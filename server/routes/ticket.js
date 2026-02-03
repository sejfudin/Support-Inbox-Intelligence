const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/role');

// const { createTicket, getTickets, getTicketById, addMessage } = require('../controllers/ticket');
const { getAllTickets, createTicket } = require('../controllers/tickets');

// const { generateAI } = require('../controllers/ai');
const { protect } = require('../middleware/auth');

 router.get('/', 
    // protect, requireRole('admin', 'agent'), 
    getAllTickets);

router.post('/',protect, createTicket);
// router.get('/:id', protect, requireRole('admin', 'agent'), getTicketById);
// router.post('/:id/messages', protect, requireRole('admin', 'agent'), addMessage);
// router.post('/:id/ai/generate', protect, requireRole('admin', 'agent'), generateAI);

module.exports = router;