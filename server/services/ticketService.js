const Ticket = require("../models/Ticket");

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
  const ticket = new Ticket({
    subject: ticketData.subject,
    description: ticketData.description || "",
    creator: ticketData.creatorId,
    status: ticketData.status === undefined ? "to do" : ticketData.status,
    assignedTo: ticketData.assignedTo,
    workspace: ticketData.workspaceId,
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
};
