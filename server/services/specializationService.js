const InternProfile = require('../models/InternProfile');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { escapeRegex } = require('../helpers/escapeRegex');
const { loadInternProfileByUserId } = require('../helpers/internAccess');
const { assertMentorUser } = require('./internProfileService');
const {
  applySpecialization,
  reassignSpecialization: reassignSpecializationRule,
  changeSpecializationMentor: changeSpecializationMentorRule,
  clearSpecialization: clearSpecializationRule,
} = require('../helpers/specializationRules');
const { emitInternDataChanged } = require('../socket/events');

const STATUSES = ['specialized', 'unspecialized', 'all'];

const PROFILE_POPULATE = [
  {
    path: 'user',
    select: 'fullname email status role hub',
    populate: { path: 'hub', select: 'name city country' },
  },
  { path: 'declaredPosition', select: 'name slug' },
  { path: 'secondaryPosition', select: 'name slug' },
  { path: 'primaryMentor', select: 'fullname email role' },
  { path: 'secondaryMentor', select: 'fullname email role' },
];

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Only a platform admin may view or manage specializations — mentors receive
// the pairing but never create/see the management surface.
const assertSpecializationAccess = (user) => {
  if (user.role !== ROLES.ADMIN) {
    throw createError('Not authorized to manage specializations', 403);
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

const formatSpecialization = (profile) => {
  const plain = profile.toObject ? profile.toObject() : profile;
  return {
    _id: plain._id,
    id: plain._id,
    user: formatUser(plain.user),
    declaredPosition: plain.declaredPosition || null,
    secondaryPosition: plain.secondaryPosition || null,
    primaryMentor: formatUser(plain.primaryMentor),
    secondaryMentor: formatUser(plain.secondaryMentor),
    specializationAssignedAt: plain.specializationAssignedAt || null,
  };
};

const statusFilter = (status) => {
  if (status === 'unspecialized') return { specializationAssignedAt: null };
  if (status === 'all') return {};
  return { specializationAssignedAt: { $ne: null } };
};

// Search matches on the referenced User's name/email — resolve to user ids
// first since InternProfile itself holds no searchable text.
const searchUserIds = async (search) => {
  if (!search) return null;
  const regex = { $regex: escapeRegex(search), $options: 'i' };
  const users = await User.find({ $or: [{ fullname: regex }, { email: regex }] })
    .select('_id')
    .lean();
  return users.map((matchedUser) => matchedUser._id);
};

const listSpecializations = async (user, query = {}) => {
  assertSpecializationAccess(user);

  const status = STATUSES.includes(query.status) ? query.status : 'specialized';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = statusFilter(status);
  if (query.mentorId) {
    filter.secondaryMentor = query.mentorId;
  }

  const userIds = await searchUserIds(query.search);
  if (userIds) {
    if (userIds.length === 0) {
      return emptyListResult(page, limit, await coverageStats(query.mentorId));
    }
    filter.user = { $in: userIds };
  }

  const [profiles, total, stats] = await Promise.all([
    InternProfile.find(filter)
      .populate(PROFILE_POPULATE)
      .sort({ specializationAssignedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    InternProfile.countDocuments(filter),
    coverageStats(query.mentorId),
  ]);

  return {
    specializations: profiles.map(formatSpecialization),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
    stats,
  };
};

const emptyListResult = (page, limit, stats) => ({
  specializations: [],
  pagination: { page, limit, total: 0, pages: 0 },
  stats,
});

// Coverage stats are computed against the whole cohort, independent of the
// active status/search filters, so the header numbers stay stable while
// browsing different views.
const coverageStats = async (mentorId) => {
  const [specializedCount, totalCount, mentorLoad] = await Promise.all([
    InternProfile.countDocuments({ specializationAssignedAt: { $ne: null } }),
    InternProfile.countDocuments({}),
    mentorId
      ? InternProfile.countDocuments({
          specializationAssignedAt: { $ne: null },
          secondaryMentor: mentorId,
        })
      : Promise.resolve(null),
  ]);

  return { specializedCount, totalCount, mentorLoad };
};

// Candidates for the "+ Assign specialization" modal: every unspecialized
// intern, including ones with no declared position yet (the modal shows those
// as non-assignable rather than hiding them).
const listUnspecializedCandidates = async (user) => {
  assertSpecializationAccess(user);

  const profiles = await InternProfile.find({ specializationAssignedAt: null })
    .populate(PROFILE_POPULATE)
    .sort({ createdAt: -1 });

  return profiles.map(formatSpecialization);
};

const assignSpecialization = async (user, payload = {}) => {
  assertSpecializationAccess(user);

  const profile = await loadInternProfileByUserId(payload.internUserId);

  if (!profile.declaredPosition) {
    throw createError('Intern has not declared a position yet', 400);
  }

  try {
    await assertMentorUser(payload.mentorId, 'specialization mentor');
  } catch (error) {
    throw createError(error.message, 400);
  }

  let changes;
  try {
    changes = applySpecialization(profile, {
      slot: payload.slot,
      mentorId: payload.mentorId,
      assignedAt: new Date(),
    });
  } catch (error) {
    throw createError(error.message, 400);
  }

  Object.assign(profile, changes);
  await profile.save();
  await profile.populate(PROFILE_POPULATE);

  emitInternDataChanged();
  return formatSpecialization(profile);
};

const loadSpecializedProfile = async (internUserId) => {
  const profile = await loadInternProfileByUserId(internUserId);
  if (!profile.specializationAssignedAt) {
    throw createError('Intern has no specialization to manage', 400);
  }
  return profile;
};

const persistAndFormat = async (profile, changes) => {
  Object.assign(profile, changes);
  await profile.save();
  await profile.populate(PROFILE_POPULATE);

  emitInternDataChanged();
  return formatSpecialization(profile);
};

const reassignSpecialization = async (user, internUserId) => {
  assertSpecializationAccess(user);

  const profile = await loadSpecializedProfile(internUserId);

  let changes;
  try {
    changes = reassignSpecializationRule(profile);
  } catch (error) {
    throw createError(error.message, 400);
  }

  return persistAndFormat(profile, changes);
};

const changeSpecializationMentor = async (user, internUserId, mentorId) => {
  assertSpecializationAccess(user);

  const profile = await loadSpecializedProfile(internUserId);

  try {
    await assertMentorUser(mentorId, 'specialization mentor');
  } catch (error) {
    throw createError(error.message, 400);
  }

  let changes;
  try {
    changes = changeSpecializationMentorRule(profile, { mentorId });
  } catch (error) {
    throw createError(error.message, 400);
  }

  return persistAndFormat(profile, changes);
};

const clearSpecialization = async (user, internUserId) => {
  assertSpecializationAccess(user);

  const profile = await loadSpecializedProfile(internUserId);
  const changes = clearSpecializationRule(profile);

  return persistAndFormat(profile, changes);
};

module.exports = {
  listSpecializations,
  listUnspecializedCandidates,
  assignSpecialization,
  reassignSpecialization,
  changeSpecializationMentor,
  clearSpecialization,
};
