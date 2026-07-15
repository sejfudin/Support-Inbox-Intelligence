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
// Mentor-only at the route gate; the service further restricts to the mentor
// assigned to the intern (see assertRecommendationWriteAccess).
router.post('/', protect, requireRole(ROLES.MENTOR), createRecommendation);
router.get('/:id', protect, getRecommendation);
router.patch('/:id', protect, requireRole(ROLES.MENTOR), updateRecommendation);

module.exports = router;
