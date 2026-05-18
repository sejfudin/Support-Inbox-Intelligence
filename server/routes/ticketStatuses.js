const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireWorkspaceManager } = require('../middleware/requireWorkspaceManager');
const {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
} = require('../controllers/ticketStatuses');

router.get('/', protect, getTicketStatuses);
router.post('/', protect, requireWorkspaceManager, createTicketStatus);
router.patch('/reorder', protect, requireWorkspaceManager, reorderTicketStatuses);
router.patch('/:id', protect, requireWorkspaceManager, updateTicketStatus);
router.delete('/:id', protect, requireWorkspaceManager, deleteTicketStatus);

module.exports = router;
