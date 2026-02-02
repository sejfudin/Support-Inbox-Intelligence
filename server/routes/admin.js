const express = require('express');
const { getUsers, updateUserRole } = require('../controllers/admin');

const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);

module.exports = router;
