const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const createRefreshToken = async (userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  
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
    role: role || 'agent',
    active: true
  });

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

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);

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
    
    const accessToken = generateAccessToken(decoded.id);

    return { accessToken };
  } catch (err) {
    throw new Error('Token expired or invalid');
  }
};

module.exports = { register, login, refresh };