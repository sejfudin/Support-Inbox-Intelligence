const express = require('express');
const router = express.Router();

const { getUserAnalytics } = require('../controllers/analytics');
const { protect } = require('../middleware/auth');

router.get('/user/:userId', protect, getUserAnalytics);

module.exports = router;
