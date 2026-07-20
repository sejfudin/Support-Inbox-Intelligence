const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Invitation = require('../models/Invitation');
const { escapeRegex } = require('../helpers/escapeRegex');

const getUserWorkspaceMemberships = async (userId) => {
  const workspaces = await Workspace.find(
    { 'members.user': userId, isArchived: { $ne: true } },
    { name: 1, members: 1, createdAt: 1 }
  ).sort({ name: 1 });

  const workspaceIds = workspaces.map((workspace) => workspace._id);
  const invitations = await Invitation.find({
    user: userId,
    workspace: { $in: workspaceIds },
    status: { $in: ['accepted', 'pending'] },
  })
    .select('workspace createdAt respondedAt status')
    .sort({ respondedAt: -1, createdAt: -1 })
    .lean();

  const invitationByWorkspace = new Map(
    invitations.map((invitation) => [invitation.workspace.toString(), invitation])
  );

  return workspaces.map((workspace) => {
    const member = workspace.members.find((m) => m.user?.equals(userId));
    const invitation = invitationByWorkspace.get(workspace._id.toString());
    const membershipDate =
      member?.joinedAt || invitation?.respondedAt || invitation?.createdAt || workspace.createdAt;

    return {
      id: workspace._id,
      name: workspace.name,
      role: member?.role || 'member',
      status: member?.status || 'active',
      createdAt: membershipDate,
      joinedAt: membershipDate,
    };
  });
};

const getUsers = async ({
  page = 1,
  limit = 10,
  search = '',
  pagination = true,
  workspaceId,
  roles,
  status,
  hubId,
}) => {
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
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { fullname: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  if (roles?.length) {
    query.role = { $in: roles };
  }

  if (status) {
    query.status = status;
  }

  if (hubId) {
    query.hub = hubId;
  }

  if (pagination === 'false' || pagination === false) {
    const users = await User.find(query)
      .select('fullname email role status workspaceId hub')
      .populate('hub', 'name city country')
      .sort({ fullname: 1 });
    return { users };
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('hub', 'name city country')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
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
    { returnDocument: 'after', runValidators: true }
  ).select('-password');

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

const getUserById = async (userId) => {
  const user = await User.findById(userId)
    .select('fullname email role status workspaceId hub createdAt')
    .populate('hub', 'name city country');

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
