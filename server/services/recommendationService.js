const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const { RECOMMENDATION_STATUSES, RECOMMENDATION_RESULTS } = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { isAssignedMentor } = require('../helpers/internAccess');
const { buildCvUrl } = require('./internCvService');

const READ_ROLES = [ROLES.ADMIN, ROLES.LEADERSHIP, ROLES.MENTOR];

const RECOMMENDATION_POPULATE = [
  {
    path: 'internProfile',
    populate: [
      {
        path: 'user',
        select: 'fullname email status role hub',
        populate: { path: 'hub', select: 'name city country' },
      },
      { path: 'internshipType', select: 'name slug' },
      { path: 'primaryMentor', select: 'fullname email role' },
      { path: 'secondaryMentor', select: 'fullname email role' },
    ],
  },
  { path: 'technologies', select: 'name slug' },
  { path: 'createdBy', select: 'fullname email role' },
  { path: 'updatedBy', select: 'fullname email role' },
  { path: 'result.decidedBy', select: 'fullname email role' },
];

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertValidObjectId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(`${label} is invalid`, 400);
  }
};

const assertReadAccess = (user) => {
  if (!READ_ROLES.includes(user.role)) {
    throw createError('Not authorized', 403);
  }
};

// Only the assigned mentor may create/update a recommendation (admins are
// read-only here). Matches the client gate (role === MENTOR) and development.
const assertRecommendationWriteAccess = (user, profile) => {
  if (user.role !== ROLES.MENTOR || !isAssignedMentor(profile, user._id)) {
    throw createError('Only the assigned mentor can modify recommendations', 403);
  }
};

const formatUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    id: user._id,
    fullname: user.fullname,
    email: user.email,
    role: user.role,
    hub: user.hub || null,
  };
};

const formatInternProfile = (profile) => {
  if (!profile) return null;
  return {
    _id: profile._id,
    id: profile._id,
    user: formatUser(profile.user),
    internshipType: profile.internshipType || null,
    primaryMentor: formatUser(profile.primaryMentor),
    secondaryMentor: formatUser(profile.secondaryMentor),
    status: profile.status,
    readyForPlacement: profile.readyForPlacement,
    expectedEndDate: profile.expectedEndDate || null,
    cvUrl: buildCvUrl(profile.cvPath),
  };
};

const formatRecommendation = (recommendation) => {
  const plain = recommendation.toObject ? recommendation.toObject() : recommendation;
  return {
    ...plain,
    id: plain._id,
    internProfile: formatInternProfile(plain.internProfile),
    createdBy: formatUser(plain.createdBy),
    updatedBy: formatUser(plain.updatedBy),
    result: {
      outcome: plain.result?.outcome || null,
      note: plain.result?.note || '',
      decidedAt: plain.result?.decidedAt || null,
      decidedBy: formatUser(plain.result?.decidedBy),
    },
  };
};

const ensureTechnologyIds = async (technologyIds = []) => {
  const ids = [...new Set((technologyIds || []).filter(Boolean).map((id) => id.toString()))];

  ids.forEach((id) => assertValidObjectId(id, 'Technology'));

  if (ids.length === 0) return [];

  const count = await Technology.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) {
    throw createError('One or more technologies are invalid', 400);
  }

  return ids;
};

const parseDate = (value, label) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`${label} is invalid`, 400);
  }
  return date;
};

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeFeedback = (feedback = {}) => {
  const normalized = {
    summary: cleanText(feedback.summary),
    strengths: cleanText(feedback.strengths),
    concerns: cleanText(feedback.concerns),
  };

  if (feedback.rating !== undefined && feedback.rating !== null && feedback.rating !== '') {
    const rating = Number(feedback.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createError('Interview feedback rating must be between 1 and 5', 400);
    }
    normalized.rating = rating;
  }

  return normalized;
};

const hasInterviewContent = (interview = {}) =>
  [
    interview.company,
    interview.role,
    interview.stage,
    interview.scheduledAt,
    interview.locationNote,
    interview.feedback?.summary,
    interview.feedback?.strengths,
    interview.feedback?.concerns,
    interview.feedback?.rating,
    ...(Array.isArray(interview.interviewers) ? interview.interviewers : []),
  ].some((value) => value !== undefined && value !== null && String(value).trim() !== '');

const normalizeInterviews = (interviews = []) => {
  if (!Array.isArray(interviews)) {
    throw createError('Interviews must be a list', 400);
  }

  return interviews.filter(hasInterviewContent).map((interview) => {
    const company = cleanText(interview.company);
    const role = cleanText(interview.role);

    if (!company) throw createError('Interview company is required', 400);
    if (!role) throw createError('Interview role is required', 400);

    return {
      _id:
        interview._id && mongoose.Types.ObjectId.isValid(interview._id) ? interview._id : undefined,
      company,
      role,
      stage: cleanText(interview.stage),
      scheduledAt: parseDate(interview.scheduledAt, 'Interview scheduled date'),
      interviewers: Array.isArray(interview.interviewers)
        ? interview.interviewers.map(cleanText).filter(Boolean)
        : [],
      locationNote: cleanText(interview.locationNote),
      feedback: normalizeFeedback(interview.feedback),
    };
  });
};

const assertValidStatus = (status) => {
  if (status !== undefined && !RECOMMENDATION_STATUSES.includes(status)) {
    throw createError('Invalid recommendation status', 400);
  }
};

const assertValidOutcome = (outcome) => {
  if (outcome !== undefined && !RECOMMENDATION_RESULTS.includes(outcome)) {
    throw createError('Invalid recommendation result', 400);
  }
};

const loadInternProfileByUserId = async (internUserId) => {
  assertValidObjectId(internUserId, 'Intern');
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw createError('Intern profile not found', 404);
  return profile;
};

const buildAccessibleProfileIds = async (user, query = {}) => {
  const profileFilter = {};

  if (user.role === ROLES.MENTOR) {
    profileFilter.$or = [{ primaryMentor: user._id }, { secondaryMentor: user._id }];
  }

  if (query.internUserId) {
    assertValidObjectId(query.internUserId, 'Intern');
    profileFilter.user = query.internUserId;
  }

  const userFilter = { role: ROLES.INTERN };

  if (query.hubId) {
    assertValidObjectId(query.hubId, 'Hub');
    userFilter.hub = query.hubId;
  }

  if (query.search) {
    userFilter.$or = [
      { fullname: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.search || query.hubId) {
    const users = await User.find(userFilter).select('_id').lean();

    if (users.length === 0) return [];

    const userIds = users.map((candidate) => candidate._id);
    if (profileFilter.user) {
      const explicitId = profileFilter.user.toString();
      if (!userIds.some((id) => id.toString() === explicitId)) return [];
    } else {
      profileFilter.user = { $in: userIds };
    }
  }

  const needsProfileFilter =
    user.role === ROLES.MENTOR ||
    Boolean(query.internUserId) ||
    Boolean(query.search) ||
    Boolean(query.hubId);

  if (!needsProfileFilter) return null;

  const profiles = await InternProfile.find(profileFilter).select('_id').lean();
  return profiles.map((profile) => profile._id);
};

const listRecommendations = async (user, query = {}) => {
  assertReadAccess(user);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.status) {
    assertValidStatus(query.status);
    filter.status = query.status;
  }

  if (query.result) {
    assertValidOutcome(query.result);
    filter['result.outcome'] = query.result;
  }

  if (query.technologyId) {
    assertValidObjectId(query.technologyId, 'Technology');
    filter.technologies = query.technologyId;
  }

  const accessibleProfileIds = await buildAccessibleProfileIds(user, query);
  if (accessibleProfileIds) {
    if (accessibleProfileIds.length === 0) {
      return { recommendations: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
    filter.internProfile = { $in: accessibleProfileIds };
  }

  const [recommendations, total] = await Promise.all([
    Recommendation.find(filter)
      .populate(RECOMMENDATION_POPULATE)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Recommendation.countDocuments(filter),
  ]);

  return {
    recommendations: recommendations.map(formatRecommendation),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
};

const assertRecommendationReadAccess = (user, recommendation) => {
  assertReadAccess(user);

  if (user.role === ROLES.MENTOR && !isAssignedMentor(recommendation.internProfile, user._id)) {
    throw createError('Not authorized to access this recommendation', 403);
  }
};

const getRecommendation = async (user, recommendationId) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation =
    await Recommendation.findById(recommendationId).populate(RECOMMENDATION_POPULATE);

  if (!recommendation) throw createError('Recommendation not found', 404);
  assertRecommendationReadAccess(user, recommendation);

  return formatRecommendation(recommendation);
};

const createRecommendation = async (user, payload = {}) => {
  const profile = await loadInternProfileByUserId(payload.internUserId);
  assertRecommendationWriteAccess(user, profile);

  assertValidStatus(payload.status);
  const technologies = await ensureTechnologyIds(payload.technologyIds);
  const interviews = normalizeInterviews(payload.interviews || []);

  const recommendation = await Recommendation.create({
    internProfile: profile._id,
    createdBy: user._id,
    updatedBy: user._id,
    technologies,
    status: payload.status || 'draft',
    recommendationNote: cleanText(payload.recommendationNote),
    interviews,
  });

  await recommendation.populate(RECOMMENDATION_POPULATE);
  return formatRecommendation(recommendation);
};

const applyResultPayload = (recommendation, payloadResult, user) => {
  if (!payloadResult || typeof payloadResult !== 'object') return;

  const outcome = payloadResult.outcome ?? recommendation.result?.outcome;
  assertValidOutcome(outcome);

  const note =
    payloadResult.note !== undefined
      ? cleanText(payloadResult.note)
      : recommendation.result?.note || '';

  if (outcome && !note) {
    throw createError('Result note is required', 400);
  }

  recommendation.result = {
    outcome,
    note,
    decidedAt: outcome ? new Date() : undefined,
    decidedBy: outcome ? user._id : undefined,
  };

  if (outcome) {
    recommendation.status = 'resulted';
  }
};

const updateRecommendation = async (user, recommendationId, payload = {}) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw createError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw createError('Intern profile not found', 404);

  assertRecommendationWriteAccess(user, profile);

  if (payload.technologyIds !== undefined) {
    recommendation.technologies = await ensureTechnologyIds(payload.technologyIds);
  }

  if (payload.status !== undefined) {
    assertValidStatus(payload.status);
    recommendation.status = payload.status;
  }

  if (payload.recommendationNote !== undefined) {
    recommendation.recommendationNote = cleanText(payload.recommendationNote);
  }

  if (payload.interviews !== undefined) {
    recommendation.interviews = normalizeInterviews(payload.interviews);
  }

  applyResultPayload(recommendation, payload.result, user);
  recommendation.updatedBy = user._id;

  await recommendation.save();

  if (recommendation.result?.outcome === 'placed') {
    profile.status = 'placed';
    profile.readyForPlacement = false;
    await profile.save();
  }

  await recommendation.populate(RECOMMENDATION_POPULATE);
  return formatRecommendation(recommendation);
};

module.exports = {
  listRecommendations,
  getRecommendation,
  createRecommendation,
  updateRecommendation,
};
