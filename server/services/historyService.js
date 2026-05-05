const History = require('../models/History');
const User = require('../models/User');

const logEvent = async (ticketId, userId, action) => {
  try {
    const user = await User.findById(userId).select('fullname').lean();
    const userName = user?.fullname || 'Unknown User';

    await History.create({ ticketId, userId, userName, action });
  } catch (err) {
    console.error('[historyService] Failed to log event:', err.message);
  }
};

module.exports = { logEvent };
