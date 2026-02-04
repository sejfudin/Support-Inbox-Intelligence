const Ticket = require("../models/Ticket");

const getAllTickets= async ({ page = 1, limit = 10, search = "", status = "" })=>{
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
        query.$or = [
            { subject: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ];
    }

    if (status && status !== "all") {
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
    .populate('assignedTo', 'fullname email role') 
    .populate('creator', 'fullName');

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
};



const createTicket = async (ticketData) => {
  const ticket = new Ticket({
    subject: ticketData.subject,
    description: ticketData.description || "",
    creator: ticketData.creatorId, 
    status: "pending", 
    assignedTo: ticketData.assignedTo,
  });

  await ticket.save();

  return await ticket.populate([
    { path: "creator", select: "fullName email" },
    { path: "assignedTo", select: "fullName email" }
  ]);
};

module.exports = {
  getAllTickets,
  createTicket,
  getTicketById,
};