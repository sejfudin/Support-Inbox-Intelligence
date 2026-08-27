const User = require('../models/User');
const { httpError } = require('../helpers/httpError');
const {
  USER_PREFERENCE_DEFINITIONS,
  USER_PREFERENCE_KEYS,
  USER_LIST_PREFERENCE_DEFINITIONS,
  USER_LIST_PREFERENCE_KEYS,
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

/** The same rule for the list-valued half of the table. */
const listDefinitionFor = (key) =>
  Object.prototype.hasOwnProperty.call(USER_LIST_PREFERENCE_DEFINITIONS, key)
    ? USER_LIST_PREFERENCE_DEFINITIONS[key]
    : null;

/** Is this a preference at all — single-valued or list-valued. */
const isKnownPreference = (key) => Boolean(definitionFor(key) || listDefinitionFor(key));

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

/**
 * A stored document only carries the keys the user has actually chosen, so every
 * read merges it onto the defaults. Callers therefore always get the complete
 * set and never have to know which fields exist yet.
 */
const withDefaults = (stored = {}) => ({
  ...DEFAULT_USER_PREFERENCES,
  ...Object.fromEntries(storedKeysOf(stored).map((key) => [key, stored[key]])),
  // Every list is copied rather than handed out: what comes off a lean document
  // is still the caller's to mutate, and the frozen defaults must not be the
  // thing they mutate.
  ...Object.fromEntries(
    USER_LIST_PREFERENCE_KEYS.map((key) => [
      key,
      Array.isArray(stored?.[key]) ? [...stored[key]] : [...DEFAULT_USER_PREFERENCES[key]],
    ])
  ),
});

/**
 * Normalises one incoming patch into `{ 'preferences.<key>': value }` pairs.
 *
 * Unknown keys are ignored rather than rejected: an older client that still
 * sends a preference we have retired should not have its whole save fail. A
 * *known* key carrying an illegal value is a bug in the caller, so that does
 * throw.
 */
const assertPatchObject = (patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw httpError('Preferences payload must be an object', 400);
  }
};

const buildUpdate = (patch) => {
  assertPatchObject(patch);

  const update = {};

  Object.entries(patch).forEach(([key, value]) => {
    // `null` is "forget this preference" and is handled by `buildUnset`, which
    // runs over the same patch. Skipping it here is what keeps a reset from also
    // writing a value.
    if (value === null) return;

    const listDefinition = listDefinitionFor(key);
    if (listDefinition) {
      if (!Array.isArray(value)) {
        throw httpError(`${key} must be an array of ${listDefinition.itemName} keys`, 400);
      }
      const unknown = value.filter((item) => !listDefinition.values.includes(item));
      if (unknown.length > 0) {
        throw httpError(`Unknown ${listDefinition.itemName}: ${unknown.join(', ')}`, 400);
      }
      // De-duplicated so the stored list carries each member once, whatever the
      // client sent. `Set` keeps first-occurrence order, which is what an
      // *ordered* list preference needs and a set-shaped one does not mind.
      const members = [...new Set(value)];

      // Refused rather than truncated. Storing five of six and reporting success
      // would leave the caller believing in a sixth row that nothing will ever
      // draw; the count is part of what they asked for.
      if (listDefinition.maxLength && members.length > listDefinition.maxLength) {
        throw httpError(
          `At most ${listDefinition.maxLength} ${listDefinition.itemName}s can be saved`,
          400
        );
      }

      update[`preferences.${key}`] = members;
      return;
    }

    const definition = definitionFor(key);
    if (!definition) return;

    if (!definition.values.includes(value)) {
      throw httpError(`Invalid value for preference "${key}"`, 400);
    }

    update[`preferences.${key}`] = value;
  });

  return update;
};

/**
 * The reset half of the same patch: a known preference sent as `null` is removed
 * from the document rather than written to today's default.
 *
 * That distinction is the whole point. An absent preference means "as shipped",
 * so a later change to a default — a new quick action, a re-ordered catalog —
 * still reaches an account that has reset, while a stored copy of today's default
 * would pin it forever. `AbsenceRequestSettings` resets the same way, for the
 * same reason.
 */
const buildUnset = (patch) => {
  assertPatchObject(patch);

  const unset = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (value !== null) return;
    if (!isKnownPreference(key)) return;
    unset[`preferences.${key}`] = '';
  });

  return unset;
};

/** The one answer shape both the read and the write reply with. */
const preferencesResponse = (stored) => ({
  preferences: withDefaults(stored),
  storedKeys: storedKeysOf(stored),
});

const getPreferences = async (userId) => {
  const user = await User.findById(userId).select('preferences').lean();
  if (!user) throw httpError('User not found', 404);
  return preferencesResponse(user.preferences);
};

/**
 * Partial merge, not a whole-object replace: only the keys present in `patch`
 * are written, via dot-notation `$set`, so two browsers changing two different
 * preferences do not clobber each other. Two browsers changing the *same* one is
 * last-write-wins, which is the intended behaviour.
 */
const updatePreferences = async (userId, patch) => {
  const update = buildUpdate(patch);
  const unset = buildUnset(patch);

  if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
    return getPreferences(userId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      ...(Object.keys(update).length > 0 && { $set: update }),
      ...(Object.keys(unset).length > 0 && { $unset: unset }),
    },
    { new: true, runValidators: true, select: 'preferences' }
  ).lean();

  if (!user) throw httpError('User not found', 404);
  return preferencesResponse(user.preferences);
};

module.exports = {
  getPreferences,
  updatePreferences,
  withDefaults,
  buildUpdate,
  buildUnset,
  storedKeysOf,
};
