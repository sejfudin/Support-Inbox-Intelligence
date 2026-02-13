const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendTemplatedEmail } = require('./emailService');
const { TEMPLATE_IDS } = require('../utils/constants');

const generateAccessToken = (id, tokenVersion) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const createRefreshToken = async (userId, tokenVersion) => {
  const token = jwt.sign({ id: userId, tokenVersion }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  
  await RefreshToken.create({
    token: token,
    user: userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return token;
};

const register = async (userData) => {
  const { fullName, email, password, role } = userData;

  const userExists = await User.findOne({ email });
  if (userExists) throw new Error('User exists');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    fullname: fullName,
    email,
    password: hashedPassword,
    role: role || 'user',
    active: true
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

  const accessToken = generateAccessToken(user._id);
  const refreshToken = await createRefreshToken(user._id);

  return { 
    id: user._id, fullName: user.fullName, email: user.email, role: user.role,
    accessToken, refreshToken 
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (user && (await bcrypt.compare(password, user.password))) {
    if (!user.active) throw new Error('Account deactivated');

    const accessToken = generateAccessToken(user._id, user.tokenVersion || 0);
    const refreshToken = await createRefreshToken(user._id, user.tokenVersion || 0);

    return { 
      id: user._id, fullName: user.fullName, email: user.email, role: user.role,
      accessToken, refreshToken 
    };
  } else {
    throw new Error('Invalid email or password');
  }
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

    return { accessToken };
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
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true, runValidators: true }
    ).select("-password"); 
  
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

module.exports = { register, login, refresh, logout, updateUser };