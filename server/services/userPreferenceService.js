const User = require('../models/User');
const {
  USER_PREFERENCE_DEFINITIONS,
  USER_PREFERENCE_KEYS,
  MUTED_NOTIFICATION_GROUP_VALUES,
  DEFAULT_USER_PREFERENCES,
} = require('../constants/userPreferences');

/**
 * Own, declared keys only. Reading straight off the table would let a payload
 * key like `toString` or `constructor` resolve to something on
 * `Object.prototype` — truthy, but with no `values` array behind it, so a junk
 * key would throw where it should have been shrugged off.
 */
const definitionFor = (key) =>
  Object.prototype.hasOwnProperty.call(USER_PREFERENCE_DEFINITIONS, key)
    ? USER_PREFERENCE_DEFINITIONS[key]
    : null;

/** Same rule for a stored document: an inherited key is not a chosen one. */
const isStored = (stored, key) =>
  Boolean(stored) &&
  Object.prototype.hasOwnProperty.call(stored, key) &&
  stored[key] !== undefined &&
  stored[key] !== null;

/**
 * The preferences this account has actually chosen — the keys present on the
 * stored subdocument, in table order.
 *
 * The client needs this per key, not as one flag: a browser that has locally set
 * a density the account never saved must keep it, while still taking the server's
 * answer for the preferences the account *has* saved. A single all-or-nothing
 * flag would let the first saved preference anywhere reset every other
 * locally-set one on every other device.
 *
 * Presence is the whole test: no field on the subdocument has a schema default
 * (only the subdocument itself does, to `{}`), so a key is there only because the
 * user put it there. An empty `mutedNotificationGroups` still counts — "I unmuted
 * everything" is a choice.
 */
const storedKeysOf = (stored) => USER_PREFERENCE_KEYS.filter((key) => isStored(stored, key));

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const notFound = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

/**
 * A stored document only carries the keys the user has actually chosen, so every
 * read merges it onto the defaults. Callers therefore always get the complete
 * set and never have to know which fields exist yet.
 */
const withDefaults = (stored = {}) => ({
  ...DEFAULT_USER_PREFERENCES,
  ...Object.fromEntries(storedKeysOf(stored).map((key) => [key, stored[key]])),
  mutedNotificationGroups: Array.isArray(stored?.mutedNotificationGroups)
    ? [...stored.mutedNotificationGroups]
    : [...DEFAULT_USER_PREFERENCES.mutedNotificationGroups],
});

/**
 * Normalises one incoming patch into `{ 'preferences.<key>': value }` pairs.
 *
 * Unknown keys are ignored rather than rejected: an older client that still
 * sends a preference we have retired should not have its whole save fail. A
 * *known* key carrying an illegal value is a bug in the caller, so that does
 * throw.
 */
const buildUpdate = (patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw badRequest('Preferences payload must be an object');
  }

  const update = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (key === 'mutedNotificationGroups') {
      if (!Array.isArray(value)) {
        throw badRequest('mutedNotificationGroups must be an array of group keys');
      }
      const unknown = value.filter((group) => !MUTED_NOTIFICATION_GROUP_VALUES.includes(group));
      if (unknown.length > 0) {
        throw badRequest(`Unknown notification group: ${unknown.join(', ')}`);
      }
      // De-duplicated so the stored list is a set, whatever the client sent.
      update['preferences.mutedNotificationGroups'] = [...new Set(value)];
      return;
    }

    const definition = definitionFor(key);
    if (!definition) return;

    if (!definition.values.includes(value)) {
      throw badRequest(`Invalid value for preference "${key}"`);
    }

    update[`preferences.${key}`] = value;
  });

  return update;
};

/**
 * Whether this account has ever chosen anything at all. Kept as a convenience on
 * top of `storedKeys` — the client reconciles per key, but a bare "this account
 * is untouched" is still the clearer thing to read in a log or a test.
 */
const hasAnyStored = (stored) => storedKeysOf(stored).length > 0;

/** The one answer shape both the read and the write reply with. */
const present = (stored) => ({
  preferences: withDefaults(stored),
  hasStoredPreferences: hasAnyStored(stored),
  storedKeys: storedKeysOf(stored),
});

const getPreferences = async (userId) => {
  const user = await User.findById(userId).select('preferences').lean();
  if (!user) throw notFound('User not found');
  return present(user.preferences);
};

/**
 * Partial merge, not a whole-object replace: only the keys present in `patch`
 * are written, via dot-notation `$set`, so two browsers changing two different
 * preferences do not clobber each other. Two browsers changing the *same* one is
 * last-write-wins, which is the intended behaviour.
 */
const updatePreferences = async (userId, patch) => {
  const update = buildUpdate(patch);

  if (Object.keys(update).length === 0) {
    return getPreferences(userId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true, select: 'preferences' }
  ).lean();

  if (!user) throw notFound('User not found');
  return present(user.preferences);
};

module.exports = {
  getPreferences,
  updatePreferences,
  withDefaults,
  buildUpdate,
  hasAnyStored,
  storedKeysOf,
};
