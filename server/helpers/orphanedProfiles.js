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
 * Everything here is the *read-side* defence, so a dirty database cannot put a
 * phantom on screen. Clearing the records themselves is a separate, explicit
 * operation: `npm run cleanup:orphaned-user-refs`.
 *
 * This module is pure — no model, no query. Reading which users are live is a
 * data-access concern and lives in `repository/liveUserFilter.js`, which composes
 * that read with `narrowUserClauseToLiveIds` below. Callers that want the filter
 * ready to hand to Mongo import it from there.
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
 * Whether a populated InternProfile still has its User. The post-`populate`
 * counterpart to the two filters below: a profile left behind by a deleted user
 * arrives with `user` populated as `null`, so the profile is truthy and the
 * person is not. Takes the profile itself rather than the record holding it —
 * callers reach it under different names (`internProfile`, `intern`).
 */
const hasLiveUser = (profile) => Boolean(profile?.user);

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
 * Throws unless a filter's `user` clause is one this module can narrow — absent,
 * a plain id, or a `{ $in: [...] }`.
 *
 * Any other operator clause (`{ $ne: ... }`, `{ $nin: [...] }`) cannot be
 * intersected with a list of ids, and the alternative is worse than an error: the
 * clause stringifies to `"[object Object]"`, matches no live id, and collapses to
 * `{ $in: [] }` — a filter that silently returns nothing at all. Failing loudly
 * beats an empty page nobody can explain.
 *
 * Separate from the narrowing below so a caller can check before paying for a
 * read of the whole users collection — see `repository/liveUserFilter.js`.
 */
const assertNarrowableUserClause = (profileFilter = {}) => {
  const requested = profileFilter.user;
  if (requested === undefined || requested === null) return;
  if (!isOperatorClause(requested)) return;
  if (Array.isArray(requested.$in)) return;

  throw new Error(
    `Cannot narrow user clause ${JSON.stringify(requested)} to live users. ` +
      'Pass an id, a { $in: [...] }, or no user clause at all.'
  );
};

/**
 * The `find`-side counterpart: narrows a filter's `user` clause to the ids given,
 * so the paged query and the `countDocuments` beside it agree.
 *
 * Total by construction — it never widens a filter it was handed:
 *
 * - no `user` clause yet   → constrained to every live user
 * - `user: <id>`           → kept only if that id resolves
 * - `user: { $in: [...] }` → intersected with the live ids
 *
 * An empty `$in` is the natural "matches nothing" result, which is what a
 * caller asking only for deleted users should get.
 */
const narrowUserClauseToLiveIds = (profileFilter = {}, liveIds = []) => {
  assertNarrowableUserClause(profileFilter);

  const requested = profileFilter.user;
  if (requested === undefined || requested === null) {
    return { ...profileFilter, user: { $in: liveIds } };
  }

  const live = new Set(liveIds.map(String));
  const asked = isOperatorClause(requested) ? requested.$in : [requested];
  return { ...profileFilter, user: { $in: asked.filter((id) => live.has(String(id))) } };
};

module.exports = {
  excludeOrphanedProfileStages,
  hasLiveUser,
  assertNarrowableUserClause,
  narrowUserClauseToLiveIds,
};
