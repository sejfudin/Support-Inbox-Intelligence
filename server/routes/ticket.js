const express = require('express');
const router = express.Router();

const {
  createTicket,
  getTicketById,
  getAllTickets,
  updateTicket,
  archiveTicket,
  getMyTickets,
  suggestTicketMetadata,
  generateTicketDescription,
} = require('../controllers/tickets');

// const { generateAI } = require('../controllers/ai');
const { protect } = require('../middleware/auth');

const { uploadImages } = require('../middleware/upload');
const {
  getTicketDescriptionImages,
  uploadTicketDescriptionImages,
  deleteTicketDescriptionImage,
  deleteAllTicketDescriptionImages,
} = require('../controllers/attachmentImage');


router.get('/my-tickets', protect, getMyTickets);
router.get('/', protect, getAllTickets);

router.post('/', protect, createTicket);
router.post('/suggest-metadata', protect, suggestTicketMetadata);
router.post('/generate-description', protect, generateTicketDescription);

router.get('/:ticketId/description/images', protect, getTicketDescriptionImages);
router.post('/:ticketId/description/images', protect, uploadImages, uploadTicketDescriptionImages);
router.delete('/:ticketId/description/images/:imageId', protect, deleteTicketDescriptionImage);
router.delete('/:ticketId/description/images', protect, deleteAllTicketDescriptionImages);

router.get('/:id', protect, getTicketById);
router.patch('/:id', protect, updateTicket);
router.patch('/:id/archive', protect, archiveTicket);

// router.post('/:id/messages', protect, requireRole('admin', 'agent'), addMessage);
// router.post('/:id/ai/generate', protect, requireRole('admin', 'agent'), generateAI);

module.exports = router;
