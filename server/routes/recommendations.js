const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  listRecommendations,
  getRecommendation,
  createRecommendation,
  updateRecommendation,
} = require('../controllers/recommendations');

router.get('/', protect, listRecommendations);
// Admins and mentors may write; the service (assertRecommendationWriteAccess →
// canWriteMentorData) enforces the finer rule that a mentor must be assigned to
// the intern, while an admin may write for any intern.
router.post('/', protect, requireRole(ROLES.ADMIN, ROLES.MENTOR), createRecommendation);
router.get('/:id', protect, getRecommendation);
router.patch('/:id', protect, requireRole(ROLES.ADMIN, ROLES.MENTOR), updateRecommendation);

module.exports = router;
