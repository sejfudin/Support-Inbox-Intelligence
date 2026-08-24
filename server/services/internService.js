const mongoose = require('mongoose');
const User = require('../models/User');
const InternProfile = require('../models/InternProfile');
const { INTERN_STATUSES, READY_STATUS } = require('../models/InternProfile');
const ReadinessFlag = require('../models/ReadinessFlag');
const Evaluation = require('../models/Evaluation');
const Recommendation = require('../models/Recommendation');
const { RECOMMENDATION_STATUSES } = require('../models/Recommendation');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const { ROLES } = require('../constants/roles');
const { escapeRegex } = require('../helpers/escapeRegex');
const {
  canViewFepDirectory,
  canWriteMentorData,
  canManageDocumentationLinks,
  canViewInternProfile,
  canEditOwnInternProfile,
  isAssignedMentor,
} = require('../helpers/internAccess');
const { canInternEditDeclaredPosition } = require('../helpers/specializationRules');
const { buildCvUrl } = require('./internCvService');
const { emitInternDataChanged } = require('../socket/events');
const { createInternProfile } = require('./internProfileService');
const { closeActiveRecommendationsForIntern } = require('./recommendationService');
const internNotificationService = require('./internNotificationService');
const { userSelect } = require('../constants/userSelect');
const { excludeOrphanedProfileStages } = require('../helpers/orphanedProfiles');

const PROFILE_POPULATE = [
  {
    path: 'user',
    select: userSelect('role', 'status', 'hub'),
    populate: { path: 'hub', select: 'name city country' },
  },
  { path: 'internshipType', select: 'name slug' },
  {
    path: 'primaryMentor',
    select: userSelect('role', 'hub'),
    populate: { path: 'hub', select: 'name' },
  },
  {
    path: 'secondaryMentor',
    select: userSelect('role', 'hub'),
    populate: { path: 'hub', select: 'name' },
  },
  { path: 'selfTechnologies', select: 'name slug' },
  { path: 'declaredPosition', select: 'name slug' },
  { path: 'secondaryPosition', select: 'name slug' },
];

const formatProfile = (profile, viewer = null) => {
  const plain = profile.toObject ? profile.toObject() : profile;
  // `cvTechnologies` was removed from the InternProfile schema, but Mongoose
  // still echoes it from documents written before that change — strip it
  // explicitly rather than relying on the schema to hide already-stored data.
  const { internalCvUrl, cvTechnologies, ...rest } = plain;
  const canSeeInternalCv =
    Boolean(viewer) && (viewer.role === ROLES.LEADERSHIP || canWriteMentorData(viewer, profile));

  return {
    ...rest,
    id: plain._id,
    cvUrl: buildCvUrl(plain.cvPath),
    ...(canSeeInternalCv ? { internalCvUrl: internalCvUrl || null } : {}),
  };
};

const buildListFilter = (user, query) => {
  const filter = {};
  const userFilter = { role: ROLES.INTERN };

  if (query.hubId) userFilter.hub = query.hubId;
  if (query.status) userFilter.status = query.status;

  if (query.search) {
    const escapedSearch = escapeRegex(query.search);
    userFilter.$or = [
      { fullname: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  if (user.role === ROLES.MENTOR) {
    filter.$or = [{ primaryMentor: user._id }, { secondaryMentor: user._id }];
  }

  if (query.mentorId) {
    filter.$or = [{ primaryMentor: query.mentorId }, { secondaryMentor: query.mentorId }];
  }

  if (query.internshipTypeId) filter.internshipType = query.internshipTypeId;
  if (query.profileStatus) filter.status = query.profileStatus;
  if (query.technologyId) filter.selfTechnologies = query.technologyId;

  return { profileFilter: filter, userFilter };
};

const listInterns = async (user, query = {}) => {
  if (!canViewFepDirectory(user.role)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const { profileFilter, userFilter } = buildListFilter(user, query);

  const internUsers = await User.find(userFilter).select('_id').lean();
  const internUserIds = internUsers.map((u) => u._id);

  if (internUserIds.length === 0) {
    return { interns: [], pagination: { page, limit, total: 0, pages: 0 } };
  }

  const fullFilter = { user: { $in: internUserIds }, ...profileFilter };

  // `inPipeline=true` → only interns with an active recommendation;
  // `inPipeline=false` → exclude them (e.g. the "ready" bench, matching the
  // leadership KPI which counts ready interns not yet in the pipeline).
  if (query.inPipeline === 'true' || query.inPipeline === 'false') {
    const pipelineProfileIds = await Recommendation.distinct('internProfile', {
      status: { $in: ACTIVE_PIPELINE_STATUSES },
    });
    fullFilter._id =
      query.inPipeline === 'true' ? { $in: pipelineProfileIds } : { $nin: pipelineProfileIds };
    // Keep the pipeline view free of placed/finished interns that still carry a
    // stale active recommendation, matching the leadership KPI.
    if (query.inPipeline === 'true' && !fullFilter.status) {
      fullFilter.status = { $nin: PIPELINE_EXCLUDED_PROFILE_STATUSES };
    }
  }

  const [profiles, total] = await Promise.all([
    InternProfile.find(fullFilter)
      .populate(PROFILE_POPULATE)
      // `_id` tiebreaker: a whole cohort routinely shares one `startDate`, and
      // Mongo's sort is not stable for ties — without it, paging can repeat one
      // intern across pages and drop another entirely.
      .sort({ startDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    InternProfile.countDocuments(fullFilter),
  ]);

  return {
    interns: profiles.map((p) => formatProfile(p, user)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
};

const getInternByUserId = async (user, internUserId) => {
  const profile = await InternProfile.findOne({ user: internUserId }).populate(PROFILE_POPULATE);

  if (!profile) {
    const err = new Error('Intern profile not found');
    err.statusCode = 404;
    throw err;
  }

  const canView =
    user.role === ROLES.ADMIN ||
    user.role === ROLES.LEADERSHIP ||
    (user.role === ROLES.MENTOR && isAssignedMentor(profile, user._id)) ||
    (user.role === ROLES.INTERN && profile.user._id.toString() === user._id.toString());

  if (!canView) {
    const err = new Error('Not authorized to access this intern');
    err.statusCode = 403;
    throw err;
  }

  return formatProfile(profile, user);
};

const getMyInternProfile = async (user) => {
  if (user.role !== ROLES.INTERN) {
    const err = new Error('Only interns have an intern profile');
    err.statusCode = 400;
    throw err;
  }

  const profile = await InternProfile.findOne({ user: user._id }).populate(PROFILE_POPULATE);

  if (!profile) {
    const err = new Error('Intern profile not found');
    err.statusCode = 404;
    throw err;
  }

  return formatProfile(profile);
};

const updateSelfTechnologies = async (user, technologyIds = []) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) throw new Error('Intern profile not found');
  if (!canEditOwnInternProfile(user, profile)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const ids = [...new Set(technologyIds)];
  if (ids.length > 0) {
    const count = await Technology.countDocuments({ _id: { $in: ids }, isActive: true });
    if (count !== ids.length) throw new Error('One or more technologies are invalid');
  }

  // The only place the list ever gets shorter: a CV scan only adds to it
  // (helpers/cvTechnologySync.js), so removing a technology is always the intern's own act here.
  profile.selfTechnologies = ids;
  await profile.save();
  return getMyInternProfile(user);
};

const updateSelfPosition = async (user, positionId = null) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) throw new Error('Intern profile not found');
  if (!canEditOwnInternProfile(user, profile)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  if (!canInternEditDeclaredPosition(profile)) {
    const err = new Error('Your position is locked by your specialization');
    err.statusCode = 403;
    throw err;
  }

  if (positionId) {
    if (profile.secondaryPosition && positionId === profile.secondaryPosition.toString()) {
      throw new Error('Main position must differ from your secondary position');
    }
    const position = await Position.findById(positionId);
    if (!position) throw new Error('Invalid position');
  }

  profile.declaredPosition = positionId || null;
  await profile.save();
  return getMyInternProfile(user);
};

const updateSelfSecondaryPosition = async (user, positionId = null) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) throw new Error('Intern profile not found');
  if (!canEditOwnInternProfile(user, profile)) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  if (positionId) {
    if (profile.declaredPosition && positionId === profile.declaredPosition.toString()) {
      throw new Error('Secondary position must differ from your main position');
    }
    const position = await Position.findById(positionId);
    if (!position) throw new Error('Invalid position');
  }

  profile.secondaryPosition = positionId || null;
  await profile.save();
  return getMyInternProfile(user);
};

const updateInternProgramme = async (user, internUserId, payload) => {
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw new Error('Intern profile not found');

  if (!canWriteMentorData(user, profile)) {
    const err = new Error('Not authorized to modify this intern');
    err.statusCode = 403;
    throw err;
  }

  const allowedStatuses = INTERN_STATUSES;
  const previousStatus = profile.status;
  const previousExpectedEndDateMs = profile.expectedEndDate
    ? profile.expectedEndDate.getTime()
    : null;

  if (payload.status !== undefined) {
    // Lifecycle status changes are admin-only — even the assigned mentor can't
    // change it, though mentors can still write other mentor data below
    // (e.g. expectedEndDate) via the canWriteMentorData check above.
    if (user.role !== ROLES.ADMIN) {
      const err = new Error('Only admins can change this intern’s status');
      err.statusCode = 403;
      throw err;
    }
    if (!allowedStatuses.includes(payload.status)) throw new Error('Invalid status');
    // Placed is set automatically when a recommendation's outcome is recorded
    // as placed (recommendationService.updateRecommendation) — it is never a
    // manual admin choice. Moving *out* of placed manually is still allowed
    // (e.g. correcting a mistake), as is re-saving while already placed.
    if (payload.status === 'placed' && previousStatus !== 'placed') {
      const err = new Error(
        'Placed is set automatically when a recommendation records the intern as placed — it can’t be set manually.'
      );
      err.statusCode = 400;
      throw err;
    }
    profile.status = payload.status;
  }

  if (payload.expectedEndDate !== undefined) {
    profile.expectedEndDate = payload.expectedEndDate ? new Date(payload.expectedEndDate) : null;
  }

  // The intern's first day on a real project. For anyone with a placement record
  // this is derived from that placement's start date and re-derived on every
  // update (see recommendationService), so edit the start date there rather than
  // here — a value written here is overwritten the next time the recommendation
  // is touched. This path is for the intern who left without a placement record
  // at all. Clearing it puts them back on the hook for attendance.
  if (payload.placedAt !== undefined) {
    profile.placedAt = payload.placedAt ? new Date(payload.placedAt) : null;
  }

  await profile.save();

  // Placement ends the intern's pipeline run — close any recommendations left
  // open so they stop counting toward "In pipeline". Silent on purpose: it's
  // a side effect of the placement below, not its own notification.
  if (payload.status === 'placed') {
    await closeActiveRecommendationsForIntern(profile._id, user);
  }

  emitInternDataChanged();

  if (payload.status !== undefined && payload.status !== previousStatus) {
    if (payload.status === 'placed') {
      internNotificationService.notifyInternPlaced({ internUserId, internProfileId: profile._id });
    } else {
      internNotificationService.notifyInternStatusChanged({
        internUserId,
        internProfileId: profile._id,
        newStatus: payload.status,
      });
    }
  }

  if (payload.expectedEndDate !== undefined) {
    const nextExpectedEndDateMs = profile.expectedEndDate
      ? profile.expectedEndDate.getTime()
      : null;
    if (nextExpectedEndDateMs !== previousExpectedEndDateMs) {
      internNotificationService.notifyExpectedEndDateChanged({
        internUserId,
        internProfileId: profile._id,
        expectedEndDate: profile.expectedEndDate,
      });
    }
  }

  return getInternByUserId(user, internUserId);
};

const MAX_DOCUMENTATION_LINKS = 20;

const isValidDocumentationUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const validateDocumentationLinks = (links) => {
  if (!Array.isArray(links)) {
    throw new Error('Documentation links must be an array');
  }

  if (links.length > MAX_DOCUMENTATION_LINKS) {
    throw new Error(`A maximum of ${MAX_DOCUMENTATION_LINKS} documentation links is allowed`);
  }

  return links.map((link, index) => {
    const label = String(link?.label || '').trim();
    const url = String(link?.url || '').trim();

    if (!label) {
      throw new Error(`Documentation link ${index + 1} requires a label`);
    }
    if (!url) {
      throw new Error(`Documentation link ${index + 1} requires a URL`);
    }
    if (!isValidDocumentationUrl(url)) {
      throw new Error(`Documentation link ${index + 1} must use an http or https URL`);
    }

    return { label, url };
  });
};

const updateDocumentationLinks = async (user, internUserId, links) => {
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw new Error('Intern profile not found');

  if (!canManageDocumentationLinks(user, profile)) {
    const err = new Error('Not authorized to manage documentation links');
    err.statusCode = 403;
    throw err;
  }

  if (!canViewInternProfile(user, profile)) {
    const err = new Error('Not authorized to access this intern');
    err.statusCode = 403;
    throw err;
  }

  profile.documentationLinks = validateDocumentationLinks(links);
  await profile.save();
  await profile.populate(PROFILE_POPULATE);

  internNotificationService.notifyDocumentationLinksUpdated({
    internUserId,
    internProfileId: profile._id,
  });

  return formatProfile(profile, user);
};

const updateInternalCvLink = async (user, internUserId, url) => {
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw new Error('Intern profile not found');

  // Adding/editing the internal CV link is admin-only; mentors keep read
  // access (see canSeeInternalCv in formatProfile) but can no longer write it.
  if (user.role !== ROLES.ADMIN) {
    const err = new Error('Not authorized to modify this intern');
    err.statusCode = 403;
    throw err;
  }

  const trimmed = String(url || '').trim();
  if (trimmed && !isValidDocumentationUrl(trimmed)) {
    throw new Error('Internal CV must use an http or https URL');
  }

  profile.internalCvUrl = trimmed || null;
  await profile.save();
  await profile.populate(PROFILE_POPULATE);
  return formatProfile(profile, user);
};

const URGENCY_WINDOW_DAYS = 60;
const PIPELINE_STALLED_DAYS = 14;
const ACTIVE_PIPELINE_STATUSES = ['recommended', 'interviewing'];
const ACTIVE_PIPELINE_LIMIT = 20;
// Interns in these lifecycle states are no longer being pitched, so they are
// excluded from the pipeline even if a stale active recommendation still points
// at them (e.g. legacy placements made before recommendations were auto-closed).
const PIPELINE_EXCLUDED_PROFILE_STATUSES = ['placed', 'completed', 'discontinued'];

const buildRecommendationFunnel = (rows) => {
  const funnel = Object.fromEntries(RECOMMENDATION_STATUSES.map((status) => [status, 0]));
  rows.forEach(({ _id, count }) => {
    if (_id && funnel[_id] !== undefined) {
      funnel[_id] = count;
    }
  });
  return funnel;
};

const getInterviewTiming = (interviews = []) => {
  const now = new Date();
  let latestCompany = '';
  let latestRole = '';
  let nextInterviewAt = null;

  const withDates = interviews.filter((interview) => interview.scheduledAt);
  if (withDates.length > 0) {
    const sortedDesc = [...withDates].sort(
      (a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)
    );
    latestCompany = sortedDesc[0].company || '';
    latestRole = sortedDesc[0].role || '';
  }

  const upcoming = withDates
    .filter((interview) => new Date(interview.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  if (upcoming.length > 0) {
    nextInterviewAt = upcoming[0].scheduledAt;
    latestCompany = upcoming[0].company || latestCompany;
    latestRole = upcoming[0].role || latestRole;
  }

  return { latestCompany, latestRole, nextInterviewAt };
};

const hasUpcomingInterview = (interviews = []) => {
  const now = new Date();
  return interviews.some(
    (interview) => interview.scheduledAt && new Date(interview.scheduledAt) >= now
  );
};

const resolveProfileUserId = (profile) => {
  const user = profile?.user;
  if (!user) return null;
  if (user._id) return user._id;
  if (mongoose.Types.ObjectId.isValid(user)) return user;
  return null;
};

const formatPipelineCandidate = (profile) => {
  const userId = resolveProfileUserId(profile);
  if (!userId || !profile?.user || typeof profile.user !== 'object') return null;
  return {
    userId,
    fullname: profile.user.fullname || 'Unknown',
    avatarUrl: profile.user.avatarUrl || null,
    hub: profile.user.hub ? { _id: profile.user.hub._id, name: profile.user.hub.name } : null,
    programme: profile.internshipType
      ? {
          _id: profile.internshipType._id,
          name: profile.internshipType.name,
          slug: profile.internshipType.slug,
        }
      : null,
  };
};

// Higher = more advanced in the pipeline. Used to pick the representative
// recommendation when an intern has several active at once.
const PIPELINE_STATUS_RANK = { interviewing: 2, recommended: 1 };

const pipelineRecOutranks = (candidate, current) => {
  const candidateRank = PIPELINE_STATUS_RANK[candidate.status] || 0;
  const currentRank = PIPELINE_STATUS_RANK[current.status] || 0;
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return new Date(candidate.updatedAt) > new Date(current.updatedAt);
};

const formatActivePipelineRow = (recommendation) => {
  const profile = recommendation.internProfile;
  const candidate = formatPipelineCandidate(profile);
  if (!candidate) return null;

  const { latestCompany, latestRole, nextInterviewAt } = getInterviewTiming(
    recommendation.interviews || []
  );

  return {
    recommendationId: recommendation._id,
    status: recommendation.status,
    ...candidate,
    technologies: (recommendation.technologies || []).map((tech) => ({
      _id: tech._id,
      name: tech.name,
      slug: tech.slug,
    })),
    latestCompany,
    latestRole,
    nextInterviewAt,
    updatedAt: recommendation.updatedAt,
  };
};

const averageEvaluationScore = (scores) => {
  if (!scores) return null;
  const values = [scores.technical, scores.communication, scores.ownership, scores.growth].filter(
    (value) => typeof value === 'number'
  );
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const buildFunnel = (rows) => {
  const funnel = Object.fromEntries(INTERN_STATUSES.map((status) => [status, 0]));
  rows.forEach(({ _id, count }) => {
    if (_id && funnel[_id] !== undefined) {
      funnel[_id] = count;
    }
  });
  return funnel;
};

const formatReadyCandidate = (
  profile,
  readyTechnologies,
  latestEvaluationAverage,
  activeRecommendation = null
) => {
  const userId = resolveProfileUserId(profile);
  if (!userId || !profile?.user || typeof profile.user !== 'object') return null;

  return {
    profileId: profile._id,
    userId,
    fullname: profile.user.fullname || 'Unknown',
    email: profile.user.email || '',
    avatarUrl: profile.user.avatarUrl || null,
    hub: profile.user.hub ? { _id: profile.user.hub._id, name: profile.user.hub.name } : null,
    programme: profile.internshipType
      ? {
          _id: profile.internshipType._id,
          name: profile.internshipType.name,
          slug: profile.internshipType.slug,
        }
      : null,
    primaryMentor: profile.primaryMentor
      ? {
          _id: profile.primaryMentor._id,
          fullname: profile.primaryMentor.fullname,
          avatarUrl: profile.primaryMentor.avatarUrl || null,
        }
      : null,
    status: profile.status,
    expectedEndDate: profile.expectedEndDate || null,
    // First day on a real project; from here the intern owes no attendance.
    placedAt: profile.placedAt || null,
    cvUrl: buildCvUrl(profile.cvPath),
    readyTechnologies,
    latestEvaluationAverage,
    activeRecommendation,
  };
};

const getProgrammeStats = async (user) => {
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.LEADERSHIP) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const activeStatuses = ['active', READY_STATUS];
  const excludedSupplyStatuses = ['placed', 'completed', 'discontinued'];
  const urgencyCutoff = new Date();
  urgencyCutoff.setDate(urgencyCutoff.getDate() + URGENCY_WINDOW_DAYS);
  const stalledCutoff = new Date();
  stalledCutoff.setDate(stalledCutoff.getDate() - PIPELINE_STALLED_DAYS);
  const now = new Date();

  const [
    funnelRows,
    activeByProgrammeRows,
    activeByHubRows,
    technologySupplyRows,
    positionSupplyRows,
    rawReadyProfiles,
    recentlyReadyProfiles,
    recommendationFunnelRows,
    recommendationOutcomeRows,
    activePipelineRecs,
    recentOutcomeRecs,
    allActiveRecommendations,
  ] = await Promise.all([
    // This counted a handful of orphaned profiles into "N interns in the
    // programme" and into `funnel.placed` on the leadership dashboard.
    InternProfile.aggregate([
      ...excludeOrphanedProfileStages(),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    InternProfile.aggregate([
      { $match: { status: { $in: activeStatuses } } },
      ...excludeOrphanedProfileStages(),
      { $group: { _id: '$internshipType', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'internshiptypes',
          localField: '_id',
          foreignField: '_id',
          as: 'programme',
        },
      },
      { $unwind: { path: '$programme', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          programme: {
            _id: '$_id',
            name: '$programme.name',
            slug: '$programme.slug',
          },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
    InternProfile.aggregate([
      { $match: { status: { $in: activeStatuses } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: '$userDoc' },
      {
        $lookup: {
          from: 'hubs',
          localField: 'userDoc.hub',
          foreignField: '_id',
          as: 'hub',
        },
      },
      { $unwind: { path: '$hub', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$hub._id',
          hub: { $first: { _id: '$hub._id', name: '$hub.name' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    ReadinessFlag.aggregate([
      {
        $lookup: {
          from: 'internprofiles',
          localField: 'internProfile',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      ...excludeOrphanedProfileStages('profile.user'),
      { $match: { 'profile.status': { $nin: excludedSupplyStatuses } } },
      {
        $lookup: {
          from: 'technologies',
          localField: 'technology',
          foreignField: '_id',
          as: 'tech',
        },
      },
      { $unwind: '$tech' },
      {
        $group: {
          _id: '$technology',
          technology: {
            $first: { _id: '$tech._id', name: '$tech.name', slug: '$tech.slug' },
          },
          readyCount: {
            $sum: { $cond: [{ $eq: ['$level', 'ready'] }, 1, 0] },
          },
          learningCount: {
            $sum: { $cond: [{ $eq: ['$level', 'learning'] }, 1, 0] },
          },
        },
      },
      { $sort: { readyCount: -1, learningCount: -1, 'technology.name': 1 } },
    ]),
    InternProfile.aggregate([
      {
        $match: {
          status: { $nin: excludedSupplyStatuses },
          declaredPosition: { $ne: null },
        },
      },
      ...excludeOrphanedProfileStages(),
      { $group: { _id: '$declaredPosition', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'positions',
          localField: '_id',
          foreignField: '_id',
          as: 'position',
        },
      },
      { $unwind: '$position' },
      {
        $project: {
          position: { _id: '$_id', name: '$position.name', slug: '$position.slug' },
          count: 1,
        },
      },
      { $sort: { count: -1, 'position.name': 1 } },
    ]),
    InternProfile.find({ status: READY_STATUS })
      .populate([
        {
          path: 'user',
          select: userSelect('hub'),
          populate: { path: 'hub', select: 'name' },
        },
        { path: 'internshipType', select: 'name slug' },
        { path: 'primaryMentor', select: userSelect() },
      ])
      .sort({ expectedEndDate: 1, updatedAt: -1 })
      .lean(),
    InternProfile.find({ status: READY_STATUS })
      .populate([
        {
          path: 'user',
          select: userSelect('hub'),
          populate: { path: 'hub', select: 'name' },
        },
        { path: 'internshipType', select: 'name slug' },
      ])
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
    Recommendation.aggregate([
      {
        $lookup: {
          from: 'internprofiles',
          localField: 'internProfile',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      ...excludeOrphanedProfileStages('profile.user'),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Recommendation.aggregate([
      { $match: { status: 'resulted', 'result.outcome': { $ne: null } } },
      {
        $lookup: {
          from: 'internprofiles',
          localField: 'internProfile',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      ...excludeOrphanedProfileStages('profile.user'),
      { $group: { _id: '$result.outcome', count: { $sum: 1 } } },
    ]),
    Recommendation.find({ status: { $in: ACTIVE_PIPELINE_STATUSES } })
      .populate([
        {
          path: 'internProfile',
          populate: [
            {
              path: 'user',
              select: userSelect('hub'),
              populate: { path: 'hub', select: 'name' },
            },
            { path: 'internshipType', select: 'name slug' },
          ],
        },
        { path: 'technologies', select: 'name slug' },
      ])
      .sort({ updatedAt: -1 })
      .lean(),
    Recommendation.find({ status: 'resulted', 'result.outcome': { $ne: null } })
      .populate([
        {
          path: 'internProfile',
          populate: {
            path: 'user',
            select: userSelect(),
          },
        },
      ])
      .sort({ 'result.decidedAt': -1, updatedAt: -1 })
      .limit(5)
      .lean(),
    Recommendation.find({ status: { $in: ACTIVE_PIPELINE_STATUSES } })
      .select('internProfile status updatedAt interviews')
      .lean(),
  ]);

  // Drop an orphaned (user-deleted) ready profile before the readiness/
  // evaluation lookups below run for it — formatReadyCandidate would discard
  // it from readyBench anyway, so there's no reason to spend those queries on
  // a profile that can never render.
  const readyProfiles = rawReadyProfiles.filter((profile) => Boolean(profile.user));

  const profileIds = readyProfiles.map((profile) => profile._id);

  const [readyFlags, latestEvaluations] = await Promise.all([
    profileIds.length > 0
      ? ReadinessFlag.find({ internProfile: { $in: profileIds }, level: 'ready' })
          .populate('technology', 'name slug')
          .lean()
      : [],
    profileIds.length > 0
      ? Evaluation.aggregate([
          { $match: { internProfile: { $in: profileIds } } },
          { $sort: { periodEnd: -1 } },
          {
            $group: {
              _id: '$internProfile',
              scores: { $first: '$scores' },
            },
          },
        ])
      : [],
  ]);

  const readyTechByProfile = readyFlags.reduce((acc, flag) => {
    const key = flag.internProfile.toString();
    if (!acc[key]) acc[key] = [];
    if (flag.technology) {
      acc[key].push({
        _id: flag.technology._id,
        name: flag.technology.name,
        slug: flag.technology.slug,
      });
    }
    return acc;
  }, {});

  const evaluationByProfile = Object.fromEntries(
    latestEvaluations.map((row) => [row._id.toString(), averageEvaluationScore(row.scores)])
  );

  const activeRecByProfile = allActiveRecommendations.reduce((acc, recommendation) => {
    const profileId = recommendation.internProfile?.toString();
    if (!profileId) return acc;
    const existing = acc[profileId];
    if (!existing || new Date(recommendation.updatedAt) > new Date(existing.updatedAt)) {
      acc[profileId] = recommendation;
    }
    return acc;
  }, {});

  // A placed/finished intern is out of the pipeline even when a stale active
  // recommendation still points at them, so every pipeline count is gated on the
  // intern's live profile status (read from the populated pipeline recs).
  const pipelineEligibleProfileIds = new Set(
    activePipelineRecs
      .map((recommendation) => recommendation.internProfile)
      .filter(
        (profile) =>
          profile && profile.user && !PIPELINE_EXCLUDED_PROFILE_STATUSES.includes(profile.status)
      )
      .map((profile) => profile._id.toString())
  );

  const profileIdsWithActiveRec = new Set(
    Object.keys(activeRecByProfile).filter((id) => pipelineEligibleProfileIds.has(id))
  );

  const interviewingProfileIds = new Set(
    allActiveRecommendations
      .filter((recommendation) => recommendation.status === 'interviewing')
      .map((recommendation) => recommendation.internProfile?.toString())
      .filter((id) => id && pipelineEligibleProfileIds.has(id))
  );

  const readyBench = readyProfiles
    .map((profile) => {
      const activeRec = activeRecByProfile[profile._id.toString()];
      return formatReadyCandidate(
        profile,
        readyTechByProfile[profile._id.toString()] || [],
        evaluationByProfile[profile._id.toString()] ?? null,
        activeRec ? { _id: activeRec._id, status: activeRec.status } : null
      );
    })
    .filter(Boolean);

  // Collapse the pipeline to one row per intern so this list counts the same
  // distinct people as the "In pipeline" KPI (summary.activeRecommendations).
  // An intern with several active recommendations keeps their most advanced one
  // (interviewing outranks recommended; ties broken by most recent activity) so
  // the interviewing/recommended split here matches the KPI split as well.
  const bestPipelineRecByProfile = new Map();
  activePipelineRecs.forEach((recommendation) => {
    const profileId = recommendation.internProfile?._id?.toString();
    if (!profileId || !pipelineEligibleProfileIds.has(profileId)) return;
    const current = bestPipelineRecByProfile.get(profileId);
    if (!current || pipelineRecOutranks(recommendation, current)) {
      bestPipelineRecByProfile.set(profileId, recommendation);
    }
  });

  const activePipelineTotal = bestPipelineRecByProfile.size;
  const activePipeline = [...bestPipelineRecByProfile.values()]
    .map(formatActivePipelineRow)
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.nextInterviewAt
        ? new Date(a.nextInterviewAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.nextInterviewAt
        ? new Date(b.nextInterviewAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .slice(0, ACTIVE_PIPELINE_LIMIT);

  const pipelineAttention = activePipelineRecs
    .map((recommendation) => {
      const candidate = formatPipelineCandidate(recommendation.internProfile);
      if (!candidate) return null;

      if (
        recommendation.status === 'interviewing' &&
        !hasUpcomingInterview(recommendation.interviews)
      ) {
        return {
          recommendationId: recommendation._id,
          userId: candidate.userId,
          fullname: candidate.fullname,
          reason: 'no_upcoming_interview',
          status: recommendation.status,
          daysStalled: null,
        };
      }

      if (
        recommendation.status === 'recommended' &&
        new Date(recommendation.updatedAt) <= stalledCutoff
      ) {
        const daysStalled = Math.floor(
          (now - new Date(recommendation.updatedAt)) / (1000 * 60 * 60 * 24)
        );
        return {
          recommendationId: recommendation._id,
          userId: candidate.userId,
          fullname: candidate.fullname,
          reason: 'stalled_recommended',
          status: recommendation.status,
          daysStalled,
        };
      }

      return null;
    })
    .filter(Boolean);

  const recentOutcomes = recentOutcomeRecs
    .map((recommendation) => {
      const profile = recommendation.internProfile;
      const userId = resolveProfileUserId(profile);
      if (!userId || !profile?.user || typeof profile.user !== 'object') return null;

      const interviews = recommendation.interviews || [];
      const latestInterview =
        interviews.length > 0
          ? [...interviews].sort(
              (a, b) =>
                new Date(b.scheduledAt || b.updatedAt || 0) -
                new Date(a.scheduledAt || a.updatedAt || 0)
            )[0]
          : null;

      return {
        recommendationId: recommendation._id,
        userId,
        fullname: profile.user?.fullname || 'Unknown',
        outcome: recommendation.result?.outcome || null,
        company: latestInterview?.company || '',
        decidedAt: recommendation.result?.decidedAt || recommendation.updatedAt,
      };
    })
    .filter(Boolean);

  const recommendationFunnel = buildRecommendationFunnel(recommendationFunnelRows);
  const recommendationOutcomes = {
    placed: recommendationOutcomeRows.find((row) => row._id === 'placed')?.count || 0,
    not_placed: recommendationOutcomeRows.find((row) => row._id === 'not_placed')?.count || 0,
  };

  const urgent = readyBench
    .filter((candidate) => {
      if (!candidate.expectedEndDate) return false;
      const endDate = new Date(candidate.expectedEndDate);
      return endDate <= urgencyCutoff;
    })
    .sort((a, b) => new Date(a.expectedEndDate) - new Date(b.expectedEndDate));

  const recentlyReady = recentlyReadyProfiles
    .map((profile) => {
      const userId = resolveProfileUserId(profile);
      if (!userId || !profile?.user || typeof profile.user !== 'object') return null;

      return {
        profileId: profile._id,
        userId,
        fullname: profile.user.fullname || 'Unknown',
        email: profile.user.email || '',
        avatarUrl: profile.user.avatarUrl || null,
        hub: profile.user.hub ? { _id: profile.user.hub._id, name: profile.user.hub.name } : null,
        programme: profile.internshipType
          ? {
              _id: profile.internshipType._id,
              name: profile.internshipType.name,
              slug: profile.internshipType.slug,
            }
          : null,
        readySince: profile.updatedAt,
      };
    })
    .filter(Boolean);

  const funnel = buildFunnel(funnelRows);
  const technologiesWithReadySupply = technologySupplyRows.filter(
    (row) => row.readyCount > 0
  ).length;

  return {
    funnel,
    // Kept under its historical name for the KPI consumers; sourced from the funnel.
    readyForPlacement: funnel[READY_STATUS],
    activeByProgramme: activeByProgrammeRows.map((row) => ({
      programme: row.programme,
      count: row.count,
    })),
    activeByHub: activeByHubRows.map((row) => ({
      hub: row.hub || { _id: null, name: 'Unassigned' },
      count: row.count,
    })),
    technologySupply: technologySupplyRows.map((row) => ({
      technology: row.technology,
      readyCount: row.readyCount,
      learningCount: row.learningCount,
    })),
    positionSupply: positionSupplyRows.map((row) => ({
      position: row.position,
      count: row.count,
    })),
    readyBench,
    urgent,
    recentlyReady,
    recommendationFunnel,
    recommendationOutcomes,
    activePipeline,
    activePipelineTotal,
    pipelineAttention,
    recentOutcomes,
    summary: {
      activeInterns: funnel.active + funnel.ready,
      placedInterns: funnel.placed,
      technologiesWithReadySupply,
      // Distinct interns, not recommendation documents — an intern recommended
      // to several projects at once still counts as one person in the pipeline.
      activeRecommendations: profileIdsWithActiveRec.size,
      interviewingCount: interviewingProfileIds.size,
      // readyBench, not readyProfiles: it's already had orphaned-user profiles
      // dropped (formatReadyCandidate returns null for one, filtered out at
      // readyBench's own definition above) — this count must agree with the
      // list it's summarizing.
      readyWithoutActiveRecommendation: readyBench.filter(
        (candidate) => !profileIdsWithActiveRec.has(candidate.profileId.toString())
      ).length,
    },
  };
};

module.exports = {
  listInterns,
  getInternByUserId,
  getMyInternProfile,
  updateSelfTechnologies,
  updateSelfPosition,
  updateSelfSecondaryPosition,
  updateInternProgramme,
  updateDocumentationLinks,
  updateInternalCvLink,
  createInternProfile,
  getProgrammeStats,
};
