const User = require('../models/User');
const bcrypt = require('bcryptjs');

const register = async (userData) => {
  const { fullName, email, password, role } = userData;

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new Error('User with this email already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    fullname: fullName, 
    email,
    password: hashedPassword,
    role: role || 'agent',
    active: true
  });

  return {
    id: user._id,
    fullname: user.fullname,
    email: user.email,
    role: user.role
  };
};

const login = async (credentials) => {
};

module.exports = {
  register,
  login
};