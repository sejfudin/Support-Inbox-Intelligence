const express = require('express');
const router = express.Router();
const {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  inviteMember,
  removeMember,
  cancelInvitation,
  getAllWorkspaces,
  switchWorkspace,
  deleteWorkspace,
  uploadWorkspaceLogo,
  deleteWorkspaceLogo,
} = require('../controllers/workspace');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { requireWorkspaceManager } = require('../middleware/requireWorkspaceManager');
const { uploadLogo } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

router.get('/', protect, getMyWorkspaces);
router.get('/all', protect, requireRole(ROLES.ADMIN), getAllWorkspaces);
router.post('/', protect, requireRole(ROLES.ADMIN, ROLES.MENTOR), createWorkspace);

router.get('/:id', protect, getWorkspace);
router.patch('/:id', protect, requireWorkspaceManager, updateWorkspace);
router.post('/:id/logo', protect, requireWorkspaceManager, uploadLogo, uploadWorkspaceLogo);
router.delete('/:id/logo', protect, requireWorkspaceManager, deleteWorkspaceLogo);
// Admins may delete any workspace; mentors only ones they own or admin
// (requireWorkspaceManager passes platform admins through unconditionally).
router.delete(
  '/:id',
  protect,
  requireRole(ROLES.ADMIN, ROLES.MENTOR),
  requireWorkspaceManager,
  deleteWorkspace
);

router.post('/:id/switch', protect, switchWorkspace);
router.post('/:id/invite', protect, requireWorkspaceManager, inviteMember);
router.delete('/:id/members/:userId', protect, requireWorkspaceManager, removeMember);
router.delete('/:id/invitations/:invitationId', protect, requireWorkspaceManager, cancelInvitation);

module.exports = router;
