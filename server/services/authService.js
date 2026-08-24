const User = require('../models/User');
const Hub = require('../models/Hub');
const { ROLES, isValidRole } = require('../constants/roles');
const { createInternProfile } = require('./internProfileService');
const InternProfile = require('../models/InternProfile');
const InternshipType = require('../models/InternshipType');
const Workspace = require('../models/Workspace');
const Invitation = require('../models/Invitation');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { httpError } = require('../helpers/httpError');

const generateAccessToken = (id, tokenVersion) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

const generateInviteToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const buildSetupUrl = (token) => `${process.env.CLIENT_URL}/set-password?token=${token}`;

const resolveHubId = async (hubId) => {
  if (!hubId) throw new Error('Hub is required');
  const hub = await Hub.findById(hubId);
  if (!hub || !hub.isActive) throw new Error('Invalid hub');
  return hub._id;
};

const createRefreshToken = async (userId, tokenVersion) => {
  const token = jwt.sign({ id: userId, tokenVersion }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });

  await RefreshToken.create({
    token: token,
    user: userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return token;
};

const resolveWorkspaceId = (role, rawWorkspaceId) => {
  if (role === ROLES.ADMIN || role === ROLES.LEADERSHIP) return undefined;
  if (!rawWorkspaceId || rawWorkspaceId === 'none') return undefined;
  return rawWorkspaceId;
};

const register = async (userData) => {
  const {
    fullName,
    email,
    role,
    hubId,
    workspaceId: rawWorkspaceId,
    workspaceRole = 'member',
    internshipTypeId,
    primaryMentorId,
    startDate,
    inviterId,
    inviterName,
  } = userData;
  if (!role || !isValidRole(role)) throw new Error('Invalid role');
  const workspaceId = resolveWorkspaceId(role, rawWorkspaceId);
  const hub = await resolveHubId(hubId);

  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  let workspace = null;

  if (workspaceId) {
    workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new Error('Workspace not found');
  }

  if (user && user.status === 'active' && !workspaceId) {
    throw new Error('User already active!');
  }

  if (user && user.status === 'active' && workspaceId) {
    const alreadyMember = workspace.members.some(
      (member) => member.user.toString() === user._id.toString() && member.status === 'active'
    );
    if (alreadyMember) throw new Error('User is already a member of this workspace');

    const pendingInvitation = await Invitation.findOne({
      user: user._id,
      workspace: workspaceId,
      status: 'pending',
    });
    if (pendingInvitation) {
      throw new Error('User already has a pending invitation for this workspace');
    }

    await Invitation.create({
      user: user._id,
      workspace: workspaceId,
      invitedBy: inviterId,
      workspaceRole,
    });

    return { message: 'Invitation sent in-app' };
  }

  if (!user) {
    user = await User.create({
      fullname: fullName,
      email: normalizedEmail,
      role,
      hub,
      active: false,
      status: 'invited',
    });
  } else {
    user.fullname = fullName;
    user.role = role || user.role;
    user.hub = hub;
    user.active = false;
    user.status = 'invited';
  }

  user.inviteTokenHash = null;
  user.inviteTokenExpires = null;
  user.invitedBy = inviterId || null;
  user.invitedAt = new Date();
  user.inviteAcceptedAt = null;
  user.inviteSetupSessionHash = null;
  user.inviteSetupSessionExpires = null;
  await user.save();

  if (role === ROLES.INTERN) {
    await InternProfile.deleteOne({ user: user._id });
    await createInternProfile({
      userId: user._id,
      internshipTypeId,
      primaryMentorId,
      startDate,
    });
  }

  if (workspaceId) {
    const pendingInvitation = await Invitation.findOne({
      user: user._id,
      workspace: workspaceId,
      status: 'pending',
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
    message:
      'User created. They can activate their account by entering their email on the password setup screen.',
    requiresPasswordSetup: true,
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.password) {
    throw new Error('Invalid email or password');
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid email or password');

  if (!user.active) throw new Error('Account deactivated');

  const accessToken = generateAccessToken(user._id, user.tokenVersion || 0);
  const refreshToken = await createRefreshToken(user._id, user.tokenVersion || 0);

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
  if (!token) throw new Error('No token provided');

  const storedToken = await RefreshToken.findOne({ token });
  if (!storedToken) throw new Error('Invalid refresh token');

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) throw new Error('User no longer exists');

    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new Error('Session expired. Please login again.');
    }

    const accessToken = generateAccessToken(user._id, user.tokenVersion);
    const refreshToken = await createRefreshToken(user._id, user.tokenVersion);
    await RefreshToken.deleteOne({ token });

    return { accessToken, refreshToken };
  } catch (err) {
    if (storedToken) await RefreshToken.deleteOne({ token });
    throw new Error('Token expired or invalid');
  }
};

const logout = async (refreshToken) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  return {
    success: true,
    message: 'Logout successful',
  };
};

/**
 * Change your own password, having proved you know the current one.
 *
 * Separate from `updateUser` on purpose. That function is also the admin's tool
 * for editing somebody else's account, where no old password can be supplied —
 * so a single code path would either block admins from resetting a locked-out
 * intern, or leave a branch that skips the check. This one only ever acts on the
 * caller's own account, and the check is unconditional.
 *
 * Without it, an access token was a permanent account takeover: whoever held one
 * could set a new password and lock the owner out of their own account, never
 * having known the old one.
 *
 * Returns a fresh token pair. The `tokenVersion` bump below invalidates *every*
 * token issued under the old password, including the one that made this request,
 * so re-issuing here is what makes "your other sessions were signed out" true
 * rather than "everyone, including you, was signed out".
 */
const changeOwnPassword = async (userId, { currentPassword, newPassword } = {}) => {
  const current = String(currentPassword || '');
  const next = String(newPassword || '');

  if (!current || !next) throw httpError('Enter your current password and a new one.', 400);
  if (next.length < 6) throw httpError('Password must have at least 6 characters.', 400);

  const user = await User.findById(userId).select('+password');

  // One refusal for every way of failing to prove it. Telling a caller apart
  // "no such account" from "wrong password" would make this an oracle, and the
  // caller is already authenticated — they learn nothing they should not know
  // from a single message.
  if (!user || !user.password || !(await bcrypt.compare(current, user.password))) {
    throw httpError('Your current password is not correct.', 401);
  }
  if (await bcrypt.compare(next, user.password)) {
    throw httpError('Your new password must be different from your current one.', 400);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(next, salt);
  user.passwordSetAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Everything issued under the old password dies with it — a password change is
  // how you evict someone who has your session, so leaving their refresh token
  // alive would defeat the point.
  await RefreshToken.deleteMany({ user: user._id });

  return {
    success: true,
    message: 'Password updated. Any other sessions have been signed out.',
    accessToken: generateAccessToken(user._id, user.tokenVersion),
    refreshToken: await createRefreshToken(user._id, user.tokenVersion),
  };
};

/**
 * An admin steps down and hands the role to another admin, who becomes their
 * mentor going forward. The caller becomes an `intern` with a brand-new
 * `InternProfile` — this is always their *first* one, since an account created
 * straight into `admin` never had one, so there is nothing to reconcile beyond
 * the defensive `deleteOne` `register()` also does.
 *
 * Deliberately narrow: `newAdminMentorId` must name an existing, active
 * `admin` — not a `mentor` — because the whole point is that platform
 * responsibility (not just a mentoring relationship) moves to another admin.
 * `assertMentorUser` inside `createInternProfile` would accept a `mentor` role
 * too, so the stricter check happens here first.
 *
 * No id parameter for the caller — `userId` always comes from the token, the
 * same shape as `changeOwnPassword`. Bumping `tokenVersion` and clearing
 * refresh tokens forces a fresh login, so the caller (and any other open tab)
 * re-authenticates into the intern experience rather than limping along on a
 * cached admin session that will 403 on its next admin-only call.
 */
const stepDownFromAdmin = async (userId, { newAdminMentorId } = {}) => {
  const caller = await User.findById(userId);
  if (!caller || caller.role !== ROLES.ADMIN || !caller.active) {
    throw httpError('Only an active admin can do this.', 403);
  }

  if (!newAdminMentorId) {
    throw httpError('Choose another admin to take over.', 400);
  }
  if (String(newAdminMentorId) === String(caller._id)) {
    throw httpError("You can't hand this over to yourself.", 400);
  }

  const newAdmin = await User.findById(newAdminMentorId).select('role status');
  if (!newAdmin || newAdmin.role !== ROLES.ADMIN || newAdmin.status !== 'active') {
    throw httpError('Selected user is not an active admin.', 400);
  }

  // Prefer the "1-on-1" track — a personal mentor pairing is the closest
  // semantic match for this handoff — and fall back to whichever active type
  // sorts first, so a firm that renamed/removed that seeded default still has
  // a working handoff instead of a hard failure.
  const internshipType =
    (await InternshipType.findOne({ slug: 'one-on-one', isActive: true })) ||
    (await InternshipType.findOne({ isActive: true }).sort({ name: 1 }));
  if (!internshipType) {
    throw httpError('No active internship type is configured for this handoff.', 400);
  }

  await InternProfile.deleteOne({ user: caller._id });
  await createInternProfile({
    userId: caller._id,
    internshipTypeId: internshipType._id,
    primaryMentorId: newAdminMentorId,
    startDate: new Date(),
  });

  caller.role = ROLES.INTERN;
  caller.tokenVersion = (caller.tokenVersion || 0) + 1;
  await caller.save();
  await RefreshToken.deleteMany({ user: caller._id });

  return {
    success: true,
    message: 'You have stepped down. Log back in to continue as an intern.',
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
      returnDocument: 'after',
      runValidators: true,
    }).select('-password');

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('This email is already in use by another user');
    }
    if (error.name === 'ValidationError') {
      throw new Error(error.message);
    }
    throw error;
  }
};

const createUserInvite = async ({ fullName, email, role, hubId, inviterId, inviterName }) => {
  if (!role || !isValidRole(role)) throw new Error('Invalid role');
  const hub = await resolveHubId(hubId);
  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (user && user.status === 'active') {
    throw new Error('User already active!');
  }

  if (!user) {
    user = await User.create({
      fullname: fullName,
      email: normalizedEmail,
      role,
      hub,
      active: false,
      status: 'invited',
    });
  } else {
    user.fullname = fullName;
    user.role = role;
    user.hub = hub;
    user.active = false;
    user.status = 'invited';
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
    message:
      'User invite created. They can activate their account by entering their email on the password setup screen.',
    requiresPasswordSetup: true,
  };
};

const verifyInvite = async ({ email, token }) => {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  let user = null;

  if (normalizedEmail) {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser?.status === 'active' || existingUser?.active) {
      throw new Error('This account is already active. Please sign in.');
    }

    user = await User.findOne({
      email: normalizedEmail,
      status: 'invited',
      active: false,
    });
  } else if (token) {
    const tokenHash = hashToken(String(token));
    user = await User.findOne({
      inviteTokenHash: tokenHash,
      inviteTokenExpires: { $gt: new Date() },
      status: 'invited',
    });
  }

  if (!user) throw new Error('No invited account found for this email.');

  const rawSetupToken = generateInviteToken();
  user.inviteSetupSessionHash = hashToken(rawSetupToken);
  user.inviteSetupSessionExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await user.save();

  return { setupToken: rawSetupToken, user };
};

const setPasswordFromInvite = async ({ setupToken, password }) => {
  if (!setupToken) throw new Error('Setup session expired. Re-open invite link.');
  if (!password || String(password).length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const setupHash = hashToken(String(setupToken));

  const user = await User.findOne({
    inviteSetupSessionHash: setupHash,
    inviteSetupSessionExpires: { $gt: new Date() },
    status: 'invited',
  }).select('+password');

  if (!user) throw new Error('Setup session expired. Re-open invite link.');

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(String(password), salt);

  user.active = true;
  user.status = 'active';
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
  changeOwnPassword,
  stepDownFromAdmin,
  updateUser,
  createUserInvite,
  verifyInvite,
  setPasswordFromInvite,
};
