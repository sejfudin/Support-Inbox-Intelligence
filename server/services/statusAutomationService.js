const Ticket = require('../models/Ticket');
const Integration = require('../models/Integration');
const historyService = require('./historyService');
const statusService = require('./statusService');

const AUTOMATION_RESULT = {
  STATUS_UPDATED: 'status_updated',
  ALREADY_TARGET_STATUS: 'already_target_status',
  AUTOMATION_DISABLED: 'automation_disabled',
  TICKET_NOT_FOUND: 'ticket_not_found',
  SETTINGS_NOT_FOUND: 'settings_not_found',
  ERROR: 'error',
};

/**
 * Gets automation settings for a workspace.
 */
async function getAutomationSettings(workspaceId) {
  const integration = await Integration.findOne({
    workspace: workspaceId,
    isConnected: true,
  }).select('settings');

  return integration?.settings || null;
}

/**
 * Determines if automation should proceed based on settings.
 */
function shouldAutomateStatusChange(ticket, targetStatusId, settings, settingKey) {
  if (!settings?.[settingKey]) {
    return {
      proceed: false,
      result: AUTOMATION_RESULT.AUTOMATION_DISABLED,
      reason: `${settingKey} is disabled`,
    };
  }

  if (statusService.statusIdsMatch(ticket.status, targetStatusId)) {
    return {
      proceed: false,
      result: AUTOMATION_RESULT.ALREADY_TARGET_STATUS,
      reason: 'Ticket already at target status',
    };
  }

  return { proceed: true };
}

/**
 * Executes status change with automation metadata.
 * @param {string} ticketId
 * @param {string} targetStatusSlug - workspace status slug from integration settings
 */
async function executeStatusChange(ticketId, targetStatusSlug, metadata = {}) {
  try {
    const oldTicket = await Ticket.findById(ticketId);
    if (!oldTicket) throw new Error('Ticket not found');

    const now = new Date();
    const statusDoc = await statusService.validateStatusForWorkspace(
      oldTicket.workspace,
      targetStatusSlug
    );
    const newStatusSlug = statusDoc.slug;
    const oldStatusSlug = await statusService.resolveStatusSlugFromTicketRef(oldTicket.status);
    const oldLabel = await statusService.getStatusLabelFromRef(oldTicket.status);
    const newLabel = statusDoc.label;

    const updateData = { status: statusDoc._id };

    await statusService.applyStatusLifecycleUpdate({
      workspaceId: oldTicket.workspace,
      oldStatus: oldStatusSlug,
      newStatus: newStatusSlug,
      oldTicket,
      updateData,
      now,
    });

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
      { new: true }
    ).populate('status', 'slug label color isBacklog tracksTime isDone');

    const triggerLabel = metadata.trigger === 'pr_merged' ? 'merged' : 'opened';
    const prInfo = metadata.prNumber ? ` (PR #${metadata.prNumber} ${triggerLabel})` : '';
    historyService.logSystemEvent(
      ticketId,
      `Status automatically changed from "${oldLabel}" to "${newLabel}"${prInfo}`
    );

    return {
      success: true,
      ticket,
      previousStatus: oldStatusSlug,
      newStatus: newStatusSlug,
      metadata,
    };
  } catch (error) {
    console.error('Error executing status change:', error);
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
        message: 'Ticket not found',
      };
    }

    const settings = await getAutomationSettings(workspaceId);

    if (!settings) {
      return {
        result: AUTOMATION_RESULT.SETTINGS_NOT_FOUND,
        message: 'Integration settings not found',
      };
    }

    const targetStatusSlug = await statusService.resolveAutomationTargetStatus(
      workspaceId,
      settings.onPROpenTargetStatusId || settings.onPROpenTargetStatus,
      'prOpen'
    );
    const targetStatusDoc = await statusService.validateStatusForWorkspace(
      workspaceId,
      targetStatusSlug
    );

    const decision = shouldAutomateStatusChange(
      ticket,
      targetStatusDoc._id,
      settings,
      'autoMoveOnPROpenEnabled'
    );

    if (!decision.proceed) {
      return {
        result: decision.result,
        message: decision.reason,
        ticketId,
        targetStatus: targetStatusSlug,
      };
    }

    const execution = await executeStatusChange(ticketId, targetStatusSlug, {
      trigger: 'pr_opened',
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
      message: `Status changed from ${execution.previousStatus} to ${targetStatusSlug}`,
      ticketId,
      previousStatus: execution.previousStatus,
      newStatus: targetStatusSlug,
      prNumber: prData.prNumber,
    };
  } catch (error) {
    console.error('Error handling PR opened:', error);
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
        message: 'Ticket not found',
      };
    }

    const settings = await getAutomationSettings(workspaceId);

    if (!settings) {
      return {
        result: AUTOMATION_RESULT.SETTINGS_NOT_FOUND,
        message: 'Integration settings not found',
      };
    }

    const targetStatusSlug = await statusService.resolveAutomationTargetStatus(
      workspaceId,
      settings.onMergeTargetStatusId || settings.onMergeTargetStatus,
      'done'
    );
    const targetStatusDoc = await statusService.validateStatusForWorkspace(
      workspaceId,
      targetStatusSlug
    );

    const decision = shouldAutomateStatusChange(
      ticket,
      targetStatusDoc._id,
      settings,
      'autoMoveOnMergeEnabled'
    );

    if (!decision.proceed) {
      return {
        result: decision.result,
        message: decision.reason,
        ticketId,
        targetStatus: targetStatusSlug,
      };
    }

    const execution = await executeStatusChange(ticketId, targetStatusSlug, {
      trigger: 'pr_merged',
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
      message: `Status changed from ${execution.previousStatus} to ${targetStatusSlug}`,
      ticketId,
      previousStatus: execution.previousStatus,
      newStatus: targetStatusSlug,
      prNumber: prData.prNumber,
    };
  } catch (error) {
    console.error('Error handling PR merged:', error);
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
