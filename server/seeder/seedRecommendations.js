#!/usr/bin/env node
/**
 * Recommendation top-up — `npm run seed:recommendations`
 *
 * ADDITIVE and IDEMPOTENT, unlike seedDemoData.js. It inserts the placement
 * pipeline from demo/dataset.js for interns who are missing it and touches
 * nothing else: no deletes, no updates to existing recommendations, no writes
 * to any other collection except the recommendation history rows it creates
 * alongside a new record. That is what makes it safe to point at a shared dev
 * database where other people (and the demo seeder) already put data.
 *
 * Every recommendation is written with the same deterministic `_id` the demo
 * seeder uses (stableId('recommendation:<key>')), so "already there" is an id
 * lookup, not a fuzzy match — re-running inserts nothing.
 *
 * People and reference data are resolved by EMAIL and SLUG rather than by
 * seeded id, so this also works on a database whose users were created through
 * the app. Anything that cannot be resolved is skipped with a warning instead
 * of aborting the run.
 *
 * Two guards on what gets written:
 *   • Dataset preflight — the shared rules in demo/recommendationRules.js must
 *     pass against the dataset itself. A failure here is a code bug; nothing is
 *     written.
 *   • Live coherence — each spec is re-checked against the intern's CURRENT
 *     profile status plus the recommendations already in the database, so a
 *     profile someone has since moved on cannot get an open recommendation that
 *     would sit in the pipeline KPI forever.
 *
 *   npm run seed:recommendations -- --dry-run          report the plan, write nothing
 *   npm run seed:recommendations                       interactive; type the database name
 *   npm run seed:recommendations -- --yes=<dbname>     non-interactive (assertion required)
 */

const path = require('path');
const readline = require('readline');

// Load env the way index.js does, so this hits the database `npm run dev`
// actually reads. Older scripts in this directory load plain `.env`, which
// points at a DIFFERENT cluster — see server/CLAUDE.md.
//
// Captured BEFORE the load: .env.development itself sets NODE_ENV=staging, so
// reading process.env.NODE_ENV afterwards would name the wrong file in the
// banner. Never branch on NODE_ENV below either.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const { slugify } = require('../helpers/slugify');
const User = require('../models/User');
const InternProfile = require('../models/InternProfile');
const Recommendation = require('../models/Recommendation');
const Position = require('../models/Position');
const Technology = require('../models/Technology');
const Project = require('../models/Project');
const History = require('../models/History');

const dataset = require('./demo/dataset');
const { createClock } = require('./demo/clock');
const {
  recommendationId,
  buildRecommendationDoc,
  buildStatusHistory,
} = require('./demo/recommendationDocs');
const { recommendationProblems, coherenceProblems } = require('./demo/recommendationRules');

// ─────────────────────────────────────────────────────────────────────────────
// argv
// ─────────────────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const options = { dryRun: false, yes: undefined };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('--yes=')) options.yes = arg.slice('--yes='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
};

// ─────────────────────────────────────────────────────────────────────────────
// Target + confirmation
// ─────────────────────────────────────────────────────────────────────────────

const describeTarget = (uri) => {
  let host = '(unparseable)';
  let db = '(unparseable)';
  try {
    const parsed = new URL(uri);
    host = parsed.hostname;
    // No path in the URI means the driver falls back to the `test` database.
    db = parsed.pathname.replace(/^\//, '') || 'test';
  } catch {
    /* leave the placeholders — the banner will show them */
  }
  return { host, db, isLocal: ['localhost', '127.0.0.1', '::1'].includes(host) };
};

const printBanner = (target) => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  RECOMMENDATION TOP-UP — additive, nothing is deleted            ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}

  INSERTS  recommendations from seeder/demo/dataset.js that are not in this
           database yet, plus their status-history rows.
  LEAVES   every existing recommendation, user, intern profile and project
           exactly as it is. Re-running inserts nothing.
`);
};

const confirm = async (target, options) => {
  printBanner(target);

  if (/prod|production|_live/i.test(target.db)) {
    console.error(`❌ Refusing: database name "${target.db}" looks like a non-development target.`);
    process.exit(1);
  }

  if (options.yes === true) {
    if (!target.isLocal) {
      console.error('❌ Bare --yes is only allowed against localhost.');
      console.error(`   For a remote target, assert the name:  --yes=${target.db}`);
      process.exit(1);
    }
    console.log('  --yes: skipping prompt (local target).\n');
    return;
  }

  if (typeof options.yes === 'string') {
    if (options.yes !== target.db) {
      console.error(`❌ --yes=${options.yes} does not match target database "${target.db}".`);
      process.exit(1);
    }
    console.log(`  --yes=${target.db}: assertion matched, skipping prompt.\n`);
    return;
  }

  if (!process.stdin.isTTY) {
    console.error('❌ Not a TTY and no --yes given — refusing to prompt into the void.');
    console.error(`   Use:  npm run seed:recommendations -- --yes=${target.db}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(
      `  To proceed, type the database name exactly:  ${target.db}\n  (anything else cancels)\n\n> `,
      (value) => {
        rl.close();
        resolve(value.trim());
      }
    );
  });

  if (answer !== target.db) {
    console.log('\n❌ Cancelled. Nothing was changed.\n');
    process.exit(0);
  }
  console.log('');
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolution — email and slug, never a seeded id
// ─────────────────────────────────────────────────────────────────────────────

// Every dataset person, keyed the way the recommendation specs refer to them.
// The hero intern's User lives in `heroes`, not `interns`, so both are folded in.
const emailByUserKey = () => {
  const map = new Map();
  [...dataset.heroes, ...dataset.mentors, ...dataset.interns].forEach((spec) => {
    if (spec.email) map.set(spec.key, spec.email);
  });
  return map;
};

const loadLookups = async () => {
  const emails = emailByUserKey();

  const [users, positions, technologies, projects] = await Promise.all([
    User.find({ email: { $in: [...emails.values()] } })
      .select('_id email fullname')
      .lean(),
    Position.find().select('_id slug').lean(),
    Technology.find().select('_id slug').lean(),
    Project.find().select('_id slug name').lean(),
  ]);

  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const profiles = await InternProfile.find({ user: { $in: users.map((user) => user._id) } })
    .select('_id user status')
    .lean();
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.user), profile]));

  const positionBySlug = new Map(positions.map((item) => [item.slug, item]));
  const techBySlug = new Map(technologies.map((item) => [item.slug, item]));
  // Demo projects are stored with slugify(name) as their slug (see
  // demo/phaseWorkspace.js), so the dataset's project key maps through the name.
  const projectBySlug = new Map(projects.map((item) => [item.slug, item]));
  const projectByDatasetKey = new Map(
    dataset.projects
      .map((spec) => [spec.key, projectBySlug.get(slugify(spec.name))])
      .filter(([, project]) => Boolean(project))
  );

  const userForKey = (key) => userByEmail.get(emails.get(key));
  const profileForInternKey = (key) => {
    const user = userForKey(key);
    return user ? profileByUserId.get(String(user._id)) : undefined;
  };

  return {
    userForKey,
    profileForInternKey,
    positionBySlug,
    techBySlug,
    projectByDatasetKey,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Planning
// ─────────────────────────────────────────────────────────────────────────────

/** Why a spec is not being inserted, or null when it is good to go. */
const resolveSpec = (spec, lookups) => {
  const profile = lookups.profileForInternKey(spec.internKey);
  if (!profile) return { skip: `intern ${spec.internKey} has no intern profile in this database` };

  const author = lookups.userForKey(spec.createdByKey);
  if (!author) return { skip: `author ${spec.createdByKey} is not a user in this database` };

  const decidedBy = spec.result ? lookups.userForKey(spec.result.decidedByKey) : undefined;
  if (spec.result && !decidedBy) {
    return { skip: `result.decidedBy ${spec.result.decidedByKey} is not a user in this database` };
  }

  const position = lookups.positionBySlug.get(spec.positionSlug);
  if (!position) return { skip: `position "${spec.positionSlug}" is missing` };

  const projectId = spec.projectKey ? lookups.projectByDatasetKey.get(spec.projectKey)?._id : null;
  if (spec.projectKey && !projectId) return { skip: `project "${spec.projectKey}" is missing` };

  const technologyIds = [];
  for (const slug of spec.technologies || []) {
    const technology = lookups.techBySlug.get(slug);
    if (!technology) return { skip: `technology "${slug}" is missing` };
    technologyIds.push(technology._id);
  }

  return {
    profile,
    author,
    refs: {
      internProfileId: profile._id,
      authorId: author._id,
      positionId: position._id,
      projectId,
      technologyIds,
      decidedById: decidedBy?._id,
    },
  };
};

/**
 * Existing recommendations reduced to the shape recommendationRules works on,
 * so the live check counts what is already in the database (an intern's
 * `placed` record, say) and not just the incoming specs.
 */
const asRuleSpec = (doc) => ({
  key: `existing:${doc._id}`,
  status: doc.status,
  result: doc.result?.outcome ? { outcome: doc.result.outcome } : undefined,
});

const buildPlan = async (lookups) => {
  const existing = await Recommendation.find().select('_id internProfile status result').lean();
  const existingIds = new Set(existing.map((doc) => String(doc._id)));
  const existingByProfile = new Map();
  existing.forEach((doc) => {
    const key = String(doc.internProfile);
    if (!existingByProfile.has(key)) existingByProfile.set(key, []);
    existingByProfile.get(key).push(doc);
  });

  const plan = { insert: [], present: [], skipped: [], warnings: [] };

  // Group the candidates per intern first: the live coherence check needs the
  // whole picture (existing + incoming) to judge, e.g., "exactly one placed".
  const candidatesByIntern = new Map();
  for (const spec of dataset.recommendations) {
    if (existingIds.has(String(recommendationId(spec)))) {
      plan.present.push(spec.key);
      continue;
    }
    const resolved = resolveSpec(spec, lookups);
    if (resolved.skip) {
      plan.skipped.push(`${spec.key}: ${resolved.skip}`);
      continue;
    }
    if (!candidatesByIntern.has(spec.internKey)) candidatesByIntern.set(spec.internKey, []);
    candidatesByIntern.get(spec.internKey).push({ spec, resolved });
  }

  for (const [internKey, candidates] of candidatesByIntern) {
    const profile = candidates[0].resolved.profile;
    const combined = [
      ...(existingByProfile.get(String(profile._id)) || []).map(asRuleSpec),
      ...candidates.map((candidate) => candidate.spec),
    ];
    const problems = coherenceProblems(internKey, profile.status, combined);

    for (const candidate of candidates) {
      // Only a problem naming this spec blocks it. Pre-existing incoherence in
      // the database (someone moved a profile by hand) is reported, not a reason
      // to withhold the rest of the pipeline.
      const blocking = problems.filter((problem) => problem.includes(candidate.spec.key));
      if (blocking.length) {
        blocking.forEach((problem) => plan.skipped.push(problem));
      } else {
        plan.insert.push(candidate);
      }
    }

    problems
      .filter((problem) => !candidates.some((candidate) => problem.includes(candidate.spec.key)))
      .forEach((problem) => plan.warnings.push(problem));
  }

  return plan;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

const applyPlan = async (plan, clock) => {
  const clockNote = [];
  let historyCount = 0;

  for (const { spec, resolved } of plan.insert) {
    const { doc, statusDates } = buildRecommendationDoc(spec, clock, resolved.refs);
    // create() (not an upsert) so a concurrent run surfaces as a duplicate-key
    // error rather than silently rewriting someone else's record.
    const recommendation = await Recommendation.create(doc);

    // History rows carry no deterministic id, so guard on the entity instead —
    // a record inserted by an earlier partial run keeps exactly one timeline.
    const existingHistory = await History.countDocuments({
      entityType: 'recommendation',
      entityId: recommendation._id,
    });
    if (existingHistory === 0) {
      const rows = buildStatusHistory(spec, recommendation._id, statusDates, resolved.author);
      if (rows.length) {
        await History.insertMany(rows);
        historyCount += rows.length;
      }
    } else {
      clockNote.push(`${spec.key}: kept ${existingHistory} existing history row(s)`);
    }
  }

  return { historyCount, notes: clockNote };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

const printCoverage = async () => {
  const profiles = await InternProfile.find()
    .populate('user', 'fullname')
    .select('user status')
    .lean();
  const counts = await Recommendation.aggregate([
    { $group: { _id: '$internProfile', count: { $sum: 1 } } },
  ]);
  const countByProfile = new Map(counts.map((row) => [String(row._id), row.count]));

  const rows = profiles.map((profile) => ({
    name: profile.user?.fullname || '(no user)',
    status: profile.status,
    count: countByProfile.get(String(profile._id)) || 0,
  }));

  console.log('\n  Coverage — recommendations per intern');
  rows
    .slice()
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .forEach((row) => {
      console.log(`   ${String(row.count).padStart(3)}  ${row.status.padEnd(13)} ${row.name}`);
    });

  const empty = rows.filter((row) => row.count === 0);
  console.log(
    empty.length
      ? `\n  ⚠️  ${empty.length} intern(s) still have none: ${empty.map((row) => row.name).join(', ')}`
      : '\n  ✅ Every intern profile has at least one recommendation.'
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error(`❌ MONGODB_URI is not set. Expected it in server/${ENV_FILE}.`);
    process.exit(1);
  }

  const target = describeTarget(process.env.MONGODB_URI);
  if (options.dryRun) {
    printBanner(target);
    console.log('  --dry-run: nothing will be written.\n');
  } else {
    await confirm(target, options);
  }

  // The dataset itself has to be sound before we look at the database — a
  // failure here is a bug in demo/dataset.js, not a state problem.
  const datasetProblems = recommendationProblems(dataset);
  if (datasetProblems.length) {
    console.error('\n❌ Dataset preflight failed — nothing was written. Fix demo/dataset.js:\n');
    datasetProblems.forEach((problem) => console.error(`   • ${problem}`));
    console.error('');
    process.exitCode = 1;
    return;
  }
  console.log('🔎 Dataset preflight: recommendation coverage and status rules hold.\n');

  await connectDB();

  // A URI with no path resolves to `test` at the driver level — close the gap
  // between what the banner claimed and what we are about to write to.
  if (mongoose.connection.name !== target.db) {
    console.error(
      `❌ Connected to "${mongoose.connection.name}" but the banner said "${target.db}". Aborting.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const lookups = await loadLookups();
  const plan = await buildPlan(lookups);

  console.log(`   ${String(plan.present.length).padStart(4)}  already present (left untouched)`);
  console.log(`   ${String(plan.insert.length).padStart(4)}  to insert`);
  console.log(`   ${String(plan.skipped.length).padStart(4)}  skipped\n`);

  if (plan.insert.length) {
    console.log('  Inserting');
    plan.insert.forEach(({ spec }) =>
      console.log(`   + ${spec.key.padEnd(24)} ${spec.internKey} — ${spec.status}`)
    );
  }
  if (plan.skipped.length) {
    console.log('\n  Skipped');
    plan.skipped.forEach((reason) => console.log(`   - ${reason}`));
  }
  if (plan.warnings.length) {
    console.log('\n  Pre-existing data worth a look (not caused by this run)');
    plan.warnings.forEach((warning) => console.log(`   ! ${warning}`));
  }

  if (options.dryRun) {
    console.log('\n  --dry-run: nothing was written.\n');
    await mongoose.disconnect();
    return;
  }

  const { historyCount, notes } = await applyPlan(plan, createClock());
  console.log(
    `\n✅ Inserted ${plan.insert.length} recommendation(s) and ${historyCount} history row(s).`
  );
  notes.forEach((note) => console.log(`   ${note}`));

  await printCoverage();
  console.log('');

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`\n❌ Recommendation top-up failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
