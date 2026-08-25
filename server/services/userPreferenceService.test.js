// The two pure halves of the preferences endpoint: what a partial patch turns
// into, and what a half-empty stored document reads back as. The Mongo round
// trip in between is not covered here — `User` is mocked away so this file needs
// no database.

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const { buildUpdate, buildUnset, withDefaults, storedKeysOf } = require('./userPreferenceService');
const {
  DEFAULT_USER_PREFERENCES,
  QUICK_ACTION_KEYS,
  QUICK_ACTIONS_MAX,
} = require('../constants/userPreferences');

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

  it('stores a quick-action order as sent, since order is the whole point', () => {
    expect(buildUpdate({ quickActions: ['add-intern', 'assign-ticket'] })).toEqual({
      'preferences.quickActions': ['add-intern', 'assign-ticket'],
    });
  });

  it('collapses a repeated quick action to its first position', () => {
    // First-occurrence order is what `Set` keeps, and for an ordered list that is
    // the only defensible answer: a key sent twice was meant to sit where it
    // first appeared.
    expect(buildUpdate({ quickActions: ['add-intern', 'assign-ticket', 'add-intern'] })).toEqual({
      'preferences.quickActions': ['add-intern', 'assign-ticket'],
    });
  });

  it('refuses an action key we do not ship, and a non-array order', () => {
    expect(() => buildUpdate({ quickActions: ['delete-everything'] })).toThrow(/Unknown/);
    expect(() => buildUpdate({ quickActions: 'assign-ticket' })).toThrow(/must be an array/);
  });

  // Shipped state: the cap is armed at 5, so the whole catalog is over it.
  it('refuses a selection over the shipped cap', () => {
    expect(QUICK_ACTIONS_MAX).toBe(5);
    expect(() => buildUpdate({ quickActions: QUICK_ACTION_KEYS })).toThrow(/At most 5/);
  });

  it('counts members, not entries — a list that repeats itself is not too long', () => {
    const repeated = [...QUICK_ACTION_KEYS.slice(0, 3), ...QUICK_ACTION_KEYS.slice(0, 3)];
    expect(buildUpdate({ quickActions: repeated })['preferences.quickActions']).toHaveLength(3);
  });

  it('stores an empty selection — "no quick actions" is a choice', () => {
    expect(buildUpdate({ quickActions: [] })).toEqual({ 'preferences.quickActions': [] });
  });

  it('still lets the muted list run to every group — the cap is per preference', () => {
    expect(
      buildUpdate({
        mutedNotificationGroups: ['mentions', 'assignments', 'reviews', 'programme', 'reminders'],
      })['preferences.mutedNotificationGroups']
    ).toHaveLength(5);
  });

  it('does not write a value for a preference being reset', () => {
    expect(buildUpdate({ quickActions: null, density: 'compact' })).toEqual({
      'preferences.density': 'compact',
    });
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

describe('buildUnset', () => {
  // Reset is a deletion, not a write of today's default: an absent preference
  // means "as shipped", so a later change to the shipped order still reaches an
  // account that has reset.
  it('removes a preference sent as null', () => {
    expect(buildUnset({ quickActions: null })).toEqual({ 'preferences.quickActions': '' });
  });

  it('leaves alone every key that carries a value', () => {
    expect(buildUnset({ quickActions: ['assign-ticket'], density: 'compact' })).toEqual({});
  });

  it('ignores a null for a key we do not ship', () => {
    expect(buildUnset({ retiredSetting: null, toString: null })).toEqual({});
  });

  it('resets a single-valued preference too, not only the lists', () => {
    expect(buildUnset({ density: null })).toEqual({ 'preferences.density': '' });
  });
});

describe('the maxLength mechanism', () => {
  // `quickActions` currently declares no cap, so this exercises the branch
  // through a stubbed definition. It is what will refuse the sixth action the day
  // `QUICK_ACTIONS_MAX` goes back to 5 — a truncating save would report success
  // and leave the caller believing in a row nothing will ever draw.
  const {
    USER_LIST_PREFERENCE_DEFINITIONS,
    QUICK_ACTION_KEYS: keys,
  } = require('../constants/userPreferences');

  it('refuses a list longer than the declared maximum', () => {
    const definition = USER_LIST_PREFERENCE_DEFINITIONS.quickActions;
    definition.maxLength = 5;
    try {
      expect(() => buildUpdate({ quickActions: keys.slice(0, 6) })).toThrow(/At most 5/);
      expect(
        buildUpdate({ quickActions: keys.slice(0, 5) })['preferences.quickActions']
      ).toHaveLength(5);
    } finally {
      definition.maxLength = null;
    }
  });
});
