const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  requireWorkspaceManager,
  workspaceManagerGuard,
} = require('../middleware/requireWorkspaceManager');
const TicketStatus = require('../models/TicketStatus');
const {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
} = require('../controllers/ticketStatuses');

// `:id` here is a status id, not a workspace id — resolve the workspace
// through the status so the manager check targets the right workspace.
const requireStatusWorkspaceManager = workspaceManagerGuard(async (req) => {
  const status = await TicketStatus.findById(req.params.id).select('workspace').lean();
  if (!status) {
    const err = new Error('Status not found.');
    err.statusCode = 404;
    throw err;
  }
  return status.workspace;
});

router.get('/', protect, getTicketStatuses);
router.post('/', protect, requireWorkspaceManager, createTicketStatus);
router.patch('/reorder', protect, requireWorkspaceManager, reorderTicketStatuses);
router.patch('/:id', protect, requireStatusWorkspaceManager, updateTicketStatus);
router.delete('/:id', protect, requireStatusWorkspaceManager, deleteTicketStatus);

module.exports = router;
