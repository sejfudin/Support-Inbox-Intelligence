const express = require('express');
const router = express.Router();

const { getLatestUserSummary, generateUserSummary } = require('../controllers/aiSummary');
const { protect } = require('../middleware/auth');

router.get('/user/:userId', protect, getLatestUserSummary);
router.post('/user/:userId/generate', protect, generateUserSummary);

module.exports = router;
