const express = require('express');
const router = express.Router();

const { getWorkspaceAnalytics, getUserAnalytics } = require('../controllers/analytics');
const { protect } = require('../middleware/auth');

router.get('/workspace/:workspaceId', protect, getWorkspaceAnalytics);
router.get('/user/:userId', protect, getUserAnalytics);

module.exports = router;
