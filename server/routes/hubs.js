const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const { getHubs, createHub, updateHub } = require('../controllers/hubs');

router.get('/', protect, getHubs);
router.post('/', protect, requireRole(ROLES.ADMIN), createHub);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateHub);

module.exports = router;
