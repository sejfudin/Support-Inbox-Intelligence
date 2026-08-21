const Evaluation = require('../models/Evaluation');
const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');
const { assertInternAccess } = require('../helpers/internAccess');
const internNotificationService = require('./internNotificationService');
const { EVALUATION_CRITERIA, averageScore } = require('../helpers/evaluationTrend');
const { emitInternDataChanged } = require('../socket/events');
const { userSelect } = require('../constants/userSelect');

const formatEvaluation = (evaluation) => {
  const plain = evaluation.toObject ? evaluation.toObject() : evaluation;

  return {
    ...plain,
    id: plain._id,
    averageScore: averageScore(plain.scores),
  };
};

/**
 * The redacted shape an intern sees of their *own* evaluation — the period, the
 * four scores, who wrote it, and the write-up that goes with them.
 *
 * **`notes` used to be withheld here and now is not.** The reasoning for hiding
 * it was that it is written for an internal audience; the reasoning for showing
 * it is that an evaluation without its write-up is a number with no explanation,
 * and an intern being scored 3/5 on ownership cannot act on the digit alone. It
 * is the mentor's feedback *to* them, unlike the three fields still withheld from
 * the recommendation shape (`recommendationNote`, `interviews[].feedback`,
 * `result.note`), which are written *about* them for a placement decision. Anyone
 * needing a channel that stays internal has `MentorComment`, which has its own
 * `visibleTo` list and remains invisible to the intern.
 *
 * Still built by picking fields rather than deleting them, so a field added to the
 * model later is absent by default instead of leaking.
 */
const formatOwnEvaluation = (evaluation) => ({
  id: evaluation._id,
  periodStart: evaluation.periodStart,
  periodEnd: evaluation.periodEnd,
  scores: evaluation.scores,
  averageScore: averageScore(evaluation.scores),
  notes: evaluation.notes || '',
  evaluator: evaluation.evaluator?.fullname || '',
  createdAt: evaluation.createdAt,
});

const listEvaluations = async (user, internUserId) => {
  const profile = await assertInternAccess(user, internUserId);

  // Evaluations are admin-only — mentors and interns can't view them.
  if (user.role === ROLES.INTERN || user.role === ROLES.MENTOR) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const evaluations = await Evaluation.find({ internProfile: profile._id })
    .populate('evaluator', userSelect('role'))
    .sort({ periodEnd: -1 });

  return evaluations.map(formatEvaluation);
};

const createEvaluation = async (user, internUserId, payload) => {
  const profile = await assertInternAccess(user, internUserId, { write: true });

  if (user.role !== ROLES.ADMIN) {
    const err = new Error('Not authorized to create evaluations');
    err.statusCode = 403;
    throw err;
  }

  const { periodStart, periodEnd, scores, notes } = payload;
  if (!periodStart || !periodEnd) throw new Error('Evaluation period is required');

  for (const key of EVALUATION_CRITERIA) {
    const value = scores?.[key];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`Score for ${key} must be between 1 and 5`);
    }
  }

  const evaluation = await Evaluation.create({
    internProfile: profile._id,
    evaluator: user._id,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    scores,
    notes: notes?.trim() || '',
  });

  await evaluation.populate('evaluator', userSelect('role'));

  internNotificationService.notifyEvaluationCreated({
    internUserId: profile.user,
    internProfileId: profile._id,
    periodStart: evaluation.periodStart,
    periodEnd: evaluation.periodEnd,
  });

  // The intern reads this about themselves on their own board and on "My
  // progress", and neither is reachable by any workspace scope — programme data
  // is not workspace data. Without this the new evaluation is invisible to them
  // until a refetch, which for a page they may be sitting on is indefinitely.
  emitInternDataChanged();

  return formatEvaluation(evaluation);
};

/**
 * The signed-in intern's own evaluations, newest period first, redacted by
 * `formatOwnEvaluation`.
 *
 * Separate from `listEvaluations` on purpose. That one is the admin surface and
 * 403s an intern outright; this is a narrower, self-only read added for the
 * intern dashboard's "My evaluations" card. The intern id is never a parameter —
 * it is resolved from the authenticated user — so there is no id to tamper with.
 */
const listOwnEvaluations = async (user) => {
  if (user.role !== ROLES.INTERN) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const profile = await InternProfile.findOne({ user: user._id }).select('_id').lean();
  if (!profile) return [];

  const evaluations = await Evaluation.find({ internProfile: profile._id })
    .populate('evaluator', 'fullname')
    .sort({ periodEnd: -1 })
    .lean();

  return evaluations.map(formatOwnEvaluation);
};

module.exports = { listEvaluations, createEvaluation, listOwnEvaluations };
