// Two independent concerns, both exercised with Mongo/Supabase mocked — no DB or network.
//
// 1. `updateSelfTechnologies` — the intern's own hand-edited list is the only path that can
//    shorten `selfTechnologies`; a CV scan only ever adds to it (see helpers/cvTechnologySync.js,
//    covered in helpers/cvTechnologySync.test.js) and never removes what's already there. The
//    upload wiring is covered separately in services/internCvService.test.js — neither exercises
//    this path, because nothing here goes through a CV at all.
//
// 2. The lifecycle-status transition rules in `updateInternProgramme` — who may change a
//    status, and why "placed" specifically can't be picked by hand (it's the recommendation
//    outcome's job; see recommendationService.updateRecommendation).

jest.mock('../config/supabase', () => ({
  supabase: { storage: { from: () => ({}) } },
  supabaseCvBucket: 'cvs',
}));

// The service destructures INTERN_STATUSES / READY_STATUS off the model module, so a bare
// findOne mock would leave those undefined at load time.
jest.mock('../models/InternProfile', () => {
  const mock = { findOne: jest.fn() };
  mock.INTERN_STATUSES = ['active', 'ready', 'placed', 'completed', 'discontinued'];
  mock.READY_STATUS = 'ready';
  return mock;
});
jest.mock('../models/Technology', () => ({ countDocuments: jest.fn() }));
jest.mock('../socket/events', () => ({ emitInternDataChanged: jest.fn() }));
jest.mock('./recommendationService', () => ({
  closeActiveRecommendationsForIntern: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./internNotificationService', () => ({
  notifyInternPlaced: jest.fn(),
  notifyInternStatusChanged: jest.fn(),
  notifyExpectedEndDateChanged: jest.fn(),
}));

const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { closeActiveRecommendationsForIntern } = require('./recommendationService');
const internNotificationService = require('./internNotificationService');
const { updateInternProgramme, updateSelfTechnologies } = require('./internService');

const INTERN = { _id: 'u1', role: 'intern' };
const ADMIN = { _id: 'a1', role: 'admin' };
const MENTOR = { _id: 'm1', role: 'mentor' };

// `react` came from a CV scan, `python` the intern declared by hand — the profile records no
// difference between the two, because neither source can remove an entry.
const mockProfile = (overrides = {}) => {
  const profile = {
    _id: 'p1',
    user: 'u1',
    cvPath: null,
    selfTechnologies: ['t-react', 't-python'],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  // First call is the mutable document `updateSelfTechnologies` works on; the second comes from
  // the `getMyInternProfile` re-read it returns, which populates. `mockReset` first: a test that
  // throws before the second call leaves it queued, and it would otherwise leak into whichever
  // test runs next.
  InternProfile.findOne
    .mockReset()
    .mockReturnValueOnce(Promise.resolve(profile))
    .mockReturnValueOnce({ populate: async () => ({ ...profile }) });

  return profile;
};

// Same two-call shape and leak hazard as `mockProfile` above: the mutable document
// `updateInternProgramme` works on, then the populated re-read `getInternByUserId` returns at
// the end.
const mockProgrammeProfile = (overrides = {}) => {
  const profile = {
    _id: 'p1',
    user: { _id: 'u1' },
    cvPath: null,
    status: 'active',
    expectedEndDate: null,
    primaryMentor: 'm1',
    secondaryMentor: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  InternProfile.findOne
    .mockReset()
    .mockReturnValueOnce(Promise.resolve(profile))
    .mockReturnValueOnce({ populate: async () => ({ ...profile }) });

  return profile;
};

beforeEach(() => {
  jest.clearAllMocks();
  Technology.countDocuments.mockImplementation(async (filter) => filter._id.$in.length);
});

describe('updateSelfTechnologies', () => {
  it('is the one path that shortens the list — a CV scan never does', async () => {
    const profile = mockProfile();

    // Intern drops the CV-added `react`, keeps their own `python`. A later CV that mentions
    // React puts it back (it is a fresh add), which is the intended cost of scans never removing.
    await updateSelfTechnologies(INTERN, ['t-python']);

    expect(profile.selfTechnologies).toEqual(['t-python']);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('saves an added technology alongside the existing ones', async () => {
    const profile = mockProfile();

    await updateSelfTechnologies(INTERN, ['t-react', 't-python', 't-vue']);

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python', 't-vue']);
  });

  it('accepts clearing the list outright', async () => {
    const profile = mockProfile();

    await updateSelfTechnologies(INTERN, []);

    expect(profile.selfTechnologies).toEqual([]);
    // Nothing to validate against the catalog when the list is empty.
    expect(Technology.countDocuments).not.toHaveBeenCalled();
  });

  it('refuses to touch a profile that is not the caller’s', async () => {
    const profile = mockProfile({ user: 'someone-else' });

    await expect(updateSelfTechnologies(INTERN, ['t-python'])).rejects.toThrow('Not authorized');

    expect(profile.save).not.toHaveBeenCalled();
    expect(profile.selfTechnologies).toEqual(['t-react', 't-python']);
  });
});

describe('updateInternProgramme — lifecycle status', () => {
  it('refuses a non-admin changing status at all, even an assigned mentor', async () => {
    const profile = mockProgrammeProfile({ status: 'active', primaryMentor: 'm1' });

    await expect(updateInternProgramme(MENTOR, 'u1', { status: 'ready' })).rejects.toThrow(
      'Only admins can change'
    );

    expect(profile.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown status value', async () => {
    mockProgrammeProfile({ status: 'active' });

    await expect(updateInternProgramme(ADMIN, 'u1', { status: 'on-leave' })).rejects.toThrow(
      'Invalid status'
    );
  });

  it('refuses to set "placed" by hand — that is the recommendation outcome\'s job', async () => {
    const profile = mockProgrammeProfile({ status: 'ready' });

    await expect(updateInternProgramme(ADMIN, 'u1', { status: 'placed' })).rejects.toThrow(
      'set automatically'
    );

    expect(profile.status).toBe('ready');
    expect(profile.save).not.toHaveBeenCalled();
    expect(closeActiveRecommendationsForIntern).not.toHaveBeenCalled();
    expect(internNotificationService.notifyInternPlaced).not.toHaveBeenCalled();
  });

  it('allows re-saving while already placed (no-op, not a transition)', async () => {
    const profile = mockProgrammeProfile({ status: 'placed' });

    await updateInternProgramme(ADMIN, 'u1', { status: 'placed' });

    expect(profile.status).toBe('placed');
    expect(profile.save).toHaveBeenCalledTimes(1);
    // Unchanged from `previousStatus`, so this isn't a fresh placement notification.
    expect(internNotificationService.notifyInternPlaced).not.toHaveBeenCalled();
    // Still fires — this cascade runs off the target status, not off whether it changed.
    expect(closeActiveRecommendationsForIntern).toHaveBeenCalledTimes(1);
  });

  it('lets an admin move an intern back out of placed manually', async () => {
    const profile = mockProgrammeProfile({ status: 'placed' });

    await updateInternProgramme(ADMIN, 'u1', { status: 'discontinued' });

    expect(profile.status).toBe('discontinued');
    expect(profile.save).toHaveBeenCalledTimes(1);
    expect(closeActiveRecommendationsForIntern).not.toHaveBeenCalled();
    expect(internNotificationService.notifyInternStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'discontinued' })
    );
  });

  it.each([
    ['active', 'ready'],
    ['ready', 'completed'],
    ['active', 'discontinued'],
    ['ready', 'active'],
  ])('allows the manual transition %s -> %s', async (from, to) => {
    const profile = mockProgrammeProfile({ status: from });

    await updateInternProgramme(ADMIN, 'u1', { status: to });

    expect(profile.status).toBe(to);
    expect(profile.save).toHaveBeenCalledTimes(1);
    expect(internNotificationService.notifyInternStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: to })
    );
    expect(closeActiveRecommendationsForIntern).not.toHaveBeenCalled();
  });

  it('does not notify when saving the same status twice', async () => {
    mockProgrammeProfile({ status: 'ready' });

    await updateInternProgramme(ADMIN, 'u1', { status: 'ready' });

    expect(internNotificationService.notifyInternStatusChanged).not.toHaveBeenCalled();
    expect(internNotificationService.notifyInternPlaced).not.toHaveBeenCalled();
  });
});
