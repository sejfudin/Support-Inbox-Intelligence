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
  getToday,
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
// This widens *who may read*, nothing else: no write verb is added and the
// response shape is unchanged. `getRoster` stays admin-only. The role guard here
// is deliberately the coarse half of the check — `getInternAttendance` scopes a
// mentor to their own interns in the service, so one mentor cannot read
// another's intern through this route.
// The `/:id` route is declared last so it can't shadow `/me`.
router.get('/', protect, requireRole(ROLES.ADMIN), getRoster);
// Every in-programme intern's state *today*, platform-wide — the dashboard's
// "Attendance today" dialog. Declared above `/:internProfileId` so that route
// cannot swallow it, and admin-only for the same reason the roster is: it names
// every intern and says who is on sick leave.
router.get('/today', protect, requireRole(ROLES.ADMIN), getToday);
router.get(
  '/:internProfileId',
  protect,
  requireRole(ROLES.ADMIN, ROLES.MENTOR),
  getInternAttendance
);

module.exports = router;
