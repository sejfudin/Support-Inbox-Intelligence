const authService = require('../services/authService');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');

const register = async (req, res, next) => {
  try {
    const result = await authService.register({
      ...req.body,
      inviterId: req.user._id,
      inviterName: req.user.fullname,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Workspace not found') {
      return res.status(404).json({ message: error.message });
    }
    const clientErrors = [
      'Hub is required',
      'Invalid hub',
      'Invalid role',
      'Internship type is required',
      'Primary mentor is required',
      'Internship start date is required',
      'Invalid internship type',
      'Invalid primary mentor',
      'Invalid secondary mentor',
      'Primary mentor must be an admin or mentor',
      'Secondary mentor must be an admin or mentor',
      'Secondary mentor must be different from primary mentor',
      'Invalid internship start date',
    ];
    if (clientErrors.includes(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    if (
      error.message?.includes('already a member') ||
      error.message?.includes('already active') ||
      error.message?.includes('pending invitation')
    ) {
      return res.status(409).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This email address is already in use.' });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    return res.status(403).json({ message: 'Session expired or invalid' });
  }
};

// `req.user.workspaceId` is a last-switched-to pointer, not proof of membership
// (see resolveActiveWorkspaceId). Report the verified workspace instead, so the
// client's workspace gating matches what the API will actually serve — a stale
// pointer must read as "no workspace", not as access.
const getMe = async (req, res, next) => {
  try {
    const activeWorkspaceId = await resolveActiveWorkspaceId({ user: req.user });

    res.status(200).json({
      ...req.user.toObject(),
      workspaceId: activeWorkspaceId,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (dbError) {
        console.error('Logout DB Error:', dbError);
      }
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        message: 'You are not authorized to update this profile',
      });
    }

    const updateData = {};

    if (req.body.fullname) updateData.fullname = req.body.fullname;
    if (req.body.password) updateData.password = req.body.password;

    if (req.user.role === 'admin') {
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.role) updateData.role = req.body.role;
      if (req.body.hub) updateData.hub = req.body.hub;

      if (req.body.active !== undefined) {
        updateData.active = req.body.active;
        updateData.status = req.body.active ? 'active' : 'disabled';
      }
    } else {
      if (req.body.email || req.body.role || req.body.active !== undefined) {
        return res.status(403).json({
          message: 'Only admins can change Email, Role, or Status.',
        });
      }
    }

    const user = await authService.updateUser(id, updateData);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === 'This email is already in use by another user') {
      return res.status(409).json({
        message: error.message,
      });
    }
    if (error.message?.includes('Invalid role')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

const verifyInvite = async (req, res) => {
  try {
    const { setupToken, user } = await authService.verifyInvite({
      email: req.body.email,
      token: req.body.token,
    });

    res.json({
      message: 'Invite verified',
      email: user.email,
      fullName: user.fullname,
      setupToken,
    });
  } catch (error) {
    const statusCode =
      error.message === 'This account is already active. Please sign in.' ? 409 : 400;
    res.status(statusCode).json({ message: error.message || 'Invalid or expired invite' });
  }
};

const setPasswordFromInvite = async (req, res) => {
  try {
    const result = await authService.setPasswordFromInvite({
      setupToken: req.body.setupToken,
      password: req.body.password,
    });

    res.json(result);
  } catch (e) {
    res.status(401).json({ message: e.message || 'Setup session expired' });
  }
};

module.exports = {
  register,
  login,
  refresh,
  getMe,
  logout,
  updateUser,
  verifyInvite,
  setPasswordFromInvite,
};
