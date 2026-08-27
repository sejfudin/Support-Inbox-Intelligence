/**
 * Which User rows a listing meant for a human should leave out.
 *
 * Two kinds of User document are not people:
 *
 * - a test account (`isTestAccount`) — an internal QA login that works exactly
 *   like a real one but must not appear in a mentor picker or an audience list;
 * - the tombstone (`isTombstone`) — the single "Deleted user" placeholder that
 *   refs left behind by a deleted account point at.
 *
 * Both are excluded the same way, with `{ $ne: true }` rather than `false`, so a
 * document written before the field existed still matches. Both were previously
 * spelled out at each query; the tombstone made that the fifth copy of the same
 * clause, which is the point at which they start disagreeing.
 *
 * The two differ in one respect, and it is why there are two filters here rather
 * than one. A test account has an "include it anyway" case — Platform Management's
 * "All Users", where an admin manages the account itself, via
 * `adminService.getUsers({ includeTestAccounts: true })`. The tombstone has no
 * such case: there is nothing about it for anyone to administer, and it must stay
 * out of *every* listing. So `includeTestAccounts` widens to `TOMBSTONE_FILTER`,
 * never to `{}`.
 */

/** Excludes both non-people. The default for any listing of users. */
const REAL_USER_FILTER = Object.freeze({
  isTestAccount: { $ne: true },
  isTombstone: { $ne: true },
});

/** Excludes only the tombstone — for the one listing that wants test accounts. */
const TOMBSTONE_FILTER = Object.freeze({ isTombstone: { $ne: true } });

/**
 * The same question after the read, for a user that arrived populated. A ref
 * pointing at a deleted account used to populate as `null`; now it populates as
 * the tombstone, so a guard that only checked for absence would wave it through.
 * Guards asserting "a real person is here" must ask this instead of `Boolean(user)`.
 */
const isRealUser = (user) => Boolean(user) && !user.isTestAccount && !user.isTombstone;

module.exports = { REAL_USER_FILTER, TOMBSTONE_FILTER, isRealUser };
