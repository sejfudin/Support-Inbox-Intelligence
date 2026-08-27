const User = require('../models/User');
const {
  assertNarrowableUserClause,
  narrowUserClauseToLiveIds,
} = require('../helpers/orphanedProfiles');

/**
 * The one read behind the orphan guards: which users still exist. Deleting a User
 * straight from the database leaves every profile that pointed at it behind, so
 * "live" cannot be derived from the profile itself — see
 * `helpers/orphanedProfiles.js` for why those ghosts matter.
 */
const findLiveUserIds = async () => {
  const liveUsers = await User.find({}).select('_id').lean();
  return liveUsers.map((user) => user._id);
};

/**
 * An InternProfile filter narrowed to users that still exist, ready to hand to
 * `find` or `countDocuments`.
 *
 * The shaping itself is pure and lives in `helpers/orphanedProfiles.js`; this is
 * the seam that pairs it with the read, so the two cannot drift apart. The clause
 * is validated *before* the read: a filter this cannot narrow is a programming
 * error, and there is no reason to scan the whole users collection to find that
 * out.
 */
const restrictProfileFilterToLiveUsers = async (profileFilter = {}) => {
  assertNarrowableUserClause(profileFilter);
  return narrowUserClauseToLiveIds(profileFilter, await findLiveUserIds());
};

module.exports = { findLiveUserIds, restrictProfileFilterToLiveUsers };
