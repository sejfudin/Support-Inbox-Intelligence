const jwt = require("jsonwebtoken");
const nodeCrypto = require("crypto");
const Integration = require("../models/Integration");
const { encrypt } = require("../helpers/crypto");
const Ticket = require("../models/Ticket");
const {
  getInstallationRepositories,
  getInstallation,
  refreshPullRequest,
} = require("../services/githubService");
const {
  linkPullRequestToTicket,
  LINK_RESULT,
} = require("../services/autoLinkService");
const {
  handlePROpened,
  handlePRMerged,
  AUTOMATION_RESULT,
} = require("../services/statusAutomationService");

/**
 * Initiates GitHub App installation flow.
 * Redirects user to GitHub to install the app.
 */
const initiateInstallation = async (req, res) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID is required",
      });
    }

    const state = jwt.sign(
      { workspaceId, userId: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const appName = process.env.GITHUB_APP_NAME;
    const redirectUri = `${process.env.SERVER_URL}/api/github/callback`;

    if (!appName) {
      return res.status(500).json({
        success: false,
        message: "GITHUB_APP_NAME environment variable is not set",
      });
    }

    const githubUrl = `https://github.com/apps/${appName}/installations/new?state=${encodeURIComponent(
      state
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.json({
      success: true,
      data: { url: githubUrl },
    });
  } catch (error) {
    console.error("Error initiating GitHub installation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate GitHub installation",
    });
  }
};

/**
 * Handles OAuth callback after GitHub App installation.
 */
const handleCallback = async (req, res) => {
  let workspaceId;
  try {
    const { installation_id, state, setup_action } = req.query;
    let decodedState;
    try {
      decodedState = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
      return res.redirect(`${process.env.CLIENT_URL}/my-workspaces?error=invalid_state`);
    }
    workspaceId = decodedState.workspaceId;

    if (setup_action === "cancel") {
      return res.redirect(
        `${process.env.CLIENT_URL}/admin/workspaces/${workspaceId}/settings?error=installation_cancelled`
      );
    }

    const installation = await getInstallation(parseInt(installation_id));

    await Integration.findOneAndUpdate(
      { workspace: workspaceId },
      {
        workspace: workspaceId,
        githubAppInstallationId: parseInt(installation_id),
        githubAccountLogin: installation.account.login,
        githubAccountType: installation.account.type,
        encryptedAccessToken: encrypt("placeholder"), // Will be replaced with real token when needed
        isConnected: true,
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.redirect(`${process.env.CLIENT_URL}/admin/workspaces/${workspaceId}/settings?github=connected`);
  } catch (error) {
    console.error("Error handling GitHub callback:", error);
    const fallback = workspaceId
      ? `${process.env.CLIENT_URL}/admin/workspaces/${workspaceId}/settings?error=callback_failed`
      : `${process.env.CLIENT_URL}/my-workspaces?error=callback_failed`;
    res.redirect(fallback);
  }
};

/**
 * Disconnects GitHub integration for a workspace.
 */
const disconnectIntegration = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const integration = await Integration.findOne({ workspace: workspaceId });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: "Integration not found",
      });
    }

    await Integration.findByIdAndDelete(integration._id);

    res.json({
      success: true,
      message: "GitHub integration disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting GitHub integration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect GitHub integration",
    });
  }
};

/**
 * Gets integration status for a workspace.
 */
const getIntegration = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const integration = await Integration.findOne({ workspace: workspaceId }).lean();

    if (!integration) {
      return res.json({
        success: true,
        data: null,
      });
    }

    // Remove sensitive data before sending to client
    const sanitizedIntegration = {
      ...integration,
      encryptedAccessToken: undefined,
      encryptedRefreshToken: undefined,
      connectedRepo: integration.connectedRepo?.fullName ? integration.connectedRepo : undefined,
    };

    res.json({
      success: true,
      data: sanitizedIntegration,
    });
  } catch (error) {
    console.error("Error fetching integration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch integration status",
    });
  }
};

/**
 * Updates integration settings.
 */
const updateIntegration = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { settings, connectedRepo } = req.body;

    const integration = await Integration.findOne({ workspace: workspaceId });

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: "Integration not found",
      });
    }

    const updateData = {};

    if (settings) {
      updateData.settings = {
        ...integration.settings,
        ...settings,
      };
    }

    if (connectedRepo?.owner && connectedRepo?.name) {
      const fullName = `${connectedRepo.owner}/${connectedRepo.name}`;

      // Check if this repo is already linked to another workspace
      const existingIntegration = await Integration.findOne({
        "connectedRepo.fullName": fullName,
        workspace: { $ne: workspaceId },
      });

      if (existingIntegration) {
        return res.status(409).json({
          success: false,
          message: `Repository ${fullName} is already linked to another workspace`,
        });
      }

      updateData.connectedRepo = {
        owner: connectedRepo.owner,
        name: connectedRepo.name,
        fullName: fullName,
        defaultBranch: connectedRepo.defaultBranch || "main",
      };
    }

    const updated = await Integration.findByIdAndUpdate(
      integration._id,
      { $set: updateData },
      { new: true }
    ).lean();

    // Remove sensitive data
    const sanitized = {
      ...updated,
      encryptedAccessToken: undefined,
      encryptedRefreshToken: undefined,
    };

    res.json({
      success: true,
      data: sanitized,
    });
  } catch (error) {
    console.error("Error updating integration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update integration settings",
    });
  }
};

/**
 * Lists repositories accessible to the GitHub App installation.
 */
const getRepositories = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const integration = await Integration.findOne({ workspace: workspaceId });

    if (!integration || !integration.isConnected) {
      return res.status(404).json({
        success: false,
        message: "GitHub integration not found or not connected",
      });
    }

    const repositories = await getInstallationRepositories(integration.githubAppInstallationId);

    // Check which repos are already linked to other workspaces
    const existingIntegrations = await Integration.find({
      "connectedRepo.fullName": { $in: repositories.map((r) => r.full_name) },
      workspace: { $ne: workspaceId },
    }).select("connectedRepo.fullName");

    const linkedRepoNames = new Set(existingIntegrations.map((i) => i.connectedRepo.fullName));

    const formattedRepos = repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      owner: repo.owner.login,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private,
      isAvailable: !linkedRepoNames.has(repo.full_name),
    }));

    res.json({
      success: true,
      data: formattedRepos,
    });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch repositories",
    });
  }
};

const handlePullRequestEvent = async (payload) => {
  const installationId = payload.installation?.id;
  if (!installationId) return;

  const integration = await Integration.findOne({ githubAppInstallationId: installationId });
  if (!integration?.isConnected || !integration?.connectedRepo?.fullName) {
    return;
  }

  const pr = payload.pull_request;
  if (!pr) return;

  const relevantActions = ['opened', 'reopened', 'edited', 'synchronize', 'closed'];
  if (!relevantActions.includes(payload.action)) {
    return;
  }

  const prData = {
    prNumber: pr.number,
    prTitle: pr.title,
    title: pr.title,
    branchName: pr.head?.ref,
    state: pr.state === 'closed' ? (pr.merged ? 'merged' : 'closed') : 'open',
    isDraft: pr.draft || false,
    author: {
      login: pr.user?.login,
      avatarUrl: pr.user?.avatar_url,
    },
    url: pr.html_url,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
    mergedBy: pr.merged_by ? {
      login: pr.merged_by.login,
      avatarUrl: pr.merged_by.avatar_url,
    } : null,
  };

  const result = await linkPullRequestToTicket(prData, integration.workspace);

  if (
    result.ticketId &&
    (result.result === LINK_RESULT.LINKED ||
      result.result === LINK_RESULT.ALREADY_LINKED)
  ) {
    const eventTime = new Date();
    let automationResult;

    if (payload.action === "opened" || payload.action === "reopened") {
      automationResult = await handlePROpened(
        result.ticketId,
        integration.workspace,
        prData,
        eventTime,
      );
    } else if (pr.merged && payload.action === "closed") {
      automationResult = await handlePRMerged(
        result.ticketId,
        integration.workspace,
        prData,
        eventTime,
      );
    }

    if (automationResult && automationResult.result === AUTOMATION_RESULT.ERROR) {
      console.error(`Auto-move error for ticket ${result.taskNumber}:`, automationResult.message);
    }
  }
};

const handleWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();

  const hmac = nodeCrypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.body).digest('hex');

  if (signature !== digest) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  if (event === 'pull_request') {
    await handlePullRequestEvent(payload);
  } else if (event === 'installation_repositories' || event === 'installation') {
    const installationId = payload.installation?.id;
    if (installationId) {
      await Integration.updateOne(
        { githubAppInstallationId: installationId },
        { $set: { lastSyncAt: new Date() } }
      );
    }
  }

  res.status(200).json({ received: true });
};

/**
 * Refreshes PR data for a ticket by fetching latest info from GitHub.
 */
const refreshPR = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { workspaceId } = req.query;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!ticket.linkedPullRequest) {
      return res.status(400).json({
        success: false,
        message: "Ticket has no linked PR",
      });
    }

    const integration = await Integration.findOne({ workspace: workspaceId || ticket.workspace });
    if (!integration?.isConnected) {
      return res.status(404).json({
        success: false,
        message: "GitHub integration not found or not connected",
      });
    }

    const updatedPR = await refreshPullRequest(integration, ticket);

    if (!updatedPR) {
      return res.status(404).json({
        success: false,
        message: "PR not found on GitHub",
      });
    }

    ticket.linkedPullRequest = updatedPR;
    await ticket.save();

    res.json({
      success: true,
      data: updatedPR,
    });
  } catch (error) {
    console.error("Error refreshing PR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to refresh PR data",
    });
  }
};

/**
 * Unlinks PR from a ticket.
 */
const unlinkPR = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user._id.toString();
    const userRole = req.user.role;

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!ticket.linkedPullRequest) {
      return res.status(400).json({
        success: false,
        message: "Ticket has no linked PR",
      });
    }

    const isAdmin = userRole === "admin";
    const isCreator = ticket.creator?.toString() === userId;
    const isAssigned = ticket.assignedTo?.some(
      (id) => id.toString() === userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to unlink this PR",
      });
    }

    ticket.linkedPullRequest = null;
    await ticket.save();

    res.json({
      success: true,
      message: "PR unlinked successfully",
    });
  } catch (error) {
    console.error("Error unlinking PR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlink PR",
    });
  }
};

module.exports = {
  initiateInstallation,
  handleCallback,
  disconnectIntegration,
  getIntegration,
  updateIntegration,
  getRepositories,
  handleWebhook,
  refreshPR,
  unlinkPR,
};