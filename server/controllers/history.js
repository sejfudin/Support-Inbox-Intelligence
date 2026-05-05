const History = require('../models/History');

const getTicketHistory = async (req, res, next) => {
  try {
    const history = await History.find({ ticketId: req.params.ticketId })
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTicketHistory };
