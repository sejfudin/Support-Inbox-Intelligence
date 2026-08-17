// The two pure halves of the preferences endpoint: what a partial patch turns
// into, and what a half-empty stored document reads back as. The Mongo round
// trip in between is not covered here — `User` is mocked away so this file needs
// no database.

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const { buildUpdate, withDefaults, hasAnyStored } = require('./userPreferenceService');
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

describe('hasAnyStored', () => {
  // This flag is what stops the first load after the move to account-level
  // preferences from resetting everyone's browser to the defaults.
  it('is false for an account that has never chosen anything', () => {
    expect(hasAnyStored(undefined)).toBe(false);
    expect(hasAnyStored({})).toBe(false);
  });

  it('is true once any key is present, including an emptied muted list', () => {
    expect(hasAnyStored({ density: 'comfortable' })).toBe(true);
    expect(hasAnyStored({ mutedNotificationGroups: [] })).toBe(true);
  });
});
