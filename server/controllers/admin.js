const userService = require("../services/adminService");
const authService = require("../services/authService");

exports.getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, pagination, workspaceId: queryWorkspaceId } = req.query;
    const isAdmin = req.user?.role === "admin";
    const workspaceId = isAdmin ? queryWorkspaceId : req.user?.workspaceId;

    const result = await userService.getUsers({
      page,
      limit,
      search,
      pagination,
      workspaceId,
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
    console.error("Update user role error:", error);

    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }

    next(error);
  }
};

exports.createUserInvite = async (req, res, next) => {
  try {
    const result = await authService.createUserInvite({
      ...req.body,
      inviterId: req.user.id,
      inviterName: req.user.fullname,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
