const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
} = require('../controllers/ticketStatuses');

router.get('/', protect, getTicketStatuses);
router.post('/', protect, requireRole('admin'), createTicketStatus);
router.patch('/reorder', protect, requireRole('admin'), reorderTicketStatuses);
router.patch('/:id', protect, requireRole('admin'), updateTicketStatus);
router.delete('/:id', protect, requireRole('admin'), deleteTicketStatus);

module.exports = router;
