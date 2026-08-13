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
  resolveStaffingRequestProject,
  resolveStaffingRequestProjectByCreating,
  listPutForwardCandidates,
  putInternsForward,
  closeStaffingRequest,
  getStaffingRequestNews,
  markStaffingRequestsSeen,
  getStaffingRequestHistory,
} = require('../controllers/staffingRequests');

// This is the platform's first leadership write path — no existing route
// admits ROLES.LEADERSHIP for a write, so nothing here leans on a middleware
// default. Reads: all leadership and all admins. Create: leadership only.
// Update: role-gated here to admin+leadership, narrowed to author-or-admin in
// the service. Close: role-gated here to admin+leadership, split per reason in
// the service. Mentors and interns get 403 from every route below. There is no
// delete route, ever — closing as `cancelled` is the eraser, and there is no
// reopen either: `closed` is terminal (ADR 0005).
//
// Nothing here writes to a closed request. A close states its own reason, and
// that reason is the record; there is deliberately no route to revise it after
// the fact (ADR 0005).
//
// `POST /:id/close` takes the reason in the body rather than being three
// routes, because the per-reason permission split already lives in one place
// (`assertCanClose`): cancel is leadership-only, fulfil and decline are
// admin-only, and cancel and decline both require a reason. A
// `requireRole(ADMIN)` on a fulfil-only route would duplicate half that rule in
// the router and leave the two copies free to drift.
// `/news` and `/seen` are registered ahead of `/:id` so they aren't swallowed
// by the id param route.
router.get('/news', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), getStaffingRequestNews);
router.post('/seen', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), markStaffingRequestsSeen);
router.get('/', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), listStaffingRequests);
router.get('/:id', protect, requireRole(ROLES.ADMIN, ROLES.LEADERSHIP), getStaffingRequest);
router.get(
  '/:id/history',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  getStaffingRequestHistory
);
router.post('/', protect, requireRole(ROLES.LEADERSHIP), createStaffingRequest);
router.patch('/:id', protect, requireRole(ROLES.LEADERSHIP), updateStaffingRequest);
// Resolving a draft project — link to an existing project, or create one from
// leadership's draft details and link that instead. Admin-only: leadership
// can describe a project, it can never create or link one (see
// resolveStaffingRequestProject/…ByCreating in the service).
router.post(
  '/:id/resolve-project',
  protect,
  requireRole(ROLES.ADMIN),
  resolveStaffingRequestProject
);
router.post(
  '/:id/resolve-project/create',
  protect,
  requireRole(ROLES.ADMIN),
  resolveStaffingRequestProjectByCreating
);
// Putting interns forward. Admin-only: leadership files demand, admins answer
// it. Both halves (read the picker, write the picks) share that guard.
//
// The picker is read per requested position — an intern is offered for the
// discipline that was actually asked for, so the position is a path segment.
// The write is request-level, because an admin stages picks across seats and
// sends them as one act: one body carrying every position group, one insert,
// one history event, one badge. The position is still never a free choice — it
// is the key of the group the picks were staged under, and the service checks
// each one is a position this request asked for.
router.get(
  '/:id/positions/:positionId/candidates',
  protect,
  requireRole(ROLES.ADMIN),
  listPutForwardCandidates
);
router.post('/:id/put-forward', protect, requireRole(ROLES.ADMIN), putInternsForward);
router.post(
  '/:id/close',
  protect,
  requireRole(ROLES.ADMIN, ROLES.LEADERSHIP),
  closeStaffingRequest
);

module.exports = router;
