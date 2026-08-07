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
} = require('../controllers/projects');

router.get('/', protect, getProjects);
// Leadership-facing aggregate routes — must be registered before the `/:id`
// wildcard below, or Express would treat "overview" as an id.
router.get('/overview', protect, getProjectsOverview);
router.get('/:id', protect, getProjectById);
router.get('/:id/overview', protect, getProjectOverview);
router.post('/', protect, requireRole(ROLES.ADMIN), createProject);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateProject);

module.exports = router;
