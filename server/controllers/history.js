const History = require('../models/History');
const Ticket = require('../models/Ticket');
const { assertWorkspaceAccess } = require('../helpers/workspaceAuthz');

const getTicketHistory = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId).select('workspace');
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await assertWorkspaceAccess(ticket.workspace, req.user, 'Ticket not found');

    const history = await History.find({ ticketId }).sort({ timestamp: -1 }).lean();

    res.status(200).json({ success: true, data: history });
  } catch (err) {
    if (err.kind === 'ObjectId' || err.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (Number.isInteger(err.statusCode)) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = { getTicketHistory };
