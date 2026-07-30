/**
 * Turning one `recommendations` spec from demo/dataset.js into documents.
 *
 * Shared by the destructive demo seeder (demo/phaseTalent.js) and the additive
 * top-up seeder (../seedRecommendations.js) so both produce byte-identical
 * records — including the deterministic `_id`, which is what makes the additive
 * script idempotent.
 *
 * Pure: every id is passed in already resolved, and every date comes from the
 * injected clock (no `new Date()` here — see demo/clock.js).
 */

const { stableId } = require('./clock');

const recommendationId = (spec) => stableId(`recommendation:${spec.key}`);

/**
 * The authoritative per-stage dates. A resulted spec with no
 * `interviewingWorkdaysAgo` leaves `interviewing` unset on purpose — the UI
 * reads that as "interviewing was skipped" (see models/Recommendation.js).
 */
const buildStatusDates = (spec, clock) => {
  const statusDates = {
    recommended: clock.at(clock.workdaysAgo(spec.recommendedWorkdaysAgo), 12, 0),
  };
  if (spec.interviewingWorkdaysAgo != null) {
    statusDates.interviewing = clock.at(clock.workdaysAgo(spec.interviewingWorkdaysAgo), 12, 0);
  }
  if (spec.resultedWorkdaysAgo != null) {
    statusDates.resulted = clock.at(clock.workdaysAgo(spec.resultedWorkdaysAgo), 12, 0);
  }
  return statusDates;
};

const buildInterviews = (spec, clock) =>
  (spec.interviews || []).map((interview) => ({
    company: interview.company,
    role: interview.role,
    stage: interview.stage,
    scheduledAt:
      interview.scheduledWorkdaysAhead != null
        ? clock.at(clock.workdaysAhead(interview.scheduledWorkdaysAhead), 10, 0)
        : clock.at(clock.workdaysAgo(interview.scheduledWorkdaysAgo), 10, 0),
    interviewers: interview.interviewers || [],
    locationNote: interview.locationNote || '',
    feedback: interview.feedback || {},
  }));

/**
 * @param refs ids resolved by the caller: internProfileId, authorId,
 *   positionId, projectId, technologyIds, and decidedById when spec.result is set.
 * @returns { doc, statusDates }
 */
const buildRecommendationDoc = (spec, clock, refs) => {
  const statusDates = buildStatusDates(spec, clock);

  const doc = {
    _id: recommendationId(spec),
    internProfile: refs.internProfileId,
    // Both createdBy and updatedBy are required on the model.
    createdBy: refs.authorId,
    updatedBy: refs.authorId,
    position: refs.positionId,
    project: refs.projectId,
    technologies: refs.technologyIds,
    status: spec.status,
    statusDates,
    recommendationNote: spec.recommendationNote || '',
    interviews: buildInterviews(spec, clock),
  };

  if (spec.result) {
    // The model validates that result.note is a non-empty string whenever
    // result.outcome is set.
    doc.result = {
      outcome: spec.result.outcome,
      note: spec.result.note,
      decidedAt: statusDates.resulted,
      decidedBy: refs.decidedById,
    };
  }

  return { doc, statusDates };
};

/**
 * One history row per stage actually reached, so the pipeline timeline has
 * something to render.
 */
const buildStatusHistory = (spec, recommendationId_, statusDates, author) => {
  const stages = [
    ['recommended', 'recommended the intern', statusDates.recommended],
    ['interviewing', 'moved to interviewing', statusDates.interviewing],
    [
      spec.result?.outcome || 'resulted',
      `marked the recommendation ${spec.result?.outcome || 'resulted'}`,
      statusDates.resulted,
    ],
  ];

  return stages
    .filter(([, , timestamp]) => Boolean(timestamp))
    .map(([statusKey, action, timestamp]) => ({
      entityType: 'recommendation',
      entityId: recommendationId_,
      action,
      statusKey,
      userId: author._id,
      userName: author.fullname,
      timestamp,
    }));
};

module.exports = { recommendationId, buildRecommendationDoc, buildStatusHistory };
