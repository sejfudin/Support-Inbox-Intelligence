// Cover for the admin-set absence request limits: what is stored, what is
// merged, and what is refused.
//
// The arithmetic those limits then drive is covered as pure functions in
// helpers/absenceRequestRules.test.js. What is left here is the part that only
// exists because there is a database — resolving an override against the shipped
// table, storing only what differs, and validating what an admin sends. Mongo is
// mocked; no DB.

jest.mock('../models/AbsenceRequestSettings', () => {
  let current = null;

  // `findOne` is awaited directly in one place and chained through `.lean()` and
  // `.populate([...]).lean()` in the others, so the stub has to answer to all
  // three. `populate` ignores its argument — this mock never actually resolves a
  // ref, it only has to keep the chain from throwing.
  const query = (doc) => ({
    lean: async () => doc,
    populate: () => ({ lean: async () => doc }),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  });

  function AbsenceRequestSettings(fields = {}) {
    this.key = fields.key;
    this.limits = {};
    this.primaryAdmin = null;
    this.updatedBy = null;
    this.updatedAt = null;
  }

  AbsenceRequestSettings.prototype.save = async function () {
    this.updatedAt = new Date('2026-08-13T09:00:00.000Z');
    current = this;
    return this;
  };

  AbsenceRequestSettings.SINGLETON_KEY = 'global';
  AbsenceRequestSettings.findOne = jest.fn(() => query(current));

  AbsenceRequestSettings.__clear = () => {
    current = null;
  };
  AbsenceRequestSettings.__stored = () => current?.limits ?? null;
  AbsenceRequestSettings.__storedPrimaryAdmin = () => current?.primaryAdmin ?? null;
  AbsenceRequestSettings.__seed = (limits) => {
    current = new AbsenceRequestSettings({ key: 'global' });
    current.limits = limits;
    current.updatedAt = new Date('2026-01-05T09:00:00.000Z');
  };
  AbsenceRequestSettings.__seedPrimaryAdmin = (id) => {
    if (!current) current = new AbsenceRequestSettings({ key: 'global' });
    current.primaryAdmin = id;
  };

  return AbsenceRequestSettings;
});

// The primary-admin write path checks the id against `User` before trusting it —
// same rule `absenceRequestService` applies to a request's own `recipientAdmin`.
// Mocked with an in-memory table rather than a real query, since Mongo is mocked
// throughout this file.
jest.mock('../models/User', () => {
  const users = new Map();
  const User = {
    findById: jest.fn((id) => ({
      select: () => ({ lean: async () => users.get(String(id)) || null }),
    })),
  };
  User.__seed = (id, fields) => users.set(String(id), fields);
  User.__clear = () => users.clear();
  return User;
});

const AbsenceRequestSettings = require('../models/AbsenceRequestSettings');
const User = require('../models/User');
const {
  getEffectiveLimits,
  getSettings,
  updateSettings,
  resetSettings,
} = require('./absenceSettingsService');

const ADMIN = { _id: 'admin-1' };

const byType = (settings, type) => settings.types.find((entry) => entry.type === type);

beforeEach(() => {
  AbsenceRequestSettings.__clear();
  User.__clear();
});

describe('reading the limits', () => {
  it('reports the shipped table when nothing has been set', async () => {
    expect(await getEffectiveLimits()).toEqual({
      remote: { maxDaysPerRequest: 3, yearlyBudget: null },
      vacation: { maxDaysPerRequest: 5, yearlyBudget: 5 },
      religious: { maxDaysPerRequest: 3, yearlyBudget: 3 },
      sick: { maxDaysPerRequest: 1, yearlyBudget: null },
    });
  });

  it('fills the gaps around a partial override', async () => {
    AbsenceRequestSettings.__seed({ vacation: { yearlyBudget: 10 } });

    const limits = await getEffectiveLimits();

    expect(limits.vacation).toEqual({ maxDaysPerRequest: 5, yearlyBudget: 10 });
    expect(limits.religious).toEqual({ maxDaysPerRequest: 3, yearlyBudget: 3 });
  });

  it('tells the admin screen which types have a yearly allowance at all', async () => {
    const settings = await getSettings();

    expect(byType(settings, 'vacation').budgeted).toBe(true);
    expect(byType(settings, 'religious').budgeted).toBe(true);
    // Not "unset" — unbudgeted. The panel must not offer a box for these.
    expect(byType(settings, 'remote').budgeted).toBe(false);
    expect(byType(settings, 'sick').budgeted).toBe(false);
  });

  it('marks every type as default until one is changed', async () => {
    const before = await getSettings();
    expect(before.types.every((entry) => entry.isDefault)).toBe(true);
    expect(before.updatedAt).toBeNull();

    const after = await updateSettings(ADMIN, { limits: { vacation: { yearlyBudget: 8 } } });

    expect(byType(after, 'vacation').isDefault).toBe(false);
    expect(byType(after, 'religious').isDefault).toBe(true);
    expect(after.updatedAt).not.toBeNull();
  });

  it('carries the defaults alongside, so the panel can show what it would revert to', async () => {
    AbsenceRequestSettings.__seed({ vacation: { maxDaysPerRequest: 2 } });

    const vacation = byType(await getSettings(), 'vacation');

    expect(vacation.maxDaysPerRequest).toBe(2);
    expect(vacation.defaults).toEqual({ maxDaysPerRequest: 5, yearlyBudget: 5 });
  });
});

describe('saving the limits', () => {
  it('stores only what differs from the shipped table', async () => {
    await updateSettings(ADMIN, {
      limits: {
        remote: { maxDaysPerRequest: 3 }, // the default — not worth storing
        vacation: { maxDaysPerRequest: 5, yearlyBudget: 10 },
      },
    });

    // The whole point of storing diffs: a later change to the constants table
    // still reaches a type nobody has overridden.
    expect(AbsenceRequestSettings.__stored()).toEqual({ vacation: { yearlyBudget: 10 } });
  });

  it('keeps types the payload leaves out', async () => {
    AbsenceRequestSettings.__seed({ religious: { yearlyBudget: 6 } });

    const settings = await updateSettings(ADMIN, { limits: { vacation: { yearlyBudget: 8 } } });

    expect(byType(settings, 'religious').yearlyBudget).toBe(6);
    expect(byType(settings, 'vacation').yearlyBudget).toBe(8);
  });

  it('records who changed it', async () => {
    await updateSettings(ADMIN, { limits: { vacation: { yearlyBudget: 8 } } });

    expect(AbsenceRequestSettings.findOne).toHaveBeenCalled();
    expect((await getSettings()).updatedAt).not.toBeNull();
  });

  it('accepts a number sent as a string, as a form will', async () => {
    const settings = await updateSettings(ADMIN, {
      limits: { vacation: { maxDaysPerRequest: '4' } },
    });

    expect(byType(settings, 'vacation').maxDaysPerRequest).toBe(4);
  });

  it('refuses a type that does not exist', async () => {
    await expect(
      updateSettings(ADMIN, { limits: { holiday: { maxDaysPerRequest: 3 } } })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/not a kind of request/i),
    });
  });

  it('refuses a yearly allowance on a type that has none', async () => {
    // Refused rather than ignored: saving "remote: 12 days a year" and watching it
    // vanish on reload reads as a broken feature, not as a rule.
    await expect(
      updateSettings(ADMIN, { limits: { remote: { yearlyBudget: 12 } } })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/no yearly allowance/i),
    });
  });

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['fractional', 2.5],
    ['past the ceiling', 31],
    ['not a number', 'lots'],
  ])('refuses a %s number of days per request', async (_label, value) => {
    await expect(
      updateSettings(ADMIN, { limits: { vacation: { maxDaysPerRequest: value } } })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('names the type and the field it is refusing', async () => {
    await expect(
      updateSettings(ADMIN, { limits: { religious: { yearlyBudget: 900 } } })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/religious holiday: days per year must be between 1 and 260/i),
    });
  });

  it('refuses a payload with no limits in it', async () => {
    for (const payload of [{}, { limits: null }, { limits: [] }]) {
      await expect(updateSettings(ADMIN, payload)).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it('writes nothing when the payload is refused', async () => {
    AbsenceRequestSettings.__seed({ vacation: { yearlyBudget: 8 } });

    await expect(
      updateSettings(ADMIN, { limits: { vacation: { yearlyBudget: 999 } } })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(AbsenceRequestSettings.__stored()).toEqual({ vacation: { yearlyBudget: 8 } });
  });
});

describe('resetting', () => {
  it('forgets every override', async () => {
    AbsenceRequestSettings.__seed({
      vacation: { maxDaysPerRequest: 2, yearlyBudget: 2 },
      sick: { maxDaysPerRequest: 4 },
    });

    const settings = await resetSettings(ADMIN);

    expect(AbsenceRequestSettings.__stored()).toEqual({});
    expect(settings.types.every((entry) => entry.isDefault)).toBe(true);
    expect(byType(settings, 'vacation').maxDaysPerRequest).toBe(5);
    expect(byType(settings, 'sick').maxDaysPerRequest).toBe(1);
  });

  it('works on a system that has never been configured', async () => {
    const settings = await resetSettings(ADMIN);

    expect(settings.types.every((entry) => entry.isDefault)).toBe(true);
  });
});

describe('the primary admin', () => {
  it('is null until one is set', async () => {
    expect((await getSettings()).primaryAdmin).toBeNull();
  });

  it('accepts an existing active admin and stores their id', async () => {
    User.__seed('admin-2', { role: 'admin', status: 'active' });

    await updateSettings(ADMIN, { limits: {}, primaryAdmin: 'admin-2' });

    expect(AbsenceRequestSettings.__storedPrimaryAdmin()).toBe('admin-2');
  });

  it('refuses an id that is not an admin', async () => {
    User.__seed('mentor-1', { role: 'mentor', status: 'active' });

    await expect(
      updateSettings(ADMIN, { limits: {}, primaryAdmin: 'mentor-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(AbsenceRequestSettings.__storedPrimaryAdmin()).toBeNull();
  });

  it('refuses an admin who is not active', async () => {
    User.__seed('admin-3', { role: 'admin', status: 'invited' });

    await expect(
      updateSettings(ADMIN, { limits: {}, primaryAdmin: 'admin-3' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses an id that does not exist', async () => {
    await expect(
      updateSettings(ADMIN, { limits: {}, primaryAdmin: 'ghost' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('clears the primary admin when sent null explicitly', async () => {
    AbsenceRequestSettings.__seedPrimaryAdmin('admin-2');

    await updateSettings(ADMIN, { limits: {}, primaryAdmin: null });

    expect(AbsenceRequestSettings.__storedPrimaryAdmin()).toBeNull();
  });

  it('leaves the primary admin untouched when the payload omits it', async () => {
    AbsenceRequestSettings.__seedPrimaryAdmin('admin-2');

    await updateSettings(ADMIN, { limits: { vacation: { yearlyBudget: 4 } } });

    expect(AbsenceRequestSettings.__storedPrimaryAdmin()).toBe('admin-2');
  });
});
