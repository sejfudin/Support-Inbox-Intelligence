const ticketService = require("../services/ticketService");

const getAllTickets = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await ticketService.getAllTickets({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search: search || "",
      status: status || "",
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
    const { id } = req.params; // 1. Get the ID from the URL (e.g., /api/tickets/123)

    // 2. Call the service layer
    const ticket = await ticketService.getTicketById(id);

    // 3. Handle case where ticket doesn't exist
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // 4. Return success
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error in getTicketById Controller:", error.message);

    // Check if error is because ID format is wrong (e.g. invalid MongoDB ObjectId)
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
    const { subject, description, assignedTo, status } = req.body;

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
    const newTicket = await ticketService.createTicket({
      subject,
      description,
      creatorId: req.user._id,
      assignedTo: assignedAgents,
      status: status || "to do",
    });
    res.status(201).json({
      success: true,
      data: newTicket,
    });
  } catch (error) {
    console.error("Error in createTicket Controller:", error.message);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to create ticket",
      error: error.message,
    });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
};
