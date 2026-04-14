const Ticket = require("../models/Ticket");
const Workspace = require("../models/Workspace");
const mongoose = require("mongoose");


const PRIORITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const parseCsvList = (raw = "", { lowercase = false } = {}) => {
  const source = Array.isArray(raw) ? raw.join(",") : String(raw || "");
  const values = source
    .split(",")
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .map((v) => (lowercase ? v.toLowerCase() : v));

  return [...new Set(values)];
};

const normalizePriorityList = ({ priorities, priority }) => {
  const parsed = parseCsvList(priorities, { lowercase: true });
  if (parsed.length > 0) return parsed;

  const legacy = String(priority || "").trim().toLowerCase();
  if (!legacy || legacy === "all") return [];

  return [legacy];
};

const normalizePriorityOrder = (value) => {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "asc" || safe === "desc") return safe;
  return "none";
};

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

  const workspace = await Workspace.findById(workspaceId).select(
    "members.user members.status",
  );
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const activeMemberIds = new Set(
    workspace.members
      .filter((member) => member.status === "active" && member.user)
      .map((member) => member.user.toString()),
  );

  const hasInvalidAssignee = assignedUserIds.some(
    (userId) => !activeMemberIds.has(userId),
  );
  if (hasInvalidAssignee) {
    throw new Error(INVALID_ASSIGNEE_ERROR);
  }
};

const getAllTickets = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "",
  priority = "",
  priorities = "",
  assigneeIds = "",
  priorityOrder = "none",
  archived,
  workspaceId,
}) => {
  if (!workspaceId) {
    return {
      tickets: [],
      pagination: {
        total: 0,
        page: Number(page),
        limit: Number(limit),
        pages: 0,
      },
    };
  }

  const safeLimit = Number(limit) || 10;
  const safePage = Number(page) || 1;
  const skip = (safePage - 1) * safeLimit;

  const query = { workspace: workspaceId };

  if (archived !== undefined) {
    query.isArchived = archived ? true : { $ne: true };
  }

  if (search) {
    const searchConditions = [
      { subject: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];

    const searchAsNumber = Number(search);
    if (!Number.isNaN(searchAsNumber)) {
      searchConditions.push({ taskNumber: searchAsNumber });
    }

    query.$or = searchConditions;
  }

  if (status === "null" || status === null) {
    query.status = null;
  } else if (status === "not_null") {
    query.status = { $ne: "backlog" };
  } else if (status && status !== "all") {
    query.status = status;
  }

  const selectedPriorities = normalizePriorityList({ priorities, priority });
  if (selectedPriorities.length > 0) {
    query.priority = { $in: selectedPriorities };
  }

  const selectedAssigneeIds = parseCsvList(assigneeIds, { lowercase: false });
  if (selectedAssigneeIds.length > 0) {
    const wantsUnassigned = selectedAssigneeIds.includes("unassigned");
    const selectedUsers = selectedAssigneeIds.filter(
      (id) => id !== "unassigned",
    );

    const selectedUserObjectIds = selectedUsers
  .filter((id) => mongoose.Types.ObjectId.isValid(id))
  .map((id) => new mongoose.Types.ObjectId(id));


    const assigneeOr = [];

    if (selectedUserObjectIds.length > 0) {
      assigneeOr.push({ assignedTo: { $in: selectedUserObjectIds } });
    }


    if (wantsUnassigned) {
      assigneeOr.push(
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } },
      );
    }

    if (assigneeOr.length === 1) {
      Object.assign(query, assigneeOr[0]);
    } else if (assigneeOr.length > 1) {
      query.$and = query.$and || [];
      query.$and.push({ $or: assigneeOr });
    }
  }

  const normalizedOrder = normalizePriorityOrder(priorityOrder);

  const mongoSort =
    normalizedOrder === "none"
      ? { updatedAt: -1 }
      : {
          priorityRank: normalizedOrder === "desc" ? -1 : 1,
          updatedAt: -1,
        };

  const [tickets, total] = await Promise.all([
    Ticket.aggregate([
      { $match: query },
      {
        $addFields: {
          priorityRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "low"] }, then: PRIORITY_RANK.low },
                { case: { $eq: ["$priority", "medium"] }, then: PRIORITY_RANK.medium },
                { case: { $eq: ["$priority", "high"] }, then: PRIORITY_RANK.high },
                { case: { $eq: ["$priority", "critical"] }, then: PRIORITY_RANK.critical },
              ],
              default: PRIORITY_RANK.medium,
            },
          },
        },
      },
      { $sort: mongoSort },
      { $skip: skip },
      { $limit: safeLimit },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
          pipeline: [{ $project: { fullname: 1, email: 1 } }],
        },
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedTo",
          pipeline: [{ $project: { fullname: 1, email: 1, role: 1 } }],
        },
      },
      { $project: { priorityRank: 0 } },
    ]),
    Ticket.countDocuments(query),
  ]);

  return {
    tickets,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
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

  const lastTicket = await Ticket.findOne({ workspace: ticketData.workspaceId })
    .sort("-taskNumber")
    .select("taskNumber")
    .lean();

  const nextTaskNumber =
    lastTicket && lastTicket.taskNumber ? lastTicket.taskNumber + 1 : 1;

  const status = ticketData.status === undefined ? "to do" : ticketData.status;

  const ticket = new Ticket({
    subject: ticketData.subject,
    description: ticketData.description || "",
    creator: ticketData.creatorId,
    status,
    priority: ticketData.priority || "medium",
    assignedTo: ticketData.assignedTo,
    workspace: ticketData.workspaceId,
    taskNumber: nextTaskNumber,
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
    if (!oldTicket) throw new Error("Ticket not found");

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
        runValidators: true,
      },
    )
      .populate("assignedTo", "fullname email role")
      .populate("creator", "fullName");

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    return ticket;
  } catch (error) {
    if (error.name === "ValidationError") {
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
  priority = "",
  priorities = "",
  priorityOrder = "none",
}) => {
  const safeLimit = Number(limit) || 10;
  const safePage = Number(page) || 1;
  const skip = (safePage - 1) * safeLimit;

  if (!workspaceId) {
    return {
      tickets: [],
      stats: {
        activeTickets: 0,
        inProgress: 0,
        blocked: 0,
        completedThisMonth: 0,
      },
      pagination: {
        total: 0,
        page: safePage,
        limit: safeLimit,
        pages: 0,
      },
    };
  }

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

  const selectedPriorities = normalizePriorityList({ priorities, priority });
  if (selectedPriorities.length > 0) {
    query.priority = { $in: selectedPriorities };
  }

  const normalizedOrder = normalizePriorityOrder(priorityOrder);
  const sortStage =
    normalizedOrder === "none"
      ? { updatedAt: -1 }
      : {
          priorityRank: normalizedOrder === "desc" ? -1 : 1,
          updatedAt: -1,
        };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [tickets, total, statsArray] = await Promise.all([
    Ticket.aggregate([
      { $match: query },
      {
        $addFields: {
          priorityRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "low"] }, then: PRIORITY_RANK.low },
                { case: { $eq: ["$priority", "medium"] }, then: PRIORITY_RANK.medium },
                { case: { $eq: ["$priority", "high"] }, then: PRIORITY_RANK.high },
                { case: { $eq: ["$priority", "critical"] }, then: PRIORITY_RANK.critical },
              ],
              default: PRIORITY_RANK.medium,
            },
          },
        },
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: safeLimit },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
          pipeline: [{ $project: { fullname: 1, email: 1 } }],
        },
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedTo",
          pipeline: [{ $project: { fullname: 1, email: 1, role: 1 } }],
        },
      },
      { $project: { priorityRank: 0 } },
    ]),
    Ticket.countDocuments(query),
    Ticket.aggregate([
      {
        $match: {
          assignedTo: userId,
          isArchived: { $ne: true },
          workspace: workspaceId,
        },
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
              $cond: [{ $in: ["$status", ["in progress", "on staging"]] }, 1, 0],
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
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
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
