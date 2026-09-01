const express = require('express');
const router = express.Router();

const {
  getTicketDraft,
  saveTicketDraft,
  deleteTicketDraft,
} = require('../controllers/ticketDrafts');
const { protect } = require('../middleware/auth');

// Its own resource rather than `/api/tickets/draft`: nothing here is a ticket,
// and a literal path sitting in front of `/tickets/:id` is one reordering away
// from being read as a ticket id.
//
// Self-only — no id in any path. The account comes from the token, the workspace
// from the caller's active one (admins may override it, as everywhere else).
router.get('/', protect, getTicketDraft);
router.put('/', protect, saveTicketDraft);
router.delete('/', protect, deleteTicketDraft);

module.exports = router;
