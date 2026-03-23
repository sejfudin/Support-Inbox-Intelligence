const express = require("express");
const router = express.Router();
const {
  login,
  getMe,
  register,
  refresh,
  logout,
  updateUser,
  verifyInvite,
  setPasswordFromInvite,
} = require("../controllers/authentication");
const { protect } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

router.post("/login", login);
router.post("/register", protect, requireRole("admin"), register);
router.get("/me", protect, getMe);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.patch("/:id", protect, updateUser);
router.post("/invite/verify", verifyInvite);
router.post("/invite/set-password", setPasswordFromInvite);

module.exports = router;
