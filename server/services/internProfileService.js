const User = require('../models/User');
const InternshipType = require('../models/InternshipType');
const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');

const MENTOR_ROLES = [ROLES.ADMIN, ROLES.MENTOR];

const assertMentorUser = async (mentorId, label) => {
  const mentor = await User.findById(mentorId).select('role status');
  if (!mentor || mentor.status !== 'active') {
    throw new Error(`Invalid ${label}`);
  }
  if (!MENTOR_ROLES.includes(mentor.role)) {
    throw new Error(`${label} must be an admin or mentor`);
  }
  return mentor;
};

const createInternProfile = async ({ userId, internshipTypeId, primaryMentorId, startDate }) => {
  if (!internshipTypeId) throw new Error('Internship type is required');
  if (!primaryMentorId) throw new Error('Primary mentor is required');
  if (!startDate) throw new Error('Internship start date is required');

  const internshipType = await InternshipType.findById(internshipTypeId);
  if (!internshipType || !internshipType.isActive) {
    throw new Error('Invalid internship type');
  }

  await assertMentorUser(primaryMentorId, 'primary mentor');

  const parsedStart = new Date(startDate);
  if (Number.isNaN(parsedStart.getTime())) {
    throw new Error('Invalid internship start date');
  }

  return InternProfile.create({
    user: userId,
    internshipType: internshipTypeId,
    primaryMentor: primaryMentorId,
    startDate: parsedStart,
  });
};

module.exports = { createInternProfile, assertMentorUser };
