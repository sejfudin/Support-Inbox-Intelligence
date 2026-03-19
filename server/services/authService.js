const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Invitation = require('../models/Invitation');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (id, tokenVersion) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

const generateInviteToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const buildSetupUrl = (token) =>
  `${process.env.CLIENT_URL}/set-password?token=${token}`;

const createRefreshToken = async (userId, tokenVersion) => {
  const token = jwt.sign(
    { id: userId, tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );

  await RefreshToken.create({
    token: token,
    user: userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return token;
};

const register = async (userData) => {
  const {
    fullName,
    email,
    role,
    workspaceId: rawWorkspaceId,
    workspaceRole = "member",
    inviterId,
    inviterName,
  } = userData;
  const isGlobalAdmin = role === "admin";
  const workspaceId = isGlobalAdmin ? undefined : rawWorkspaceId;

  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  let workspace = null;

  if (workspaceId) {
    workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
  }

  if (user && user.status === "active" && !workspaceId) {
    throw new Error("User already active!");
  }

  if (user && user.status === "active" && workspaceId) {
    const alreadyMember = workspace.members.some(
      (member) =>
        member.user.toString() === user._id.toString() && member.status === "active"
    );
    if (alreadyMember) throw new Error("User is already a member of this workspace");

    const pendingInvitation = await Invitation.findOne({
      user: user._id,
      workspace: workspaceId,
      status: "pending",
    });
    if (pendingInvitation) {
      throw new Error("User already has a pending invitation for this workspace");
    }

    await Invitation.create({
      user: user._id,
      workspace: workspaceId,
      invitedBy: inviterId,
      workspaceRole,
    });

    return { message: "Invitation sent in-app" };
  }

  if (!user) {
    user = await User.create({
      fullname: fullName,
      email: normalizedEmail,
      role: role || "user",
      active: false,
      status: "invited",
    });
  } else {
    user.fullname = fullName;
    user.role = role || user.role || "user";
    user.active = false;
    user.status = "invited";
  }

  user.inviteTokenHash = null;
  user.inviteTokenExpires = null;
  user.invitedBy = inviterId || null;
  user.invitedAt = new Date();
  user.inviteAcceptedAt = null;
  user.inviteSetupSessionHash = null;
  user.inviteSetupSessionExpires = null;
  await user.save();

  if (workspaceId) {
    const pendingInvitation = await Invitation.findOne({
      user: user._id,
      workspace: workspaceId,
      status: "pending",
    });

    if (!pendingInvitation) {
      await Invitation.create({
        user: user._id,
        workspace: workspaceId,
        invitedBy: inviterId,
        workspaceRole,
      });
    }
  }

  return {
    message: "User created. They can activate their account by entering their email on the password setup screen.",
    requiresPasswordSetup: true,
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.password) {
    throw new Error("Invalid email or password");
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid email or password");

  if (!user.active) throw new Error("Account deactivated");

  const accessToken = generateAccessToken(user._id, user.tokenVersion || 0);
  const refreshToken = await createRefreshToken(
    user._id,
    user.tokenVersion || 0,
  );

  return {
    id: user._id,
    fullName: user.fullname,
    email: user.email,
    role: user.role,
    accessToken,
    refreshToken,
  };
};

const refresh = async (token) => {
  if (!token) throw new Error("No token provided");

  const storedToken = await RefreshToken.findOne({ token });
  if (!storedToken) throw new Error("Invalid refresh token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) throw new Error("User no longer exists");

    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new Error("Session expired. Please login again.");
    }

    const accessToken = generateAccessToken(user._id, user.tokenVersion);

    return { accessToken };
  } catch (err) {
    if (storedToken) await RefreshToken.deleteOne({ token });
    throw new Error("Token expired or invalid");
  }
};

const logout = async (refreshToken) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  return {
    success: true,
    message: "Logout successful",
  };
};

const updateUser = async (userId, updateData) => {
  const updateOperation = { $set: updateData };

  if (updateData.password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(updateData.password, salt);
    updateOperation.$inc = { tokenVersion: 1 };
    await RefreshToken.deleteMany({ user: userId });
  } else {
    delete updateData.password;
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateOperation, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("This email is already in use by another user");
    }
    throw error;
  }
};

const createUserInvite = async ({
  fullName,
  email,
  role = "user",
  inviterId,
  inviterName,
}) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (user && user.status === "active") {
    throw new Error("User already active!");
  }

  if (!user) {
    user = await User.create({
      fullname: fullName,
      email: normalizedEmail,
      role,
      active: false,
      status: "invited",
    });
  } else {
    user.fullname = fullName;
    user.role = role;
    user.active = false;
    user.status = "invited";
  }

  user.inviteTokenHash = null;
  user.inviteTokenExpires = null;
  user.invitedBy = inviterId;
  user.invitedAt = new Date();
  user.inviteAcceptedAt = null;

  // reset any previous setup session
  user.inviteSetupSessionHash = null;
  user.inviteSetupSessionExpires = null;

  await user.save();

  return {
    message: "User invite created. They can activate their account by entering their email on the password setup screen.",
    requiresPasswordSetup: true,
  };
};

const verifyInvite = async ({ email, token }) => {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  let user = null;

  if (normalizedEmail) {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser?.status === "active" || existingUser?.active) {
      throw new Error("This account is already active. Please sign in.");
    }

    user = await User.findOne({
      email: normalizedEmail,
      status: "invited",
      active: false,
    });
  } else if (token) {
    const tokenHash = hashToken(String(token));
    user = await User.findOne({
      inviteTokenHash: tokenHash,
      inviteTokenExpires: { $gt: new Date() },
      status: "invited",
    });
  }

  if (!user) throw new Error("No invited account found for this email.");

  const rawSetupToken = generateInviteToken();
  user.inviteSetupSessionHash = hashToken(rawSetupToken);
  user.inviteSetupSessionExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await user.save();

  return { setupToken: rawSetupToken, user };
};

const setPasswordFromInvite = async ({ setupToken, password }) => {
  if (!setupToken)
    throw new Error("Setup session expired. Re-open invite link.");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const setupHash = hashToken(String(setupToken));

  const user = await User.findOne({
    inviteSetupSessionHash: setupHash,
    inviteSetupSessionExpires: { $gt: new Date() },
    status: "invited",
  }).select("+password");

  if (!user) throw new Error("Setup session expired. Re-open invite link.");

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(String(password), salt);

  user.active = true;
  user.status = "active";
  user.passwordSetAt = new Date();
  user.inviteAcceptedAt = new Date();

  user.inviteTokenHash = null;
  user.inviteTokenExpires = null;
  user.inviteSetupSessionHash = null;
  user.inviteSetupSessionExpires = null;

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await RefreshToken.deleteMany({ user: user._id });

  await user.save();

  // Activate workspace membership if the user was invited to one
  if (user.workspaceId) {
    await Workspace.updateOne(
      { _id: user.workspaceId, 'members.user': user._id },
      { $set: { 'members.$.status': 'active' } }
    );
  }

  const accessToken = generateAccessToken(user._id, user.tokenVersion);
  const refreshToken = await createRefreshToken(user._id, user.tokenVersion);

  return {
    id: user._id,
    fullName: user.fullname,
    email: user.email,
    role: user.role,
    accessToken,
    refreshToken,
  };
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  updateUser,
  createUserInvite,
  verifyInvite,
  setPasswordFromInvite,
};
