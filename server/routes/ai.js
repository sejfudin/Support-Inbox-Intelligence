const express = require('express');
const { generateAI } = require('../controllers/ai');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/tickets/:id/ai/generate', protect, generateAI);

module.exports = router;
