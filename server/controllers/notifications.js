const notificationService = require('../services/notificationService');
const dailyReminderService = require('../services/dailyReminderService');
const { broadcastToUserRoom } = require('../socket/socketServer');
const { invalidationScopes } = require('../socket/invalidationScopes');

const getRequesterSocketId = (req) => {
  const rawSocketId = req.headers['x-socket-id'];
  if (!rawSocketId || typeof rawSocketId !== 'string') {
    return null;
  }

  const trimmed = rawSocketId.trim();
  return trimmed || null;
};

const getNotifications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const { items, unreadCount } = await notificationService.listForUser(req.user._id, { limit });
    res.status(200).json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * The on-arrival half of the daily reminder. The scheduler sweeps the cohort on
 * its first tick inside the 10:30–11:00 window; this covers the intern who was
 * not around for that sweep and opens the app at 10:47.
 *
 * Scoped to the caller — it only ever checks `req.user`, so no role guard is
 * needed beyond `protect`. Idempotent: `Notification.dedupeKey` means a repeat
 * call (or a race with the scheduler) writes nothing and still reports success.
 */
const runDailyReminderCheck = async (req, res, next) => {
  try {
    const result = await dailyReminderService.runDailyReminderCheckForUser(req.user._id);
    res.status(200).json({ success: true, message: 'Reminder check complete', data: result });
  } catch (err) {
    next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const doc = await notificationService.markRead(req.params.id, req.user._id);

    broadcastToUserRoom(
      req.user._id,
      'NOTIFICATION_MARKED_AS_READ',
      {
        notificationIds: [String(doc._id)],
        scopes: [invalidationScopes.user(req.user._id)],
      },
      {
        excludeSocketId: getRequesterSocketId(req),
      }
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
    const result = await notificationService.markAllRead(req.user._id);

    if (result.notificationIds.length > 0) {
      broadcastToUserRoom(
        req.user._id,
        'NOTIFICATION_MARKED_AS_READ',
        {
          notificationIds: result.notificationIds,
          scopes: [invalidationScopes.user(req.user._id)],
        },
        {
          excludeSocketId: getRequesterSocketId(req),
        }
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  runDailyReminderCheck,
  markNotificationRead,
  markAllNotificationsRead,
};
