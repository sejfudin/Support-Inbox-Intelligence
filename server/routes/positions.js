const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPositions } = require('../controllers/positions');

router.get('/', protect, getPositions);

module.exports = router;
