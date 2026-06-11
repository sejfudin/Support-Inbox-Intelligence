const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listRecommendations,
  getRecommendation,
  createRecommendation,
  updateRecommendation,
} = require('../controllers/recommendations');

router.get('/', protect, listRecommendations);
router.post('/', protect, createRecommendation);
router.get('/:id', protect, getRecommendation);
router.patch('/:id', protect, updateRecommendation);

module.exports = router;
