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
  getWorkspaceAnalytics,
} = require('../controllers/workspace');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.get('/', protect, getMyWorkspaces);
router.get('/all', protect, requireRole('admin'), getAllWorkspaces);
router.post('/', protect, requireRole('admin'), createWorkspace);

router.get('/:id', protect, getWorkspace);
router.get('/:id/analytics', protect, getWorkspaceAnalytics);
router.patch('/:id', protect, requireRole('admin'), updateWorkspace);
router.delete('/:id', protect, requireRole('admin'), deleteWorkspace);

router.post('/:id/switch', protect, switchWorkspace);
router.post('/:id/invite', protect, requireRole('admin'), inviteMember);
router.delete('/:id/members/:userId', protect, requireRole('admin'), removeMember);

module.exports = router;
