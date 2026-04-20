const jwt = require("jsonwebtoken");
const nodeCrypto = require("crypto");
const Integration = require("../models/Integration");
const { encrypt } = require("../helpers/crypto");
const { getInstallationRepositories, getInstallation } = require("../services/githubService");
const { linkPullRequestToTicket, LINK_RESULT } = require("../services/autoLinkService");

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

  const relevantActions = ['opened', 'reopened', 'edited', 'synchronize'];
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

  switch (result.result) {
    case LINK_RESULT.LINKED:
      console.log(`Linked PR #${result.prNumber} to ticket ${result.taskNumber}`);
      break;
    case LINK_RESULT.ALREADY_LINKED:
      console.log(`Updated PR #${result.prNumber} on ticket ${result.taskNumber}`);
      break;
    case LINK_RESULT.DIFFERENT_PR_LINKED:
      console.log(`Cannot link PR #${result.requestedPrNumber} - ticket ${result.taskNumber} has PR #${result.existingPrNumber}`);
      break;
    case LINK_RESULT.TICKET_NOT_FOUND:
      console.log(`No ticket found for taskNumber ${result.taskNumber} from PR #${pr.number}`);
      break;
    case LINK_RESULT.NO_TASK_NUMBER:
      console.log(`No task number found in PR #${pr.number}`);
      break;
    case LINK_RESULT.ERROR:
      console.error(`Error linking PR #${pr.number}:`, result.message);
      break;
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

module.exports = {
  initiateInstallation,
  handleCallback,
  disconnectIntegration,
  getIntegration,
  updateIntegration,
  getRepositories,
  handleWebhook,
};