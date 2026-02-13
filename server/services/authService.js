const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendTemplatedEmail } = require('./emailService');
const { TEMPLATE_IDS } = require('../utils/constants');

const generateAccessToken = (id, tokenVersion) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

const generateInviteToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

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
  const { fullName, email, role } = userData;

  const userExists = await User.findOne({ email });
  if (userExists) throw new Error("User exists");

  const user = await User.create({
    fullname: fullName,
    email,
    role: role || "user",
    active: false,
    status: "invited",
  });
  const emailResults = await Promise.allSettled([
    sendTemplatedEmail(
      user.email,
      TEMPLATE_IDS.WELCOME_EMAIL,
      {
        fullName: user.fullname,
        email: user.email,
        password: password,
        loginUrl: `${process.env.CLIENT_URL}/login`, 
      }
    )
  ]);

  if (emailResults[0].status === 'rejected') {
    console.error('Welcome email failed to send:', emailResults[0].reason);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.inviteTokenHash = tokenHash;
  user.inviteTokenExpires = Date.now() + 1000 * 60 * 60;
  await user.save();

  const inviteUrl = `${process.env.CLIENT_URL}/set-password?token=${rawToken}`;

  console.log("Sending invite email to:", user.email);
  console.log("Template:", TEMPLATE_IDS.INVITE_SET_PASSWORD);
  console.log("From:", process.env.SENDGRID_FROM_EMAIL);

  await sendTemplatedEmail(user.email, TEMPLATE_IDS.INVITE_SET_PASSWORD, {
    fullName: user.fullname,
    inviterName: "Admin",
    appName: "Support Inbox",
    setPasswordUrl: inviteUrl,
  });

  return { message: "Invite sent" };
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

  const rawInviteToken = generateInviteToken();
  user.inviteTokenHash = hashToken(rawInviteToken);
  user.inviteTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  user.invitedBy = inviterId;
  user.invitedAt = new Date();
  user.inviteAcceptedAt = null;

  // reset any previous setup session
  user.inviteSetupSessionHash = null;
  user.inviteSetupSessionExpires = null;

  await user.save();

  const setPasswordUrl = `${process.env.CLIENT_URL}/set-password?token=${rawInviteToken}`;

  console.log("Sending invite email to:", user.email);
  console.log("Template:", TEMPLATE_IDS.INVITE_SET_PASSWORD);
  console.log("From:", process.env.SENDGRID_FROM_EMAIL);

  await sendTemplatedEmail(user.email, TEMPLATE_IDS.INVITE_SET_PASSWORD, {
    fullName: user.fullname,
    inviterName: inviterName || "Admin",
    setPasswordUrl,
  });

  return { message: "Invite sent" };
};

const verifyInvite = async (token) => {
  if (!token) throw new Error("Invalid invite");

  const tokenHash = hashToken(String(token));

  const user = await User.findOne({
    inviteTokenHash: tokenHash,
    inviteTokenExpires: { $gt: new Date() },
    status: "invited",
  });

  if (!user) throw new Error("Invalid invite");

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
