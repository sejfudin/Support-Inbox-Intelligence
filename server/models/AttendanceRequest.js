const mongoose = require('mongoose');
const {
  REQUEST_TYPES,
  REMOTE,
  maxDaysFor,
  rulesFor,
} = require('../constants/attendanceRequestTypes');

/**
 * One intern asking for days away from the usual office check-in, and the admin
 * decision on it.
 *
 * Four types share this one collection because they share everything that matters:
 * the same lifecycle, the same all-or-nothing decision, the same admin queue, and
 * the same "approval writes the attendance row" mechanic. What differs — the
 * ceiling, the yearly budget, whether the day may be backdated, and whether it
 * counts as worked — lives in `constants/attendanceRequestTypes.js`, one row per
 * type. Four parallel collections would have been four copies of this file.
 *
 * **A request is decided as a unit.** Its days need not be consecutive; nothing in
 * the rules cares, and "Monday and Friday" is as ordinary a request as "Monday to
 * Wednesday". Approving writes a row per day, rejecting refuses all of them, and
 * there is no per-day verdict because the intern chose those days together.
 *
 * This is the per-intern counterpart to `NonWorkingDay`, and the two must not be
 * confused — see that model's comment. `NonWorkingDay` is cohort-wide and removes a
 * day from *everyone's* denominator. An approved request writes one `Attendance`
 * row per day, and what that row does to the arithmetic depends on the type:
 * `remote` counts as attended (working from home is work), while `vacation`,
 * `religious` and `sick` leave the denominator the way a holiday does — a day off
 * is neither attended nor missed.
 *
 * The row is the audit trail and outlives the days it covers, which is why an
 * approval is never deleted — `revoked` is a state, not a `deleteOne`.
 */
const PENDING = 'pending';
const APPROVED = 'approved';
const REJECTED = 'rejected';
const CANCELLED = 'cancelled';
const REVOKED = 'revoked';

const REQUEST_STATUSES = [PENDING, APPROVED, REJECTED, CANCELLED, REVOKED];

// The states that still hold a claim on the day. A request in any other state is
// spent: the day is free to be requested again, and — for the budgeted types — the
// days it named are returned to the intern's yearly allowance. Kept here rather
// than in the service because the duplicate-day check and the budget check ask the
// same question.
const LIVE_STATUSES = [PENDING, APPROVED];

const attendanceRequestSchema = new mongoose.Schema(
  {
    // Points at InternProfile, not User — the same anchor `Attendance` uses, so a
    // request and the rows it produces are keyed off the same document.
    intern: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
      index: true,
    },
    // Which of the four things is being asked for. Defaults to `remote` so the
    // handful of pt.1 rows written before this field existed still read correctly.
    type: {
      type: String,
      enum: REQUEST_TYPES,
      default: REMOTE,
      required: true,
      index: true,
    },
    // The days being asked for, as office-local 'YYYY-MM-DD' keys matching
    // `Attendance.date` and `NonWorkingDay.date`, so all three compare as plain
    // strings with no timezone maths anywhere.
    //
    // Stored sorted. The bound here is per-type and is the last line of defence —
    // the real validation, with the reasons an intern can act on, is in
    // `helpers/attendanceRequestRules.js`.
    dates: {
      type: [
        {
          type: String,
          match: [/^\d{4}-\d{2}-\d{2}$/, 'each date must be a YYYY-MM-DD key'],
        },
      ],
      required: true,
      validate: [
        // A plain function, not an arrow: `this` has to be the document so the
        // ceiling can depend on the type being validated.
        function (value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= maxDaysFor(this.type);
        },
        function (props) {
          const max = maxDaysFor(this.type);
          const label = rulesFor(this.type).label.toLowerCase();
          return `a ${label} request must cover between 1 and ${max} day${max === 1 ? '' : 's'} (got ${props.value?.length ?? 0})`;
        },
      ],
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: PENDING,
      required: true,
      index: true,
    },
    // The intern's reason. Optional for every type: a day off is a request, not a
    // defence, and requiring a sick note through a text box would not be one anyway.
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    // Who decided, and when. Both stay null while pending.
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    // The admin's note on a rejection or a revocation — the intern sees this, so
    // it is the only place a refusal can be explained.
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

// Serves both hot paths: "this intern's live requests" (the duplicate-day and
// budget checks) and "this intern's history" for their own list.
attendanceRequestSchema.index({ intern: 1, status: 1 });
// Serves the admin queue, which reads pending requests by the day being asked for.
attendanceRequestSchema.index({ status: 1, dates: 1 });

module.exports = mongoose.model('AttendanceRequest', attendanceRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.LIVE_STATUSES = LIVE_STATUSES;
module.exports.PENDING = PENDING;
module.exports.APPROVED = APPROVED;
module.exports.REJECTED = REJECTED;
module.exports.CANCELLED = CANCELLED;
module.exports.REVOKED = REVOKED;
