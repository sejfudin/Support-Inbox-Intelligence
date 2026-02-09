const userService = require('../services/adminService');

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, pagination} = req.query;
    
    const result = await userService.getUsers({ 
      page, 
      limit, 
      search,
      pagination
    });

    res.json(result);
  } catch (error) {
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
    console.error('Update user role error:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    
    next(error);
  }
};