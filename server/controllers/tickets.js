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
        res.status(200).json({success: true,
        data: result.tickets,
        pagination: result.pagination,});

    } catch (error) {
        console.error("Error in getTickets Controller:", error.message);
        
        res.status(500).json({
        success: false,
        message: "Server Error: Unable to fetch tickets",
        error: error.message,
        });
  }
};

const createTicket = async (req, res) => {
  try {
    const { subject, description, customerName, customerEmail } = req.body;
    if (!subject || !customerName || !customerEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "Subject and customer details are required" 
      });
    }
    const newTicket = await ticketService.createTicket({
      subject,
      description,
      customerName,
      customerEmail,
      creatorId: req.user._id
    });
    res.status(201).json({
      success: true,
      data: newTicket
    });
  } catch (error) {
    console.error("Error in createTicket Controller:", error.message);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to create ticket",
      error: error.message,
    });
  }
}

module.exports = {
  getAllTickets,
  createTicket,
};