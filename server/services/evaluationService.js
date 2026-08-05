const Evaluation = require('../models/Evaluation');
const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');
const { assertInternAccess } = require('../helpers/internAccess');

const averageOf = (scores = {}) => {
  const values = Object.values(scores);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) / 10;
};

const formatEvaluation = (evaluation) => {
  const plain = evaluation.toObject ? evaluation.toObject() : evaluation;

  return {
    ...plain,
    id: plain._id,
    averageScore: averageOf(plain.scores),
  };
};

/**
 * The redacted shape an intern sees of their *own* evaluation — scores, period,
 * and who wrote it. `notes` is deliberately dropped: it is written by an admin
 * for an internal audience, not addressed to the intern, and nothing in the
 * intern dashboard renders it. Built by picking fields rather than deleting
 * them, so a field added to the model later isn't exposed by accident.
 */
const formatOwnEvaluation = (evaluation) => ({
  id: evaluation._id,
  periodStart: evaluation.periodStart,
  periodEnd: evaluation.periodEnd,
  scores: evaluation.scores,
  averageScore: averageOf(evaluation.scores),
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
    .populate('evaluator', 'fullname email role')
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

  const requiredScores = ['technical', 'communication', 'ownership', 'growth'];
  for (const key of requiredScores) {
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

  await evaluation.populate('evaluator', 'fullname email role');
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
