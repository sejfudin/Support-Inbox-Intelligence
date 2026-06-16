const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getTechnologies,
  createTechnology,
  updateTechnology,
} = require('../controllers/technologies');

router.get('/', protect, getTechnologies);
router.post('/', protect, requireRole(ROLES.ADMIN), createTechnology);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateTechnology);

module.exports = router;
