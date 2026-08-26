#!/usr/bin/env node
/**
 * Fabricate the dangling refs `migrate:tombstone-user-refs` is meant to repair,
 * so its three write shapes can be driven against a real database.
 *
 * WHY THIS EXISTS
 *
 * The dev database has exactly one dangling ref, and it is the easy kind: an
 * optional scalar, repaired with `$set`. Production has the hard kinds — a
 * `required` scalar, a plain array of ids, and a ref inside a document array —
 * and this repo has no integration suite, so nothing has ever driven those three
 * updates against Mongo. The unit tests cover which strategy gets chosen; they
 * cannot tell you whether an `arrayFilters` update lands on the right element or
 * whether `$addToSet` really collapses two departed assignees into one tombstone.
 *
 * So this inserts a fixture that reproduces all of them, plus one ref the
 * migration must REFUSE, and then reads back what happened.
 *
 * HOW IT WRITES
 *
 * Through the raw driver, not through Mongoose. That is the point rather than a
 * shortcut: a ticket with no valid status, or a workspace whose owner does not
 * exist, is a document the schema would reject — and hand-deleting a User is
 * precisely how production came to hold such documents. Validators would refuse
 * to reproduce the bug.
 *
 * Every inserted document carries `probeTag`, which is how `--remove` finds them
 * again afterwards. Removal keys on the tag and not on the fake user ids, because
 * by then the migration has rewritten those ids to the tombstone.
 *
 *   npm run probe:orphaned-user-refs -- --insert --yes=<db>   fabricate the fixture
 *   npm run probe:orphaned-user-refs -- --verify              report what the refs point at now
 *   npm run probe:orphaned-user-refs -- --remove --yes=<db>   delete the fixture
 *
 * A NORMAL RUN
 *
 *   1. --insert            (7 dangling refs appear: 6 repointable, 1 refused)
 *   2. migrate:tombstone-user-refs               — read the plan
 *   3. migrate:tombstone-user-refs -- --apply    — write
 *   4. --verify            (every fabricated ref now names the tombstone; the
 *                           InternProfile one must still be dangling)
 *   5. --remove            (fixture gone)
 *
 * The tombstone itself is left behind by `--remove`, deliberately: once created it
 * is a legitimate record that the dev database's own real orphan needs, and the
 * migration reuses it.
 *
 * REFUSES `NODE_ENV=production`. This script writes fabricated records, and the
 * only way to reach the production database is that env file. Unlike the repair
 * scripts, there is no case for pointing this one at production, so it does not
 * offer the option.
 */

const path = require('path');
const fs = require('fs');

const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

fs.readdirSync(path.join(__dirname, '..', 'models'))
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => require(path.join(__dirname, '..', 'models', file)));

const { describeTarget, confirmDatabaseName } = require('./lib/targetDatabase');

const COMMAND = 'probe:orphaned-user-refs';
const PROBE_TAG = 'orphan-ref-probe';

/**
 * Three user ids that name nothing. Fixed rather than generated, so a run that
 * dies half way leaves something the next `--remove` can still recognise, and so
 * the report below is readable — `dead…01` says what it is.
 */
const DEAD = [
  new mongoose.Types.ObjectId('dead00000000000000000001'),
  new mongoose.Types.ObjectId('dead00000000000000000002'),
  new mongoose.Types.ObjectId('dead00000000000000000003'),
];

/**
 * The fixture, one entry per shape the migration has to handle. `refs` is what
 * `--verify` reads back, and the shape each one exercises is named so a failure
 * report says which write went wrong rather than which document did.
 */
const FIXTURE_REFS = [
  { collection: 'workspaces', refPath: 'owner', shape: '$set on a required scalar' },
  { collection: 'workspaces', refPath: 'members.user', shape: 'positional $set (arrayFilters)' },
  { collection: 'tickets', refPath: 'creator', shape: '$set on a required scalar' },
  { collection: 'tickets', refPath: 'assignedTo', shape: '$pull + $addToSet on an id array' },
  {
    collection: 'internprofiles',
    refPath: 'user',
    shape: 'MUST BE REFUSED — subject of the record',
  },
];

const parseArgs = (argv) => {
  const options = { insert: false, remove: false, verify: false, yes: undefined };
  for (const arg of argv) {
    if (arg === '--insert') options.insert = true;
    else if (arg === '--remove') options.remove = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('--yes=')) options.yes = arg.slice('--yes='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  const chosen = [options.insert, options.remove, options.verify].filter(Boolean).length;
  if (chosen !== 1) {
    console.error('Pick exactly one of --insert, --remove, --verify.');
    process.exit(1);
  }
  return options;
};

const collection = (name) => mongoose.connection.collection(name);

/**
 * A live user, to sit in the fixture workspace beside the dead ones. Without it
 * the positional update could pass by rewriting every element rather than only
 * the ones it was asked to — `--verify` checks this member is untouched.
 */
const findBystander = async () => {
  const user = await collection('users').findOne({ isTombstone: { $ne: true } }, { _id: 1 });
  if (!user) throw new Error('No users in this database — nothing to use as a live bystander.');
  return user._id;
};

const insertFixture = async () => {
  const bystander = await findBystander();
  const workspaceId = new mongoose.Types.ObjectId();

  await collection('workspaces').insertOne({
    _id: workspaceId,
    probeTag: PROBE_TAG,
    name: '[PROBE] orphaned user refs',
    // Required, and pointing at nothing: the case `--prune-refs` cannot touch.
    owner: DEAD[0],
    isArchived: true,
    members: [
      { user: DEAD[0], role: 'member', status: 'active' },
      // A second dead member in the SAME workspace, so repointing produces two
      // tombstone entries in one array — the duplicate the migration reports and
      // deliberately does not collapse.
      { user: DEAD[1], role: 'member', status: 'active' },
      { user: bystander, role: 'admin', status: 'active' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await collection('tickets').insertOne({
    probeTag: PROBE_TAG,
    subject: '[PROBE] orphaned user refs',
    workspace: workspaceId,
    // Names no TicketStatus. Nothing here reads it, and inventing a real one
    // would mean writing a status row this fixture would also have to clean up.
    status: new mongoose.Types.ObjectId(),
    priority: 'medium',
    creator: DEAD[0],
    // Two dead assignees, so `$addToSet` has something to collapse.
    assignedTo: [DEAD[1], DEAD[2]],
    isArchived: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await collection('internprofiles').insertOne({
    probeTag: PROBE_TAG,
    // The refusal case. This profile *is* the departed person; the migration must
    // report it and leave it for `cleanup:orphaned-user-refs`.
    user: DEAD[2],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`
  Inserted:
    workspaces      1   owner → dead…01, members → dead…01, dead…02, plus a live bystander
    tickets         1   creator → dead…01, assignedTo → dead…02, dead…03
    internprofiles  1   user → dead…03   (must be REFUSED, not repointed)

  7 dangling refs — 6 the migration repoints, 1 it must refuse. (Five documents-
  and-paths, but Workspace.members.user and Ticket.assignedTo hold two each.)
  Whatever this database already had dangling is on top. Now run:

    npm run migrate:tombstone-user-refs
    npm run migrate:tombstone-user-refs -- --apply --yes=<db>
    npm run ${COMMAND} -- --verify
`);
};

const removeFixture = async () => {
  for (const name of ['workspaces', 'tickets', 'internprofiles']) {
    const { deletedCount } = await collection(name).deleteMany({ probeTag: PROBE_TAG });
    console.log(`  🧹 ${name}: deleted ${deletedCount}`);
  }
  console.log(
    '\n  The tombstone user is left in place — it is a real record once created, and\n' +
      "  this database's own orphaned ref needs it.\n"
  );
};

const idsAt = (doc, refPath) => {
  const [head, leaf] = refPath.split('.');
  const value = doc?.[head];
  if (leaf) return (value || []).map((entry) => entry?.[leaf]);
  return Array.isArray(value) ? value : [value];
};

const verifyFixture = async () => {
  const tombstone = await collection('users').findOne({ isTombstone: true }, { _id: 1 });
  if (!tombstone) {
    console.log('  No tombstone in this database yet — has the migration been applied?\n');
  }
  const tombstoneId = tombstone ? String(tombstone._id) : null;
  const deadIds = new Set(DEAD.map(String));

  const describe = (id) => {
    if (!id) return 'null';
    const asString = String(id);
    if (asString === tombstoneId) return 'TOMBSTONE';
    if (deadIds.has(asString)) return `still dangling (${asString.slice(0, 6)}…)`;
    return `other live user (${asString.slice(0, 6)}…)`;
  };

  console.log(`  tombstone: ${tombstoneId ?? 'none'}\n`);

  for (const { collection: name, refPath, shape } of FIXTURE_REFS) {
    const doc = await collection(name).findOne({ probeTag: PROBE_TAG });
    if (!doc) {
      console.log(`  ${name}.${refPath}: fixture document missing — was --insert run?`);
      continue;
    }
    const resolved = idsAt(doc, refPath).map(describe);
    const tombstones = resolved.filter((entry) => entry === 'TOMBSTONE').length;
    console.log(`  ${`${name}.${refPath}`.padEnd(26)} ${resolved.join(', ')}`);
    console.log(`      ${shape}`);
    if (refPath === 'assignedTo' && tombstones > 1) {
      console.log('      ⚠️  two tombstone entries — $addToSet did not collapse them');
    }
  }

  console.log(`
  What a correct run looks like:

    workspaces.owner           TOMBSTONE
    workspaces.members.user    TOMBSTONE, TOMBSTONE, other live user
                               (two entries is expected here and reported by the
                                migration — collapsing them would delete a membership)
    tickets.creator            TOMBSTONE
    tickets.assignedTo         TOMBSTONE            (one entry, not two)
    internprofiles.user        still dangling       (refused on purpose)

  The live bystander must still read as "other live user": the positional update
  is only allowed to touch the elements it filtered for.
`);
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if ((process.env.NODE_ENV || 'development') === 'production') {
    console.error('❌ This script fabricates broken records. It does not run against production.');
    process.exit(1);
  }

  const target = describeTarget();
  await connectDB();

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ORPHANED-REF PROBE — fabricates broken records                  ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}
  action   : ${options.insert ? 'INSERT fixture' : options.remove ? 'REMOVE fixture' : 'VERIFY'}
`);

  if (options.verify) {
    await verifyFixture();
    await mongoose.connection.close();
    return;
  }

  await confirmDatabaseName(target, options, COMMAND, options.insert ? '--insert' : '--remove');

  if (options.insert) await insertFixture();
  else await removeFixture();

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Probe failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
