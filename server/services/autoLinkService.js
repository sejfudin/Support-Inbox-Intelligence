const Ticket = require("../models/Ticket");
const { extractTaskNumber } = require("../helpers/taskExtractor");

const LINK_RESULT = {
  LINKED: "linked",
  ALREADY_LINKED: "already_linked",
  TICKET_NOT_FOUND: "ticket_not_found",
  NO_TASK_NUMBER: "no_task_number",
  DIFFERENT_PR_LINKED: "different_pr_linked",
  UNLINKED_AND_LINKED: "unlinked_and_linked",
  ERROR: "error",
};

/**
 * Extracts task number from PR data and finds matching ticket.
 *
 * @param {Object} prData - Pull request data
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} - Ticket and extracted task number
 */
async function findTicketByPrData(prData, workspaceId) {
  const { branchName, title } = prData;

  const taskNumber = extractTaskNumber({ branchName, title });

  if (!taskNumber) {
    return { ticket: null, taskNumber: null, reason: "No task number found in PR" };
  }

  const ticket = await Ticket.findOne({
    workspace: workspaceId,
    taskNumber: taskNumber,
    isArchived: { $ne: true },
  });

  if (!ticket) {
    return { ticket: null, taskNumber, reason: `No ticket found with taskNumber ${taskNumber}` };
  }

  return { ticket, taskNumber };
}

/**
 * Attempts to atomically link a PR to a ticket using $setOnInsert.
 * Only succeeds if the ticket has no existing linked PR.
 *
 * @param {string} ticketId - Ticket ID
 * @param {Object} prData - PR data to link
 * @returns {Promise<Object>} - Result with success flag and current PR
 */
async function tryAtomicLink(ticketId, prData) {
  const prPayload = buildPrPayload(prData);

  const result = await Ticket.findOneAndUpdate(
    {
      _id: ticketId,
      linkedPullRequest: null, // Only if no PR is currently linked
    },
    {
      $set: {
        linkedPullRequest: prPayload,
      },
    },
    { new: true }
  );

  if (result) {
    return { success: true, ticket: result, linkedPr: prPayload };
  }

  // If no result, check if it's because ticket already has a linked PR
  const existingTicket = await Ticket.findById(ticketId);
  return {
    success: false,
    ticket: existingTicket,
    existingPr: existingTicket?.linkedPullRequest,
  };
}

/**
 * Builds PR payload for linkedPullRequest field.
 *
 * @param {Object} prData - PR data from GitHub
 * @returns {Object} - Formatted PR payload
 */
function buildPrPayload(prData) {
  const {
    prNumber,
    prTitle,
    branchName,
    state,
    isDraft,
    author,
    url,
    createdAt,
    updatedAt,
    mergedAt,
    mergedBy,
  } = prData;

  return {
    prNumber,
    prTitle: prTitle || "Untitled PR",
    branchName: branchName || "unknown",
    state: state || "open",
    isDraft: isDraft || false,
    author: author || { login: "unknown" },
    url: url || "",
    createdAt: createdAt || new Date(),
    updatedAt: updatedAt || new Date(),
    mergedAt: mergedAt || null,
    mergedBy: mergedBy || null,
  };
}

/**
 * Links a PR to a ticket.
 * Primary use case: New PR opened → link to ticket.
 *
 * @param {Object} prData - PR data from GitHub webhook
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} - Link result
 */
async function linkPullRequestToTicket(prData, workspaceId) {
  try {
    const { ticket, taskNumber, reason } = await findTicketByPrData(prData, workspaceId);

    if (!taskNumber) {
      return {
        result: LINK_RESULT.NO_TASK_NUMBER,
        message: reason,
      };
    }

    if (!ticket) {
      return {
        result: LINK_RESULT.TICKET_NOT_FOUND,
        message: reason,
        taskNumber,
      };
    }

    // Try atomic link (only if no PR currently linked)
    const atomicResult = await tryAtomicLink(ticket._id, prData);

    if (atomicResult.success) {
      return {
        result: LINK_RESULT.LINKED,
        message: `PR #${prData.prNumber} linked to ticket ${taskNumber}`,
        ticketId: ticket._id,
        taskNumber,
        prNumber: prData.prNumber,
      };
    }

    // Handle already linked case
    const existingPr = atomicResult.existingPr;

    // If same PR already linked, just update it
    if (existingPr && existingPr.prNumber === prData.prNumber) {
      await Ticket.findByIdAndUpdate(
        ticket._id,
        { $set: { linkedPullRequest: buildPrPayload(prData) } },
        { new: true }
      );
      return {
        result: LINK_RESULT.ALREADY_LINKED,
        message: `PR #${prData.prNumber} already linked, updated details`,
        ticketId: ticket._id,
        taskNumber,
        prNumber: prData.prNumber,
      };
    }

    // Different PR already linked - conflict resolution needed
    return {
      result: LINK_RESULT.DIFFERENT_PR_LINKED,
      message: `Ticket ${taskNumber} already has PR #${existingPr.prNumber} linked`,
      ticketId: ticket._id,
      taskNumber,
      requestedPrNumber: prData.prNumber,
      existingPrNumber: existingPr.prNumber,
      existingPr,
    };
  } catch (error) {
    console.error("Error linking PR to ticket:", error);
    return {
      result: LINK_RESULT.ERROR,
      message: error.message,
    };
  }
}

/**
 * Unlinks the current PR and links a new one.
 * Use case: User wants to replace linked PR with a different one.
 *
 * @param {Object} prData - New PR data
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} - Link result
 */
async function replaceLinkedPullRequest(prData, workspaceId) {
  try {
    const { ticket, taskNumber, reason } = await findTicketByPrData(prData, workspaceId);

    if (!taskNumber) {
      return {
        result: LINK_RESULT.NO_TASK_NUMBER,
        message: reason,
      };
    }

    if (!ticket) {
      return {
        result: LINK_RESULT.TICKET_NOT_FOUND,
        message: reason,
        taskNumber,
      };
    }

    const previousPr = ticket.linkedPullRequest;

    // Unlink and link new PR
    await Ticket.findByIdAndUpdate(
      ticket._id,
      { $set: { linkedPullRequest: buildPrPayload(prData) } },
      { new: true }
    );

    return {
      result: LINK_RESULT.UNLINKED_AND_LINKED,
      message: `Replaced PR #${previousPr?.prNumber || "none"} with PR #${prData.prNumber}`,
      ticketId: ticket._id,
      taskNumber,
      previousPrNumber: previousPr?.prNumber,
      newPrNumber: prData.prNumber,
    };
  } catch (error) {
    console.error("Error replacing linked PR:", error);
    return {
      result: LINK_RESULT.ERROR,
      message: error.message,
    };
  }
}

/**
 * Unlinks a PR from a ticket.
 * Use case: PR closed without merging, or manual unlink.
 *
 * @param {string} ticketId - Ticket ID
 * @param {number} [prNumber] - Optional PR number to verify before unlinking
 * @returns {Promise<Object>} - Unlink result
 */
async function unlinkPullRequest(ticketId, prNumber = null) {
  try {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return {
        success: false,
        message: "Ticket not found",
      };
    }

    // If prNumber specified, only unlink if it matches
    if (prNumber && ticket.linkedPullRequest?.prNumber !== prNumber) {
      return {
        success: false,
        message: `Ticket has different PR #${ticket.linkedPullRequest?.prNumber} linked`,
        linkedPrNumber: ticket.linkedPullRequest?.prNumber,
      };
    }

    if (!ticket.linkedPullRequest) {
      return {
        success: false,
        message: "No PR is currently linked to this ticket",
      };
    }

    const unlinkedPrNumber = ticket.linkedPullRequest.prNumber;

    await Ticket.findByIdAndUpdate(ticketId, {
      $set: { linkedPullRequest: null },
    });

    return {
      success: true,
      message: `Unlinked PR #${unlinkedPrNumber} from ticket`,
      unlinkedPrNumber,
      ticketId,
    };
  } catch (error) {
    console.error("Error unlinking PR:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  LINK_RESULT,
  findTicketByPrData,
  linkPullRequestToTicket,
  replaceLinkedPullRequest,
  unlinkPullRequest,
};
