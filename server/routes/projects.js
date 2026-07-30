const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const { getProjects, createProject, updateProject } = require('../controllers/projects');

router.get('/', protect, getProjects);
router.post('/', protect, requireRole(ROLES.ADMIN), createProject);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), updateProject);

module.exports = router;
