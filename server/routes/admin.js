const express = require('express');
const { getUsers, getUser, updateUserRole, createUserInvite } = require('../controllers/admin');
const { getAdminDashboard } = require('../controllers/adminDashboard');

const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Workspace-scoped admin dashboard. The workspace comes from `?workspaceId=`
// (the dashboard's own picker) rather than the caller's active workspace, so an
// admin can read any workspace without switching into it.
router.get('/dashboard', protect, requireRole(ROLES.ADMIN), getAdminDashboard);

// All authenticated users can fetch users
router.get('/users', protect, getUsers);
router.get('/users/:id', protect, requireRole('admin'), getUser);

// Only admins can update user roles
router.patch('/users/:id/role', protect, requireRole('admin'), updateUserRole);
router.post('/create-user', protect, requireRole('admin'), createUserInvite);

module.exports = router;
