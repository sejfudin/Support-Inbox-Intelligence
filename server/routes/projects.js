const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getProjects,
  createProject,
  updateProject,
  getProjectById,
  getProjectsOverview,
  getProjectOverview,
  requestInternsForProject,
} = require('../controllers/projects');

router.get('/', protect, getProjects);
// Leadership-facing aggregate routes — must be registered before the `/:id`
// wildcard below, or Express would treat "overview" as an id.
router.get('/overview', protect, getProjectsOverview);
router.get('/:id', protect, getProjectById);
router.get('/:id/overview', protect, getProjectOverview);
router.post('/', protect, requireRole(ROLES.ADMIN), createProject);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateProject);
// The first leadership write route in this domain — every other write here
// (and everywhere else in the intern/recommendation domain) is admin-only.
// Deliberately thin: notifies admins, persists nothing. See projectService.js.
router.post(
  '/:id/request-interns',
  protect,
  requireRole(ROLES.LEADERSHIP),
  requestInternsForProject
);

module.exports = router;
