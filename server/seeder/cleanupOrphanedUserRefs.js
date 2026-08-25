#!/usr/bin/env node
/**
 * Orphaned user-reference cleanup — `npm run cleanup:orphaned-user-refs`
 *
 * WHY THIS EXISTS
 *
 * There is no in-app "delete user" path (see `.claude/docs/security.md`), so the
 * only way a User leaves the database is somebody deleting the document by hand.
 * Nothing cascades when that happens. Every record that pointed at that user
 * survives holding an id that resolves to nothing: the InternProfile above all,
 * and with it the recommendations, evaluations, attendance and absence requests
 * hanging off that profile.
 *
 * On screen those became rows reading "Unknown" — a person who does not exist,
 * counted in the totals beside them. `helpers/orphanedProfiles.js` is the
 * read-side defence that stops them rendering; this script removes the records
 * themselves, which is the only thing that also repairs the raw counts.
 *
 * WHAT IT DOES
 *
 * REPORTS every dangling `ref: 'User'` in every model, discovered by walking the
 * Mongoose schemas — so a ref added later shows up here without editing this file.
 *
 * DELETES only records with no subject left: an InternProfile whose user is gone,
 * everything keyed to such a profile, and the per-user rows (sessions, notifications,
 * AI summaries, invitations) that mean nothing without their owner.
 *
 * LEAVES, and only reports, dangling refs in *authorship* and *membership* fields —
 * `updatedBy`, `evaluator`, `author`, `decidedBy`, `Ticket.assignedTo`, workspace
 * members, ticket message senders. Those records still describe something that
 * really happened; losing them would erase history rather than repair it. Pass
 * `--prune-refs` to also clear those individual fields (unset scalars, $pull from
 * arrays of ids) while keeping the records. A ref inside a sub-document array, and
 * any required field, is reported and skipped instead — see `prunePlainRefs`.
 *
 * Dry-run is the default. Nothing is written without `--apply`.
 *
 *   npm run cleanup:orphaned-user-refs                        report only (default)
 *   npm run cleanup:orphaned-user-refs -- --apply             interactive; type the database name
 *   npm run cleanup:orphaned-user-refs -- --apply --yes=<db>  non-interactive (assertion required)
 *   npm run cleanup:orphaned-user-refs -- --apply --prune-refs   also clear authorship/membership refs
 *
 * Unlike the seeders, this one does NOT refuse a production-looking database
 * name: repairing production is the reason it exists. The guard is that writing
 * always needs the database name asserted out loud.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load env the way index.js does, so this hits the database `npm run dev` reads.
// Captured BEFORE the load: .env.development itself sets NODE_ENV, so reading
// process.env.NODE_ENV afterwards would name the wrong file in the banner.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Every model, loaded by directory listing rather than by name: the schema walk
// below is only exhaustive if nothing is missing from the registry.
fs.readdirSync(path.join(__dirname, '..', 'models'))
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => require(path.join(__dirname, '..', 'models', file)));

const User = mongoose.model('User');
const InternProfile = mongoose.model('InternProfile');

/**
 * The model, or null when this branch does not have it. The tables below name
 * models by string so the cascade is readable in one glance, but not every
 * branch carries every model — `master` has no Attendance or AbsenceRequest —
 * and `mongoose.model()` throws on an unregistered name. Skipping what is not
 * there beats maintaining a per-branch copy of this script.
 */
const modelIfPresent = (name) =>
  mongoose.modelNames().includes(name) ? mongoose.model(name) : null;

/**
 * Records keyed to an InternProfile. When the profile goes, these go with it —
 * each one describes that intern and nothing else, and a recommendation or an
 * attendance row pointing at a profile that no longer exists is the same ghost
 * one step removed.
 */
const PROFILE_DEPENDENTS = [
  ['Recommendation', 'internProfile'],
  ['Evaluation', 'internProfile'],
  ['MentorComment', 'internProfile'],
  ['ReadinessFlag', 'internProfile'],
  ['Attendance', 'intern'],
  ['AbsenceRequest', 'intern'],
];

/**
 * Per-user rows that mean nothing once their owner is gone: a refresh token
 * nobody can present, a notification with no one to read it, a cached AI summary
 * of a deleted profile, an invitation to an account that no longer exists.
 */
const USER_OWNED = [
  ['RefreshToken', 'user'],
  ['Notification', 'recipient'],
  ['AISummary', 'user'],
  ['Invitation', 'user'],
];

/**
 * Whether a finding is one the deletion plan deliberately leaves alone — an
 * authorship or membership ref, as opposed to `InternProfile.user` (the profile
 * itself goes) or a `USER_OWNED` row (the whole record goes). The banner, the
 * prune step and the post-prune recheck all have to agree on this, so they ask
 * here rather than each restating it.
 */
const isAuthorshipRef = ({ modelName, refPath }) =>
  !(modelName === 'InternProfile' && refPath === 'user') &&
  !USER_OWNED.some(([name, field]) => name === modelName && field === refPath);

const parseArgs = (argv) => {
  const options = { apply: false, pruneRefs: false, yes: undefined };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--prune-refs') options.pruneRefs = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('--yes=')) options.yes = arg.slice('--yes='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
};

const describeTarget = () => {
  const uri = process.env.MONGODB_URI || '';
  let host = '(unparseable URI)';
  let db = '(unknown)';
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

/**
 * Every schema path on `Model` that is a `ref: 'User'` — scalar, array of ids,
 * or buried in a sub-document. Recurses, because `eachPath` reports an embedded
 * document or a document array as a single node and never yields the paths
 * inside it: without the descent, `Workspace.members[].user`,
 * `Ticket.messages[].sender` and `Ticket.reviewRequest.reviewer` are all invisible
 * and the script reports "no dangling refs" while they dangle.
 *
 * Each entry carries what the prune step needs to decide, resolved here where the
 * SchemaType is in hand: `Model.schema.path()` does not resolve a dotted
 * sub-document path, so a lookup after the fact reads `undefined` and silently
 * loses the `required` flag.
 *
 * - `isArray`    — the field itself holds a list of ids (`$pull`, not `$unset`).
 * - `inDocArray` — the field sits inside a document array, so its dotted path is
 *                  not directly writable; the prune step skips these.
 * - `isRequired` — clearing it would leave the record invalid.
 */
const userRefPaths = (schema, prefix = '') => {
  const paths = [];

  schema.eachPath((pathName, type) => {
    const fullPath = prefix ? `${prefix}.${pathName}` : pathName;

    // Embedded document (`instance === 'Embedded'`) or document array
    // (`instance === 'Array'` with a schema) — descend.
    if (type.schema) {
      const isDocArray = type.instance === 'Array';
      paths.push(
        ...userRefPaths(type.schema, fullPath).map((entry) => ({
          ...entry,
          inDocArray: entry.inDocArray || isDocArray,
        }))
      );
      return;
    }

    // `[{ type: ObjectId, ref: 'User' }]` declares its ref on the array's
    // element options. Mongoose leaves `caster.options` empty for that form, so
    // read the declared type as well — checking only the caster misses it.
    const elementOptions = Array.isArray(type.options?.type) ? type.options.type[0] : null;
    const isScalarRef = type.options?.ref === 'User';
    const isArrayRef = type.caster?.options?.ref === 'User' || elementOptions?.ref === 'User';

    if (isScalarRef || isArrayRef) {
      paths.push({
        path: fullPath,
        isArray: Boolean(isArrayRef),
        inDocArray: false,
        isRequired: Boolean(type.isRequired),
      });
    }
  });

  return paths;
};

/**
 * Read a possibly-dotted path out of a lean document. Walking through an array
 * — `members.user` over `members: [...]` — collects the key from every element,
 * which is how a ref inside a document array is read at all.
 */
const readPath = (doc, pathName) =>
  pathName.split('.').reduce((value, key) => {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.flatMap((entry) => (entry == null ? [] : [entry[key]]));
    }
    return value[key];
  }, doc);

/**
 * Every dangling `ref: 'User'` in the database, grouped by model and path.
 * `liveUserIds` is passed in as a Set of strings — one read of the users
 * collection serves the whole scan.
 */
const scanDanglingUserRefs = async (liveUserIds) => {
  const findings = [];

  for (const modelName of mongoose.modelNames()) {
    const Model = mongoose.model(modelName);
    for (const { path: refPath, isArray, inDocArray, isRequired } of userRefPaths(Model.schema)) {
      const docs = await Model.find({ [refPath]: { $ne: null } })
        .select(refPath)
        .lean();

      const dangling = [];
      for (const doc of docs) {
        const value = readPath(doc, refPath);
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (!id) continue;
          const userId = String(id?._id ?? id);
          if (!liveUserIds.has(userId)) dangling.push({ docId: String(doc._id), userId });
        }
      }

      if (dangling.length)
        findings.push({ modelName, refPath, isArray, inDocArray, isRequired, dangling });
    }
  }

  return findings;
};

const printFindings = (findings) => {
  if (findings.length === 0) {
    console.log('  No dangling user references anywhere. Nothing to do.\n');
    return;
  }

  console.log('  Dangling user references found:\n');
  for (const { modelName, refPath, dangling } of findings) {
    const missing = [...new Set(dangling.map((entry) => entry.userId))];
    console.log(`    ${modelName}.${refPath}  —  ${dangling.length} record(s)`);
    console.log(`        missing user id(s): ${missing.join(', ')}`);
  }
  console.log('');
};

/**
 * What `--apply` would remove, resolved up front so the banner can be honest
 * about the blast radius before anything is written.
 */
const buildDeletionPlan = async (liveUserIds) => {
  const allProfiles = await InternProfile.find({}).select('_id user').lean();
  const orphanProfiles = allProfiles.filter(
    (profile) => !profile.user || !liveUserIds.has(String(profile.user))
  );
  const orphanProfileIds = orphanProfiles.map((profile) => profile._id);

  const plan = { orphanProfiles, orphanProfileIds, dependents: [], userOwned: [] };

  for (const [modelName, field] of PROFILE_DEPENDENTS) {
    if (orphanProfileIds.length === 0) continue;
    const Model = modelIfPresent(modelName);
    if (!Model) continue;
    const count = await Model.countDocuments({ [field]: { $in: orphanProfileIds } });
    if (count) plan.dependents.push({ modelName, field, count });
  }

  for (const [modelName, field] of USER_OWNED) {
    const Model = modelIfPresent(modelName);
    if (!Model) continue;
    const docs = await Model.find({}).select(field).lean();
    const ids = docs
      .filter((doc) => {
        const value = readPath(doc, field);
        return value && !liveUserIds.has(String(value));
      })
      .map((doc) => doc._id);
    if (ids.length) plan.userOwned.push({ modelName, field, ids });
  }

  return plan;
};

const printBanner = (target, plan, findings, options) => {
  const totalDeletes =
    plan.orphanProfileIds.length +
    plan.dependents.reduce((sum, row) => sum + row.count, 0) +
    plan.userOwned.reduce((sum, row) => sum + row.ids.length, 0);

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ORPHANED USER-REFERENCE CLEANUP                                 ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}
  mode     : ${options.apply ? '⚠️  APPLY — records will be deleted' : 'DRY RUN — nothing will be written'}
`);

  printFindings(findings);

  console.log(`  Deletion plan (${totalDeletes} record(s)):\n`);
  if (totalDeletes === 0) {
    console.log('    nothing to delete.\n');
  } else {
    if (plan.orphanProfileIds.length) {
      console.log(`    InternProfile                    ${plan.orphanProfileIds.length}`);
      plan.orphanProfiles.forEach((profile) =>
        console.log(`        profile ${profile._id} → missing user ${profile.user ?? 'none'}`)
      );
    }
    plan.dependents.forEach(({ modelName, field, count }) =>
      console.log(`    ${modelName.padEnd(32)} ${count}   (via ${field} of a deleted profile)`)
    );
    plan.userOwned.forEach(({ modelName, field, ids }) =>
      console.log(`    ${modelName.padEnd(32)} ${ids.length}   (via ${field})`)
    );
    console.log('');
  }

  const authorship = findings.filter(isAuthorshipRef);
  if (authorship.length) {
    console.log(
      options.pruneRefs
        ? '  --prune-refs: authorship/membership refs above will also be cleared.\n'
        : '  Authorship/membership refs above are KEPT (records describe real events).\n' +
            '  Re-run with --prune-refs to clear those individual fields too — note it\n' +
            '  skips REQUIRED fields (Workspace.owner, Ticket.creator, InternProfile.\n' +
            '  primaryMentor) and refs inside sub-document arrays (Workspace.members[].user,\n' +
            '  Ticket.messages[].sender), which have to be fixed in the app instead.\n'
    );
  }
};

const confirm = async (target, options) => {
  // No bare `--yes`, local or not. The whole guard on this script is that a write
  // names its own target out loud — it is the only check standing in for the
  // production-name refusal the seeders have and this one deliberately does not.
  // A localhost exemption is how the habit of typing `--yes` gets built, and the
  // habit is what eventually meets a remote URI.
  if (options.yes === true) {
    console.error('❌ Bare --yes is not accepted. Assert the database name:');
    console.error(`   npm run cleanup:orphaned-user-refs -- --apply --yes=${target.db}`);
    process.exit(1);
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
    console.error(`   Use:  npm run cleanup:orphaned-user-refs -- --apply --yes=${target.db}`);
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
    console.log('\n  Cancelled. Nothing was written.\n');
    process.exit(0);
  }
  console.log('');
};

const applyPlan = async (plan) => {
  let deleted = 0;

  // Dependents first: if the run dies halfway, what is left is a profile whose
  // children are gone — which this script cleans up on the next run — rather
  // than children pointing at a profile that no longer exists.
  for (const { modelName, field } of plan.dependents) {
    const result = await mongoose
      .model(modelName)
      .deleteMany({ [field]: { $in: plan.orphanProfileIds } });
    console.log(`  🧹 ${modelName}: deleted ${result.deletedCount}`);
    deleted += result.deletedCount;
  }

  if (plan.orphanProfileIds.length) {
    const result = await InternProfile.deleteMany({ _id: { $in: plan.orphanProfileIds } });
    console.log(`  🧹 InternProfile: deleted ${result.deletedCount}`);
    deleted += result.deletedCount;
  }

  for (const { modelName, ids } of plan.userOwned) {
    const result = await mongoose.model(modelName).deleteMany({ _id: { $in: ids } });
    console.log(`  🧹 ${modelName}: deleted ${result.deletedCount}`);
    deleted += result.deletedCount;
  }

  return deleted;
};

/**
 * Clear dangling refs in fields the deletion plan deliberately leaves alone:
 * `$unset` for a scalar, `$pull` for an array element. The record survives; only
 * the pointer to a user that no longer exists goes.
 */
const prunePlainRefs = async (findings, liveUserIds) => {
  let touched = 0;
  const skipped = [];

  for (const finding of findings) {
    // Already handled by the deletion plan — the whole record is going.
    if (!isAuthorshipRef(finding)) continue;

    const { modelName, refPath, isArray, inDocArray, isRequired, dangling } = finding;
    const Model = mongoose.model(modelName);

    // A ref inside a document array — `Workspace.members[].user`,
    // `Ticket.messages[].sender`. The dotted path is not writable: `$unset` on
    // it errors, and the only single-operator alternative is `$pull`ing the
    // whole element, which deletes a membership or a message rather than
    // repairing it. Removing history is exactly what this script refuses to do.
    if (inDocArray) {
      console.log(
        `  ⏭️  ${modelName}.${refPath}: ${dangling.length} record(s) SKIPPED — ref sits inside a ` +
          'sub-document array; clearing it would delete the whole entry.'
      );
      skipped.push({
        modelName,
        refPath,
        count: dangling.length,
        reason: 'inside a sub-document array',
      });
      continue;
    }

    // A required scalar cannot be cleared without corrupting the record.
    // `updateMany` does not run validators, so the $unset would silently
    // succeed and leave a Workspace with no owner or a Ticket with no creator —
    // a worse state than the dangling id it was meant to repair. Reassigning
    // those is a decision for a person, not for this script.
    if (!isArray && isRequired) {
      console.log(
        `  ⏭️  ${modelName}.${refPath}: ${dangling.length} record(s) SKIPPED — field is required, ` +
          'reassign it in the app instead.'
      );
      skipped.push({ modelName, refPath, count: dangling.length, reason: 'field is required' });
      continue;
    }

    const missingIds = [...new Set(dangling.map((entry) => entry.userId))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const result = isArray
      ? await Model.updateMany(
          { [refPath]: { $in: missingIds } },
          { $pull: { [refPath]: { $in: missingIds } } }
        )
      : await Model.updateMany({ [refPath]: { $in: missingIds } }, { $unset: { [refPath]: '' } });

    console.log(`  ✂️  ${modelName}.${refPath}: cleared on ${result.modifiedCount} record(s)`);
    touched += result.modifiedCount;
  }

  // Guard against a required-field schema rejecting the unset silently.
  const recheck = await scanDanglingUserRefs(liveUserIds);
  const stillDangling = recheck.filter(isAuthorshipRef);
  const unexpected = stillDangling.filter(
    ({ modelName, refPath }) =>
      !skipped.some((entry) => entry.modelName === modelName && entry.refPath === refPath)
  );
  if (unexpected.length) {
    console.log('\n  ⚠️  Still dangling after prune, and not deliberately skipped:');
    unexpected.forEach(({ modelName, refPath, dangling }) =>
      console.log(`      ${modelName}.${refPath} — ${dangling.length}`)
    );
  }
  if (skipped.length) {
    console.log('\n  Left alone deliberately (fix these in the app):');
    skipped.forEach(({ modelName, refPath, count, reason }) =>
      console.log(`      ${modelName}.${refPath} — ${count}   (${reason})`)
    );
  }

  return touched;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const target = describeTarget();

  await connectDB();

  const liveUsers = await User.find({}).select('_id').lean();
  const liveUserIds = new Set(liveUsers.map((user) => String(user._id)));

  const findings = await scanDanglingUserRefs(liveUserIds);
  const plan = await buildDeletionPlan(liveUserIds);

  console.log(`\n  Users currently in the database: ${liveUserIds.size}`);
  printBanner(target, plan, findings, options);

  const hasWork =
    plan.orphanProfileIds.length > 0 ||
    plan.dependents.length > 0 ||
    plan.userOwned.length > 0 ||
    (options.pruneRefs && findings.length > 0);

  if (!options.apply) {
    console.log('  DRY RUN: nothing was written. Re-run with --apply to delete.\n');
    await mongoose.connection.close();
    return;
  }

  if (!hasWork) {
    console.log('  ✅ Nothing to delete.\n');
    await mongoose.connection.close();
    return;
  }

  await confirm(target, options);

  const deleted = await applyPlan(plan);
  const pruned = options.pruneRefs ? await prunePlainRefs(findings, liveUserIds) : 0;

  console.log(
    `\n  ✅ Done. Deleted ${deleted} record(s)${
      options.pruneRefs ? `, cleared refs on ${pruned}` : ''
    }.\n`
  );

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
