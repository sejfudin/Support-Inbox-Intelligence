const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  listSpecializedCandidates,
  listUnspecializedCandidates,
  assignSpecialization,
} = require('../controllers/specializations');

// Specializations are admin-only, both to view and to manage — mentors
// receive the pairing but have no read/write surface here.
router.get('/', protect, requireRole(ROLES.ADMIN), listSpecializedCandidates);
router.get('/candidates', protect, requireRole(ROLES.ADMIN), listUnspecializedCandidates);
router.post('/', protect, requireRole(ROLES.ADMIN), assignSpecialization);

module.exports = router;
