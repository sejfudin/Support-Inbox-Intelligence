const notificationService = require("../services/notificationService");

const getNotifications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const { items, unreadCount } = await notificationService.listForUser(
      req.user._id,
      { limit },
    );
    res.status(200).json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const doc = await notificationService.markRead(
      req.params.id,
      req.user._id,
    );
    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user._id);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
