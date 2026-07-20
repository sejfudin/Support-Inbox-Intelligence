const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');

const MENTOR_ROLES = [ROLES.ADMIN, ROLES.MENTOR];
const FEP_VIEW_ROLES = [ROLES.ADMIN, ROLES.MENTOR, ROLES.LEADERSHIP];

const normalizeRefId = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (ref._id) return ref._id.toString();
  return ref.toString();
};

const isAssignedMentor = (profile, userId) => {
  const id = userId.toString();
  return (
    normalizeRefId(profile.primaryMentor) === id || normalizeRefId(profile.secondaryMentor) === id
  );
};

const canViewFepDirectory = (role) => FEP_VIEW_ROLES.includes(role);

const canWriteMentorData = (user, profile) => {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.MENTOR && isAssignedMentor(profile, user._id)) return true;
  return false;
};

const canManageDocumentationLinks = (user, profile) =>
  user.role === ROLES.ADMIN ||
  user.role === ROLES.LEADERSHIP ||
  (user.role === ROLES.MENTOR && isAssignedMentor(profile, user._id));

const canViewInternProfile = (user, profile) => {
  if (user.role === ROLES.ADMIN || user.role === ROLES.LEADERSHIP) return true;
  if (user.role === ROLES.MENTOR && isAssignedMentor(profile, user._id)) return true;
  if (user.role === ROLES.INTERN && normalizeRefId(profile.user) === user._id.toString()) {
    return true;
  }
  return false;
};

const canEditOwnInternProfile = (user, profile) =>
  user.role === ROLES.INTERN && normalizeRefId(profile.user) === user._id.toString();

const loadInternProfileByUserId = async (userId) => {
  const profile = await InternProfile.findOne({ user: userId });
  if (!profile) {
    const err = new Error('Intern profile not found');
    err.statusCode = 404;
    throw err;
  }
  return profile;
};

const assertInternAccess = async (user, internUserId, { write = false } = {}) => {
  const profile = await loadInternProfileByUserId(internUserId);

  if (write && canEditOwnInternProfile(user, profile)) {
    return profile;
  }

  if (!canViewInternProfile(user, profile)) {
    const err = new Error('Not authorized to access this intern');
    err.statusCode = 403;
    throw err;
  }

  if (write && !canWriteMentorData(user, profile)) {
    const err = new Error('Not authorized to modify this intern');
    err.statusCode = 403;
    throw err;
  }

  return profile;
};

module.exports = {
  MENTOR_ROLES,
  FEP_VIEW_ROLES,
  isAssignedMentor,
  canViewFepDirectory,
  canWriteMentorData,
  canManageDocumentationLinks,
  canViewInternProfile,
  canEditOwnInternProfile,
  loadInternProfileByUserId,
  assertInternAccess,
};
