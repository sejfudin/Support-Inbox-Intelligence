// The two pure halves of the preferences endpoint: what a partial patch turns
// into, and what a half-empty stored document reads back as. The Mongo round
// trip in between is not covered here — `User` is mocked away so this file needs
// no database.

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const {
  buildUpdate,
  withDefaults,
  hasAnyStored,
  storedKeysOf,
} = require('./userPreferenceService');
const { DEFAULT_USER_PREFERENCES } = require('../constants/userPreferences');

describe('buildUpdate', () => {
  it('writes only the keys the patch carries, dot-noted so the merge is partial', () => {
    expect(buildUpdate({ density: 'compact' })).toEqual({ 'preferences.density': 'compact' });
  });

  it('ignores a key we no longer ship rather than failing the whole save', () => {
    expect(buildUpdate({ density: 'compact', retiredSetting: 'whatever' })).toEqual({
      'preferences.density': 'compact',
    });
  });

  it('rejects an illegal value for a key we do ship', () => {
    expect(() => buildUpdate({ density: 'roomy' })).toThrow(/Invalid value/);
  });

  it('never writes uiScale — that one stays per-device', () => {
    expect(buildUpdate({ uiScale: 'larger' })).toEqual({});
  });

  it('de-duplicates muted notification groups and refuses unknown ones', () => {
    expect(buildUpdate({ mutedNotificationGroups: ['mentions', 'mentions'] })).toEqual({
      'preferences.mutedNotificationGroups': ['mentions'],
    });
    expect(() => buildUpdate({ mutedNotificationGroups: ['nope'] })).toThrow(/Unknown/);
    expect(() => buildUpdate({ mutedNotificationGroups: 'mentions' })).toThrow(/must be an array/);
  });

  it('ignores a key that only exists on Object.prototype', () => {
    // These used to resolve to an inherited function, which then blew up on
    // `definition.values` — a 500 for a payload that deserved a shrug.
    expect(buildUpdate({ toString: 'x', constructor: 'x', hasOwnProperty: 'x' })).toEqual({});
    expect(buildUpdate(JSON.parse('{"__proto__":"x","density":"compact"}'))).toEqual({
      'preferences.density': 'compact',
    });
  });

  it('refuses a payload that is not an object', () => {
    expect(() => buildUpdate(['density'])).toThrow(/must be an object/);
    expect(() => buildUpdate(null)).toThrow(/must be an object/);
  });
});

describe('withDefaults', () => {
  it('fills every unchosen preference from the defaults', () => {
    expect(withDefaults({ density: 'compact' })).toEqual({
      ...DEFAULT_USER_PREFERENCES,
      density: 'compact',
    });
  });

  it('treats a missing subdocument as a fresh account', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('copies the muted list rather than aliasing the shared default', () => {
    const result = withDefaults({});
    result.mutedNotificationGroups.push('mentions');
    expect(DEFAULT_USER_PREFERENCES.mutedNotificationGroups).toEqual([]);
  });
});

describe('withDefaults', () => {
  it('ignores a stored key that is not a preference we ship', () => {
    expect(withDefaults({ density: 'compact', retiredSetting: 'whatever' })).toEqual({
      ...DEFAULT_USER_PREFERENCES,
      density: 'compact',
    });
  });
});

describe('storedKeysOf', () => {
  // Per key, not one flag: this is what lets a device keep a locally-set
  // preference the account never saved while still taking the server's answer
  // for the ones it did.
  it('lists nothing for an account that has never chosen anything', () => {
    expect(storedKeysOf(undefined)).toEqual([]);
    expect(storedKeysOf({})).toEqual([]);
  });

  it('lists only the keys actually present, including an emptied muted list', () => {
    expect(storedKeysOf({ density: 'comfortable', mutedNotificationGroups: [] })).toEqual([
      'density',
      'mutedNotificationGroups',
    ]);
  });

  it('does not count an inherited key or an explicit null', () => {
    expect(storedKeysOf({ density: null })).toEqual([]);
    expect(storedKeysOf(Object.create({ density: 'compact' }))).toEqual([]);
  });
});

describe('hasAnyStored', () => {
  it('is false for an account that has never chosen anything', () => {
    expect(hasAnyStored(undefined)).toBe(false);
    expect(hasAnyStored({})).toBe(false);
  });

  it('is true once any key is present, including an emptied muted list', () => {
    expect(hasAnyStored({ density: 'comfortable' })).toBe(true);
    expect(hasAnyStored({ mutedNotificationGroups: [] })).toBe(true);
  });
});
