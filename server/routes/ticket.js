const express = require('express');
const router = express.Router();

const { createTicket, getTickets, getTicketById, addMessage } = require('../controllers/ticket');

const { generateAI } = require('../controllers/ai');
const { protect } = require('../middleware/auth');

router.post('/', createTicket);
router.get('/', protect, getTickets);
router.get('/:id', protect, getTicketById);
router.post('/:id/messages', protect, addMessage);
router.post('/:id/ai/generate', protect, generateAI);

module.exports = router;