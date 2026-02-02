const express = require('express');
const router = express.Router();

const { createTicket, getTickets, getTicketById, addMessage } = require('../controllers/ticket');

router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.post('/:id/messages', addMessage);

module.exports = router;