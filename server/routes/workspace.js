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
const { uploadLogo } = require('../middleware/upload');

router.get('/', protect, getMyWorkspaces);
router.get('/all', protect, requireRole('admin'), getAllWorkspaces);
router.post('/', protect, requireRole('admin'), createWorkspace);

router.get('/:id', protect, getWorkspace);
router.patch('/:id', protect, requireRole('admin'), updateWorkspace);
router.post('/:id/logo', protect, requireRole('admin'), uploadLogo, uploadWorkspaceLogo);
router.delete('/:id/logo', protect, requireRole('admin'), deleteWorkspaceLogo);
router.delete('/:id', protect, requireRole('admin'), deleteWorkspace);

router.post('/:id/switch', protect, switchWorkspace);
router.post('/:id/invite', protect, requireRole('admin'), inviteMember);
router.delete('/:id/members/:userId', protect, requireRole('admin'), removeMember);

module.exports = router;
