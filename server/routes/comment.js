const express = require("express");
const router = express.Router();

const {
  createComment,
  getCommentsByTicketId,
  updateComment,
  deleteComment,
} = require("../controllers/comment");
const { protect } = require("../middleware/auth");

router.post("/", protect, createComment);
router.get("/:id", protect, getCommentsByTicketId);
router.put("/", protect, updateComment);
router.delete("/", protect, deleteComment);

module.exports = router;
