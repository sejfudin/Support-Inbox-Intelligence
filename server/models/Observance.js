const mongoose = require('mongoose');

/**
 * A religious holiday, marked on the calendar so an intern can see it coming.
 *
 * **This is a notice and nothing more.** An observance does not remove the day from
 * anyone's attendance denominator, does not excuse anybody from checking in, and is
 * not an approval. It exists so an intern planning a religious-holiday request can
 * see that Ramazanski bajram falls on a Tuesday before they open the date picker.
 *
 * It is deliberately **not** a `NonWorkingDay`, and the distinction is the whole
 * reason this collection exists. `NonWorkingDay` is cohort-wide: writing Orthodox
 * Christmas into it would exempt the entire programme, including everyone who does
 * not observe it. An observance applies to whoever it applies to, and the intern is
 * the one who decides that by filing a request.
 *
 * A day can legitimately be both — a state holiday that is also a religious one —
 * in which case the `NonWorkingDay` row is what affects attendance and this row is
 * what names the occasion. Nothing here needs to know about that overlap.
 *
 * Dates are seeded rather than fetched. The ones that matter in Bosnia are the
 * *observed* dates — the Islamic Community announces Bajram, and Orthodox and
 * Catholic Easter diverge by which computus you follow — and a general holiday API
 * returns state holidays, not the multi-faith set this collection is for. A few
 * years of exact dates in `seeder/observances.js` beats a network call that can be
 * wrong, rate-limited, or down while somebody is trying to plan their leave.
 */

const TRADITIONS = ['muslim', 'orthodox', 'catholic', 'jewish', 'other'];

const observanceSchema = new mongoose.Schema(
  {
    // Office-local calendar day as 'YYYY-MM-DD' — the same key shape `Attendance`,
    // `NonWorkingDay` and `AttendanceRequest.dates` use, so they all compare as
    // plain strings with no timezone maths.
    //
    // Not unique: two traditions can land on the same day, and a multi-day
    // observance is stored as one row per day so a single date lookup finds it.
    date: {
      type: String,
      required: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be a YYYY-MM-DD key'],
    },
    // Shown in the calendar tooltip and the upcoming-observances notice.
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // Which tradition observes it. Presentational — nothing branches on it — but it
    // lets the notice group sensibly and lets a future filter exist without a
    // migration. `other` is the escape hatch rather than a free-text field.
    tradition: {
      type: String,
      enum: TRADITIONS,
      default: 'other',
      required: true,
    },
    // Whether this date is calculated rather than confirmed.
    //
    // True for the Islamic observances, which in Bosnia are announced by the Islamic
    // Community rather than derived, and can land a day either side of the tabular
    // calendar the seeder computes. The calendar surfaces this so an intern planning
    // leave knows to check — a date the app stated confidently and got wrong is the
    // exact failure this feature exists to prevent.
    provisional: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// The calendar asks for a window of days, so date-ordered reads are the hot path.
observanceSchema.index({ date: 1, tradition: 1 });

module.exports = mongoose.model('Observance', observanceSchema);
module.exports.TRADITIONS = TRADITIONS;
