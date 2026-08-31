/**
 * Per-workspace ticket numbering.
 *
 * `taskNumber` was computed as `max(taskNumber) + 1` with a read and a write on
 * either side of several awaits, so concurrent creates in one workspace all read
 * the same maximum and all wrote the same number. Nothing at the storage layer
 * rejected the duplicate. `$inc` on a single `Counter` document is atomic and
 * relative, which removes the read entirely from the hot path.
 *
 * The counter self-heals: a workspace that has tickets but no counter document
 * (created before this existed, or wiped) gets one seeded from its current
 * highest `taskNumber` on the next create. That is why the increment below is
 * deliberately NOT an upsert — an upsert would silently start such a workspace
 * at 1 and collide with every ticket it already has.
 *
 * Gaps in the sequence are expected and harmless: a number is claimed before
 * `ticket.save()`, so a failed save burns it. Reserving it only on success would
 * mean reading before writing, which is the bug this replaces.
 */
const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');

const TICKET_COUNTER_NAME = 'ticket';
const DUPLICATE_KEY_CODE = 11000;

const counterFilter = (workspaceId) => ({
  workspace: workspaceId,
  name: TICKET_COUNTER_NAME,
});

// `returnDocument: 'after'` is load-bearing, not decoration: without it the
// pre-increment document comes back and every caller gets the previous number.
const incrementCounter = async (workspaceId) =>
  Counter.findOneAndUpdate(
    counterFilter(workspaceId),
    { $inc: { seq: 1 } },
    { returnDocument: 'after' }
  ).lean();

// `$max`, so it only ever raises. No `upsert`: Mongoose would add its schema
// default as `$setOnInsert: { seq: 0 }`, and Mongo rejects an update that writes
// the same path twice. A missing document comes back as `null` instead.
const raiseCounter = async (workspaceId, seq) =>
  Counter.findOneAndUpdate(
    counterFilter(workspaceId),
    { $max: { seq } },
    { returnDocument: 'after' }
  ).lean();

const highestTaskNumber = async (workspaceId) => {
  const lastTicket = await Ticket.findOne({ workspace: workspaceId })
    .sort('-taskNumber')
    .select('taskNumber')
    .lean();

  return lastTicket?.taskNumber || 0;
};

// Two requests can reach this at the same moment on a workspace's first-ever
// create. The unique index makes the loser throw `E11000`, which is the expected
// outcome rather than an error: all the caller needs is for the document to
// exist, and it now does.
const seedCounter = async (workspaceId, seq) => {
  try {
    await Counter.create({ ...counterFilter(workspaceId), seq });
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY_CODE) throw error;
  }
};

/**
 * Claims and returns the next `taskNumber` for a workspace. One round trip in
 * the common case; three only on the first create after the counter is missing.
 */
const nextTaskNumber = async (workspaceId) => {
  const incremented = await incrementCounter(workspaceId);
  if (incremented) return incremented.seq;

  await seedCounter(workspaceId, await highestTaskNumber(workspaceId));

  const afterSeed = await incrementCounter(workspaceId);
  if (!afterSeed) {
    throw new Error('Could not allocate a task number for this workspace');
  }

  return afterSeed.seq;
};

/**
 * Raises a workspace's counter to its highest existing `taskNumber`, creating it
 * if absent. Never lowers it, so it is safe to re-run. Used by the backfill
 * script and by any seeder that writes `taskNumber` itself — without it, the
 * first ticket created after a seed collides with a seeded one.
 */
const syncTaskNumberCounter = async (workspaceId) => {
  const max = await highestTaskNumber(workspaceId);

  const raised = await raiseCounter(workspaceId, max);
  if (raised) return raised.seq;

  await seedCounter(workspaceId, max);

  // Retried rather than assumed: `seedCounter` swallows `E11000`, so reaching
  // here can mean somebody else's document won the insert — and theirs may sit
  // below `max`. Returning `max` without re-raising would report a counter value
  // the collection does not hold.
  const afterSeed = await raiseCounter(workspaceId, max);
  return afterSeed?.seq ?? max;
};

module.exports = { TICKET_COUNTER_NAME, nextTaskNumber, syncTaskNumberCounter };
