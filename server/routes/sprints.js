const express = require('express');
const router = express.Router();

const {
  getSprints,
  getSprintToShow,
  getNextSprintWindow,
  getPreviousSprintLeftovers,
  getSprintById,
  createSprint,
  updateSprint,
  deleteSprint,
  getSprintSummary,
  generateSprintSummary,
} = require('../controllers/sprints');
const { protect } = require('../middleware/auth');

// No role gate: any active workspace member may create, edit or delete a sprint
// (see .claude/docs/security.md). What may be edited or deleted is a property of
// the sprint's own state, not of the caller — enforced in helpers/sprintRules.js.
router.get('/', protect, getSprints);
router.get('/current', protect, getSprintToShow);
// All three fixed paths stay above '/:id', which would otherwise swallow them.
router.get('/leftovers', protect, getPreviousSprintLeftovers);
router.get('/next-window', protect, getNextSprintWindow);
router.get('/:id', protect, getSprintById);
// The AI recap for a sprint. Authorized by workspace scope like every route
// above — no role gate; what may be done to a sprint is a property of the
// sprint, not the caller (helpers/sprintRules.js). Generation is Groq-gated and
// answers 503 when the key is unset, the same as the other AI endpoints.
router.get('/:id/summary', protect, getSprintSummary);
router.post('/:id/summary', protect, generateSprintSummary);
router.post('/', protect, createSprint);
router.patch('/:id', protect, updateSprint);
router.delete('/:id', protect, deleteSprint);

module.exports = router;
