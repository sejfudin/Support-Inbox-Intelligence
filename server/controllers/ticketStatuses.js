const statusService = require('../services/statusService');

const resolveWorkspaceId = (req) => {
  const isAdmin = req.user?.role === 'admin';
  return isAdmin && req.query.workspaceId
    ? req.query.workspaceId
    : isAdmin && req.body?.workspaceId
      ? req.body.workspaceId
      : req.user?.workspaceId;
};

const getTicketStatuses = async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
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
    const workspaceId = resolveWorkspaceId(req);
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
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await statusService.updateStatus(id, req.body);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    if (error.message === 'Status not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await statusService.deleteStatus(id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.message === 'Status not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const reorderTicketStatuses = async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const { orderedIds } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const statuses = await statusService.reorderStatuses(workspaceId, orderedIds);
    res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
};
