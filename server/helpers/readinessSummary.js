/**
 * Joining an intern's *declared* technologies and position to the readiness flags
 * a mentor actually recorded against them.
 *
 * Pure and DB-free so it can be unit-tested. The join is the whole subtlety here:
 * a `ReadinessFlag` exists only once someone has assessed something, so a declared
 * technology with no flag is "Not assessed" — which is a real state the intern
 * needs to see, not a row to hide. Mirrors what `InternReadinessPanel` /
 * `InternRoleReadinessPanel` do client-side for the admin, so the intern's
 * read-only view and the admin's editable one agree on both content and order.
 */

// Mirrors `READINESS_LEVELS` in `models/ReadinessFlag.js`, which stays the schema
// authority — duplicated as plain strings rather than imported so this file pulls
// in no mongoose and stays trivially testable. `readinessSummary.test.js` pins
// the two lists together.
const LEVEL_NONE = 'none';
const LEVEL_LEARNING = 'learning';
const LEVEL_READY = 'ready';

// Best first: the intern reads what they are ready for before what they have not
// started. Same order the admin's technology grid sorts by.
const LEVEL_ORDER = Object.freeze([LEVEL_READY, LEVEL_LEARNING, LEVEL_NONE]);

/** `_id` off a populated ref, an ObjectId, or a string — all three occur here. */
const refId = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return String(ref._id || ref.id || ref);
};

/**
 * The assessment provenance shown under a level: who set it and when.
 *
 * Both are facts about the intern's own record rather than anything written about
 * them, which is why they are shown. `null` when nobody has assessed it yet.
 */
const assessment = (flag) => ({
  level: flag?.level || LEVEL_NONE,
  assessedBy: flag?.setBy?.fullname || null,
  assessedAt: flag?.updatedAt || flag?.createdAt || null,
});

/**
 * One row per technology the intern has declared, best-assessed first.
 *
 * Driven by the declared list, not by the flags: a flag left behind by a
 * technology the intern has since dropped is not theirs to see any more, and a
 * declared technology nobody has looked at yet still needs its "Not assessed"
 * row.
 *
 * @param {Array<{ _id: any, name: string, slug?: string }>} declaredTechnologies
 * @param {Array<{ technology?: any, level?: string, setBy?: object }>} flags
 */
const buildTechnologyReadiness = (declaredTechnologies = [], flags = []) => {
  const byTechnology = new Map();
  for (const flag of flags) {
    const id = refId(flag?.technology);
    if (id) byTechnology.set(id, flag);
  }

  return declaredTechnologies
    .map((technology) => ({
      id: refId(technology),
      name: technology?.name || '',
      slug: technology?.slug || '',
      ...assessment(byTechnology.get(refId(technology))),
    }))
    .sort((a, b) => {
      const order = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    });
};

/**
 * Readiness for the position the intern currently holds, or `null` when they have
 * not declared one.
 *
 * Only a flag targeting *that* position counts. A position flag is a singleton
 * per intern that gets rewritten when the declared position changes, so a flag
 * left over from a previous role must read "Not assessed" rather than carry a
 * stale level onto the new one.
 *
 * @param {{ _id: any, name: string, slug?: string }|null} position
 * @param {Array<{ position?: any, level?: string, setBy?: object }>} flags
 */
const buildPositionReadiness = (position, flags = []) => {
  if (!position) return null;

  const positionId = refId(position);
  const flag = flags.find((candidate) => refId(candidate?.position) === positionId);

  return {
    id: positionId,
    name: position.name || '',
    slug: position.slug || '',
    ...assessment(flag),
  };
};

/**
 * How the intern's technologies break down by level, plus how many are still
 * unassessed — the "what is left" number the page leads with.
 *
 * Counts rows, so it takes `buildTechnologyReadiness` output rather than raw
 * flags: counting flags would miss every declared-but-unassessed technology,
 * which is exactly the group worth surfacing.
 */
const summarizeReadiness = (rows = []) => {
  const summary = { total: rows.length, ready: 0, learning: 0, none: 0 };

  for (const row of rows) {
    const level = LEVEL_ORDER.includes(row?.level) ? row.level : LEVEL_NONE;
    summary[level] += 1;
  }

  return summary;
};

module.exports = {
  LEVEL_ORDER,
  buildTechnologyReadiness,
  buildPositionReadiness,
  summarizeReadiness,
};
