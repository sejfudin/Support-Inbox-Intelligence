const express = require('express');
const { getUsers, getUser, updateUserRole, createUserInvite } = require('../controllers/admin');

const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// All authenticated users can fetch users
router.get('/users', protect, getUsers);
router.get('/users/:id', protect, requireRole('admin'), getUser);

// Only admins can update user roles
router.patch('/users/:id/role', protect, requireRole('admin'), updateUserRole);
router.post('/create-user', protect, requireRole('admin'), createUserInvite);

module.exports = router;
