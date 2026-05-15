const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
  getTaskStatuses,
  createTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
  reorderTaskStatuses,
} = require('../controllers/taskStatuses');

router.get('/', protect, getTaskStatuses);
router.post('/', protect, requireRole('admin'), createTaskStatus);
router.patch('/reorder', protect, requireRole('admin'), reorderTaskStatuses);
router.patch('/:id', protect, requireRole('admin'), updateTaskStatus);
router.delete('/:id', protect, requireRole('admin'), deleteTaskStatus);

module.exports = router;
