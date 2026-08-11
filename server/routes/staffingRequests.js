const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const {
  listStaffingRequests,
  getStaffingRequest,
  createStaffingRequest,
  updateStaffingRequest,
  cancelStaffingRequest,
} = require('../controllers/staffingRequests');

// This is the platform's first leadership write path — no existing route
// admits ROLES.LEADERSHIP for a write, so nothing here leans on a middleware
// default. Reads: all leadership and all admins. Create: leadership only.
// Update/cancel: role-gated here to admin+leadership, narrowed to
// author-or-admin in the service. Mentors and interns get 403 from every
// route below. There is no delete route, ever — cancel is the eraser.
router.get('/', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), listStaffingRequests);
router.get('/:id', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), getStaffingRequest);
router.post('/', protect, requireRole(ROLES.LEADERSHIP), createStaffingRequest);
router.patch('/:id', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), updateStaffingRequest);
router.post(
  '/:id/cancel',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  cancelStaffingRequest
);

module.exports = router;
