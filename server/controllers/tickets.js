const ticketService = require("../services/ticketService");

const getAllTickets = async (req, res) => { 
    try {
        const { page, limit, search } = req.query;
        const result = await ticketService.getAllTickets({ 
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            search: search || "", 
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

module.exports = {
  getAllTickets,
};