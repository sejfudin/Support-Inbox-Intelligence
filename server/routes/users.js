const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyPreferences, updateMyPreferences, markWhatsNewSeen } = require('../controllers/users');

// `me` is the only subject here on purpose: preferences are read and written by
// their owner, so there is no id to guard and no role to check beyond "signed in".
router.get('/me/preferences', protect, getMyPreferences);
router.patch('/me/preferences', protect, updateMyPreferences);

// Same rule, same reason: the what's-new tour's seen-state belongs to whoever is
// holding the token, so there is no id in the path to guard.
router.patch('/me/whats-new-seen', protect, markWhatsNewSeen);

module.exports = router;
