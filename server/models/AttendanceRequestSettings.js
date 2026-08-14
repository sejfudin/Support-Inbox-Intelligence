const mongoose = require('mongoose');
const { LIMIT_BOUNDS } = require('../constants/attendanceRequestTypes');

/**
 * The admin-set limits on attendance requests: how many days one request of each
 * type may cover, and how many days a year the budgeted types allow.
 *
 * **One document, always.** `key` is fixed and unique, so a second row cannot be
 * written — the alternative, "newest wins", makes the effective configuration
 * depend on a sort order and leaves losing rows sitting in the collection looking
 * authoritative.
 *
 * Global rather than per-workspace, on the same grounds as `NonWorkingDay`: an
 * `AttendanceRequest` carries no workspace at all — it hangs off the intern — and
 * the programme's allowances apply to the whole cohort. If a hub ever needs its
 * own, the escape hatch is the one that model documents: an optional `workspace`
 * here, with the lookup falling back to the global row.
 *
 * **Only differences from the default are stored.** An empty `limits` map is a
 * system running exactly as shipped, which is what makes "reset to defaults" a
 * deletion rather than a re-write of the current constants, and lets a change to
 * `constants/attendanceRequestTypes.js` still reach installations that never
 * touched the type it changed. The consequence to know: saving a value that
 * happens to equal the default stores nothing, so the two are indistinguishable
 * afterwards. That is the intended reading — "unset" and "set to the default"
 * mean the same thing here.
 */

const SINGLETON_KEY = 'global';

// Bounds are declared here as well as in the service. The service's rejections
// are the ones an admin reads; these catch a seeder, a migration or a mongo shell
// writing something the UI would never have sent.
const limitSchema = new mongoose.Schema(
  {
    maxDaysPerRequest: {
      type: Number,
      min: LIMIT_BOUNDS.maxDaysPerRequest.min,
      max: LIMIT_BOUNDS.maxDaysPerRequest.max,
    },
    // Absent for the unbudgeted types, which is not the same as zero. Nothing
    // writes this key for `remote` or `sick`, and `yearlyBudgetFor` would ignore
    // it if something did.
    yearlyBudget: {
      type: Number,
      min: LIMIT_BOUNDS.yearlyBudget.min,
      max: LIMIT_BOUNDS.yearlyBudget.max,
    },
  },
  { _id: false }
);

const attendanceRequestSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: SINGLETON_KEY,
      unique: true,
      immutable: true,
    },
    // Keyed by request type. A Map rather than four named fields so that adding a
    // fifth type stays what the type table promises — a row there and a colour on
    // the client — instead of also being a schema change here.
    limits: {
      type: Map,
      of: limitSchema,
      default: () => new Map(),
    },
    // These numbers decide what an intern is entitled to. "Who cut vacation to
    // three days, and when" is a question someone will ask, and `timestamps`
    // alone answers only half of it.
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const AttendanceRequestSettings = mongoose.model(
  'AttendanceRequestSettings',
  attendanceRequestSettingsSchema
);

AttendanceRequestSettings.SINGLETON_KEY = SINGLETON_KEY;

module.exports = AttendanceRequestSettings;
