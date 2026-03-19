const User = require('../models/User');
const Workspace = require('../models/Workspace');

const getUsers = async ({
  page = 1,
  limit = 10,
  search = "" ,
  pagination = true,
  workspaceId,
}) => {
    const skip = (page - 1) * limit;
    const query = {};
    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId).select('members.user members.status');
      if (!workspace) {
        return pagination === "false" || pagination === false
          ? { users: [] }
          : {
              users: [],
              pagination: {
                total: 0,
                page: Number(page),
                limit: Number(limit),
                pages: 0,
              },
            };
      }

      const memberIds = workspace.members
        .filter((member) => member.status === 'active' && member.user)
        .map((member) => member.user);

      query._id = { $in: memberIds };
    }
    if (search) {
        query.$or = [
        { fullname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        ];
    }

    if (pagination === "false" || pagination === false) {
    const users = await User.find(query).select('fullname email role status workspaceId').sort({ fullname: 1 });
    return { users }; 
  }

    const [users, total] = await Promise.all([
        User.find(query)
        .select('-password') 
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
        User.countDocuments(query),
    ]);

    return {
        users,
        pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
        },
    };
};

const updateUserRole = async (userId, role) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
        throw new Error('User not found');
    }

    return user;
};

module.exports = {
  getUsers,
  updateUserRole
};
