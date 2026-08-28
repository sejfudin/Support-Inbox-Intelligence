// `sendMentorNoteFromStaff` is the target gate for `POST /api/users/:userId/
// mentor-notes` — `requireRole` at the route already vouched for the *sender*
// (admin/leadership), so everything proven here is about the *recipient*: it has
// to be a mentor, and an active one, and the note has to actually get delivered
// before the caller is told it was. Mongo and the notification service are
// mocked; `httpError` is real (pure).

jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('./internNotificationService', () => ({ notifyMentorNoteFromStaff: jest.fn() }));

const User = require('../models/User');
const internNotificationService = require('./internNotificationService');
const { sendMentorNoteFromStaff } = require('./mentorNoteService');

const ACTOR = { _id: 'admin1', role: 'admin', fullname: 'Ana Admin' };

const mockTarget = (overrides) => {
  const doc = {
    _id: 'mentor1',
    role: 'mentor',
    fullname: 'Mo Mentor',
    status: 'active',
    ...overrides,
  };
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(doc) });
  return doc;
};

beforeEach(() => {
  jest.clearAllMocks();
  internNotificationService.notifyMentorNoteFromStaff.mockResolvedValue({
    delivered: true,
    redelivered: false,
  });
});

const call = (over = {}) =>
  sendMentorNoteFromStaff({ actor: ACTOR, targetUserId: 'mentor1', body: 'Heads up', ...over });

describe('sendMentorNoteFromStaff', () => {
  it('rejects an empty or whitespace-only note without touching the DB', async () => {
    await expect(call({ body: '   ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('rejects a note longer than the 500-char limit', async () => {
    await expect(call({ body: 'x'.repeat(501) })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s when the target user does not exist', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
  });

  it('400s when the target is not a mentor', async () => {
    mockTarget({ role: 'admin' });
    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(internNotificationService.notifyMentorNoteFromStaff).not.toHaveBeenCalled();
  });

  it('400s when the target mentor account is not active', async () => {
    mockTarget({ status: 'invited' });
    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(internNotificationService.notifyMentorNoteFromStaff).not.toHaveBeenCalled();
  });

  it('502s when the notification was not delivered', async () => {
    mockTarget();
    internNotificationService.notifyMentorNoteFromStaff.mockResolvedValue({
      skipped: 'no-recipient',
    });
    await expect(call()).rejects.toMatchObject({ statusCode: 502 });
  });

  it('delivers the trimmed note verbatim and returns the recipient on success', async () => {
    mockTarget();
    const result = await call({ body: '  Please review the sprint plan.  ' });

    expect(internNotificationService.notifyMentorNoteFromStaff).toHaveBeenCalledWith({
      recipientUserId: 'mentor1',
      authorName: 'Ana Admin',
      body: 'Please review the sprint plan.',
    });
    expect(result).toEqual({ recipient: { id: 'mentor1', fullname: 'Mo Mentor' } });
  });
});
