const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  listSpecializations,
  listUnspecializedCandidates,
  assignSpecialization,
  reassignSpecialization,
  changeSpecializationMentor,
  clearSpecialization,
} = require('../controllers/specializations');

// Specializations are admin-only, both to view and to manage — mentors
// receive the pairing but have no read/write surface here.
router.get('/', protect, requireRole(ROLES.ADMIN), listSpecializations);
router.get('/candidates', protect, requireRole(ROLES.ADMIN), listUnspecializedCandidates);
router.post('/', protect, requireRole(ROLES.ADMIN), assignSpecialization);
router.patch('/:internUserId/reassign', protect, requireRole(ROLES.ADMIN), reassignSpecialization);
router.patch(
  '/:internUserId/mentor',
  protect,
  requireRole(ROLES.ADMIN),
  changeSpecializationMentor
);
router.delete('/:internUserId', protect, requireRole(ROLES.ADMIN), clearSpecialization);

module.exports = router;
