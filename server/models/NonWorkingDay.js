const mongoose = require('mongoose');

/**
 * A calendar day nobody was expected to attend — a public holiday, a programme
 * break, a fully-remote week.
 *
 * Weekends are NOT stored here: they are derived from the date itself
 * (`countWorkingDays`). This collection is only for weekdays that would otherwise
 * be counted as owed.
 *
 * Such a day leaves the attendance denominator entirely and renders greyed out,
 * exactly like a weekend — it is never an absence. Without it the app counts every
 * Mon–Fri as owed and reads ~17pt low for a month containing a holiday.
 *
 * Global rather than per-workspace: all three hubs are in Bosnia and the programme
 * breaks apply to the whole cohort. If a hub ever needs its own calendar, add an
 * optional `workspace` here and make the lookup fall back to the global set.
 *
 * **This collection is cohort-wide, and only cohort-wide.** Everything in it
 * applies to every intern at once. Per-intern days off — an intern requesting a
 * remote day, calling in sick, taking leave — do NOT belong here, however similar
 * the effect on the denominator looks: they are one person's day, they carry a
 * requester and an approval state, and they need to be auditable per intern.
 * That is a separate per-intern model. Widening `kind` here to cover it would
 * quietly make one intern's sick day exempt the whole cohort.
 */
const nonWorkingDaySchema = new mongoose.Schema(
  {
    // Office-local calendar day as 'YYYY-MM-DD' — the same key shape `Attendance`
    // uses, so the two can be compared as plain strings with no timezone maths.
    date: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be a YYYY-MM-DD key'],
    },
    // Shown in the calendar tooltip: "Labour Day", "Remote week", "Programme break".
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // Which sort of non-working day this is. All three kinds leave the attendance
    // denominator in exactly the same way — the maths never branches on it. Only
    // wording does: the calendar colours a remote week differently from a public
    // holiday, and `checkIn` refuses a remote day with a different sentence than
    // a holiday. Neither can be driven off the free-text `label`. Rows written
    // before this field read as 'holiday'.
    kind: {
      type: String,
      enum: ['holiday', 'break', 'remote'],
      default: 'holiday',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NonWorkingDay', nonWorkingDaySchema);
