#!/usr/bin/env node
/**
 * Point refs left behind by a deleted user at a tombstone — `npm run migrate:tombstone-user-refs`
 *
 * WHY THIS EXISTS
 *
 * There is no in-app "delete user" path, so a User only leaves the database by
 * hand, and nothing cascades. Every record that pointed at that account keeps an
 * id resolving to nothing. `populate` returns `null`, the read path falls back to
 * the literal "Unknown", and a person who does not exist renders on screen.
 *
 * `cleanupOrphanedUserRefs.js` is the other half of this. It deletes what the
 * departed user *owned* — their profile, their sessions, their notifications —
 * and it can clear an optional field with `--prune-refs`. What it cannot do is
 * repair the refs that actually produce the visible "Unknown":
 *
 *   Ticket.creator            required: true   → `$unset` leaves an invalid ticket
 *   Workspace.owner           required: true   → `$unset` leaves a workspace with no owner
 *   Invitation.invitedBy      required: true
 *   InternProfile.primaryMentor  required: true
 *   Workspace.members[].user   in a document array → the only one-operator
 *                              alternative is `$pull`, which deletes the
 *                              membership instead of repairing it
 *
 * `updateMany` does not run validators, so those `$unset`s would succeed silently
 * and leave documents the app can never save again — a worse state than the
 * dangling id. Deleting the records instead is not available either: a ticket
 * belongs to its workspace and everyone still talking in it, not to whoever typed
 * it first.
 *
 * So this script does the third thing. It gives the ref a subject that really
 * exists: one tombstone User, `fullname: "Deleted user"`, `isTombstone: true`,
 * with no password and `active: false` so it cannot log in, and excluded from
 * every listing a human picks from (`constants/userVisibility.js`).
 *
 * `required` stays satisfied. `populate` resolves. No `|| 'Unknown'` fallback
 * fires, because nothing is missing any more. The audit trail keeps saying the
 * ticket was created by somebody, which is true.
 *
 * WHAT IT REPOINTS
 *
 * Every dangling ref that describes something a user DID or somewhere they
 * BELONGED — the same line `lib/userRefScan.js` draws for the cleanup script,
 * read from the other side. A ref whose whole subject is the departed user
 * (`InternProfile.user`, and the per-user rows in `USER_OWNED`) is reported and
 * refused: an InternProfile owned by "Deleted user" is a ghost intern, which is
 * the bug rather than the fix. Those belong to `cleanup:orphaned-user-refs`.
 *
 * Three write shapes, picked per ref by the schema walk:
 *
 *   scalar            $set
 *   array of ids      $pull the dead ids, then $addToSet the tombstone — so a
 *                     ticket assigned to two departed users ends up assigned to
 *                     one tombstone, not two copies of it
 *   in a doc array    positional $set through arrayFilters, which repairs the
 *                     element in place without removing it
 *
 * Dry-run is the default. Nothing is written without `--apply`.
 *
 *   npm run migrate:tombstone-user-refs                        report only (default)
 *   npm run migrate:tombstone-user-refs -- --apply             interactive; type the database name
 *   npm run migrate:tombstone-user-refs -- --apply --yes=<db>  non-interactive (assertion required)
 *
 * Idempotent: a second run finds nothing dangling and reuses the same tombstone.
 *
 * Like the cleanup script, this one does NOT refuse a production-looking database
 * name — repairing production is the reason it exists. The guard is that writing
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
const { ROLES } = require('../constants/roles');

// Every model, loaded by directory listing rather than by name: the schema walk
// is only exhaustive if nothing is missing from the registry.
fs.readdirSync(path.join(__dirname, '..', 'models'))
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => require(path.join(__dirname, '..', 'models', file)));

const User = mongoose.model('User');

const {
  isAuthorshipRef,
  readPath,
  scanDanglingUserRefs,
  missingIdsOf,
} = require('./lib/userRefScan');
const { describeTarget, confirmDatabaseName } = require('./lib/targetDatabase');
const { strategyFor, STRATEGY_LABELS, buildPlan, totalRefs } = require('./lib/repointPlan');

const COMMAND = 'migrate:tombstone-user-refs';

/**
 * The tombstone account.
 *
 * `active: false` and no `password` are the two things that make it not a login,
 * and either one alone is enough: `authService.login` rejects a user with no
 * password hash, and rejects an inactive user after that. The schema agrees —
 * `password` is only `required` when `active === true`.
 *
 * `role` is required and no value is meaningful here. `mentor` is chosen because
 * nothing queries by it: `role: ROLES.INTERN` is used as a *filter* in four
 * services (intern listings, recommendations, workspace interns, and the daily
 * reminder that would otherwise try to notify a tombstone), while every mentor
 * and leadership mention is an authorization check on the caller, never a listing
 * query. The guard on this account is `isTombstone`, not its role.
 *
 * `.invalid` is the reserved TLD for exactly this (RFC 2606) — no chance of the
 * address resolving anywhere real.
 */
const TOMBSTONE = Object.freeze({
  fullname: 'Deleted user',
  email: 'deleted-user@system.invalid',
  role: ROLES.MENTOR,
  active: false,
  status: 'disabled',
  isTombstone: true,
});

const parseArgs = (argv) => {
  const options = { apply: false, yes: undefined };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('--yes=')) options.yes = arg.slice('--yes='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
};

const printBanner = (target, plan, tombstone, options) => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  REPOINT ORPHANED USER REFS → TOMBSTONE                          ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}
  mode     : ${options.apply ? '⚠️  APPLY — refs will be rewritten' : 'DRY RUN — nothing will be written'}
  tombstone: ${
    tombstone
      ? `${tombstone._id}  (${tombstone.fullname} <${tombstone.email}>)`
      : `none yet — would be created as "${TOMBSTONE.fullname}" <${TOMBSTONE.email}>`
  }
`);

  if (!plan.repointable.length && !plan.refused.length && !plan.deferred.length) {
    console.log('  No dangling user references anywhere. Nothing to do.\n');
    return;
  }

  if (plan.repointable.length) {
    console.log(`  Repoint plan (${totalRefs(plan.repointable)} ref(s)):\n`);
    for (const finding of plan.repointable) {
      console.log(
        `    ${`${finding.modelName}.${finding.refPath}`.padEnd(34)} ${String(
          finding.dangling.length
        ).padStart(4)}   ${STRATEGY_LABELS[finding.strategy]}${
          finding.isRequired ? '   [required field]' : ''
        }`
      );
      console.log(`        missing user id(s): ${missingIdsOf(finding).join(', ')}`);
    }
    console.log('');
  }

  if (plan.refused.length) {
    console.log('  ⏭️  Refused — cannot be written safely:\n');
    plan.refused.forEach((finding) =>
      console.log(
        `    ${finding.modelName}.${finding.refPath} — ${finding.dangling.length}   (${
          STRATEGY_LABELS[finding.strategy]
        })`
      )
    );
    console.log('');
  }

  if (plan.deferred.length) {
    console.log("  ⏭️  Not this script's job — the record's whole subject is gone:\n");
    plan.deferred.forEach((finding) =>
      console.log(`    ${finding.modelName}.${finding.refPath} — ${finding.dangling.length}`)
    );
    console.log('      Run  npm run cleanup:orphaned-user-refs  for these.\n');
  }
};

/** The one tombstone, or null. */
const findTombstone = () => User.findOne({ isTombstone: true }).lean();

/**
 * The tombstone, created if it is not there yet. `User.create` rather than an
 * upsert, so the schema validators actually run on the document this migration
 * is about to point the whole database at.
 */
const ensureTombstone = async () => {
  const existing = await findTombstone();
  if (existing) {
    console.log(`  ♻️  Reusing tombstone ${existing._id}`);
    return existing;
  }
  const created = await User.create(TOMBSTONE);
  console.log(`  ➕ Created tombstone ${created._id} (${TOMBSTONE.email})`);
  return created.toObject();
};

const repointFinding = async (finding, tombstoneId) => {
  const { modelName, refPath, strategy, docArrayPath, leafPath, dangling } = finding;
  const Model = mongoose.model(modelName);
  const missingIds = missingIdsOf(finding).map((id) => new mongoose.Types.ObjectId(id));

  if (strategy === 'set') {
    const result = await Model.updateMany(
      { [refPath]: { $in: missingIds } },
      { $set: { [refPath]: tombstoneId } }
    );
    return result.modifiedCount;
  }

  if (strategy === 'swap-in-array') {
    // Two operators, and the filter is by document id rather than by the ref:
    // after the `$pull` the document no longer matches `{ [refPath]: { $in } }`,
    // so a second query on that shape would find nothing to add the tombstone to.
    // `$addToSet` rather than `$push` is what keeps two departed assignees from
    // becoming two identical tombstone entries.
    const docIds = [...new Set(dangling.map((entry) => entry.docId))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    await Model.updateMany({ _id: { $in: docIds } }, { $pull: { [refPath]: { $in: missingIds } } });
    const result = await Model.updateMany(
      { _id: { $in: docIds } },
      { $addToSet: { [refPath]: tombstoneId } }
    );
    return result.modifiedCount;
  }

  // positional — repair the element in place. `$pull` would have deleted the
  // membership or the message, which is the thing these scripts exist not to do.
  const result = await Model.updateMany(
    { [refPath]: { $in: missingIds } },
    { $set: { [`${docArrayPath}.$[el].${leafPath}`]: tombstoneId } },
    { arrayFilters: [{ [`el.${leafPath}`]: { $in: missingIds } }] }
  );
  return result.modifiedCount;
};

/**
 * Where repointing produced two tombstone entries in the same document array —
 * a workspace that had two departed members now lists "Deleted user" twice.
 *
 * Reported, never fixed. Collapsing them means deleting a membership row, and
 * which of the two to keep (with whatever role and join date each carried) is a
 * decision for a person.
 */
const reportDocArrayDuplicates = async (findings, tombstoneId) => {
  const duplicates = [];

  for (const finding of findings.filter((row) => row.strategy === 'positional')) {
    const { modelName, refPath, docArrayPath, leafPath } = finding;
    const docs = await mongoose
      .model(modelName)
      .find({ [refPath]: tombstoneId })
      .select(docArrayPath)
      .lean();

    for (const doc of docs) {
      const values = readPath(doc, refPath);
      const count = (Array.isArray(values) ? values : [values]).filter(
        (value) => value && String(value?._id ?? value) === String(tombstoneId)
      ).length;
      if (count > 1) duplicates.push({ modelName, refPath, docId: String(doc._id), count });
    }
  }

  if (duplicates.length) {
    console.log('\n  ⚠️  Tombstone now appears more than once in the same array:');
    duplicates.forEach(({ modelName, refPath, docId, count }) =>
      console.log(`      ${modelName}.${refPath} — ${docId} has ${count} entries`)
    );
    console.log('      Left as-is: collapsing them means deleting a row a person should choose.');
  }

  return duplicates.length;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const target = describeTarget();

  await connectDB();

  const liveUsers = await User.find({}).select('_id').lean();
  const liveUserIds = new Set(liveUsers.map((user) => String(user._id)));

  const findings = await scanDanglingUserRefs(liveUserIds);
  const plan = buildPlan(findings);
  const tombstone = await findTombstone();

  console.log(`\n  Users currently in the database: ${liveUserIds.size}`);
  printBanner(target, plan, tombstone, options);

  if (!options.apply) {
    console.log('  DRY RUN: nothing was written. Re-run with --apply to repoint.\n');
    await mongoose.connection.close();
    return;
  }

  if (!plan.repointable.length) {
    console.log('  ✅ Nothing to repoint.\n');
    await mongoose.connection.close();
    return;
  }

  await confirmDatabaseName(target, options, COMMAND);

  const subject = await ensureTombstone();
  const tombstoneId = subject._id;

  // Counted in documents, and said so: the plan above counts *refs*, and one
  // document can hold several of them (a workspace with two departed members, a
  // ticket assigned to two). Reporting both as "records" reads like refs went
  // missing between the plan and the write.
  let rewritten = 0;
  for (const finding of plan.repointable) {
    const modified = await repointFinding(finding, tombstoneId);
    console.log(
      `  🎯 ${finding.modelName}.${finding.refPath}: repointed ${finding.dangling.length} ref(s) ` +
        `on ${modified} document(s)`
    );
    rewritten += modified;
  }

  await reportDocArrayDuplicates(plan.repointable, tombstoneId);

  // The tombstone is a live user now, so it must be in the set the recheck reads
  // against — otherwise every ref just repaired reads back as still dangling.
  const recheck = await scanDanglingUserRefs(new Set([...liveUserIds, String(tombstoneId)]));
  const stillDangling = recheck.filter(
    (finding) => isAuthorshipRef(finding) && strategyFor(finding) !== 'refuse-nested'
  );
  if (stillDangling.length) {
    console.log('\n  ⚠️  Still dangling after repoint:');
    stillDangling.forEach(({ modelName, refPath, dangling }) =>
      console.log(`      ${modelName}.${refPath} — ${dangling.length}`)
    );
  }

  const remaining = recheck.filter((finding) => !isAuthorshipRef(finding));
  if (remaining.length) {
    console.log("\n  Left for the cleanup script (record's subject is gone):");
    remaining.forEach(({ modelName, refPath, dangling }) =>
      console.log(`      ${modelName}.${refPath} — ${dangling.length}`)
    );
  }

  console.log(
    `\n  ✅ Done. Repointed ${totalRefs(plan.repointable)} ref(s) across ${rewritten} document(s) ` +
      `at ${tombstoneId}.\n`
  );

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Repoint failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
