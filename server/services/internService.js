const User = require('../models/User');
const InternProfile = require('../models/InternProfile');
const { INTERN_STATUSES } = require('../models/InternProfile');
const ReadinessFlag = require('../models/ReadinessFlag');
const Evaluation = require('../models/Evaluation');
const Technology = require('../models/Technology');
const { ROLES } = require('../constants/roles');
const {
  canViewFepDirectory,
  canWriteMentorData,
  canEditOwnInternProfile,
  isAssignedMentor,
} = require('../helpers/internAccess');
const { buildCvUrl } = require('./internCvService');
const { createInternProfile } = require('./internProfileService');

const PROFILE_POPULATE = [
  {
    path: 'user',
    select: 'fullname email status role hub',
    populate: { path: 'hub', select: 'name city country' },
  },
  { path: 'internshipType', select: 'name slug' },
  {
    path: 'primaryMentor',
    select: 'fullname email role hub',
    populate: { path: 'hub', select: 'name' },
  },
  {
    path: 'secondaryMentor',
    select: 'fullname email role hub',
    populate: { path: 'hub', select: 'name' },
  },
  { path: 'selfTechnologies', select: 'name slug' },
];

const formatProfile = (profile, viewerRole) => {
  const plain = profile.toObject ? profile.toObject() : profile;
  const isInternViewer = viewerRole === ROLES.INTERN;

  const formatted = {
    ...plain,
    id: plain._id,
    cvUrl: buildCvUrl(plain.cvPath),
  };

  if (isInternViewer) {
    delete formatted.readyForPlacement;
  }

  return formatted;
};

const buildListFilter = (user, query) => {
  const filter = {};
  const userFilter = { role: ROLES.INTERN };

  if (query.hubId) userFilter.hub = query.hubId;
  if (query.status) userFilter.status = query.status;

  if (query.search) {
    userFilter.$or = [
      { fullname: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
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
  if (query.readyForPlacement === 'true') filter.readyForPlacement = true;
  if (query.readyForPlacement === 'false') filter.readyForPlacement = false;
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

  const [profiles, total] = await Promise.all([
    InternProfile.find(fullFilter)
      .populate(PROFILE_POPULATE)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit),
    InternProfile.countDocuments(fullFilter),
  ]);

  return {
    interns: profiles.map((p) => formatProfile(p, user.role)),
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

  return formatProfile(profile, user.role);
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

  return formatProfile(profile, user.role);
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

  profile.selfTechnologies = ids;
  await profile.save();
  return getMyInternProfile(user);
};

const updateInternByMentor = async (user, internUserId, payload) => {
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw new Error('Intern profile not found');

  if (!canWriteMentorData(user, profile)) {
    const err = new Error('Not authorized to modify this intern');
    err.statusCode = 403;
    throw err;
  }

  const allowedStatuses = INTERN_STATUSES;

  if (payload.status !== undefined) {
    if (!allowedStatuses.includes(payload.status)) throw new Error('Invalid status');
    profile.status = payload.status;
  }

  if (payload.readyForPlacement !== undefined) {
    profile.readyForPlacement = Boolean(payload.readyForPlacement);
  }

  if (payload.expectedEndDate !== undefined) {
    profile.expectedEndDate = payload.expectedEndDate ? new Date(payload.expectedEndDate) : null;
  }

  await profile.save();
  return getInternByUserId(user, internUserId);
};

const URGENCY_WINDOW_DAYS = 60;

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

const formatReadyCandidate = (profile, readyTechnologies, latestEvaluationAverage) => ({
  profileId: profile._id,
  userId: profile.user?._id || profile.user,
  fullname: profile.user?.fullname || 'Unknown',
  email: profile.user?.email || '',
  hub: profile.user?.hub
    ? { _id: profile.user.hub._id, name: profile.user.hub.name }
    : null,
  programme: profile.internshipType
    ? {
        _id: profile.internshipType._id,
        name: profile.internshipType.name,
        slug: profile.internshipType.slug,
      }
    : null,
  primaryMentor: profile.primaryMentor
    ? { _id: profile.primaryMentor._id, fullname: profile.primaryMentor.fullname }
    : null,
  status: profile.status,
  expectedEndDate: profile.expectedEndDate || null,
  cvUrl: buildCvUrl(profile.cvPath),
  readyTechnologies,
  latestEvaluationAverage,
});

const getProgrammeStats = async (user) => {
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.LEADERSHIP) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const activeStatuses = ['active', 'ready'];
  const excludedSupplyStatuses = ['placed', 'completed', 'discontinued'];
  const urgencyCutoff = new Date();
  urgencyCutoff.setDate(urgencyCutoff.getDate() + URGENCY_WINDOW_DAYS);

  const [
    funnelRows,
    readyForPlacement,
    activeByProgrammeRows,
    activeByHubRows,
    technologySupplyRows,
    readyProfiles,
    recentlyReadyProfiles,
  ] = await Promise.all([
    InternProfile.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    InternProfile.countDocuments({ readyForPlacement: true }),
    InternProfile.aggregate([
      { $match: { status: { $in: activeStatuses } } },
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
    InternProfile.find({ readyForPlacement: true })
      .populate([
        {
          path: 'user',
          select: 'fullname email hub',
          populate: { path: 'hub', select: 'name' },
        },
        { path: 'internshipType', select: 'name slug' },
        { path: 'primaryMentor', select: 'fullname' },
      ])
      .sort({ expectedEndDate: 1, updatedAt: -1 })
      .lean(),
    InternProfile.find({ readyForPlacement: true })
      .populate([
        {
          path: 'user',
          select: 'fullname email hub',
          populate: { path: 'hub', select: 'name' },
        },
        { path: 'internshipType', select: 'name slug' },
      ])
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

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

  const readyBench = readyProfiles.map((profile) =>
    formatReadyCandidate(
      profile,
      readyTechByProfile[profile._id.toString()] || [],
      evaluationByProfile[profile._id.toString()] ?? null
    )
  );

  const urgent = readyBench
    .filter((candidate) => {
      if (!candidate.expectedEndDate) return false;
      const endDate = new Date(candidate.expectedEndDate);
      return endDate <= urgencyCutoff;
    })
    .sort((a, b) => new Date(a.expectedEndDate) - new Date(b.expectedEndDate));

  const recentlyReady = recentlyReadyProfiles.map((profile) => ({
    profileId: profile._id,
    userId: profile.user?._id || profile.user,
    fullname: profile.user?.fullname || 'Unknown',
    email: profile.user?.email || '',
    hub: profile.user?.hub
      ? { _id: profile.user.hub._id, name: profile.user.hub.name }
      : null,
    programme: profile.internshipType
      ? {
          _id: profile.internshipType._id,
          name: profile.internshipType.name,
          slug: profile.internshipType.slug,
        }
      : null,
    readySince: profile.updatedAt,
  }));

  const funnel = buildFunnel(funnelRows);
  const technologiesWithReadySupply = technologySupplyRows.filter((row) => row.readyCount > 0).length;

  return {
    funnel,
    readyForPlacement,
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
    readyBench,
    urgent,
    recentlyReady,
    summary: {
      activeInterns: funnel.active + funnel.ready,
      placedInterns: funnel.placed,
      technologiesWithReadySupply,
    },
  };
};

module.exports = {
  listInterns,
  getInternByUserId,
  getMyInternProfile,
  updateSelfTechnologies,
  updateInternByMentor,
  createInternProfile,
  getProgrammeStats,
};
