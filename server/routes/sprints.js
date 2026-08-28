const express = require('express');
const router = express.Router();

const {
  getSprints,
  getSprintToShow,
  getSprintById,
  createSprint,
} = require('../controllers/sprints');
const { protect } = require('../middleware/auth');

// No role gate: any active workspace member may create a sprint (see
// .claude/docs/security.md).
router.get('/', protect, getSprints);
router.get('/current', protect, getSprintToShow);
router.get('/:id', protect, getSprintById);
router.post('/', protect, createSprint);

module.exports = router;
