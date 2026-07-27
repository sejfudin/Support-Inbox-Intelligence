const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getMyAttendance,
  checkIn,
  cancelCheckIn,
  getRoster,
  getInternAttendance,
} = require('../controllers/attendance');

// The signed-in intern's own attendance (only interns record attendance).
router.get('/me', protect, requireRole(ROLES.INTERN), getMyAttendance);
router.post('/me/check-in', protect, requireRole(ROLES.INTERN), checkIn);
router.delete('/me/check-in', protect, requireRole(ROLES.INTERN), cancelCheckIn);

// Read-only, admin-only. The roster lists all interns for a month; the per-intern
// route returns one intern's full history for the calendar view. The `/:id`
// route is declared last so it can't shadow `/me`.
router.get('/', protect, requireRole(ROLES.ADMIN), getRoster);
router.get('/:internProfileId', protect, requireRole(ROLES.ADMIN), getInternAttendance);

module.exports = router;
