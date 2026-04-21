const crypto = require("crypto");
const Integration = require("../models/Integration");
const { decrypt, encrypt } = require("../helpers/crypto");

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Generates a JWT for GitHub App authentication.
 * GitHub App JWTs use RS256 algorithm.
 */
function generateGitHubAppJWT() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time
    exp: now + 600, // Expiration time
    iss: appId,
  };

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${payloadEncoded}`;

  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

/**
 * Gets an installation access token for a GitHub App installation.
 *
 * @param {number} installationId - The GitHub App installation ID
 * @returns {Promise<string>} - The installation access token
 */
async function getInstallationToken(installationId) {
  try {
    const jwt = generateGitHubAppJWT();

    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to get installation token: ${error.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Error getting installation token:", error);
    throw error;
  }
}

/**
 * Fetches pull request details from GitHub.
 *
 * @param {string} token - Installation access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @returns {Promise<Object>} - PR details
 */
async function getPullRequest(token, owner, repo, prNumber) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch PR: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches repositories accessible to a GitHub App installation.
 *
 * @param {number} installationId - The GitHub App installation ID
 * @returns {Promise<Array>} - List of repositories
 */
async function getInstallationRepositories(installationId) {
  try {
    const token = await getInstallationToken(installationId);

    const response = await fetch(
      `${GITHUB_API_BASE}/installation/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.repositories || [];
  } catch (error) {
    console.error("Error fetching repositories:", error);
    throw error;
  }
}

/**
 * Fetches installation details from GitHub.
 *
 * @param {number} installationId - The GitHub App installation ID
 * @returns {Promise<Object>} - Installation details
 */
async function getInstallation(installationId) {
  try {
    const jwt = generateGitHubAppJWT();

    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch installation: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching installation:", error);
    throw error;
  }
}

/**
 * Gets the token for an integration, fetching a new one if needed.
 *
 * @param {Object} integration - Integration document
 * @returns {Promise<string>} - Valid access token
 */
async function getIntegrationToken(integration) {
  if (
    integration.tokenExpiresAt &&
    new Date(Date.now() + 5 * 60 * 1000) < integration.tokenExpiresAt
  ) {
    const decrypted = decrypt(integration.encryptedAccessToken);
    if (decrypted) {
      return decrypted;
    }
  }

  const token = await getInstallationToken(integration.githubAppInstallationId);

  const expiresAt = new Date(Date.now() + 55 * 60 * 1000);

  await Integration.findByIdAndUpdate(integration._id, {
    encryptedAccessToken: encrypt(token),
    tokenExpiresAt: expiresAt,
    lastSyncAt: new Date(),
  });

  return token;
}

/**
 * Refreshes PR data for a ticket by fetching latest info from GitHub.
 *
 * @param {Object} integration - Integration document
 * @param {Object} ticket - Ticket document with linkedPullRequest
 * @returns {Promise<Object|null>} - Updated PR data or null
 */
async function refreshPullRequest(integration, ticket) {
  if (!ticket.linkedPullRequest) return null;

  const token = await getIntegrationToken(integration);
  const { url } = ticket.linkedPullRequest;

  const urlMatch = url?.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!urlMatch) {
    throw new Error("Invalid PR URL format");
  }

  const [, owner, repo, number] = urlMatch;

  const prData = await getPullRequest(token, owner, repo, number);
  if (!prData) return null;

  return {
    prNumber: prData.number,
    prTitle: prData.title,
    branchName: prData.head?.ref || ticket.linkedPullRequest.branchName,
    state: prData.merged ? "merged" : prData.state,
    isDraft: prData.draft,
    author: {
      login: prData.user?.login,
      avatarUrl: prData.user?.avatar_url,
    },
    url: prData.html_url,
    createdAt: prData.created_at,
    updatedAt: prData.updated_at,
    mergedAt: prData.merged_at,
    mergedBy: prData.merged_by
      ? {
          login: prData.merged_by.login,
          avatarUrl: prData.merged_by.avatar_url,
        }
      : null,
  };
}

module.exports = {
  getInstallationToken,
  getPullRequest,
  getInstallationRepositories,
  getInstallation,
  getIntegrationToken,
  refreshPullRequest,
};
