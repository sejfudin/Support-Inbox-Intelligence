const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyPreferences, updateMyPreferences } = require('../controllers/users');

// `me` is the only subject here on purpose: preferences are read and written by
// their owner, so there is no id to guard and no role to check beyond "signed in".
router.get('/me/preferences', protect, getMyPreferences);
router.patch('/me/preferences', protect, updateMyPreferences);

module.exports = router;
