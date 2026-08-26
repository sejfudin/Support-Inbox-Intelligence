const User = require('../models/User');

/**
 * Reads about the deleted-user tombstone — the single placeholder account that
 * refs left behind by a hand-deleted User point at. See `models/User.js`
 * (`isTombstone`) for why it exists, and `seeder/repointOrphanedUserRefs.js` for
 * what creates and maintains it.
 *
 * A read, so it lives here rather than in `constants/userVisibility.js`: that
 * module holds the pure filters and the post-populate predicate, and stays
 * dependency-free.
 */

/** The tombstone account, or null if this database has never needed one. */
const findTombstoneUser = () => User.findOne({ isTombstone: true }).select('_id').lean();

/**
 * Found once per process, then remembered: there is exactly one tombstone and its
 * id never changes.
 *
 * Only a hit is cached. A miss stays uncached on purpose — the migration that
 * creates the tombstone can run against a database while the server is up, and a
 * remembered "there isn't one" would keep every guard below waving the tombstone
 * through until someone restarted the process. The cost of that choice is one
 * `findOne` per call on a database that has no tombstone, over a collection with
 * tens of documents.
 */
let cachedTombstoneId = null;

const tombstoneId = async () => {
  if (cachedTombstoneId) return cachedTombstoneId;
  const tombstone = await findTombstoneUser();
  if (tombstone) cachedTombstoneId = String(tombstone._id);
  return cachedTombstoneId;
};

/**
 * Whether an id names the tombstone.
 *
 * The question outward-facing side effects have to ask. A guard that only checked
 * for a missing user was enough while a deleted account populated as `null`; once
 * its refs point at the tombstone, the id resolves to a present, named user who
 * still must never be sent anything.
 */
const isTombstoneUser = async (userId) => {
  if (!userId) return false;
  const id = await tombstoneId();
  return Boolean(id) && id === String(userId);
};

/** Test seam — drops the memoized id so a suite can change what the read returns. */
const resetTombstoneCache = () => {
  cachedTombstoneId = null;
};

module.exports = { findTombstoneUser, isTombstoneUser, resetTombstoneCache };
