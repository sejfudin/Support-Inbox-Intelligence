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
  deleteRecommendation,
} = require('../controllers/recommendations');

router.get('/', protect, listRecommendations);
// Recommendations are admin-only: mentors no longer view or manage them.
router.post('/', protect, requireRole(ROLES.ADMIN), createRecommendation);
router.get('/:id', protect, getRecommendation);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateRecommendation);
router.delete('/:id', protect, requireRole(ROLES.ADMIN), deleteRecommendation);

module.exports = router;
