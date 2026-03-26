const Ticket = require("../models/Ticket");
const Workspace = require("../models/Workspace");

const INVALID_ASSIGNEE_ERROR =
  "Assigned users must be active members of this workspace";

const normalizeAssignedUserIds = (assignedTo = []) => {
  const rawIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

  return [...new Set(rawIds.filter(Boolean).map((id) => id.toString()))];
};

const ensureAssignableUsersBelongToWorkspace = async ({
  workspaceId,
  assignedTo = [],
}) => {
  const assignedUserIds = normalizeAssignedUserIds(assignedTo);
  if (!workspaceId || assignedUserIds.length === 0) return;

  const workspace = await Workspace.findById(workspaceId).select("members.user members.status");
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const activeMemberIds = new Set(
    workspace.members
      .filter((member) => member.status === "active" && member.user)
      .map((member) => member.user.toString())
  );

  const hasInvalidAssignee = assignedUserIds.some((userId) => !activeMemberIds.has(userId));
  if (hasInvalidAssignee) {
    throw new Error(INVALID_ASSIGNEE_ERROR);
  }
};

const getAllTickets = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "",
  archived,
  workspaceId,
}) => {
  if (!workspaceId) return { tickets: [], pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 } };

  const skip = (page - 1) * limit;

  const query = { workspace: workspaceId };
  if (archived !== undefined) {
    query.isArchived = archived ? true : { $ne: true };
  }
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (status === "null" || status === null) {
    query.status = null;
  } else if (status === "not_null") {
    query.status = { $ne: "backlog" };
  } else if (status && status !== "all") {
    query.status = status;
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("creator", "fullname email")
      .populate("assignedTo", "fullname email role"),
    Ticket.countDocuments(query),
  ]);
  return {
    tickets,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

const getTicketById = async (ticketId) => {
  const ticket = await Ticket.findById(ticketId)
    .populate("assignedTo", "fullname email role")
    .populate("creator", "fullname email");

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return ticket;
};

const createTicket = async (ticketData) => {
  await ensureAssignableUsersBelongToWorkspace({
    workspaceId: ticketData.workspaceId,
    assignedTo: ticketData.assignedTo,
  });

  const status = ticketData.status === undefined ? "to do" : ticketData.status;

  const ticket = new Ticket({
    subject: ticketData.subject,
    description: ticketData.description || "",
    creator: ticketData.creatorId,
    status,
    assignedTo: ticketData.assignedTo,
    workspace: ticketData.workspaceId,
    inProgressAt: status === "in progress" ? new Date() : undefined,
  });

  await ticket.save();

  return await ticket.populate([
    { path: "creator", select: "fullName email" },
    { path: "assignedTo", select: "fullName email" },
  ]);
};

const updateTicket = async (ticketId, updateData) => {
  try {
    const oldTicket = await Ticket.findById(ticketId);
    if (!oldTicket) throw new Error('Ticket not found');

    if (Object.prototype.hasOwnProperty.call(updateData, "assignedTo")) {
      await ensureAssignableUsersBelongToWorkspace({
        workspaceId: oldTicket.workspace,
        assignedTo: updateData.assignedTo,
      });
    }

    if (updateData.status && updateData.status !== oldTicket.status) {
      const newStatus = updateData.status.toLowerCase();
      const oldStatus = oldTicket.status.toLowerCase();
      const now = new Date();

      if (oldStatus === "in progress") {
        if (oldTicket.inProgressAt) {
          const elapsed = Math.round((now - oldTicket.inProgressAt) / 1000);
          updateData.totalTimeSpent = (oldTicket.totalTimeSpent || 0) + elapsed;
          updateData.inProgressAt = null;
        }
      } else if (newStatus === "in progress") {
        updateData.inProgressAt = now;
      }

      if (newStatus === "done") {
        updateData.doneAt = now;
      } else if (oldStatus === "done") {
        updateData.doneAt = null;
      }
    }

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
      { 
        new: true,
        runValidators: true 
      }
    )    
    .populate('assignedTo', 'fullname email role') 
    .populate('creator', 'fullName');


    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new Error(`Validation failed: ${error.message}`);
    }
    throw error;
  }
};

const archiveTicket = async (ticketId) => {
  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { $set: { isArchived: true } },
    { new: true },
  );
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  return ticket;
};

const getMyTickets = async ({
  userId,
  workspaceId,
  page = 1,
  limit = 10,
  search = "",
  status = "",
}) => {
  const skip = (page - 1) * limit;
  if (!workspaceId) return { tickets: [], stats: { activeTickets: 0, inProgress: 0, blocked: 0, completedThisMonth: 0 }, pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 } };

  const query = {
    assignedTo: userId,
    isArchived: { $ne: true },
    workspace: workspaceId,
  };

  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (status && status !== "all") {
    query.status = status;
  }
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [tickets, total, statsArray] = await Promise.all([
    Ticket.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("creator", "fullname email")
      .populate("assignedTo", "fullname email role"),

    Ticket.countDocuments(query),

    Ticket.aggregate([
      {
        $match: {
          assignedTo: userId,
          isArchived: { $ne: true },
          workspace: workspaceId,
        }
      },
      {
        $group: {
          _id: null,
          activeTickets: {
            $sum: {
              $cond: [
                { $in: ["$status", ["to do", "in progress", "on staging", "blocked"]] },
                1,
                0,
              ],
            },
          },
          inProgress: {
            $sum: {
              $cond: [
                { $in: ["$status", ["in progress", "on staging"]] },
                1,
                0,
              ],
            },
          },
          blocked: {
            $sum: {
              $cond: [{ $eq: ["$status", "blocked"] }, 1, 0],
            },
          },
          completedThisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "done"] },
                    { $gte: ["$updatedAt", startOfMonth] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const stats = statsArray[0] || {
    activeTickets: 0,
    inProgress: 0,
    blocked: 0,
    completedThisMonth: 0,
  };

  return {
    tickets,
    stats,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

module.exports = {
  getAllTickets,
  createTicket,
  getTicketById,
  updateTicket,
  archiveTicket,
  getMyTickets,
  INVALID_ASSIGNEE_ERROR,
};
