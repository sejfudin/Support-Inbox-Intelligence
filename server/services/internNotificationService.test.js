jest.mock('../models/Notification', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../socket/socketServer', () => ({ sendToUser: jest.fn() }));
jest.mock('../socket/invalidationScopes', () => ({
  invalidationScopes: { user: (id) => `user:${id}` },
}));
jest.mock('./groqAiClient', () => ({
  requestGroqOutputText: jest.fn().mockRejectedValue(new Error('AI unavailable')),
  extractJsonObject: jest.fn(),
}));
// `dispatch` asks whether the recipient is the deleted-user tombstone before it
// writes anything. Mocked, or every test here reaches for the users collection.
jest.mock('../repository/tombstoneUser', () => ({ isTombstoneUser: jest.fn() }));

const Notification = require('../models/Notification');
const { isTombstoneUser } = require('../repository/tombstoneUser');
const { sendToUser } = require('../socket/socketServer');
const {
  notifyDailyReminder,
  notifyRecommendationCreated,
  notifyRecommendationStatusChanged,
  notifyRecommendationNotPlaced,
  notifyInternPlaced,
} = require('./internNotificationService');

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

// A recommendation with no project reaches these functions as `project:
// undefined` (the caller always reads `recommendation.project?.name`), and
// the notification still has to read as a grammatical sentence.
describe('recommendation notifications with an unknown project', () => {
  beforeEach(() => jest.clearAllMocks());

  it('notifyRecommendationCreated falls back to the mid-sentence phrase', async () => {
    Notification.create.mockResolvedValue({ toObject: () => ({ _id: 'n1' }) });

    await notifyRecommendationCreated({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      position: 'Backend Developer',
      project: undefined,
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "You're being considered for Backend Developer on a project to be confirmed.",
      })
    );
  });

  it('notifyRecommendationStatusChanged falls back to the mid-sentence phrase', async () => {
    Notification.create.mockResolvedValue({ toObject: () => ({ _id: 'n1' }) });

    await notifyRecommendationStatusChanged({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      project: undefined,
      newStatus: 'interviewing',
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Your recommendation for a project to be confirmed is now at the Interviewing stage.',
      })
    );
  });

  it('notifyRecommendationNotPlaced falls back to the mid-sentence phrase', async () => {
    Notification.create.mockResolvedValue({ toObject: () => ({ _id: 'n1' }) });

    await notifyRecommendationNotPlaced({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      project: undefined,
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "You weren't placed on a project to be confirmed this time. New opportunities come up regularly.",
      })
    );
  });

  it('notifyInternPlaced falls back to the mid-sentence phrase', async () => {
    Notification.create.mockResolvedValue({ toObject: () => ({ _id: 'n1' }) });

    await notifyInternPlaced({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      position: 'Backend Developer',
      project: undefined,
      startDate: null,
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Congratulations — you're now placed as Backend Developer on a project to be confirmed.",
      })
    );
  });
});

describe('tombstone recipients', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes nothing when the recipient is the deleted-user tombstone', async () => {
    // A reassigned primary mentor, or a recipient admin, can resolve to the
    // tombstone once the repoint migration has run: the id is present and names a
    // real document, so only this check stands between it and a notification row
    // nobody can ever read.
    isTombstoneUser.mockResolvedValue(true);

    const result = await notifyDailyReminder({
      internUserId: 'tombstone-id',
      internProfileId: 'profile-1',
      missingAttendance: true,
      missingDaily: false,
      dateKey: '2026-08-13',
    });

    expect(result).toEqual({ skipped: 'tombstone-recipient' });
    expect(Notification.create).not.toHaveBeenCalled();
    expect(sendToUser).not.toHaveBeenCalled();
  });

  it('still writes for a real recipient', async () => {
    isTombstoneUser.mockResolvedValue(false);
    Notification.create.mockResolvedValue({ toObject: () => ({ _id: 'n1' }) });

    await notifyDailyReminder({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      missingAttendance: true,
      missingDaily: false,
      dateKey: '2026-08-13',
    });

    expect(Notification.create).toHaveBeenCalled();
  });
});
