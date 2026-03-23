const express = require("express");
const router = express.Router();

const {
  createTicket,
  getTicketById,
  getAllTickets,
  updateTicket,
  archiveTicket,
  deleteTicket,
  getMyTickets,
} = require("../controllers/tickets");

// const { generateAI } = require('../controllers/ai');
const { protect } = require("../middleware/auth");

router.get("/my-tickets", protect, getMyTickets);
router.get("/", protect, getAllTickets);

router.post("/", protect, createTicket);
router.get("/:id", protect, getTicketById);
router.patch("/:id", protect, updateTicket);
router.patch("/:id/archive", protect, archiveTicket);
router.delete("/", protect, deleteTicket);

// router.post('/:id/messages', protect, requireRole('admin', 'agent'), addMessage);
// router.post('/:id/ai/generate', protect, requireRole('admin', 'agent'), generateAI);

module.exports = router;
