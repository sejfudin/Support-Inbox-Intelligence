#!/usr/bin/env node
/**
 * Demo seeder — `npm run seed:demo`
 *
 * Wipes the transactional data in the target database and rebuilds one coherent
 * demo dataset: four hero logins, 26 interns across every profile status (plus
 * one deactivated account) with attendance history, a worked-on ticket board,
 * stand-ups in both workspaces, and a placement pipeline. See demo/dataset.js
 * for the content and demo/clock.js for the date strategy.
 *
 * DESTRUCTIVE. It deletes users, workspaces, tickets, comments, intern
 * profiles, attendance, dailies, recommendations, evaluations and refresh
 * tokens. It PRESERVES reference data (hubs, internship types, technologies,
 * positions).
 *
 * Safe to re-run: nothing uses Math.random(), all dates are working-day offsets
 * from one frozen anchor, and the _id of every user, workspace, intern profile,
 * ticket, project and attendance row is derived from a symbolic key — so two
 * runs on the same day produce the same people, rates, tickets and text, and
 * deep links survive a re-seed.
 *
 * Three things are legitimately regenerated each run and are NOT stable:
 * the bcrypt salt (so the password hash differs — the password itself does
 * not), mongoose's auto-ids on embedded subdocs (ticket messages, daily
 * entries, interviews, documentation links), and the per-workspace
 * TicketStatus ids, which come from the shared seedDefaultStatuses() service.
 * Pinning the last one would mean duplicating the canonical status list here
 * and letting it drift — not worth it.
 *
 *   npm run seed:demo -- --dry-run               inspect the target, change nothing
 *   npm run seed:demo                            interactive; type the database name
 *   npm run seed:demo -- --yes=<dbname>          non-interactive (assertion required)
 *   npm run seed:demo -- --checkin-today         also check the hero intern in today
 */

const path = require('path');
const readline = require('readline');

// Load env the way index.js does, so this hits the database `npm run dev`
// actually reads. Scripts in this directory historically loaded plain `.env`,
// which points at a DIFFERENT cluster — see server/CLAUDE.md.
//
// ENV_FILE is captured BEFORE the load on purpose: .env.development itself sets
// NODE_ENV=staging, so reading process.env.NODE_ENV afterwards would report the
// wrong filename in the confirmation banner. File selection is unaffected (it
// happens before the load), but never branch on NODE_ENV below either.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const { seedReferenceData } = require('./referenceData');
const Hub = require('../models/Hub');
const InternshipType = require('../models/InternshipType');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const Project = require('../models/Project');

const dataset = require('./demo/dataset');
const { createClock, stableId } = require('./demo/clock');
const { recommendationProblems } = require('./demo/recommendationRules');
const phaseIdentity = require('./demo/phaseIdentity');
const phaseWorkspace = require('./demo/phaseWorkspace');
const phaseTalent = require('./demo/phaseTalent');
const phaseAttendance = require('./demo/phaseAttendance');

// Child-before-parent, so a crash mid-wipe leaves parents with no dangling
// children (which renders as "empty") rather than the reverse (which renders as
// a 500 on populate). Driven by a list so adding a model wires it in one place.
const WIPE_PLAN = [
  ['Notification', {}],
  ['Comment', {}],
  ['History', {}],
  ['AISummary', {}],
  ['Attendance', {}],
  // After `Attendance`, which points at it. Missed when the model was added, and
  // the omission is invisible until you re-seed: profile ids are deterministic, so
  // surviving requests reattach to the newly-created intern and their approved days
  // are charged against a budget the fresh dataset says is untouched.
  ['AbsenceRequest', {}],
  ['Daily', {}],
  ['Ticket', {}],
  // Per-workspace ticket-number counters. Wiped with the tickets they count, or
  // a fresh dataset inherits the previous run's sequence; phaseWorkspace resets
  // each workspace's counter to its highest seeded number.
  ['Counter', {}],
  ['TicketStatus', {}],
  ['Category', {}],
  ['Integration', {}],
  ['Invitation', {}],
  ['Recommendation', {}],
  ['ReadinessFlag', {}],
  ['Evaluation', {}],
  ['MentorComment', {}],
  ['InternProfile', {}],
  ['Workspace', {}],
  ['RefreshToken', {}],
  ['User', {}],
  // Keep any system project (none exist today, but the model still supports one).
  ['Project', { isSystem: { $ne: true } }],
];

// Preserved entirely — never appear in WIPE_PLAN.
const PRESERVED = ['Hub', 'InternshipType', 'Technology', 'Position'];

// Profile statuses that put an intern on the attendance roster
// (IN_PROGRAMME_STATUSES in models/InternProfile.js).
const ROSTER_PROFILE_STATUSES = ['active', 'ready'];

// ─────────────────────────────────────────────────────────────────────────────
// argv
// ─────────────────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const options = { dryRun: false, yes: undefined, checkinToday: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--checkin-today') options.checkinToday = true;
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
║  DEMO SEED — THIS DESTROYS DATA                                  ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}

  DELETES  every user, workspace, ticket, comment, intern profile,
           attendance record, daily, recommendation, evaluation and
           refresh token in this database.
  PRESERVES hubs, internship types, technologies, and positions.

  Anyone else using "${target.db}" loses their data, and open browser
  sessions against it will break (every user id changes).
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
    console.error(`   Use:  npm run seed:demo -- --yes=${target.db}`);
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
// Reference lookups + preflight
// ─────────────────────────────────────────────────────────────────────────────

const loadReferenceData = async () => {
  const [hubs, programmes, technologies, positions] = await Promise.all([
    Hub.find().lean(),
    InternshipType.find().lean(),
    Technology.find().lean(),
    Position.find().lean(),
  ]);

  const lookup = (list, field, label) => (value) => {
    const found = list.find((item) => item[field] === value);
    if (!found) throw new Error(`${label} not found: ${value}`);
    return found;
  };

  return {
    hubByName: lookup(hubs, 'name', 'Hub'),
    programmeBySlug: lookup(programmes, 'slug', 'Internship type'),
    techBySlug: lookup(technologies, 'slug', 'Technology'),
    positionBySlug: lookup(positions, 'slug', 'Position'),
  };
};

/**
 * Resolve every symbolic reference in the dataset BEFORE anything is deleted.
 * A typo here must cost 2 seconds, not "wiped the shared dev DB, then crashed".
 */
const preflight = (ref) => {
  const problems = [];
  const check = (fn, value, label) => {
    try {
      fn(value);
    } catch {
      problems.push(`${label}: ${value}`);
    }
  };

  const userKeys = new Set(
    [...dataset.heroes, ...dataset.mentors, ...dataset.interns].map((spec) => spec.key)
  );
  const internKeys = new Set(dataset.interns.map((spec) => spec.key));
  const workspaceKeys = new Set(dataset.workspaces.map((spec) => spec.key));
  const categoryKeys = new Set(dataset.categories.map((spec) => spec.key));
  const projectKeys = new Set(dataset.projects.map((spec) => spec.key));
  const ticketKeys = new Set(dataset.tickets.map((spec) => spec.key));

  // Hero contract: the four accounts the demo is driven from must exist exactly.
  const requiredHeroes = [
    'admin@symphony.is',
    'mentor@symphony.is',
    'intern@symphony.is',
    'leadership@symphony.is',
  ];
  for (const email of requiredHeroes) {
    if (!dataset.heroes.some((hero) => hero.email === email)) {
      problems.push(`missing hero account: ${email}`);
    }
  }

  // Every user needs a unique, non-empty email.
  const emails = [...dataset.heroes, ...dataset.mentors, ...dataset.interns]
    .map((spec) => spec.email)
    .filter(Boolean);
  const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
  if (duplicateEmails.length) problems.push(`duplicate emails: ${duplicateEmails.join(', ')}`);

  for (const spec of [...dataset.heroes, ...dataset.mentors]) {
    check(ref.hubByName, spec.hub, 'staff hub');
  }

  const histogram = {};
  for (const spec of dataset.interns) {
    histogram[spec.status] = (histogram[spec.status] || 0) + 1;
    check(ref.programmeBySlug, spec.programme, `intern ${spec.key} programme`);
    check(ref.positionBySlug, spec.position, `intern ${spec.key} position`);
    if (spec.hub) check(ref.hubByName, spec.hub, `intern ${spec.key} hub`);
    (spec.technologies || []).forEach((slug) =>
      check(ref.techBySlug, slug, `intern ${spec.key} technology`)
    );
    (spec.readiness || []).forEach((flag) => {
      if (flag.technology && flag.position) {
        problems.push(`intern ${spec.key}: readiness flag sets both technology and position`);
      }
      if (!flag.technology && !flag.position) {
        problems.push(`intern ${spec.key}: readiness flag sets neither technology nor position`);
      }
      if (flag.technology) check(ref.techBySlug, flag.technology, `intern ${spec.key} readiness`);
      if (flag.position) check(ref.positionBySlug, flag.position, `intern ${spec.key} readiness`);
    });
    if (!userKeys.has(spec.mentorKey)) problems.push(`intern ${spec.key}: unknown mentorKey`);
    if (spec.attendance && !dataset.evaluationProfiles[spec.attendance.persona]) {
      problems.push(`intern ${spec.key}: unknown persona ${spec.attendance.persona}`);
    }
    if (spec.account) {
      if (!['active', 'invited', 'disabled'].includes(spec.account.status)) {
        problems.push(`intern ${spec.key}: unknown account.status ${spec.account.status}`);
      }
      // getRoster keys off PROFILE status and never checks user.active, so a
      // deactivated account on an active/ready profile would sit on the
      // attendance roster forever at 0%.
      if (spec.account.active === false && ROSTER_PROFILE_STATUSES.includes(spec.status)) {
        problems.push(
          `intern ${spec.key}: deactivated account with profile status "${spec.status}" would appear on the attendance roster with no attendance — use a terminal status`
        );
      }
      // An inactive user must not also carry attendance rows.
      if (spec.account.active === false && spec.attendance) {
        problems.push(`intern ${spec.key}: deactivated account should not generate attendance`);
      }
    }
  }

  // Pinned so a careless edit can't quietly hollow out the demo — e.g. moving
  // interns to terminal statuses and shrinking the attendance roster to four.
  const expected = { active: 10, ready: 6, placed: 5, completed: 3, discontinued: 2 };
  for (const [status, count] of Object.entries(expected)) {
    if (histogram[status] !== count) {
      problems.push(
        `intern status ${status}: expected ${count}, dataset has ${histogram[status] || 0}`
      );
    }
  }

  for (const spec of dataset.workspaces) {
    if (!userKeys.has(spec.ownerKey)) problems.push(`workspace ${spec.key}: unknown ownerKey`);
    spec.staffMembers.forEach((member) => {
      if (!userKeys.has(member.key)) {
        problems.push(`workspace ${spec.key}: unknown member ${member.key}`);
      }
    });
    if (Array.isArray(spec.internMemberKeys)) {
      spec.internMemberKeys.forEach((key) => {
        if (!internKeys.has(key)) problems.push(`workspace ${spec.key}: unknown intern ${key}`);
      });
    }
  }

  for (const spec of dataset.categories) {
    if (!workspaceKeys.has(spec.workspaceKey)) {
      problems.push(`category ${spec.key}: unknown workspaceKey`);
    }
  }

  for (const spec of dataset.projects) {
    (spec.technologies || []).forEach((slug) =>
      check(ref.techBySlug, slug, `project ${spec.key} technology`)
    );
  }

  const statusSlugs = new Set(['backlog', 'to do', 'in progress', 'on staging', 'blocked', 'done']);
  for (const spec of dataset.tickets) {
    if (!workspaceKeys.has(spec.workspaceKey)) {
      problems.push(`ticket ${spec.key}: unknown workspaceKey`);
    }
    if (!statusSlugs.has(spec.statusSlug)) {
      problems.push(`ticket ${spec.key}: unknown statusSlug ${spec.statusSlug}`);
    }
    if (!userKeys.has(spec.creatorKey)) problems.push(`ticket ${spec.key}: unknown creatorKey`);
    (spec.assigneeKeys || []).forEach((key) => {
      if (!userKeys.has(key)) problems.push(`ticket ${spec.key}: unknown assignee ${key}`);
    });
    if (spec.categoryKey && !categoryKeys.has(spec.categoryKey)) {
      problems.push(`ticket ${spec.key}: unknown categoryKey`);
    }
    // A ticket's category must live in the same workspace as the ticket —
    // Mongo won't stop it, and a mismatch breaks the board silently.
    if (spec.categoryKey) {
      const category = dataset.categories.find((item) => item.key === spec.categoryKey);
      if (category && category.workspaceKey !== spec.workspaceKey) {
        problems.push(
          `ticket ${spec.key}: category ${spec.categoryKey} belongs to workspace ${category.workspaceKey}`
        );
      }
    }
    (spec.comments || []).forEach((comment) => {
      if (!userKeys.has(comment.authorKey)) {
        problems.push(`ticket ${spec.key}: unknown comment author ${comment.authorKey}`);
      }
    });
    (spec.messages || []).forEach((message) => {
      if (message.senderKey && !userKeys.has(message.senderKey)) {
        problems.push(`ticket ${spec.key}: unknown message sender ${message.senderKey}`);
      }
    });
  }

  for (const spec of dataset.notifications) {
    if (!userKeys.has(spec.recipientKey)) {
      problems.push(`notification: unknown recipientKey ${spec.recipientKey}`);
    }
    if (!ticketKeys.has(spec.ticketKey)) {
      problems.push(`notification: unknown ticketKey ${spec.ticketKey}`);
    }
  }

  for (const spec of dataset.dailies) {
    const label = `dailies[${spec.workspaceKey}]`;
    if (!workspaceKeys.has(spec.workspaceKey)) problems.push(`${label}: unknown workspaceKey`);
    if (!userKeys.has(spec.scribeKey)) problems.push(`${label}: unknown scribeKey`);
    if (!(spec.days > 0)) problems.push(`${label}: days must be > 0`);
    if (!(spec.skipEvery > 1)) problems.push(`${label}: skipEvery must be > 1 (else nobody files)`);
    if (!(spec.blockerEvery > 0)) problems.push(`${label}: blockerEvery must be > 0`);
    ['done', 'todo', 'blockers'].forEach((pool) => {
      // Empty pools would index to undefined and write null entry text.
      if (!Array.isArray(spec[pool]) || spec[pool].length === 0) {
        problems.push(`${label}: ${pool} pool is empty`);
      }
    });
    spec.blockerTicketKeys.forEach((key) => {
      if (!ticketKeys.has(key)) problems.push(`${label}: unknown blocker ticket ${key}`);
    });
    // A blocker can only link a ticket in its OWN workspace.
    spec.blockerTicketKeys.forEach((key) => {
      const ticket = dataset.tickets.find((item) => item.key === key);
      if (ticket && ticket.workspaceKey !== spec.workspaceKey) {
        problems.push(
          `${label}: blocker ticket ${key} belongs to workspace ${ticket.workspaceKey}`
        );
      }
    });
  }

  for (const spec of dataset.recommendations) {
    if (!internKeys.has(spec.internKey)) {
      problems.push(`recommendation ${spec.key}: unknown internKey`);
    }
    if (!userKeys.has(spec.createdByKey)) {
      problems.push(`recommendation ${spec.key}: unknown createdByKey`);
    }
    check(ref.positionBySlug, spec.positionSlug, `recommendation ${spec.key} position`);
    if (spec.projectKey && !projectKeys.has(spec.projectKey)) {
      problems.push(`recommendation ${spec.key}: unknown projectKey`);
    }
    (spec.technologies || []).forEach((slug) =>
      check(ref.techBySlug, slug, `recommendation ${spec.key} technology`)
    );
    if (spec.result) {
      if (!String(spec.result.note || '').trim()) {
        problems.push(`recommendation ${spec.key}: result.outcome set without a note`);
      }
      if (!userKeys.has(spec.result.decidedByKey)) {
        problems.push(`recommendation ${spec.key}: unknown result.decidedByKey`);
      }
      if (spec.resultedWorkdaysAgo == null) {
        problems.push(`recommendation ${spec.key}: result set without resultedWorkdaysAgo`);
      }
    }
    if (spec.status === 'resulted' && !spec.result) {
      problems.push(`recommendation ${spec.key}: status "resulted" without a result`);
    }
    if (spec.status !== 'resulted' && spec.result) {
      problems.push(`recommendation ${spec.key}: result set but status is "${spec.status}"`);
    }
  }

  // Duplicate recommendation keys would collide on stableId and silently drop a
  // record (Recommendation.create would throw, but only mid-run).
  const recommendationKeys = dataset.recommendations.map((spec) => spec.key);
  const duplicateRecommendationKeys = recommendationKeys.filter(
    (key, index) => recommendationKeys.indexOf(key) !== index
  );
  if (duplicateRecommendationKeys.length) {
    problems.push(`duplicate recommendation keys: ${duplicateRecommendationKeys.join(', ')}`);
  }

  // Coverage (every intern has one), the multi-recommendation contract, and
  // recommendation-vs-profile-status coherence.
  problems.push(...recommendationProblems(dataset));

  // Deterministic _ids must not collide.
  const idKeys = [
    ...[...userKeys].map((key) => `user:${key}`),
    ...[...workspaceKeys].map((key) => `workspace:${key}`),
    ...[...ticketKeys].map((key) => `ticket:${key}`),
    ...[...projectKeys].map((key) => `project:${key}`),
    ...recommendationKeys.map((key) => `recommendation:${key}`),
  ];
  const ids = idKeys.map((key) => String(stableId(key)));
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) problems.push(`stableId collision: ${duplicateIds.join(', ')}`);

  if (problems.length) {
    console.error('\n❌ Preflight failed — nothing was deleted. Fix demo/dataset.js:\n');
    problems.forEach((problem) => console.error(`   • ${problem}`));
    console.error('');
    throw new Error(`Preflight failed with ${problems.length} problem(s).`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Wipe
// ─────────────────────────────────────────────────────────────────────────────

const runWipe = async ({ dryRun }) => {
  console.log(dryRun ? '🔍 Counting what would be deleted…\n' : '🧹 Wiping transactional data…\n');
  let total = 0;
  for (const [modelName, filter] of WIPE_PLAN) {
    const Model = require(`../models/${modelName}`);
    const count = dryRun
      ? await Model.countDocuments(filter)
      : (await Model.deleteMany(filter)).deletedCount;
    total += count;
    if (count > 0) console.log(`   ${String(count).padStart(6)}  ${modelName}`);
  }
  console.log(`   ${'─'.repeat(6)}\n   ${String(total).padStart(6)}  total\n`);
  return total;
};

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const printSummary = (ctx) => {
  const { clock, counts } = ctx;
  console.log('\n✅ Demo data seeded.\n');

  console.log('  Counts');
  Object.entries(counts).forEach(([label, count]) => {
    console.log(`   ${String(count).padStart(6)}  ${label}`);
  });

  console.log('\n  Hero logins (password: password)');
  dataset.heroes.forEach((hero) => {
    console.log(`   ${hero.email.padEnd(26)} ${hero.role.padEnd(11)} ${hero.fullname}`);
  });

  // Month-scoped, matching what the roster renders — reporting is per calendar
  // month, never cumulative, so a history-wide rate here would contradict the UI.
  console.log(`\n  Attendance roster — ${clock.anchorKey.slice(0, 7)} (anchor ${clock.anchorKey})`);
  ctx.attendanceSummary
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .forEach((row) => {
      const today =
        row.today === 'none'
          ? 'not in yet'
          : row.today === 'cancelled'
            ? 'cancelled'
            : 'checked in';
      const days = `${row.present}/${row.workingDays}`;
      console.log(
        `   ${String(row.rate).padStart(3)}%  ${days.padStart(6)}  ${row.name.padEnd(26)} ${row.persona.padEnd(11)} ${today}`
      );
    });

  console.log('\n  Notes');
  console.log('   • Every user id changed — log out and back in on any open tab.');
  console.log(
    `   • "Today" in this data is ${clock.anchorKey}. Re-run the seeder on the morning of the`
  );
  console.log(
    "     demo so the roster's current-day column is live — it is deterministic, so re-running"
  );
  console.log('     costs nothing and reproduces the same people, rates and tickets.');
  if (clock.isWeekendToday) {
    console.log(
      `   • Running on a weekend: history anchors to ${clock.anchorKey}, and no daily will be editable.`
    );
  }
  const windowShut = clock.isWeekendToday || clock.officeHourNow >= 11 || clock.officeHourNow < 7;
  if (windowShut && !ctx.options.checkinToday) {
    console.log(
      `   • ⚠️  Check-in window (07:00–11:00 Sarajevo) is closed right now (${clock.officeHourNow}:xx).`
    );
    console.log('        A live check-in as intern@symphony.is will return 422 until it reopens.');
  } else if (!ctx.options.checkinToday) {
    console.log('   • intern@symphony.is has NOT checked in today — that is the live demo moment.');
  }
  console.log('');
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

  await connectDB();

  // Last gap between "what the banner claimed" and "what we're about to delete":
  // a URI with no path resolves to `test` at the driver level.
  if (mongoose.connection.name !== target.db) {
    console.error(
      `❌ Connected to "${mongoose.connection.name}" but the banner said "${target.db}". Aborting.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // Reference data first: it is never wiped, and preflight resolves against it.
  console.log('📚 Ensuring reference data (hubs, programmes, technologies, positions)…');
  await seedReferenceData();
  const ref = await loadReferenceData();

  console.log('🔎 Preflight — resolving every reference in the dataset…');
  preflight(ref);
  console.log('   all references resolve.\n');

  if (options.dryRun) {
    await runWipe({ dryRun: true });
    console.log(`   Preserved untouched: ${PRESERVED.join(', ')}.\n`);
    await mongoose.disconnect();
    return;
  }

  await runWipe({ dryRun: false });

  const salt = await bcrypt.genSalt(10);
  const ctx = {
    options,
    clock: createClock(),
    data: dataset,
    ref,
    passwordHash: await bcrypt.hash(dataset.PASSWORD, salt),
    users: new Map(),
    profiles: new Map(),
    workspaces: new Map(),
    statuses: new Map(),
    categories: new Map(),
    tickets: new Map(),
    projects: new Map(),
    counts: {},
    attendanceSummary: [],
  };

  console.log('👤 Users, workspaces, statuses, categories, intern profiles…');
  await phaseIdentity.run(ctx);

  console.log('🎫 Projects, tickets, comments, history, notifications, dailies…');
  await phaseWorkspace.run(ctx);

  console.log('🎯 Readiness, evaluations, mentor notes, recommendations…');
  await phaseTalent.run(ctx);

  console.log('📅 Attendance history…');
  await phaseAttendance.run(ctx);

  printSummary(ctx);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`\n❌ Seed failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
