/**
 * Rules the seeded placement pipeline has to satisfy, shared by the destructive
 * demo seeder (`seedDemoData.js` preflight) and the additive top-up seeder
 * (`seedRecommendations.js`), so both refuse the same bad data.
 *
 * Imports nothing — plain data + pure functions over demo/dataset.js.
 */

// Recommendation stages that are still open (not resolved with a result).
const OPEN_RECOMMENDATION_STATUSES = ['recommended', 'interviewing'];

const isOpenStatus = (status) => OPEN_RECOMMENDATION_STATUSES.includes(status);

/**
 * Which recommendation shapes each PROFILE status can legitimately carry. These
 * mirror recommendationService — see the comment above `recommendations` in
 * demo/dataset.js for the reasoning behind each row.
 */
const RECOMMENDATION_RULES = {
  // Resolving a recommendation as not_placed moves the profile to `ready`, so
  // the app itself can never leave a resulted recommendation on an `active`
  // intern.
  active: { open: true, notPlaced: false, placed: false },
  ready: { open: true, notPlaced: true, placed: false },
  // Terminal statuses: NON_RECOMMENDABLE_PROFILE_STATUSES rejects new
  // recommendations for these interns, and closeStaleRecommendations.js closes
  // any that were left open.
  placed: { open: false, notPlaced: true, placed: true, requiresPlaced: true },
  completed: { open: false, notPlaced: true, placed: false },
  discontinued: { open: false, notPlaced: true, placed: false },
};

/**
 * Check one intern's recommendations against their profile status.
 * `internStatus` is the status to judge against — the dataset's for the demo
 * seeder, the live profile's for the additive one.
 */
const coherenceProblems = (internKey, internStatus, specs) => {
  const problems = [];
  const rules = RECOMMENDATION_RULES[internStatus];
  if (!rules) {
    problems.push(`intern ${internKey}: no recommendation rules for status "${internStatus}"`);
    return problems;
  }

  for (const spec of specs) {
    const outcome = spec.result?.outcome;
    if (isOpenStatus(spec.status) && !rules.open) {
      problems.push(
        `recommendation ${spec.key}: "${spec.status}" would sit open forever on a ${internStatus} intern`
      );
    }
    if (outcome === 'not_placed' && !rules.notPlaced) {
      problems.push(
        `recommendation ${spec.key}: a not_placed result puts the intern back on the bench, which contradicts profile status "${internStatus}"`
      );
    }
    if (outcome === 'placed' && !rules.placed) {
      problems.push(
        `recommendation ${spec.key}: a placed result contradicts profile status "${internStatus}"`
      );
    }
  }

  const placedCount = specs.filter((spec) => spec.result?.outcome === 'placed').length;
  if (rules.requiresPlaced && placedCount !== 1) {
    problems.push(
      `intern ${internKey}: profile status "${internStatus}" needs exactly one placed recommendation, found ${placedCount}`
    );
  }
  if (placedCount > 1) {
    problems.push(`intern ${internKey}: ${placedCount} recommendations claim a placed outcome`);
  }

  return problems;
};

/**
 * Every rule that spans the whole recommendation set: coverage (nobody without
 * one), the multi-recommendation contract, and per-intern coherence.
 *
 * `statusFor` maps an intern key to the profile status to judge against.
 * Defaults to the dataset's own status.
 */
const recommendationProblems = (dataset, statusFor) => {
  const problems = [];
  const byIntern = new Map(dataset.interns.map((spec) => [spec.key, []]));

  for (const spec of dataset.recommendations) {
    const bucket = byIntern.get(spec.internKey);
    // An unknown internKey is reported by the caller's own reference checks.
    if (bucket) bucket.push(spec);
  }

  for (const intern of dataset.interns) {
    const specs = byIntern.get(intern.key);
    if (specs.length === 0) {
      problems.push(
        `intern ${intern.key}: no recommendations — every intern needs at least one so their pipeline tab is never empty`
      );
      continue;
    }
    const status = statusFor ? statusFor(intern.key) : intern.status;
    problems.push(...coherenceProblems(intern.key, status, specs));
  }

  for (const key of dataset.RECOMMENDATION_MULTI_KEYS) {
    if (!byIntern.has(key)) {
      problems.push(`RECOMMENDATION_MULTI_KEYS: unknown intern ${key}`);
      continue;
    }
    const count = byIntern.get(key).length;
    if (count < 2) {
      problems.push(
        `intern ${key}: listed in RECOMMENDATION_MULTI_KEYS but has ${count} recommendation(s)`
      );
    }
  }

  return problems;
};

module.exports = {
  OPEN_RECOMMENDATION_STATUSES,
  RECOMMENDATION_RULES,
  isOpenStatus,
  coherenceProblems,
  recommendationProblems,
};
