const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');
const { loadInternProfileByUserId } = require('../helpers/internAccess');
const { assertMentorUser } = require('./internProfileService');
const { applySpecialization } = require('../helpers/specializationRules');
const { emitInternDataChanged } = require('../socket/events');

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

const listSpecializedCandidates = async (user, query = {}) => {
  assertSpecializationAccess(user);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = { specializationAssignedAt: { $ne: null } };

  const [profiles, total] = await Promise.all([
    InternProfile.find(filter)
      .populate(PROFILE_POPULATE)
      .sort({ specializationAssignedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    InternProfile.countDocuments(filter),
  ]);

  return {
    specializations: profiles.map(formatSpecialization),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
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

module.exports = {
  listSpecializedCandidates,
  listUnspecializedCandidates,
  assignSpecialization,
};
