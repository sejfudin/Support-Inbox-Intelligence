const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  runDailyReminderCheck,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notifications');

router.get('/', protect, getNotifications);
// Self-scoped: checks only `req.user`, so `protect` is the whole guard. Declared
// before '/:id/read' so the literal path can't be read as an id.
router.post('/daily-reminder-check', protect, runDailyReminderCheck);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:id/read', protect, markNotificationRead);

module.exports = router;
