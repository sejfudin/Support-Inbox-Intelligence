const User = require('../models/User');

const getUsers = async ({
  page = 1,
  limit = 10,
  search = "" ,
  pagination = true,
  workspaceId,
}) => {
    const skip = (page - 1) * limit;
    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
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
