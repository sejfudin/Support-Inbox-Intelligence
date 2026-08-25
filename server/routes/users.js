const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getMyPreferences,
  updateMyPreferences,
  markWhatsNewSeen,
  sendMentorNote,
} = require('../controllers/users');

// `me` is the only subject here on purpose: preferences are read and written by
// their owner, so there is no id to guard and no role to check beyond "signed in".
router.get('/me/preferences', protect, getMyPreferences);
router.patch('/me/preferences', protect, updateMyPreferences);

// Same rule, same reason: the what's-new tour's seen-state belongs to whoever is
// holding the token, so there is no id in the path to guard.
router.patch('/me/whats-new-seen', protect, markWhatsNewSeen);

// The one exception to "every route here is self-only": admin/leadership
// sending a note to a specific mentor. requireRole gates the sender;
// mentorNoteService re-checks the target's role, which requireRole can't
// express. This is the first leadership write path outside staffing requests.
router.post(
  '/:userId/mentor-notes',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  sendMentorNote
);

module.exports = router;
