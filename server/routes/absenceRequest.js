const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  getMyRequests,
  createMyRequest,
  cancelMyRequest,
  getRequests,
  decideRequest,
  revokeRequest,
} = require('../controllers/absenceRequest');

// The signed-in intern's own requests — remote work, vacation, a religious
// holiday, a sick day. Only interns record attendance, so only interns can ask for
// a day away from it.
router.get('/me', protect, requireRole(ROLES.INTERN), getMyRequests);
router.post('/me', protect, requireRole(ROLES.INTERN), createMyRequest);
router.delete('/me/:id', protect, requireRole(ROLES.INTERN), cancelMyRequest);

// The admin queue. Same two-tier shape as routes/attendance.js: interns act on
// their own record under /me, admins read and decide everyone's. `/me` is declared
// above so the `/:id` routes below can never shadow it.
router.get('/', protect, requireRole(ROLES.ADMIN), getRequests);
router.patch('/:id', protect, requireRole(ROLES.ADMIN), decideRequest);
router.delete('/:id', protect, requireRole(ROLES.ADMIN), revokeRequest);

module.exports = router;
