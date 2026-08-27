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
 * counted in the totals beside them. `helpers/orphanedProfiles.js` and
 * `repository/liveUserFilter.js` are the read-side defence that stops them
 * rendering; this script removes the records themselves, which is the only thing
 * that also repairs the raw counts.
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
 * PREFER `npm run migrate:tombstone-user-refs` for that second half. Clearing an
 * authorship ref is the weaker repair: it cannot touch a required field at all
 * (`Ticket.creator`, `Workspace.owner`), it drops the fact that a ticket was ever
 * assigned, and on a ref inside a document array it can only `$pull` the whole
 * membership. The repoint migration points all of those at a tombstone user
 * instead, which keeps the record valid and readable. `--prune-refs` stays for
 * the case where an optional ref should genuinely read as empty.
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

// The scan, and the line between "this record's subject is gone" and "this
// record describes something that happened", are shared with
// `repointOrphanedUserRefs.js` — see `lib/userRefScan.js` for why they live
// there rather than in either script.
const {
  modelIfPresent,
  PROFILE_DEPENDENTS,
  USER_OWNED,
  isAuthorshipRef,
  readPath,
  scanDanglingUserRefs,
  missingIdsOf,
} = require('./lib/userRefScan');
const { describeTarget, confirmDatabaseName } = require('./lib/targetDatabase');

const COMMAND = 'cleanup:orphaned-user-refs';

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
            '  Run  npm run migrate:tombstone-user-refs  to repair them — it points each\n' +
            '  one at a "Deleted user" tombstone, which works on REQUIRED fields\n' +
            '  (Workspace.owner, Ticket.creator, InternProfile.primaryMentor) and on refs\n' +
            '  inside sub-document arrays (Workspace.members[].user) that --prune-refs has\n' +
            '  to skip. Use --prune-refs only where an optional ref should read as empty.\n'
    );
  }
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

    const missingIds = missingIdsOf({ dangling }).map((id) => new mongoose.Types.ObjectId(id));

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

  await confirmDatabaseName(target, options, COMMAND);

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
