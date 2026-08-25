const User = require('../models/User');

/**
 * Guards against "ghost" rows: records whose `user` ref points at a User that no
 * longer exists.
 *
 * There is no in-app "delete user" path (see `.claude/docs/security.md`), so the
 * only way a User disappears is somebody removing it straight from the database.
 * Nothing cascades when that happens, and every document that referenced it —
 * InternProfile above all, plus everything hanging off it — survives pointing at
 * an id that resolves to nothing. `populate` then yields `null`, the read paths
 * fall back to a literal "Unknown", and the row renders as a person who does not
 * exist while still being counted in the `total` beside it.
 *
 * Both exports here are the *read-side* defence, so a dirty database cannot put
 * a phantom on screen. Clearing the records themselves is a separate, explicit
 * operation: `npm run cleanup:orphaned-user-refs`.
 */

/**
 * Aggregation stages that drop any document whose `user` ref is dangling.
 *
 * `userLocalField` is the dotted path to the ref at whatever point in the
 * pipeline this is spliced in: 'user' when InternProfile is the aggregation
 * root, or 'profile.user' once an earlier stage has already $lookup'd/$unwind'd
 * the profile in under that alias.
 */
const excludeOrphanedProfileStages = (userLocalField = 'user') => [
  { $lookup: { from: 'users', localField: userLocalField, foreignField: '_id', as: '_userDoc' } },
  { $match: { _userDoc: { $ne: [] } } },
  { $project: { _userDoc: 0 } },
];

/**
 * Whether a `user` clause is a Mongo operator object rather than an id. Keyed on
 * a leading `$`, so an ObjectId — an object too, but with no such key — reads as
 * the plain id it is.
 */
const isOperatorClause = (clause) =>
  typeof clause === 'object' &&
  clause !== null &&
  !Array.isArray(clause) &&
  Object.keys(clause).some((key) => key.startsWith('$'));

/**
 * The `find`-side counterpart: narrows a filter's `user` clause to users that
 * still exist, so the paged query and the `countDocuments` beside it agree.
 *
 * Total by construction — it never widens a filter it was handed:
 *
 * - no `user` clause yet   → constrained to every live user
 * - `user: <id>`           → kept only if that id resolves
 * - `user: { $in: [...] }` → intersected with the live ids
 *
 * An empty `$in` is the natural "matches nothing" result, which is what a
 * caller asking only for deleted users should get.
 *
 * Any other operator clause (`{ $ne: ... }`, `{ $nin: [...] }`) throws. Those
 * cannot be intersected with a list of ids, and the alternative is worse than an
 * error: the clause stringifies to `"[object Object]"`, matches no live id, and
 * collapses to `{ $in: [] }` — a filter that silently returns nothing at all.
 * Failing loudly here beats an empty page nobody can explain.
 */
const restrictProfileFilterToLiveUsers = async (profileFilter = {}) => {
  const requested = profileFilter.user;
  const isPlainId = requested === undefined || requested === null || !isOperatorClause(requested);

  if (!isPlainId && !Array.isArray(requested.$in)) {
    throw new Error(
      `restrictProfileFilterToLiveUsers cannot narrow user clause ${JSON.stringify(requested)}. ` +
        'Pass an id, a { $in: [...] }, or no user clause at all.'
    );
  }

  const liveUsers = await User.find({}).select('_id').lean();
  const liveIds = liveUsers.map((user) => user._id);

  if (requested === undefined || requested === null) {
    return { ...profileFilter, user: { $in: liveIds } };
  }

  const live = new Set(liveIds.map(String));
  const asked = isPlainId ? [requested] : requested.$in;
  return { ...profileFilter, user: { $in: asked.filter((id) => live.has(String(id))) } };
};

module.exports = { excludeOrphanedProfileStages, restrictProfileFilterToLiveUsers };
