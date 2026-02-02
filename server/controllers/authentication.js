const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
};