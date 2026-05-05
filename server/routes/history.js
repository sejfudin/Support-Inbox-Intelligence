const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getTicketHistory } = require('../controllers/history');

router.get('/:ticketId', protect, getTicketHistory);

module.exports = router;
