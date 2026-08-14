const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const { getPositions, createPosition, updatePosition } = require('../controllers/positions');

router.get('/', protect, getPositions);
router.post('/', protect, requireRole(ROLES.ADMIN), createPosition);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updatePosition);

module.exports = router;
