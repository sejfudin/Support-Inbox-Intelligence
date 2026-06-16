const Evaluation = require('../models/Evaluation');
const { ROLES } = require('../constants/roles');
const { assertInternAccess, canWriteMentorData } = require('../helpers/internAccess');

const formatEvaluation = (evaluation) => {
  const plain = evaluation.toObject ? evaluation.toObject() : evaluation;
  const scores = plain.scores || {};
  const values = Object.values(scores);
  const average = values.length > 0 ? values.reduce((sum, n) => sum + n, 0) / values.length : null;

  return {
    ...plain,
    id: plain._id,
    averageScore: average ? Math.round(average * 10) / 10 : null,
  };
};

const listEvaluations = async (user, internUserId) => {
  const profile = await assertInternAccess(user, internUserId);

  if (user.role === ROLES.INTERN) {
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

  if (!canWriteMentorData(user, profile)) {
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

module.exports = { listEvaluations, createEvaluation };
