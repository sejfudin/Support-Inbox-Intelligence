const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/role');

const { createTicket, getTickets, getTicketById, addMessage ,getAllTickets, updateTicket, deleteTicket} = require('../controllers/tickets');

// const { generateAI } = require('../controllers/ai');
const { protect } = require('../middleware/auth');

 router.get('/', 
    // protect, requireRole('admin', 'user'), 
    getAllTickets);

router.post('/',protect, createTicket);
router.get('/:id', getTicketById);
router.patch('/update',protect, updateTicket);
router.delete('/', protect, deleteTicket);

// router.post('/:id/messages', protect, requireRole('admin', 'agent'), addMessage);
// router.post('/:id/ai/generate', protect, requireRole('admin', 'agent'), generateAI);

module.exports = router;