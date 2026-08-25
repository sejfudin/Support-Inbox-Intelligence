const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { httpError } = require('../helpers/httpError');
const internNotificationService = require('./internNotificationService');

const MAX_BODY_LENGTH = 500;

/**
 * Admin or leadership sending a note directly to a mentor — the first
 * staff-to-staff note in the app (every other note is either about an intern
 * or from an intern). `requireRole` at the route only gates who can *send*;
 * it can't express "the target must be a mentor," so that check lives here.
 */
const sendMentorNoteFromStaff = async ({ actor, targetUserId, body }) => {
  const trimmed = String(body || '').trim();
  if (!trimmed) throw httpError('Note text is required.', 400);
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw httpError(`Note must be ${MAX_BODY_LENGTH} characters or fewer.`, 400);
  }

  const target = await User.findById(targetUserId).select('role fullname');
  if (!target) throw httpError('User not found.', 404);
  if (target.role !== ROLES.MENTOR) throw httpError('Notes can only be sent to mentors.', 400);

  return internNotificationService.notifyMentorNoteFromStaff({
    recipientUserId: target._id,
    authorName: actor.fullname,
    body: trimmed,
  });
};

module.exports = { sendMentorNoteFromStaff };
