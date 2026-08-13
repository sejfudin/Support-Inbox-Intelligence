const mongoose = require('mongoose');

/**
 * One intern asking to work remotely, and the admin decision on it.
 *
 * **A request covers 1, 2 or 3 days and is decided as a unit.** Three is the
 * ceiling on a single request, not on the intern: wanting a fourth day means
 * submitting another request, and there is **no limit on how many requests** they
 * may have open. That combination is deliberate — an intern with exams all week
 * asks twice (3 days, then 2) rather than being told no.
 *
 * The days need not be consecutive. Nothing in the rules cares, and "Monday and
 * Friday" is as ordinary a request as "Monday to Wednesday".
 *
 * This is the per-intern counterpart to `NonWorkingDay`, and the two must not be
 * confused — see that model's comment. `NonWorkingDay` is cohort-wide and removes
 * a day from everyone's denominator; this removes nothing from anyone's. An
 * approved request writes one `Attendance` row per day with `status: 'remote'`,
 * which **counts as an attended day**: working from home is work, so a fully
 * remote week still reads 100%.
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
// spent: the day is free to be requested again, and the request stops counting
// against the outstanding cap. Kept here rather than in the service because both
// the cap check and the duplicate-day check ask the same question.
const LIVE_STATUSES = [PENDING, APPROVED];

// The most days one request may cover. Not a budget — see the class comment: an
// intern may file as many requests as they need, this only bounds each one.
const MAX_DAYS_PER_REQUEST = 3;

const remoteWorkRequestSchema = new mongoose.Schema(
  {
    // Points at InternProfile, not User — the same anchor `Attendance` uses, so a
    // request and the row it produces are keyed off the same document.
    intern: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
      index: true,
    },
    // The days being asked for, as office-local 'YYYY-MM-DD' keys matching
    // `Attendance.date` and `NonWorkingDay.date`, so all three compare as plain
    // strings with no timezone maths anywhere.
    //
    // Stored sorted. The schema bound is the last line of defence — the real
    // validation, with the reasons an intern can act on, is in
    // `helpers/remoteWorkRules.js`.
    dates: {
      type: [
        {
          type: String,
          match: [/^\d{4}-\d{2}-\d{2}$/, 'each date must be a YYYY-MM-DD key'],
        },
      ],
      required: true,
      validate: [
        (value) =>
          Array.isArray(value) && value.length >= 1 && value.length <= MAX_DAYS_PER_REQUEST,
        `a request must cover between 1 and ${MAX_DAYS_PER_REQUEST} days`,
      ],
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: PENDING,
      required: true,
      index: true,
    },
    // The intern's reason. Optional: a remote day is a request, not a defence.
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

// Serves both hot paths: "this intern's live requests" (the duplicate-day check)
// and "this intern's history" for their own list.
remoteWorkRequestSchema.index({ intern: 1, status: 1 });
// Serves the admin queue, which reads pending requests by the day being asked for.
remoteWorkRequestSchema.index({ status: 1, dates: 1 });

module.exports = mongoose.model('RemoteWorkRequest', remoteWorkRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.LIVE_STATUSES = LIVE_STATUSES;
module.exports.MAX_DAYS_PER_REQUEST = MAX_DAYS_PER_REQUEST;
module.exports.PENDING = PENDING;
module.exports.APPROVED = APPROVED;
module.exports.REJECTED = REJECTED;
module.exports.CANCELLED = CANCELLED;
module.exports.REVOKED = REVOKED;
