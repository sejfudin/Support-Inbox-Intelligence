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
  closeStaffingRequest,
  reopenStaffingRequest,
  setStaffingRequestNote,
} = require('../controllers/staffingRequests');

// This is the platform's first leadership write path — no existing route
// admits ROLES.LEADERSHIP for a write, so nothing here leans on a middleware
// default. Reads: all leadership and all admins. Create: leadership only.
// Update/close/reopen: role-gated here to admin+leadership, narrowed to
// author-or-admin in the service. Note: admin only — leadership must not write
// a note onto its own ask. Mentors and interns get 403 from every route below.
// There is no delete route, ever — closing as `cancelled` is the eraser.
//
// `POST /:id/close` takes the reason in the body rather than being three
// routes, because the per-reason permission split already lives in one place
// (`assertCanClose`): cancel is author-or-admin, fulfil and decline are
// admin-only, and decline requires a note. A `requireRole(ADMIN)` on a
// fulfil-only route would duplicate half that rule in the router and leave the
// two copies free to drift.
router.get('/', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), listStaffingRequests);
router.get('/:id', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), getStaffingRequest);
router.post('/', protect, requireRole(ROLES.LEADERSHIP), createStaffingRequest);
router.patch('/:id', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), updateStaffingRequest);
router.patch('/:id/note', protect, requireRole(ROLES.ADMIN), setStaffingRequestNote);
router.post(
  '/:id/close',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  closeStaffingRequest
);
router.post(
  '/:id/reopen',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  reopenStaffingRequest
);

module.exports = router;
