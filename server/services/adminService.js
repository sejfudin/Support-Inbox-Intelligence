const User = require('../models/User');
const Workspace = require('../models/Workspace');

const getUserWorkspaceMemberships = async (userId) => {
  const workspaces = await Workspace.find(
    { 'members.user': userId, isArchived: { $ne: true } },
    { name: 1, members: 1, createdAt: 1 }
  ).sort({ name: 1 });

  return workspaces.map((workspace) => {
    const member = workspace.members.find((m) => m.user?.equals(userId));
    return {
      id: workspace._id,
      name: workspace.name,
      role: member?.role || 'member',
      status: member?.status || 'active',
      createdAt: member?.createdAt || workspace.createdAt,
    };
  });
};

const getUsers = async ({ page = 1, limit = 10, search = '', pagination = true, workspaceId }) => {
  const skip = (page - 1) * limit;
  const query = {};
  if (workspaceId) {
    const workspace = await Workspace.findById(workspaceId).select('members.user members.status');
    if (!workspace) {
      return pagination === 'false' || pagination === false
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
      { fullname: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (pagination === 'false' || pagination === false) {
    const users = await User.find(query)
      .select('fullname email role status workspaceId')
      .sort({ fullname: 1 });
    return { users };
  }

  const [users, total] = await Promise.all([
    User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  // Fetch workspace membership data for each user
  const usersWithMemberships = await Promise.all(
    users.map(async (user) => {
      const membershipData = await getUserWorkspaceMemberships(user._id);

      return {
        ...user.toObject(),
        workspaces: membershipData,
        workspaceCount: membershipData.length,
      };
    })
  );

  return {
    users: usersWithMemberships,
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

const getUserById = async (userId) => {
  const user = await User.findById(userId).select('fullname email role status workspaceId');

  if (!user) {
    throw new Error('User not found');
  }

  const membershipData = await getUserWorkspaceMemberships(user._id);

  return {
    ...user.toObject(),
    workspaces: membershipData,
    workspaceCount: membershipData.length,
  };
};

module.exports = {
  getUsers,
  updateUserRole,
  getUserById,
};
