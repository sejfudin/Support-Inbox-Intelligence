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

// Read-only. The roster lists all interns for a month and stays admin-only; the
// per-intern route returns one intern's full history and is also read by the
// mentor-facing Attendance tab on the intern profile — a mentor is the primary
// reader of their intern's attendance, so ADMIN alone was too narrow.
//
// This widens *who may read*, nothing else: no write verb is added, the response
// shape is unchanged, and the route has never scoped by mentor — `getRoster` is
// still admin-only, and any mentor may read any intern here, exactly as any
// mentor may already open any intern profile.
// The `/:id` route is declared last so it can't shadow `/me`.
router.get('/', protect, requireRole(ROLES.ADMIN), getRoster);
router.get(
  '/:internProfileId',
  protect,
  requireRole(ROLES.ADMIN, ROLES.MENTOR),
  getInternAttendance
);

module.exports = router;
