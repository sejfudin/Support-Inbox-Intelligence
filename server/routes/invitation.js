const express = require("express");

const {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
} = require("../controllers/invitation");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/me", protect, getMyInvitations);
router.post("/:id/accept", protect, acceptInvitation);
router.post("/:id/decline", protect, declineInvitation);

module.exports = router;
