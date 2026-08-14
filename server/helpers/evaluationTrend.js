/**
 * Evaluation score arithmetic — the average of one evaluation and the movement
 * between two.
 *
 * Pure and DB-free so it can be unit-tested: the intern's own "My progress" page
 * renders these numbers as feedback about themselves, and a criterion that reads
 * "down 1.0" when it actually held steady is worse than showing nothing.
 *
 * Shared by `evaluationService`'s admin and self formatters so the two can never
 * disagree about what an average is.
 */

// The four things an evaluation scores, in the order they are shown. The model
// (`models/Evaluation.js`) is the schema authority; this is the display order and
// the list `createEvaluation` validates against, kept in one place so a fifth
// criterion is added once rather than in three files.
const EVALUATION_CRITERIA = Object.freeze(['technical', 'communication', 'ownership', 'growth']);

const SCORE_MIN = 1;
const SCORE_MAX = 5;

/** One decimal place — the precision the UI prints, so nothing rounds twice. */
const round1 = (value) => Math.round(value * 10) / 10;

const scoreOf = (scores, key) => {
  const value = scores?.[key];
  return Number.isFinite(value) ? value : null;
};

/**
 * The mean of an evaluation's criterion scores, or `null` when it has none.
 *
 * Averaged over the *known* criteria rather than `Object.values(scores)`: a lean
 * Mongoose document can carry keys that are not scores, and a stray one would
 * silently shift every average on the page.
 */
const averageScore = (scores = {}) => {
  const values = EVALUATION_CRITERIA.map((key) => scoreOf(scores, key)).filter(
    (value) => value !== null
  );

  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
};

/**
 * Per-criterion movement between the two most recent evaluations.
 *
 * @param {Array<{ scores?: object }>} evaluations newest period FIRST — the order
 *   `listOwnEvaluations` returns (`sort({ periodEnd: -1 })`). Passing them the
 *   other way round inverts every arrow, so the caller sorts, not this.
 * @returns {Array<{ key: string, latest: number|null, previous: number|null, delta: number|null }>}
 *   One entry per criterion, always all four, so the UI renders a stable set of
 *   rows instead of appearing to lose one. `delta` is `null` when there is no
 *   earlier score to compare against — distinct from `0`, which means the score
 *   genuinely held steady.
 */
const criterionTrends = (evaluations = []) => {
  const [latest, previous] = evaluations;

  return EVALUATION_CRITERIA.map((key) => {
    const latestScore = scoreOf(latest?.scores, key);
    const previousScore = scoreOf(previous?.scores, key);

    return {
      key,
      latest: latestScore,
      previous: previousScore,
      delta:
        latestScore !== null && previousScore !== null ? round1(latestScore - previousScore) : null,
    };
  });
};

/**
 * Movement in the overall average between the two most recent evaluations, or
 * `null` when there is nothing to compare. Same newest-first contract as
 * `criterionTrends`.
 */
const averageDelta = (evaluations = []) => {
  const [latest, previous] = evaluations;
  const latestAverage = averageScore(latest?.scores);
  const previousAverage = averageScore(previous?.scores);

  if (latestAverage === null || previousAverage === null) return null;
  return round1(latestAverage - previousAverage);
};

module.exports = {
  EVALUATION_CRITERIA,
  SCORE_MIN,
  SCORE_MAX,
  averageScore,
  averageDelta,
  criterionTrends,
};
