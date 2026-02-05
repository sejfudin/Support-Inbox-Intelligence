const express = require('express');
const router = express.Router();
const { login, getMe, register, refresh, logout, updateUser } = require('../controllers/authentication');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/me', protect, getMe);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.patch("/:id", protect, updateUser);

module.exports = router;