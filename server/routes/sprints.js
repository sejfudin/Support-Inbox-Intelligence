const express = require('express');
const router = express.Router();

const {
  getSprints,
  getSprintToShow,
  getSprintById,
  createSprint,
  updateSprint,
  deleteSprint,
} = require('../controllers/sprints');
const { protect } = require('../middleware/auth');

// No role gate: any active workspace member may create, edit or delete a sprint
// (see .claude/docs/security.md). What may be edited or deleted is a property of
// the sprint's own state, not of the caller — enforced in helpers/sprintRules.js.
router.get('/', protect, getSprints);
router.get('/current', protect, getSprintToShow);
router.get('/:id', protect, getSprintById);
router.post('/', protect, createSprint);
router.patch('/:id', protect, updateSprint);
router.delete('/:id', protect, deleteSprint);

module.exports = router;
