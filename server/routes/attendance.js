const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const { getMyAttendance, checkIn, cancelCheckIn, getRoster } = require('../controllers/attendance');

// The signed-in intern's own attendance (only interns record attendance).
router.get('/me', protect, requireRole(ROLES.INTERN), getMyAttendance);
router.post('/me/check-in', protect, requireRole(ROLES.INTERN), checkIn);
router.delete('/me/check-in', protect, requireRole(ROLES.INTERN), cancelCheckIn);

// Read-only roster for mentors/admins. The service scopes mentors to their
// assigned interns; admins see everyone.
router.get('/', protect, requireRole(ROLES.ADMIN, ROLES.MENTOR), getRoster);

module.exports = router;
