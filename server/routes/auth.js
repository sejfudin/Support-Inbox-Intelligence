const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  register,
  refresh,
  logout,
  changePassword,
  setMyAvatar,
  removeMyAvatar,
  updateUser,
  verifyInvite,
  setPasswordFromInvite,
} = require('../controllers/authentication');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');

router.post('/login', login);
router.post('/register', protect, requireRole(ROLES.ADMIN), register);
router.get('/me', protect, getMe);
router.post('/refresh', refresh);
router.post('/logout', logout);
// Every role, including any that has no profile screen to reach it from: the
// rule is the endpoint's, not the form's. Declared above `/:id` so it can never
// be shadowed by a user id.
router.patch('/me/password', protect, changePassword);
// Self-serve only, and declared above `/:id` for the same reason the password
// route is: `/me/avatar` must never be shadowed by a user id. There is
// deliberately no admin-sets-another-user's-picture endpoint — see
// `services/userAvatarService.js`.
router.post('/me/avatar', protect, uploadAvatar, setMyAvatar);
router.delete('/me/avatar', protect, removeMyAvatar);
router.patch('/:id', protect, updateUser);
router.post('/invite/verify', verifyInvite);
router.post('/invite/set-password', setPasswordFromInvite);

module.exports = router;
