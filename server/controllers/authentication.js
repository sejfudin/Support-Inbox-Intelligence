const authService = require("../services/authService");

const attachCookie = (res, refreshToken) => {
  const oneDay = 1000 * 60 * 60 * 24;
  const isSecureEnv =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isSecureEnv,
    expires: new Date(Date.now() + oneDay * 7),
    sameSite: isSecureEnv ? "none" : "lax",
  });
};

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
    attachCookie(res, result.refreshToken);
    const { refreshToken, ...userData } = result;
    res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    const isSecureEnv =
      process.env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "staging";

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isSecureEnv,
      sameSite: isSecureEnv ? "none" : "lax",
    });

    return res.status(403).json({ message: "Session expired or invalid" });
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (dbError) {
        console.error("Logout DB Error:", dbError);
      }
    }

    const isSecureEnv =
      process.env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "staging";

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isSecureEnv,
      sameSite: isSecureEnv ? "none" : "lax",
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "admin" && req.user.id !== id) {
      return res.status(403).json({
        message: "You are not authorized to update this profile",
      });
    }

    const updateData = {};

    if (req.body.fullname) updateData.fullname = req.body.fullname;
    if (req.body.password) updateData.password = req.body.password;

    if (req.user.role === "admin") {
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.role) updateData.role = req.body.role;

      if (req.body.active !== undefined) updateData.active = req.body.active;
    } else {
      if (req.body.email || req.body.role || req.body.active !== undefined) {
        return res.status(403).json({
          message: "Only admins can change Email, Role, or Status.",
        });
      }
    }

    const user = await authService.updateUser(id, updateData);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === "This email is already in use by another user") {
      return res.status(409).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
};

const attachInviteSetupCookie = (res, setupToken) => {
  const isSecureEnv =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";

  res.cookie("invite_setup", setupToken, {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: isSecureEnv ? "none" : "lax",
    expires: new Date(Date.now() + 15 * 60 * 1000),
  });
};

const clearInviteSetupCookie = (res) => {
  const isSecureEnv =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";

  res.clearCookie("invite_setup", {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: isSecureEnv ? "none" : "lax",
  });
};

const verifyInvite = async (req, res) => {
  try {
    const isSecureEnv =
      process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
    
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isSecureEnv,
      sameSite: isSecureEnv ? "none" : "lax",
    });

    const { setupToken, user } = await authService.verifyInvite({
      email: req.body.email,
      token: req.body.token,
    });
    attachInviteSetupCookie(res, setupToken);

    res.json({
      message: "Invite verified",
      email: user.email,
      fullName: user.fullname,
    });
  } catch (error) {
    const statusCode =
      error.message === "This account is already active. Please sign in." ? 409 : 400;
    res.status(statusCode).json({ message: error.message || "Invalid or expired invite" });
  }
};

const setPasswordFromInvite = async (req, res) => {
  try {
    const result = await authService.setPasswordFromInvite({
      setupToken: req.cookies.invite_setup,
      password: req.body.password,
    });

    attachCookie(res, result.refreshToken);
    clearInviteSetupCookie(res);

    const { refreshToken, ...userData } = result;
    res.json(userData);
  } catch (e) {
    res.status(401).json({ message: e.message || "Setup session expired" });
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
