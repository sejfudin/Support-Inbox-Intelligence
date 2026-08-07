// Cover for the CV-scan provenance prune in `updateSelfTechnologies`.
//
// This is the rule that makes the ownership model in helpers/cvTechnologySync.js work from the
// other direction: a technology the intern removes by hand stops being the scan's to manage, so
// re-adding it later counts as their own declaration and a future CV can never take it away.
// The reconciler itself is covered in helpers/cvTechnologySync.test.js and the upload wiring in
// services/internCvService.test.js — neither exercises this path, because nothing here goes
// through a CV at all. Mongo and Supabase are mocked; no DB or network.

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

const InternProfile = require('../models/InternProfile');
const Technology = require('../models/Technology');
const { updateSelfTechnologies } = require('./internService');

const INTERN = { _id: 'u1', role: 'intern' };

// `react` came from a CV scan, `python` the intern declared by hand.
const mockProfile = (overrides = {}) => {
  const profile = {
    _id: 'p1',
    user: 'u1',
    cvPath: null,
    selfTechnologies: ['t-react', 't-python'],
    cvTechnologies: ['t-react'],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  // First call is the mutable document `updateSelfTechnologies` works on; the second comes from
  // the `getMyInternProfile` re-read it returns, which populates.
  InternProfile.findOne
    .mockReturnValueOnce(Promise.resolve(profile))
    .mockReturnValueOnce({ populate: async () => ({ ...profile }) });

  return profile;
};

beforeEach(() => {
  jest.clearAllMocks();
  Technology.countDocuments.mockImplementation(async (filter) => filter._id.$in.length);
});

describe('updateSelfTechnologies — CV provenance prune', () => {
  it('hands a technology back to the intern when they remove it by hand', async () => {
    const profile = mockProfile();

    // Intern drops the CV-added `react`, keeps their own `python`.
    await updateSelfTechnologies(INTERN, ['t-python']);

    expect(profile.selfTechnologies).toEqual(['t-python']);
    // The prune: react is no longer declared, so the scan no longer owns it. Re-adding it later
    // therefore counts as a manual declaration that a future CV cannot remove.
    expect(profile.cvTechnologies).toEqual([]);
    expect(profile.save).toHaveBeenCalledTimes(1);
  });

  it('leaves a CV-added technology scan-owned while it is still declared', async () => {
    const profile = mockProfile();

    await updateSelfTechnologies(INTERN, ['t-react', 't-python', 't-vue']);

    expect(profile.selfTechnologies).toEqual(['t-react', 't-python', 't-vue']);
    // Merely keeping it is not an act of ownership — a later CV may still drop it.
    expect(profile.cvTechnologies).toEqual(['t-react']);
  });

  it('keeps cvTechnologies a subset when the whole list is cleared', async () => {
    const profile = mockProfile();

    await updateSelfTechnologies(INTERN, []);

    expect(profile.selfTechnologies).toEqual([]);
    expect(profile.cvTechnologies).toEqual([]);
    // Nothing to validate against the catalog when the list is empty.
    expect(Technology.countDocuments).not.toHaveBeenCalled();
  });

  it('tolerates a legacy profile that predates the cvTechnologies field', async () => {
    const profile = mockProfile({ cvTechnologies: undefined });

    await expect(updateSelfTechnologies(INTERN, ['t-python'])).resolves.toBeDefined();

    expect(profile.cvTechnologies).toEqual([]);
  });

  it('refuses to touch a profile that is not the caller’s', async () => {
    const profile = mockProfile({ user: 'someone-else' });

    await expect(updateSelfTechnologies(INTERN, ['t-python'])).rejects.toThrow('Not authorized');

    expect(profile.save).not.toHaveBeenCalled();
    expect(profile.cvTechnologies).toEqual(['t-react']);
  });
});
