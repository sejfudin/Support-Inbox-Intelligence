const ticketService = require("../services/ticketService");
const { DUE_DATE_IN_PAST_ERROR } = ticketService;

const STORY_POINTS_ERROR = "Story points must be an integer between 1 and 5";

const getAllTickets = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      priority, 
      priorities, 
      assigneeIds, 
      priorityOrder, 
      archived,
      workspaceId: queryWorkspaceId,
      sortBy,
      sortOrder,
    } = req.query;

    const isAdmin = req.user?.role === "admin";
    const workspaceId =
      isAdmin && queryWorkspaceId ? queryWorkspaceId : req.user?.workspaceId;

    const result = await ticketService.getAllTickets({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search: search || "",
      status: status || "",
      priority: priority || "",
      priorities: priorities || "",
      assigneeIds: assigneeIds || "",
      priorityOrder: priorityOrder || "none",
      archived: archived === undefined ? undefined : archived === "true",
      workspaceId,
      sortBy: sortBy || "dueDate",
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });

    res.status(200).json({
      success: true,
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getTickets Controller:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error: Unable to fetch tickets",
      error: error.message,
    });
  }
};


const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error in getTicketById Controller:", error.message);

    if (error.kind === "ObjectId") {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    res.status(500).json({
      success: false,
      message: "Server Error: Unable to fetch ticket details",
      error: error.message,
    });
  }
};

const createTicket = async (req, res) => {
  try {
    const {
      subject,
      description,
      assignedTo,
      status,
      workspaceId: bodyWorkspaceId,
      priority,
      dueDate,
      storyPoints,
    } = req.body;
    const isAdmin = req.user && req.user.role === "admin";
    const hasStatus = status !== undefined && status !== null && status !== "";
    const resolvedStatus = isAdmin
      ? hasStatus
        ? status
        : "backlog"
      : hasStatus
        ? status
        : "to do";

    const assignedAgents = assignedTo
      ? Array.isArray(assignedTo)
        ? assignedTo
        : [assignedTo]
      : [];
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject details are required",
      });
    }

    const workspaceId =
      isAdmin && bodyWorkspaceId ? bodyWorkspaceId : req.user.workspaceId;

    const normalizedStoryPoints = normalizeStoryPointsInput(storyPoints);

    const newTicket = await ticketService.createTicket({
      subject,
      description,
      creatorId: req.user._id,
      assignedTo: assignedAgents,
      status: resolvedStatus,
      workspaceId,
      priority: priority || "medium",
      dueDate,
      storyPoints: normalizedStoryPoints,
    });
    res.status(201).json({
      success: true,
      data: newTicket,
    });
  } catch (error) {
    console.error("Error in createTicket Controller:", error.message);
    if (
      error.message ===
        "Assigned users must be active members of this workspace" ||
      error.message === "Workspace not found"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === STORY_POINTS_ERROR) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === DUE_DATE_IN_PAST_ERROR) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error: Unable to create ticket",
      error: error.message,
    });

  }
};

const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const hasStoryPoints = Object.prototype.hasOwnProperty.call(updateData, "storyPoints");

    const normalizedStoryPoints = hasStoryPoints ? normalizeStoryPointsInput(updateData.storyPoints) : undefined;

    const allowedUpdates = [
      "subject",
      "description",
      "status",
      "assignedTo",
      "priority",
      "dueDate",
      "storyPoints",
    ];
    const filteredUpdate = Object.keys(updateData)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        if (key === "status" && typeof updateData[key] === "string") {
          obj[key] = updateData[key].toLowerCase();
        } else if (key === "priority" && typeof updateData[key] === "string") {
          obj[key] = updateData[key].toLowerCase();
        } else if (key === "dueDate") {
          const v = updateData[key];
          obj[key] = v === null || v === "" ? null : v;
        } else if (key === "storyPoints") {
          obj[key] = normalizedStoryPoints;
        } else {
          obj[key] = updateData[key];
        }
        return obj;
      }, {});

    const updatedTicket = await ticketService.updateTicket(id, filteredUpdate);

    res.status(200).json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    if (error.message === "Ticket not found") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message ===
        "Assigned users must be active members of this workspace" ||
      error.message === "Workspace not found"
    ) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message === STORY_POINTS_ERROR) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message === DUE_DATE_IN_PAST_ERROR) {
      return res.status(400).json({ message: error.message });
    }

    next(error);
  }
};

const archiveTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.archiveTicket(id);

    res.status(200).json({
      success: true,
      data: ticket,
      message: "Ticket archived successfully",
    });
  } catch (error) {
    if (error.message === "Ticket not found") {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

const deleteTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.body;

    const result = await ticketService.deleteTicket(ticketId);

    res.status(200).json({
      success: true,
      message: result.message,
      id: result.id,
    });
  } catch (error) {
    if (error.message === "Ticket not found") {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      priority,
      priorities,
      priorityOrder,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await ticketService.getMyTickets({
      userId: req.user._id,
      workspaceId: req.user.workspaceId,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search: search || "",
      status: status || "",
      priority: priority || "",
      priorities: priorities || "",
      priorityOrder: priorityOrder || "none",
      sortBy: sortBy || "dueDate",
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });

    res.status(200).json({
      success: true,
      data: result.tickets,
      stats: result.stats,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const normalizeStoryPointsInput = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);

  if(!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error(STORY_POINTS_ERROR);

  return parsed;
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  archiveTicket,
  deleteTicket,
  getMyTickets,
};
