const statusService = require('../services/statusService');
const { StatusValidationError } = require('../helpers/statusValidation');
const TicketStatus = require('../models/TicketStatus');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');

const sendStatusError = (res, error) => {
  if (error instanceof StatusValidationError || error.statusCode === 400) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.message === 'Status not found.' || error.message === 'Status not found') {
    return res.status(404).json({ success: false, message: 'Status not found.' });
  }
  return res.status(500).json({ success: false, message: error.message });
};

// A falsy `workspaceId` means the caller has no resolvable workspace — reject
// rather than skipping the scope check, which would leave the write unscoped.
const assertStatusInWorkspace = async (statusId, workspaceId) => {
  if (!workspaceId) {
    throw new StatusValidationError('No workspace associated');
  }
  const status = await TicketStatus.findById(statusId);
  if (!status) {
    const err = new StatusValidationError('Status not found.');
    err.statusCode = 404;
    throw err;
  }
  if (status.workspace.toString() !== workspaceId.toString()) {
    throw new StatusValidationError('This status does not belong to the selected workspace.');
  }
  return status;
};

const resolveWorkspaceId = async (req) => {
  // Guarded routes stash the authorized workspace on req.managedWorkspaceId
  // (non-admins only) — always prefer it so the write target matches the check.
  if (req.managedWorkspaceId) return req.managedWorkspaceId;
  return resolveActiveWorkspaceId({
    user: req.user,
    override: req.query.workspaceId || req.body?.workspaceId,
  });
};

const getTicketStatuses = async (req, res) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const statuses = await statusService.getWorkspaceStatuses(workspaceId);
    res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTicketStatus = async (req, res) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const { label, color, isBacklog, tracksTime, isDone } = req.body;
    const status = await statusService.createStatus({
      workspaceId,
      label,
      color,
      isBacklog,
      tracksTime,
      isDone,
    });

    res.status(201).json({ success: true, data: status });
  } catch (error) {
    return sendStatusError(res, error);
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = await resolveWorkspaceId(req);
    await assertStatusInWorkspace(id, workspaceId);
    const status = await statusService.updateStatus(id, req.body);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return sendStatusError(res, error);
  }
};

const deleteTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = await resolveWorkspaceId(req);
    await assertStatusInWorkspace(id, workspaceId);
    const { reassignToStatusId } = req.body || {};
    const result = await statusService.deleteStatus(id, { reassignToStatusId });
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return sendStatusError(res, error);
  }
};

const reorderTicketStatuses = async (req, res) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const { orderedIds } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const statuses = await statusService.reorderStatuses(workspaceId, orderedIds);
    res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    return sendStatusError(res, error);
  }
};

module.exports = {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
};
