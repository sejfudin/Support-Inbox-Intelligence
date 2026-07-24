const express = require('express');
const router = express.Router();

const {
  getDaily,
  getDailyHistory,
  startDaily,
  addEntry,
  updateEntry,
  removeEntry,
  getWorkspaceDailyOverview,
  getMemberDailyEntry,
} = require('../controllers/dailies');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');

// Admin-only standup-compliance dashboard — read-only, no intern-facing use, so
// unlike the routes below it doesn't ride the ambient `resolveWorkspaceId` override.
router.get('/admin/overview', protect, requireRole(ROLES.ADMIN), getWorkspaceDailyOverview);
router.get('/admin/entry', protect, requireRole(ROLES.ADMIN), getMemberDailyEntry);

router.get('/history', protect, getDailyHistory);
router.get('/', protect, getDaily);
router.post('/', protect, startDaily);
router.post('/:id/entries', protect, addEntry);
router.patch('/:id/entries/:entryId', protect, updateEntry);
router.delete('/:id/entries/:entryId', protect, removeEntry);

module.exports = router;
