// Mentor notes have two independent audience mechanisms, and the point of this
// file is to prove they can't cross-contaminate: `visibleTo` (staff sharing a
// note with staff peers) and `visibleToIntern` (the author choosing, per note, to
// let the intern it's about read it too). Mongo and the notification service are
// mocked — no DB or network. `internAccess.js` is real and unmocked: it's pure
// given a profile shape, so exercising it here is cheap and catches a real authz
// regression instead of a mocked one.

jest.mock('../models/MentorComment', () => ({ find: jest.fn(), create: jest.fn() }));
jest.mock('../models/InternProfile', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('./internNotificationService', () => ({
  notifyMentorNoteMention: jest.fn(),
  notifyInternMentorNoteShared: jest.fn(),
}));

const MentorComment = require('../models/MentorComment');
const InternProfile = require('../models/InternProfile');
const User = require('../models/User');
const internNotificationService = require('./internNotificationService');
const { listComments, createComment } = require('./mentorCommentService');

const ADMIN = { _id: 'admin1', role: 'admin', fullname: 'Ana Admin' };
const MENTOR = { _id: 'mentor1', role: 'mentor', fullname: 'Mo Mentor' };
const INTERN = { _id: 'intern1', role: 'intern', fullname: 'Ivan Intern' };

const mockProfile = (overrides = {}) => ({
  _id: 'profile1',
  user: 'intern1',
  primaryMentor: 'mentor1',
  secondaryMentor: null,
  ...overrides,
});

// A chainable `.find().populate()...populate().sort()` mock — `listComments` calls
// one `.populate()` for the intern branch, two for the staff branch, then `.sort()`.
const chainableFind = (result) => {
  const chain = { populate: jest.fn(() => chain), sort: jest.fn(() => Promise.resolve(result)) };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listComments', () => {
  it('gives an intern only the notes explicitly shared with them, stripped of visibleTo/visibleToIntern', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    const shared = {
      _id: 'c1',
      author: { fullname: 'Mo Mentor', role: 'mentor' },
      content: 'Great progress this sprint.',
      visibleTo: ['admin1'],
      visibleToIntern: true,
      internProfile: 'profile1',
      createdAt: new Date('2026-08-01'),
    };
    MentorComment.find.mockReturnValue(chainableFind([shared]));

    const result = await listComments(INTERN, 'intern1');

    // Queried only for `visibleToIntern: true` on this intern's own profile.
    expect(MentorComment.find).toHaveBeenCalledWith(
      expect.objectContaining({ internProfile: 'profile1', visibleToIntern: true })
    );
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Great progress this sprint.');
    // Staff-facing fields never reach the intern's shape.
    expect(result[0].visibleTo).toBeUndefined();
    expect(result[0].visibleToIntern).toBeUndefined();
    expect(result[0].internProfile).toBeUndefined();
  });

  it("refuses an intern trying to read a profile that isn't their own", async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile({ user: 'someone-else' }));

    await expect(listComments(INTERN, 'someone-else')).rejects.toThrow('Not authorized');
    expect(MentorComment.find).not.toHaveBeenCalled();
  });

  it('gives a non-admin staff caller the author-or-visibleTo view, untouched by the intern flag', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    const authored = {
      _id: 'c1',
      author: { _id: 'mentor1', fullname: 'Mo Mentor', role: 'mentor' },
      visibleTo: [],
      visibleToIntern: false,
      content: 'Internal-only note.',
      createdAt: new Date(),
    };
    const notMine = {
      _id: 'c2',
      author: { _id: 'admin1', fullname: 'Ana Admin', role: 'admin' },
      visibleTo: [],
      visibleToIntern: true, // shared with the intern, but that doesn't add this mentor as a reader
      content: 'Someone else’s note, shared with the intern only.',
      createdAt: new Date(),
    };
    MentorComment.find.mockReturnValue(chainableFind([authored, notMine]));

    const result = await listComments(MENTOR, 'intern1');

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Internal-only note.');
  });

  it('gives an admin every note regardless of authorship or visibleTo — the "Admins only" floor', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    const byMentorNoAudience = {
      _id: 'c1',
      author: { _id: 'mentor1', fullname: 'Mo Mentor', role: 'mentor' },
      visibleTo: [], // "Admins only" in the UI — must actually reach an admin
      visibleToIntern: false,
      content: 'Mentor wrote this with nobody added to the audience.',
      createdAt: new Date(),
    };
    const byMentorSharedWithSomeoneElse = {
      _id: 'c2',
      author: { _id: 'mentor1', fullname: 'Mo Mentor', role: 'mentor' },
      visibleTo: [{ _id: 'leader1', fullname: 'Lea Leadership', role: 'leadership' }],
      visibleToIntern: false,
      content: 'Mentor shared this with leadership, not with any admin by name.',
      createdAt: new Date(),
    };
    MentorComment.find.mockReturnValue(
      chainableFind([byMentorNoAudience, byMentorSharedWithSomeoneElse])
    );

    const result = await listComments(ADMIN, 'intern1');

    expect(result).toHaveLength(2);
  });
});

describe('createComment', () => {
  const baseCreated = (overrides = {}) => ({
    _id: 'new1',
    internProfile: 'profile1',
    author: { _id: 'admin1', fullname: 'Ana Admin', role: 'admin' },
    content: 'A note',
    visibleTo: [],
    visibleToIntern: false,
    createdAt: new Date(),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('refuses a mentor who is not assigned to this intern', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile({ primaryMentor: 'someone-else' }));

    await expect(
      createComment(MENTOR, 'intern1', { content: 'hi', visibleTo: [] })
    ).rejects.toThrow('Not authorized');
    expect(MentorComment.create).not.toHaveBeenCalled();
  });

  it('rejects a visibleTo recipient who is not an active admin/mentor/leadership user', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) }); // none matched

    await expect(
      createComment(ADMIN, 'intern1', { content: 'hi', visibleTo: ['bogus-id'] })
    ).rejects.toThrow('One or more visibility recipients are invalid');
    expect(MentorComment.create).not.toHaveBeenCalled();
  });

  it('notifies each staff visibleTo recipient, and never the intern, when visibleToIntern is unset', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'leader1' }]) });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ fullname: 'Ivan Intern' }),
    });
    MentorComment.create.mockResolvedValue(
      baseCreated({
        visibleTo: [{ _id: 'leader1', fullname: 'Lea Leadership', role: 'leadership' }],
      })
    );

    await createComment(ADMIN, 'intern1', {
      content: 'Heads up',
      visibleTo: ['leader1'],
      visibleToIntern: false,
    });

    expect(internNotificationService.notifyMentorNoteMention).toHaveBeenCalledTimes(1);
    expect(internNotificationService.notifyMentorNoteMention).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'leader1', internUserId: 'intern1' })
    );
    expect(internNotificationService.notifyInternMentorNoteShared).not.toHaveBeenCalled();
  });

  it('notifies the intern, and no staff, for a visibleToIntern note with an empty visibleTo', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    MentorComment.create.mockResolvedValue(baseCreated({ visibleToIntern: true }));

    await createComment(ADMIN, 'intern1', {
      content: 'Great job this week!',
      visibleTo: [],
      visibleToIntern: true,
    });

    expect(MentorComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ visibleToIntern: true })
    );
    expect(internNotificationService.notifyInternMentorNoteShared).toHaveBeenCalledWith(
      expect.objectContaining({ internUserId: 'intern1', authorName: 'Ana Admin' })
    );
    expect(internNotificationService.notifyMentorNoteMention).not.toHaveBeenCalled();
    // No visibleTo recipients meant no need to look up the intern's name for that path.
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('can notify both axes at once — staff visibleTo and the intern — for the same note', async () => {
    InternProfile.findOne.mockResolvedValue(mockProfile());
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'mentor1' }]) });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ fullname: 'Ivan Intern' }),
    });
    MentorComment.create.mockResolvedValue(
      baseCreated({
        visibleTo: [{ _id: 'mentor1', fullname: 'Mo Mentor', role: 'mentor' }],
        visibleToIntern: true,
      })
    );

    await createComment(ADMIN, 'intern1', {
      content: 'Shared with a colleague and the intern',
      visibleTo: ['mentor1'],
      visibleToIntern: true,
    });

    expect(internNotificationService.notifyMentorNoteMention).toHaveBeenCalledTimes(1);
    expect(internNotificationService.notifyInternMentorNoteShared).toHaveBeenCalledTimes(1);
  });
});
