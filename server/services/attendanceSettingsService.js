const AttendanceRequestSettings = require('../models/AttendanceRequestSettings');
const {
  REQUEST_TYPES,
  TYPE_RULES,
  LIMIT_BOUNDS,
  DEFAULT_LIMITS,
  isRequestType,
  isBudgetedType,
  maxDaysFor,
  yearlyBudgetFor,
} = require('../constants/attendanceRequestTypes');
const { httpError } = require('../helpers/httpError');

/**
 * The admin-set limits on attendance requests, and the one place that turns what
 * is stored into what the rules actually apply.
 *
 * Everything that reads a limit goes through `getEffectiveLimits()` and passes
 * the result down as an argument. Nothing below the service layer loads it:
 * `helpers/attendanceRequestRules.js` and `constants/attendanceRequestTypes.js`
 * stay free of Mongoose so the rules keep unit-testing without a database, which
 * in a repo with no integration suite is the only test they will ever get.
 *
 * There is no cache. One indexed `findOne` on a single-document collection, on
 * request paths that already load the intern's whole request history, is not the
 * cost worth introducing a staleness window for — an admin lowering a budget and
 * seeing the old one enforced for the next minute is a bug report, and a much
 * more confusing one than an extra query.
 */

const { SINGLETON_KEY } = AttendanceRequestSettings;

const loadDoc = () => AttendanceRequestSettings.findOne({ key: SINGLETON_KEY });

// `.lean()` hands back a plain object; a live document hands back a real `Map`,
// which would read as empty under `limits[type]` and silently lose every override
// on the next save. Both are flattened here so callers never have to know which
// they are holding. Missing document, missing map and empty map all mean the same
// thing: running as shipped.
const storedLimits = (doc) => {
  const limits = doc?.limits;
  if (!limits) return {};
  return limits instanceof Map ? Object.fromEntries(limits) : limits;
};

/**
 * Every type's limits after overrides, as `{ [type]: { maxDaysPerRequest,
 * yearlyBudget } }`. Always complete and always safe to index — an unset or
 * unreadable override falls back to the shipped default, and an unbudgeted type
 * reports `null` no matter what is stored against it.
 */
const effectiveFrom = (stored) =>
  Object.fromEntries(
    REQUEST_TYPES.map((type) => [
      type,
      {
        maxDaysPerRequest: maxDaysFor(type, stored),
        yearlyBudget: yearlyBudgetFor(type, stored),
      },
    ])
  );

const getEffectiveLimits = async () => effectiveFrom(storedLimits(await loadDoc().lean()));

const isDefault = (type, limits) =>
  limits[type].maxDaysPerRequest === DEFAULT_LIMITS[type].maxDaysPerRequest &&
  limits[type].yearlyBudget === DEFAULT_LIMITS[type].yearlyBudget;

/**
 * What the admin screen renders: every type, what it is set to now, what it ships
 * as, and the rails. Sent whole so the form needs no table of its own — the same
 * bargain the intern's request panel already gets from `buildTypeInfo`.
 */
const getSettings = async () => {
  const doc = await loadDoc().populate({ path: 'updatedBy', select: 'fullname' }).lean();
  const limits = effectiveFrom(storedLimits(doc));

  return {
    bounds: LIMIT_BOUNDS,
    types: REQUEST_TYPES.map((type) => ({
      type,
      label: TYPE_RULES[type].label,
      // Whether the yearly field is offered at all. The client must not infer
      // this from `yearlyBudget === null` and offer to fill it in — it is null
      // because the type is unbudgeted by design, not because nobody has set it.
      budgeted: isBudgetedType(type),
      maxDaysPerRequest: limits[type].maxDaysPerRequest,
      yearlyBudget: limits[type].yearlyBudget,
      defaults: DEFAULT_LIMITS[type],
      isDefault: isDefault(type, limits),
    })),
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy?.fullname || null,
  };
};

const readNumber = (raw, field, label) => {
  const { min, max } = LIMIT_BOUNDS[field];
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;

  if (!Number.isInteger(value)) {
    throw httpError(`${label} must be a whole number of days.`, 400);
  }
  if (value < min || value > max) {
    throw httpError(`${label} must be between ${min} and ${max} days.`, 400);
  }
  return value;
};

/**
 * Save the limits (admin). Types absent from the payload keep what they have, so
 * a caller may send one type without resetting the other three.
 *
 * Nothing already filed is re-validated. A request approved under a five-day
 * allowance stays approved when the allowance drops to three — the intern was
 * told yes, and the arithmetic that pays for it has already been written into
 * their attendance. The new number binds what is asked for next, and the budget
 * check clamps at zero rather than reporting a negative remainder.
 */
const updateSettings = async (user, payload = {}) => {
  const incoming = payload.limits;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw httpError('Send the limits to save.', 400);
  }

  const doc = (await loadDoc()) || new AttendanceRequestSettings({ key: SINGLETON_KEY });
  const merged = effectiveFrom(storedLimits(doc));

  for (const [type, values] of Object.entries(incoming)) {
    if (!isRequestType(type)) {
      throw httpError(`"${type}" is not a kind of request.`, 400);
    }
    if (!values || typeof values !== 'object') {
      throw httpError(`Send the limits for ${TYPE_RULES[type].label.toLowerCase()}.`, 400);
    }

    const label = TYPE_RULES[type].label;

    if (values.maxDaysPerRequest !== undefined) {
      merged[type].maxDaysPerRequest = readNumber(
        values.maxDaysPerRequest,
        'maxDaysPerRequest',
        `${label}: days per request`
      );
    }

    if (values.yearlyBudget !== undefined) {
      // Refused rather than ignored: silently dropping it would let an admin
      // save "remote: 12 days a year", see it vanish on reload, and reasonably
      // conclude the feature is broken.
      if (!isBudgetedType(type)) {
        throw httpError(`${label} has no yearly allowance to set.`, 400);
      }
      merged[type].yearlyBudget = readNumber(
        values.yearlyBudget,
        'yearlyBudget',
        `${label}: days per year`
      );
    }
  }

  // Only what differs from the shipped table is persisted — see the model's
  // comment. An entry equal to its default is dropped, not stored as itself.
  const toStore = {};
  for (const type of REQUEST_TYPES) {
    const entry = {};
    if (merged[type].maxDaysPerRequest !== DEFAULT_LIMITS[type].maxDaysPerRequest) {
      entry.maxDaysPerRequest = merged[type].maxDaysPerRequest;
    }
    if (isBudgetedType(type) && merged[type].yearlyBudget !== DEFAULT_LIMITS[type].yearlyBudget) {
      entry.yearlyBudget = merged[type].yearlyBudget;
    }
    if (Object.keys(entry).length > 0) toStore[type] = entry;
  }

  doc.limits = toStore;
  doc.updatedBy = user._id;
  await doc.save();

  return getSettings();
};

/** Put every type back to what it ships as, by forgetting the overrides. */
const resetSettings = async (user) => {
  const doc = (await loadDoc()) || new AttendanceRequestSettings({ key: SINGLETON_KEY });
  doc.limits = {};
  doc.updatedBy = user._id;
  await doc.save();

  return getSettings();
};

module.exports = {
  getEffectiveLimits,
  getSettings,
  updateSettings,
  resetSettings,
};
