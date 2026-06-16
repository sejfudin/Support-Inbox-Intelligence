const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getInternshipTypes,
  createInternshipType,
  updateInternshipType,
} = require('../controllers/internshipTypes');

router.get('/', protect, getInternshipTypes);
router.post('/', protect, requireRole(ROLES.ADMIN), createInternshipType);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateInternshipType);

module.exports = router;
