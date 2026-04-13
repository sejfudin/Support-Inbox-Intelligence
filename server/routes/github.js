const express = require("express");
const router = express.Router();

const {
  initiateInstallation,
  handleCallback,
  disconnectIntegration,
  getIntegration,
  updateIntegration,
  getRepositories,
} = require("../controllers/github");

const { protect } = require("../middleware/auth");

// OAuth flow routes
router.get("/install", protect, initiateInstallation);
router.get("/callback", handleCallback);

// Integration management routes
router.get("/workspaces/:workspaceId/integration", protect, getIntegration);
router.patch("/workspaces/:workspaceId/integration", protect, updateIntegration);
router.delete("/workspaces/:workspaceId/integration", protect, disconnectIntegration);
router.get("/workspaces/:workspaceId/repositories", protect, getRepositories);

module.exports = router;
