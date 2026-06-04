const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRoles } = require('../controllers/roles');

router.get('/', protect, getRoles);

module.exports = router;
