const express = require('express');
const router = express.Router();
const {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  inviteMember,
  removeMember,
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

router.get('/', protect, getMyWorkspaces);
router.get('/all', protect, requireRole('admin'), getAllWorkspaces);
router.post('/', protect, requireRole('admin'), createWorkspace);

router.get('/:id', protect, getWorkspace);
router.patch('/:id', protect, requireWorkspaceManager, updateWorkspace);
router.post('/:id/logo', protect, requireWorkspaceManager, uploadLogo, uploadWorkspaceLogo);
router.delete('/:id/logo', protect, requireWorkspaceManager, deleteWorkspaceLogo);
router.delete('/:id', protect, requireRole('admin'), deleteWorkspace);

router.post('/:id/switch', protect, switchWorkspace);
router.post('/:id/invite', protect, requireWorkspaceManager, inviteMember);
router.delete('/:id/members/:userId', protect, requireWorkspaceManager, removeMember);

module.exports = router;
