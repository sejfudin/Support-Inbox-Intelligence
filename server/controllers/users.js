const userPreferenceService = require('../services/userPreferenceService');
const onboardingTourService = require('../services/onboardingTourService');
const mentorNoteService = require('../services/mentorNoteService');
const adminService = require('../services/adminService');
const { ROLES } = require('../constants/roles');
const { handleControllerError: handleError } = require('../helpers/controllerError');

/**
 * The signed-in user's own UI preferences. Scoped to `req.user` and nothing
 * else — there is no id in the path, so one account can never read or write
 * another's.
 */

exports.getMyPreferences = async (req, res, next) => {
  try {
    const result = await userPreferenceService.getPreferences(req.user._id);
    res.json({ success: true, message: 'Preferences retrieved', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateMyPreferences = async (req, res, next) => {
  try {
    const result = await userPreferenceService.updatePreferences(req.user._id, req.body);
    res.json({ success: true, message: 'Preferences saved', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

/**
 * Marks the what's-new tour seen for the caller. Same rule as the preferences
 * handlers above: the subject is `req.user`, never a path parameter, so one
 * account can never mark another's tour read.
 */
exports.markWhatsNewSeen = async (req, res, next) => {
  try {
    const result = await onboardingTourService.markWhatsNewSeen(req.user._id, req.body?.version);
    res.json({ success: true, message: 'Tour marked as seen', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

/**
 * The one exception to "the subject is always `req.user`" above: admin/
 * leadership sending a note to a specific mentor, whose id comes from the
 * path. `requireRole` on the route gates the sender; the target's own role
 * is re-checked in `mentorNoteService`.
 */
exports.sendMentorNote = async (req, res, next) => {
  try {
    const result = await mentorNoteService.sendMentorNoteFromStaff({
      actor: req.user,
      targetUserId: req.params.userId,
      body: req.body?.body,
    });
    res.json({ success: true, message: 'Note sent', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

/**
 * The mentor picker behind the "send a note to a mentor" modal — every active
 * mentor on the platform, unscoped. Same sender gate as `sendMentorNote` above
 * (`requireRole(ADMIN, LEADERSHIP)` at the route); routed through
 * `adminService.getUsers` so the test-account exclusion stays free. Leadership
 * has no active workspace, so it must NOT go through the workspace-scoped
 * `GET /api/admin/users` path, which would hand a non-admin an empty list.
 */
exports.getMentorNoteCandidates = async (req, res, next) => {
  try {
    const result = await adminService.getUsers({
      roles: [ROLES.MENTOR],
      status: 'active',
      pagination: false,
      requireWorkspaceScope: false,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, next);
  }
};
