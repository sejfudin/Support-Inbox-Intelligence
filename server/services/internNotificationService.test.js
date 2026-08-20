jest.mock('../models/Notification', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../socket/socketServer', () => ({ sendToUser: jest.fn() }));
jest.mock('../socket/invalidationScopes', () => ({
  invalidationScopes: { user: (id) => `user:${id}` },
}));
jest.mock('./groqAiClient', () => ({
  requestGroqOutputText: jest.fn().mockRejectedValue(new Error('AI unavailable')),
  extractJsonObject: jest.fn(),
}));

const Notification = require('../models/Notification');
const { sendToUser } = require('../socket/socketServer');
const { notifyDailyReminder } = require('./internNotificationService');

describe('notifyDailyReminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes a date/user idempotency key and emits the created notification', async () => {
    const stored = { toObject: () => ({ _id: 'notification-1' }) };
    Notification.create.mockResolvedValue(stored);

    await notifyDailyReminder({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      missingAttendance: true,
      missingDaily: false,
      dateKey: '2026-08-13',
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'user-1',
        type: 'daily_attendance_reminder',
        dedupeKey: 'daily-reminder:2026-08-13:user-1',
      })
    );
    expect(sendToUser).toHaveBeenCalledTimes(1);
  });

  it('treats a duplicate idempotency key as already delivered', async () => {
    Notification.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));

    await expect(
      notifyDailyReminder({
        internUserId: 'user-1',
        internProfileId: 'profile-1',
        missingAttendance: true,
        missingDaily: true,
        dateKey: '2026-08-13',
      })
    ).resolves.toEqual({ skipped: 'duplicate' });
    expect(sendToUser).not.toHaveBeenCalled();
  });

  it('re-emits the existing unread row when the caller asked to redeliver', async () => {
    Notification.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    const existing = { _id: 'notification-1', read: false, title: 'Reminder' };
    Notification.findOne.mockReturnValue({ lean: () => Promise.resolve(existing) });

    await expect(
      notifyDailyReminder({
        internUserId: 'user-1',
        internProfileId: 'profile-1',
        missingAttendance: true,
        missingDaily: false,
        dateKey: '2026-08-13',
        redeliver: true,
      })
    ).resolves.toEqual({ delivered: true, redelivered: true });

    // The row is already counted in the badge, so the re-delivery must not add to it.
    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      'new_notification',
      expect.objectContaining({ notification: existing, unreadDelta: 0 })
    );
  });

  it('stays silent on redelivery once the reader has read it', async () => {
    Notification.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    Notification.findOne.mockReturnValue({
      lean: () => Promise.resolve({ _id: 'notification-1', read: true }),
    });

    await expect(
      notifyDailyReminder({
        internUserId: 'user-1',
        internProfileId: 'profile-1',
        missingAttendance: true,
        missingDaily: false,
        dateKey: '2026-08-13',
        redeliver: true,
      })
    ).resolves.toEqual({ skipped: 'already-read' });
    expect(sendToUser).not.toHaveBeenCalled();
  });
});
