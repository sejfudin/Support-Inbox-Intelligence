const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const { RECOMMENDATION_STATUSES, RECOMMENDATION_RESULTS } = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const { READY_STATUS } = require('../models/InternProfile');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { isAssignedMentor, canWriteMentorData } = require('../helpers/internAccess');
const { escapeRegex } = require('../helpers/escapeRegex');
const { buildCvUrl } = require('./internCvService');
const { emitInternDataChanged } = require('../socket/events');
const historyService = require('./historyService');

// The status milestones tracked in the append-only history log — the status
// lifecycle itself (recommended → interviewing → resulted). The placement
// outcome (placed / not placed) is a separate field surfaced as "Result", not
// a timeline step. The recommendations table shows the latest date per status.
const TRACKED_STATUS_KEYS = ['recommended', 'interviewing', 'resulted'];

const statusKeyLabel = (statusKey) =>
  ({
    recommended: 'Recommended',
    interviewing: 'Interviewing',
    resulted: 'Resulted',
  })[statusKey] || statusKey;

// Append a status-change record to the recommendation's history log. Never
// overwrites — each call is a new row, preserving the full trail even when a
// status is revisited.
const logStatusEvent = (recommendationId, userId, statusKey) =>
  historyService.logEntityEvent({
    entityType: 'recommendation',
    entityId: recommendationId,
    userId,
    statusKey,
    action: `Status set to ${statusKeyLabel(statusKey)}`,
  });

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
  { path: 'position', select: 'name slug' },
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

const assertRecommendationWriteAccess = (user, profile) => {
  // Admins can always write; mentors only for interns they are assigned to.
  // Mirrors canWriteMentorData used by evaluations/mentor notes so the
  // frontend's admin+mentor button state matches the backend (the ticket's
  // FE/BE 403 mismatch).
  if (!canWriteMentorData(user, profile)) {
    throw createError('Not authorized to modify recommendations', 403);
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
    expectedEndDate: profile.expectedEndDate || null,
    cvUrl: buildCvUrl(profile.cvPath),
  };
};

const formatRecommendation = (recommendation, statusDates = {}) => {
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
    // Date each tracked status was applied. The document's own statusDates are
    // authoritative (author-editable, support skipping interviewing); records
    // created before that field existed fall back to the append-only history
    // log. A document is "date-managed" once it has a recommended date.
    statusDates: plain.statusDates?.recommended
      ? {
          recommended: plain.statusDates.recommended,
          interviewing: plain.statusDates.interviewing || null,
          resulted: plain.statusDates.resulted || null,
        }
      : {
          recommended: statusDates.recommended || null,
          interviewing: statusDates.interviewing || null,
          resulted: statusDates.resulted || null,
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

const ensurePositionId = async (positionId) => {
  if (!positionId) {
    throw createError('Position is required', 400);
  }

  assertValidObjectId(positionId, 'Position');

  const exists = await Position.exists({ _id: positionId });
  if (!exists) {
    throw createError('Position is invalid', 400);
  }

  return positionId;
};

const ensureProject = (project) => {
  const value = cleanText(project);
  if (!value) {
    throw createError('Project is required', 400);
  }
  return value;
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

/**
 * Resolve the per-stage dates after a create/update. Rules:
 * - Only stages up to the current status hold a date; later stages are cleared.
 * - A stage the caller dates explicitly keeps that date (author-editable).
 * - A newly reached stage with no explicit date defaults to now — except
 *   interviewing when the recommendation is already resulted (jumping straight
 *   from recommended to resulted skips interviewing).
 * - An explicit `null` for interviewing on a resulted recommendation marks the
 *   stage as skipped; recommended and resulted can never be skipped.
 */
const applyStatusDates = (recommendation, payloadDates) => {
  if (payloadDates !== undefined && (typeof payloadDates !== 'object' || payloadDates === null)) {
    throw createError('Status dates must be an object', 400);
  }

  const currentIndex = RECOMMENDATION_STATUSES.indexOf(recommendation.status);
  const next = {};

  RECOMMENDATION_STATUSES.forEach((statusKey, index) => {
    if (index > currentIndex) return; // unreached stages carry no date

    const provided =
      payloadDates && Object.prototype.hasOwnProperty.call(payloadDates, statusKey)
        ? payloadDates[statusKey]
        : undefined;

    if (provided === null) {
      if (statusKey !== 'interviewing' || recommendation.status !== 'resulted') {
        throw createError(
          'Only the interviewing stage of a resulted recommendation can be skipped',
          400
        );
      }
      return; // skipped — no date
    }

    if (provided !== undefined) {
      next[statusKey] = parseDate(provided, `${statusKey} date`);
      return;
    }

    const existing = recommendation.statusDates?.[statusKey];
    if (existing) {
      next[statusKey] = existing;
      return;
    }

    // Newly reached, no explicit date. Interviewing stays skipped when the
    // recommendation jumped straight to resulted.
    if (statusKey === 'interviewing' && recommendation.status === 'resulted') return;
    next[statusKey] = new Date();
  });

  // Stage dates must not run backwards (recommended ≤ interviewing ≤ resulted).
  if (next.interviewing && next.recommended && next.interviewing < next.recommended) {
    throw createError('Interviewing date cannot be before the recommended date', 400);
  }
  if (next.resulted) {
    if (next.interviewing && next.resulted < next.interviewing) {
      throw createError('Resulted date cannot be before the interviewing date', 400);
    }
    if (next.recommended && next.resulted < next.recommended) {
      throw createError('Resulted date cannot be before the recommended date', 400);
    }
  }

  recommendation.statusDates = next;
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
    const escapedSearch = escapeRegex(query.search);
    userFilter.$or = [
      { fullname: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
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

  // One aggregate for all rows on the page (avoids N+1) → { [id]: {status: date} }.
  const statusDatesById = await historyService.getLatestStatusDatesForEntities(
    'recommendation',
    recommendations.map((recommendation) => recommendation._id)
  );

  return {
    recommendations: recommendations.map((recommendation) =>
      formatRecommendation(recommendation, statusDatesById[recommendation._id.toString()] || {})
    ),
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

  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
};

// An intern who is placed or has otherwise left the programme is no longer a
// candidate, so a new recommendation would just linger open (it is never
// counted in the pipeline KPI, which gates on live profile status).
const NON_RECOMMENDABLE_PROFILE_STATUSES = ['placed', 'completed', 'discontinued'];

const createRecommendation = async (user, payload = {}) => {
  const profile = await loadInternProfileByUserId(payload.internUserId);
  assertRecommendationWriteAccess(user, profile);

  if (NON_RECOMMENDABLE_PROFILE_STATUSES.includes(profile.status)) {
    throw createError(`Cannot recommend an intern who is ${profile.status}`, 409);
  }

  assertValidStatus(payload.status);
  // The timeline only moves forward from Recommended — later stages are set by
  // updating the recommendation, so each milestone gets a date.
  if (payload.status !== undefined && payload.status !== 'recommended') {
    throw createError('A new recommendation must start as Recommended', 400);
  }
  const position = await ensurePositionId(payload.positionId);
  const project = ensureProject(payload.project);
  const technologies = await ensureTechnologyIds(payload.technologyIds);
  const interviews = normalizeInterviews(payload.interviews || []);

  const recommendation = await Recommendation.create({
    internProfile: profile._id,
    createdBy: user._id,
    updatedBy: user._id,
    position,
    project,
    technologies,
    status: 'recommended',
    recommendationNote: cleanText(payload.recommendationNote),
    interviews,
    statusDates: {
      // Defaults to today; the author may backdate it at creation.
      recommended: parseDate(payload.statusDates?.recommended, 'recommended date') || new Date(),
    },
  });

  // Append the initial status to the history log (append-only trail).
  await logStatusEvent(recommendation._id, user._id, recommendation.status);

  await recommendation.populate(RECOMMENDATION_POPULATE);
  emitInternDataChanged();
  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
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

const ACTIVE_PIPELINE_STATUSES = ['recommended', 'interviewing'];

// A placed intern is out of the pipeline: any of their still-open
// recommendations are moot, so resolve them as not_placed with an
// explanatory note. Idempotent — interns with no open recommendations
// are untouched.
const closeActiveRecommendationsForIntern = async (
  internProfileId,
  user,
  { excludeRecommendationId = null } = {}
) => {
  const filter = {
    internProfile: internProfileId,
    status: { $in: ACTIVE_PIPELINE_STATUSES },
  };
  if (excludeRecommendationId) filter._id = { $ne: excludeRecommendationId };

  // Per-document (not a blind updateMany) so each auto-close also gets its
  // append-only history row and complete statusDates — otherwise the table
  // (history-backed for legacy records) and the cards disagree on the
  // Resulted date, and the audit trail silently misses the close.
  const toClose = await Recommendation.find(filter).select('_id status statusDates createdAt');
  const now = new Date();

  for (const recommendation of toClose) {
    const set = {
      status: 'resulted',
      result: {
        outcome: 'not_placed',
        note: 'Closed automatically because the intern was placed.',
        decidedAt: now,
        decidedBy: user._id,
      },
      updatedBy: user._id,
    };

    if (recommendation.statusDates?.recommended) {
      // Stamp the stage date so the auto-close shows on the status timeline
      // like any other resulted recommendation.
      set['statusDates.resulted'] = now;
    } else {
      // Records that predate statusDates: seed the earlier stages from the
      // history log (same as updateRecommendation) so the document carries a
      // complete set, not just the resulted date.
      const historyDates = await historyService.getLatestStatusDates(
        'recommendation',
        recommendation._id
      );
      const statusDates = {
        recommended: historyDates.recommended || recommendation.createdAt,
        resulted: now,
      };
      if (historyDates.interviewing) statusDates.interviewing = historyDates.interviewing;
      set.statusDates = statusDates;
    }

    // updateOne (not save) so legacy documents missing the now-required
    // position/project fields aren't blocked by model validation.
    await Recommendation.updateOne({ _id: recommendation._id }, { $set: set });

    await historyService.logEntityEvent({
      entityType: 'recommendation',
      entityId: recommendation._id,
      userId: user._id,
      statusKey: 'resulted',
      action: 'Status set to Resulted (closed automatically because the intern was placed)',
    });
  }
};

const updateRecommendation = async (user, recommendationId, payload = {}) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw createError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw createError('Intern profile not found', 404);

  assertRecommendationWriteAccess(user, profile);

  // Snapshot the status BEFORE mutating so we append a history record only on an
  // actual status change (append-only — never overwrite an existing record).
  const previousStatus = recommendation.status;

  if (payload.positionId !== undefined) {
    recommendation.position = await ensurePositionId(payload.positionId);
  }

  if (payload.project !== undefined) {
    recommendation.project = ensureProject(payload.project);
  }

  if (payload.technologyIds !== undefined) {
    recommendation.technologies = await ensureTechnologyIds(payload.technologyIds);
  }

  if (payload.status !== undefined) {
    assertValidStatus(payload.status);
    // The timeline only moves forward — completed stages can't be re-selected.
    if (
      RECOMMENDATION_STATUSES.indexOf(payload.status) <
      RECOMMENDATION_STATUSES.indexOf(recommendation.status)
    ) {
      throw createError('Recommendation status can only move forward', 400);
    }
    recommendation.status = payload.status;
  }

  if (payload.recommendationNote !== undefined) {
    recommendation.recommendationNote = cleanText(payload.recommendationNote);
  }

  if (payload.interviews !== undefined) {
    recommendation.interviews = normalizeInterviews(payload.interviews);
  }

  applyResultPayload(recommendation, payload.result, user);

  // Records created before statusDates existed on the document: seed from the
  // history log so editing them doesn't reset their historical dates to today.
  if (!recommendation.statusDates?.recommended) {
    const historyDates = await historyService.getLatestStatusDates(
      'recommendation',
      recommendation._id
    );
    recommendation.statusDates = {
      recommended: historyDates.recommended || recommendation.createdAt,
      interviewing: historyDates.interviewing,
      resulted: historyDates.resulted,
    };
  }

  applyStatusDates(recommendation, payload.statusDates);
  recommendation.updatedBy = user._id;

  await recommendation.save();

  // Keep the intern's placement status in sync with the outcome: "placed"
  // marks the profile placed; "not placed" puts the intern back on the bench
  // (ready for a new placement). Terminal statuses are never touched.
  const outcome = recommendation.result?.outcome;
  if (outcome === 'placed') {
    if (profile.status !== 'placed') {
      profile.status = 'placed';
      await profile.save();
    }
    // A placed intern is out of the pipeline — resolve their other still-open
    // recommendations as not_placed (idempotent).
    await closeActiveRecommendationsForIntern(profile._id, user, {
      excludeRecommendationId: recommendation._id,
    });
  } else if (outcome === 'not_placed' && ['active', 'placed'].includes(profile.status)) {
    profile.status = READY_STATUS;
    await profile.save();
  }

  // Append-only status history: log a new row whenever the tracked status
  // actually changes (recommended → interviewing → resulted). The row is never
  // overwritten, so prior status dates are preserved even if status moves back.
  if (
    recommendation.status !== previousStatus &&
    TRACKED_STATUS_KEYS.includes(recommendation.status)
  ) {
    await logStatusEvent(recommendation._id, user._id, recommendation.status);
  }

  await recommendation.populate(RECOMMENDATION_POPULATE);
  // Covers the direct update and any auto-closed sibling recommendations —
  // the invalidation is a single global "intern data changed" broadcast.
  emitInternDataChanged();
  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
};

const deleteRecommendation = async (user, recommendationId) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw createError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw createError('Intern profile not found', 404);

  // Same rule as writes: admins always, mentors only for their assigned interns.
  assertRecommendationWriteAccess(user, profile);

  await Recommendation.deleteOne({ _id: recommendation._id });
  // Remove the recommendation's status trail too — it has no other consumer.
  await historyService.deleteEntityHistory('recommendation', recommendation._id);

  // The intern's placement state follows the MOST RECENT recommendation, so
  // recompute it from the newest remaining record: a Placed outcome keeps the
  // intern placed, anything else (no outcome, not placed, or no recommendation
  // left at all) returns them to the bench as ready. Manual lifecycle states
  // (active/completed/discontinued) are never touched here.
  if (['placed', READY_STATUS].includes(profile.status)) {
    const latest = await Recommendation.findOne({ internProfile: profile._id })
      .sort({ updatedAt: -1 })
      .select('result.outcome')
      .lean();
    const nextStatus = latest?.result?.outcome === 'placed' ? 'placed' : READY_STATUS;
    if (profile.status !== nextStatus) {
      profile.status = nextStatus;
      await profile.save();
    }
  }

  emitInternDataChanged();

  // Enough shape for the frontend cache invalidation (id + intern user id).
  return { _id: recommendation._id, internProfile: { user: profile.user } };
};

module.exports = {
  listRecommendations,
  getRecommendation,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  closeActiveRecommendationsForIntern,
};
