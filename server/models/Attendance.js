const mongoose = require('mongoose');

// One document per intern per day they act on their attendance. Absent days are
// NOT stored — absence is simply the lack of a record and is derived at read
// time. A `cancelled` record unchecks the day: it reads as absent, but the intern
// can check in again while the window is open, which flips the same row back to
// `present`. The unique { intern, date } index keeps that one row per day, so
// repeat check-ins are idempotent (duplicate key) instead of piling up.
const PRESENT = 'present';
const CANCELLED = 'cancelled';
// An approved remote-work day (see models/AttendanceRequest.js). Written by the
// admin's approval, never by a check-in — there is no office to arrive at, so the
// 07:00–11:00 window does not apply to it.
//
// It is a status of its own rather than a flag on `present` because the two are
// different facts and the UI must tell them apart. For the arithmetic they are
// the same: `ATTENDED_STATUSES` below is what the rate counts, and remote is in
// it. Working from home is work.
const REMOTE = 'remote';
// The three approved-absence statuses, also written by an admin's approval. Unlike
// `remote` these are **not work**, so they are not attended — see
// `EXEMPT_STATUSES` below for what they do to the arithmetic instead.
const VACATION = 'vacation';
const RELIGIOUS = 'religious';
const SICK = 'sick';
const ATTENDANCE_STATUSES = [PRESENT, CANCELLED, REMOTE, VACATION, RELIGIOUS, SICK];

// The statuses that count as an attended day. Everything that computes a rate
// derives its numerator from these — never from `status === 'present'`, which
// would silently drop remote days out of every percentage in the app.
const ATTENDED_STATUSES = [PRESENT, REMOTE];

// The statuses that take the day out of the denominator entirely, the way a
// cohort-wide `NonWorkingDay` does — except these are one intern's day, not
// everyone's.
//
// A day off is neither attended nor missed. Counting it as attended would read a
// month of holiday as 100%; counting it as absent would punish leave an admin
// approved. So the day leaves the sum on both sides: nothing owed, nothing missed.
// `computeMonthStats` is the only place that acts on this.
const EXEMPT_STATUSES = [VACATION, RELIGIOUS, SICK];

// Every status an approved request can write. These rows carry a `request`
// back-pointer; a `present` row never does, because a check-in is the intern's own
// act and no request stands behind it.
const REQUESTED_STATUSES = [REMOTE, VACATION, RELIGIOUS, SICK];

const attendanceSchema = new mongoose.Schema(
  {
    intern: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
    },
    // Office-local calendar day as 'YYYY-MM-DD'. Stored as a string (not a Date)
    // so the day never drifts across the UTC midnight boundary.
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: PRESENT,
      required: true,
    },
    // The moment of check-in (the timestamp the UI surfaces). Left set even when
    // a day is later cancelled, as an audit trail of when they had checked in.
    checkedInAt: {
      type: Date,
      default: Date.now,
    },
    // Snapshot of the hub the intern checked in from, resolved from User.hub at
    // check-in time. Optional until the office-network step is wired.
    hub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hub',
      default: null,
    },
    // Source IP recorded at check-in, for the (deferred) office-network audit.
    checkInIp: {
      type: String,
      default: null,
    },
    // The approved request this row came from, for any status in
    // `REQUESTED_STATUSES`. Null on a `present` row: a check-in is the intern's own
    // act and no request stands behind it.
    //
    // It exists so revoking an approval can delete the row it created and nothing
    // else. Without the back-pointer, revoke would have to match on
    // { intern, date } and could destroy a genuine check-in that happened to land
    // on the same day.
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRequest',
      default: null,
    },
  },
  { timestamps: true }
);

// Enforces one record per intern per day: idempotent check-ins + one-way lock.
attendanceSchema.index({ intern: 1, date: 1 }, { unique: true });
// Serves the mentor/admin roster's range and per-day queries.
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.ATTENDANCE_STATUSES = ATTENDANCE_STATUSES;
module.exports.ATTENDED_STATUSES = ATTENDED_STATUSES;
module.exports.EXEMPT_STATUSES = EXEMPT_STATUSES;
module.exports.REQUESTED_STATUSES = REQUESTED_STATUSES;
module.exports.PRESENT = PRESENT;
module.exports.CANCELLED = CANCELLED;
module.exports.REMOTE = REMOTE;
module.exports.VACATION = VACATION;
module.exports.RELIGIOUS = RELIGIOUS;
module.exports.SICK = SICK;
