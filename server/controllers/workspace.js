const workspaceService = require('../services/workspaceService');
const { StatusValidationError } = require('../helpers/statusValidation');

exports.createWorkspace = async (req, res, next) => {
  try {
    const { name, description, statuses } = req.body;
    if (!name) return res.status(400).json({ message: 'Workspace name is required' });

    const workspace = await workspaceService.createWorkspace({
      name,
      description,
      ownerId: req.user._id,
      statuses,
    });

    res.status(201).json(workspace);
  } catch (err) {
    if (err instanceof StatusValidationError || err.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.getMyWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await workspaceService.getUserWorkspaces(req.user._id);
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
};

exports.getWorkspace = async (req, res, next) => {
  try {
    const workspace = await workspaceService.getWorkspaceById(req.params.id, {
      userId: req.user._id,
      role: req.user.role,
    });
    res.json(workspace);
  } catch (err) {
    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ message: err.message });
    }
    next(err);
  }
};

exports.updateWorkspace = async (req, res, next) => {
  try {
    const { name, description, owner } = req.body;
    const workspace = await workspaceService.updateWorkspace(
      req.params.id,
      { name, description, owner },
      req.user._id
    );
    res.json(workspace);
  } catch (err) {
    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }
    if (err.message === 'Only the workspace owner can transfer ownership') {
      return res.status(403).json({ message: err.message });
    }
    if (err.message === 'New owner must be an active member of the workspace') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.uploadWorkspaceLogo = async (req, res, next) => {
  try {
    const updatedWorkspace = await workspaceService.uploadWorkspaceLogo(req.params.id, req.file);
    res.json(updatedWorkspace);
  } catch (err) {
    if (err.message === 'Workspace not found.')
      return res.status(404).json({ message: err.message });

    if (err.message === 'Logo file is required' || err.message === 'Unsupported logo file type') {
      return res.status(400).json({ message: err.message });
    }

    next(err);
  }
};

exports.deleteWorkspaceLogo = async (req, res, next) => {
  try {
    const updatedWorkspace = await workspaceService.deleteWorkspaceLogo(req.params.id);

    res.json(updatedWorkspace);
  } catch (err) {
    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }

    next(err);
  }
};

exports.inviteMember = async (req, res, next) => {
  try {
    const result = await workspaceService.inviteMemberToWorkspace({
      workspaceId: req.params.id,
      ...req.body,
      inviterId: req.user._id,
      inviterName: req.user.fullname,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }
    if (err.message === 'User not found') {
      return res.status(404).json({ message: err.message });
    }
    if (
      err.message === 'User is required' ||
      err.message === 'User is already a member of this workspace' ||
      err.message === 'User already has a pending invitation for this workspace'
    ) {
      return res
        .status(err.message === 'User is required' ? 400 : 409)
        .json({ message: err.message });
    }
    next(err);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const result = await workspaceService.removeMember({
      workspaceId: req.params.id,
      userId: req.params.userId,
    });
    res.json(result);
  } catch (err) {
    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }
    if (err.message === 'Cannot remove the workspace owner') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.cancelInvitation = async (req, res, next) => {
  try {
    const result = await workspaceService.cancelInvitation({
      workspaceId: req.params.id,
      invitationId: req.params.invitationId,
    });
    res.json(result);
  } catch (err) {
    if (err.message === 'Workspace not found' || err.message === 'Invitation not found') {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
};

exports.getAllWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await workspaceService.getAllWorkspaces();
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
};

exports.switchWorkspace = async (req, res, next) => {
  try {
    const result = await workspaceService.switchWorkspace({
      workspaceId: req.params.id,
      userId: req.user._id,
      userRole: req.user.role,
    });
    res.json(result);
  } catch (err) {
    if (err.message === 'Workspace not found')
      return res.status(404).json({ message: err.message });
    if (err.message === 'Not a member of this workspace')
      return res.status(403).json({ message: err.message });
    next(err);
  }
};

exports.deleteWorkspace = async (req, res, next) => {
  try {
    const result = await workspaceService.deleteWorkspace(req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message === 'Workspace not found')
      return res.status(404).json({ message: err.message });
    next(err);
  }
};
