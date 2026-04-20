const Ticket = require("../models/Ticket");
const Integration = require("../models/Integration");

const AUTOMATION_RESULT = {
  STATUS_UPDATED: "status_updated",
  ALREADY_TARGET_STATUS: "already_target_status",
  AUTOMATION_DISABLED: "automation_disabled",
  TICKET_NOT_FOUND: "ticket_not_found",
  SETTINGS_NOT_FOUND: "settings_not_found",
  ERROR: "error",
};

/**
 * Gets automation settings for a workspace.
 */
async function getAutomationSettings(workspaceId) {
  const integration = await Integration.findOne({
    workspace: workspaceId,
    isConnected: true,
  }).select("settings");

  return integration?.settings || null;
}

/**
 * Determines if automation should proceed based on settings.
 */
function shouldAutomateStatusChange(ticket, targetStatus, settings, settingKey) {
  if (!settings?.[settingKey]) {
    return {
      proceed: false,
      result: AUTOMATION_RESULT.AUTOMATION_DISABLED,
      reason: `${settingKey} is disabled`,
    };
  }

  if (ticket.status === targetStatus) {
    return {
      proceed: false,
      result: AUTOMATION_RESULT.ALREADY_TARGET_STATUS,
      reason: `Ticket already at status: ${targetStatus}`,
    };
  }

  return { proceed: true };
}

/**
 * Executes status change with automation metadata.
 */
async function executeStatusChange(ticketId, targetStatus, metadata = {}) {
  try {
    const oldTicket = await Ticket.findById(ticketId);
    if (!oldTicket) throw new Error("Ticket not found");

    const now = new Date();
    const updateData = {
      status: targetStatus,
    };

    const oldStatus = oldTicket.status?.toLowerCase();
    const newStatus = targetStatus.toLowerCase();

    if (oldStatus === "in progress") {
      if (oldTicket.inProgressAt) {
        const elapsed = Math.round((now - oldTicket.inProgressAt) / 1000);
        updateData.totalTimeSpent = (oldTicket.totalTimeSpent || 0) + elapsed;
        updateData.inProgressAt = null;
      }
    } else if (newStatus === "in progress") {
      updateData.inProgressAt = now;
    }

    if (newStatus === "done") {
      updateData.doneAt = now;
    } else if (oldStatus === "done") {
      updateData.doneAt = null;
    }

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
      { new: true }
    );

    return {
      success: true,
      ticket,
      previousStatus: oldTicket.status,
      newStatus: targetStatus,
      metadata,
    };
  } catch (error) {
    console.error("Error executing status change:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handles PR opened event - moves ticket to configured status.
 */
async function handlePROpened(ticketId, workspaceId, prData, eventTime) {
  try {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return {
        result: AUTOMATION_RESULT.TICKET_NOT_FOUND,
        message: "Ticket not found",
      };
    }

    const settings = await getAutomationSettings(workspaceId);

    if (!settings) {
      return {
        result: AUTOMATION_RESULT.SETTINGS_NOT_FOUND,
        message: "Integration settings not found",
      };
    }

    const targetStatus = settings.onPROpenTargetStatus || "on staging";

    const decision = shouldAutomateStatusChange(
      ticket,
      targetStatus,
      settings,
      "autoMoveOnPROpenEnabled"
    );

    if (!decision.proceed) {
      return {
        result: decision.result,
        message: decision.reason,
        ticketId,
        targetStatus,
      };
    }

    const execution = await executeStatusChange(ticketId, targetStatus, {
      trigger: "pr_opened",
      prNumber: prData.prNumber,
      prTitle: prData.prTitle,
      triggeredAt: eventTime,
    });

    if (!execution.success) {
      return {
        result: AUTOMATION_RESULT.ERROR,
        message: execution.error,
      };
    }

    return {
      result: AUTOMATION_RESULT.STATUS_UPDATED,
      message: `Status changed from ${execution.previousStatus} to ${targetStatus}`,
      ticketId,
      previousStatus: execution.previousStatus,
      newStatus: targetStatus,
      prNumber: prData.prNumber,
    };
  } catch (error) {
    console.error("Error handling PR opened:", error);
    return {
      result: AUTOMATION_RESULT.ERROR,
      message: error.message,
    };
  }
}

/**
 * Handles PR merged event - moves ticket to configured status.
 */
async function handlePRMerged(ticketId, workspaceId, prData, eventTime) {
  try {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return {
        result: AUTOMATION_RESULT.TICKET_NOT_FOUND,
        message: "Ticket not found",
      };
    }

    const settings = await getAutomationSettings(workspaceId);

    if (!settings) {
      return {
        result: AUTOMATION_RESULT.SETTINGS_NOT_FOUND,
        message: "Integration settings not found",
      };
    }

    const targetStatus = settings.onMergeTargetStatus || "done";

    const decision = shouldAutomateStatusChange(
      ticket,
      targetStatus,
      settings,
      "autoMoveOnMergeEnabled"
    );

    if (!decision.proceed) {
      return {
        result: decision.result,
        message: decision.reason,
        ticketId,
        targetStatus,
      };
    }

    const execution = await executeStatusChange(ticketId, targetStatus, {
      trigger: "pr_merged",
      prNumber: prData.prNumber,
      prTitle: prData.prTitle,
      mergedBy: prData.mergedBy,
      triggeredAt: eventTime,
    });

    if (!execution.success) {
      return {
        result: AUTOMATION_RESULT.ERROR,
        message: execution.error,
      };
    }

    return {
      result: AUTOMATION_RESULT.STATUS_UPDATED,
      message: `Status changed from ${execution.previousStatus} to ${targetStatus}`,
      ticketId,
      previousStatus: execution.previousStatus,
      newStatus: targetStatus,
      prNumber: prData.prNumber,
    };
  } catch (error) {
    console.error("Error handling PR merged:", error);
    return {
      result: AUTOMATION_RESULT.ERROR,
      message: error.message,
    };
  }
}

module.exports = {
  AUTOMATION_RESULT,
  getAutomationSettings,
  shouldAutomateStatusChange,
  executeStatusChange,
  handlePROpened,
  handlePRMerged,
};
