/**
 * Deciding what `repointOrphanedUserRefs.js` may write, and how.
 *
 * Pure: it takes the scan's findings and returns a plan. Separate from the script
 * so the decisions can be tested without a database — the script's own job is the
 * banner, the confirmation and the updates.
 */

const { isAuthorshipRef } = require('./userRefScan');

/**
 * How a given dangling ref has to be written. Read off the schema walk rather
 * than off the field name, so a ref added later is classified without editing
 * this file.
 */
const strategyFor = ({ nestedDocArray, inDocArray, isArray }) => {
  // One `$[]` placeholder addresses one array level. Two nested document arrays
  // would need two, and guessing which element to write is worse than declining.
  // Nothing in the current schema set reaches this branch.
  if (nestedDocArray) return 'refuse-nested';
  if (inDocArray) return 'positional';
  if (isArray) return 'swap-in-array';
  return 'set';
};

const STRATEGY_LABELS = Object.freeze({
  set: '$set',
  'swap-in-array': '$pull + $addToSet',
  positional: 'positional $set (arrayFilters)',
  'refuse-nested': 'REFUSED — nested document arrays',
});

/**
 * Split the scan into what this migration repairs, what it declines, and what it
 * hands back to the cleanup script.
 *
 * `deferred` is not a failure. A ref whose whole subject is the departed user —
 * `InternProfile.user`, or a per-user row in `USER_OWNED` — must not acquire a
 * tombstone: an InternProfile owned by "Deleted user" is a ghost intern, which is
 * the bug rather than the fix. Naming them beats leaving the operator to wonder
 * why the numbers do not add up.
 */
const buildPlan = (findings) => {
  const repointable = [];
  const refused = [];
  const deferred = [];

  for (const finding of findings) {
    if (!isAuthorshipRef(finding)) {
      deferred.push(finding);
      continue;
    }
    const strategy = strategyFor(finding);
    if (strategy === 'refuse-nested') refused.push({ ...finding, strategy });
    else repointable.push({ ...finding, strategy });
  }

  return { repointable, refused, deferred };
};

/** How many individual refs a list of findings covers, not how many findings. */
const totalRefs = (rows) => rows.reduce((sum, row) => sum + row.dangling.length, 0);

module.exports = { strategyFor, STRATEGY_LABELS, buildPlan, totalRefs };
