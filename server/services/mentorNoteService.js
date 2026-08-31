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

  const target = await User.findById(targetUserId).select('role fullname status');
  if (!target) throw httpError('User not found.', 404);
  if (target.role !== ROLES.MENTOR) throw httpError('Notes can only be sent to mentors.', 400);
  // "any *active* mentor on the platform" (security.md) — an invited-but-never-signed-in
  // or a deactivated mentor account can't read the note, so don't create one for it.
  if (target.status !== 'active') {
    throw httpError('That mentor’s account is not active.', 400);
  }

  const result = await internNotificationService.notifyMentorNoteFromStaff({
    recipientUserId: target._id,
    authorName: actor.fullname,
    body: trimmed,
  });
  // `notifyMentorNoteFromStaff` is the one notifier here that isn't fire-and-forget:
  // delivering the note *is* the action, so a non-delivered result is a failed request,
  // not a swallowed side effect.
  if (!result?.delivered) {
    throw httpError('Could not deliver the note. Please try again.', 502);
  }

  return { recipient: { id: String(target._id), fullname: target.fullname } };
};

module.exports = { sendMentorNoteFromStaff };
