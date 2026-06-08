const userService = require('../services/adminService');
const authService = require('../services/authService');

exports.getUsers = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      pagination,
      workspaceId: queryWorkspaceId,
      roles: rolesParam,
      status,
      hubId,
    } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const workspaceId = isAdmin ? queryWorkspaceId : req.user?.workspaceId;
    const roles = rolesParam
      ? String(rolesParam)
          .split(',')
          .map((r) => r.trim())
      : undefined;

    const result = await userService.getUsers({
      page,
      limit,
      search,
      pagination,
      workspaceId,
      roles,
      status,
      hubId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }

    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await userService.updateUserRole(id, role);

    res.json(user);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }

    next(error);
  }
};

exports.createUserInvite = async (req, res, next) => {
  try {
    const result = await authService.createUserInvite({
      ...req.body,
      inviterId: req.user.id,
      inviterName: req.user.fullname,
    });
    res.status(201).json(result);
  } catch (err) {
    if (
      err.message === 'Invalid role' ||
      err.message === 'Hub is required' ||
      err.message === 'Invalid hub'
    ) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};
