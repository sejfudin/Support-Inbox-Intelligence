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
    placementExemptions: [],
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

  it('validates only what is being added, so a deactivated technology cannot block an edit', async () => {
    const profile = mockProfile({ selfTechnologies: ['t-react', 't-python', 't-devops'] });
    // `devops` was deactivated after the intern declared it. The page joins
    // declarations against the *active* catalog, so the row is not on screen — and
    // validating the whole array against `isActive` therefore rejected every edit
    // because of an entry the intern could neither see nor drop.
    Technology.countDocuments.mockImplementation(
      async (filter) => filter._id.$in.filter((id) => id !== 't-devops').length
    );

    // The intern drops `react`; `devops` rides along untouched, as it must.
    await updateSelfTechnologies(INTERN, ['t-python', 't-devops']);

    expect(profile.selfTechnologies).toEqual(['t-python', 't-devops']);
    expect(profile.save).toHaveBeenCalledTimes(1);
    // Nothing was added, so the catalog was never asked in the first place.
    expect(Technology.countDocuments).not.toHaveBeenCalled();
  });

  it('still refuses a technology the catalog does not offer', async () => {
    const profile = mockProfile();
    Technology.countDocuments.mockResolvedValue(0);

    await expect(
      updateSelfTechnologies(INTERN, ['t-react', 't-python', 't-retired'])
    ).rejects.toThrow('One or more technologies are invalid');

    expect(profile.save).not.toHaveBeenCalled();
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

  // Regression: an intern placed on a project and then brought back to the programme
  // kept `placedAt`, so `computeMonthStats` clamped their denominator to the day before
  // it — every later month read 0 present of 0 owed, and check-in itself was refused.
  // The recommendation paths already reset it; this manual one did not.
  describe('placedAt (the attendance exemption)', () => {
    const PLACED_AT = new Date('2026-06-08T00:00:00.000Z');

    it.each(['active', 'ready'])(
      'clears placedAt when an admin brings a placed intern back as %s',
      async (to) => {
        const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

        await updateInternProgramme(ADMIN, 'u1', { status: to });

        expect(profile.status).toBe(to);
        expect(profile.placedAt).toBeNull();
        expect(profile.save).toHaveBeenCalledTimes(1);
      }
    );

    it.each(['active', 'ready'])(
      'records the stretch they were away as a closed exemption (back as %s)',
      async (to) => {
        // Clearing `placedAt` on its own would reopen every day since the placement
        // as an absence — absence is stored as the *lack* of an attendance row, so
        // the whole stretch would read as missed. The closed stint is what keeps
        // those days out of the denominator instead.
        const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

        await updateInternProgramme(ADMIN, 'u1', { status: to });

        expect(profile.placementExemptions).toHaveLength(1);
        expect(profile.placementExemptions[0].from).toBe(PLACED_AT);
        expect(profile.placementExemptions[0].to).toBeInstanceOf(Date);
      }
    );

    it('keeps stretches already recorded from an earlier placement', async () => {
      const earlier = { from: new Date('2026-03-02'), to: new Date('2026-03-16') };
      const profile = mockProgrammeProfile({
        status: 'placed',
        placedAt: PLACED_AT,
        placementExemptions: [earlier],
      });

      await updateInternProgramme(ADMIN, 'u1', { status: 'active' });

      expect(profile.placementExemptions).toHaveLength(2);
      expect(profile.placementExemptions[0]).toBe(earlier);
    });

    it('records no stretch for a placement that never started', async () => {
      // Placed with a start date still in the future, then brought back before it
      // arrived: they never stopped owing attendance, so nothing is excused.
      const future = new Date('2099-01-04');
      const profile = mockProgrammeProfile({ status: 'placed', placedAt: future });

      await updateInternProgramme(ADMIN, 'u1', { status: 'active' });

      expect(profile.placedAt).toBeNull();
      expect(profile.placementExemptions).toEqual([]);
    });

    it('records no stretch when an admin clears placedAt by hand', async () => {
      // An explicit null is a correction — "this exemption was a mistake" — and a
      // correction should leave no trace of the thing it corrected. Distinct from
      // the status move above, which means "they came back", and that did happen.
      const profile = mockProgrammeProfile({
        status: 'placed',
        placedAt: PLACED_AT,
        placementExemptions: [],
      });

      await updateInternProgramme(ADMIN, 'u1', { status: 'active', placedAt: null });

      expect(profile.placedAt).toBeNull();
      expect(profile.placementExemptions).toEqual([]);
    });

    it.each(['completed', 'discontinued'])(
      'keeps placedAt when a placed intern moves to %s',
      async (to) => {
        const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

        await updateInternProgramme(ADMIN, 'u1', { status: to });

        expect(profile.status).toBe(to);
        expect(profile.placedAt).toBe(PLACED_AT);
      }
    );

    it('keeps placedAt when re-saving an already-placed intern as placed', async () => {
      const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

      await updateInternProgramme(ADMIN, 'u1', { status: 'placed' });

      expect(profile.placedAt).toBe(PLACED_AT);
    });

    it('leaves placedAt alone on an edit that does not touch the status', async () => {
      const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

      await updateInternProgramme(ADMIN, 'u1', { expectedEndDate: '2026-09-01' });

      expect(profile.placedAt).toBe(PLACED_AT);
    });

    it('does not invent a reset for an intern who was never placed', async () => {
      const profile = mockProgrammeProfile({ status: 'ready', placedAt: PLACED_AT });

      await updateInternProgramme(ADMIN, 'u1', { status: 'active' });

      expect(profile.placedAt).toBe(PLACED_AT);
    });

    it('still honours an explicit placedAt in the payload over the reset', async () => {
      const profile = mockProgrammeProfile({ status: 'placed', placedAt: PLACED_AT });

      await updateInternProgramme(ADMIN, 'u1', { status: 'active', placedAt: '2026-07-01' });

      expect(profile.placedAt).toEqual(new Date('2026-07-01'));
    });
  });

  it('does not notify when saving the same status twice', async () => {
    mockProgrammeProfile({ status: 'ready' });

    await updateInternProgramme(ADMIN, 'u1', { status: 'ready' });

    expect(internNotificationService.notifyInternStatusChanged).not.toHaveBeenCalled();
    expect(internNotificationService.notifyInternPlaced).not.toHaveBeenCalled();
  });
});
