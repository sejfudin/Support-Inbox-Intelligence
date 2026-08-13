jest.mock('../models/Notification', () => ({ create: jest.fn() }));
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
    ).resolves.toBeUndefined();
    expect(sendToUser).not.toHaveBeenCalled();
  });
});
