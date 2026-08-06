const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const {
  officeDateKey,
  officeMonthKey,
  isValidMonthKey,
  monthBounds,
  isOfficeWeekend,
  isWithinCheckInWindow,
  checkInWindowState,
  CHECK_IN_WINDOW,
  CHECK_IN_WINDOW_LABEL,
} = require('../helpers/attendanceTime');
const { computeMonthStats, isExemptOn, loadNonWorkingDays } = require('../helpers/attendanceStats');
const { httpError } = require('../helpers/httpError');

const { PRESENT, CANCELLED } = Attendance;

// Which interns appear on the admin roster. Attendance is only meaningful for
// interns currently in the programme, so terminal states (placed/completed/
// discontinued) are excluded. The list lives on the model because the admin
// dashboard counts the same set — widen it there, not here.
const { IN_PROGRAMME_STATUSES } = InternProfile;

const loadMyProfile = async (user) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) {
    throw httpError('No intern profile is linked to your account.', 404);
  }
  return profile;
};

// Split a set of raw attendance rows into the { records, cancelledDates } shape
// the frontend consumes, plus the latest check-in timestamp.
const splitRows = (rows) => {
  const records = [];
  const cancelledDates = [];
  let lastCheckIn = null;
  for (const row of rows) {
    if (row.status === CANCELLED) {
      cancelledDates.push(row.date);
    } else {
      records.push({ date: row.date, checkedInAt: row.checkedInAt });
      if (!lastCheckIn || row.checkedInAt > lastCheckIn) lastCheckIn = row.checkedInAt;
    }
  }
  return { records, cancelledDates, lastCheckIn };
};

// The intern's own summary returns their full history (the calendar pages
// through months and the streak walks back across them, all client-side) plus a
// server-computed stat block for the CURRENT month (start-date-prorated).
//
// `placedAt` is sent so the client can grey out every day from it onward instead
// of drawing them as absences — the calendar pages through months client-side, so
// it needs the boundary, not just this month's totals.
const buildSummary = async (profile) => {
  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates } = splitRows(rows);
  const monthKey = officeMonthKey();
  const nonWorking = await loadNonWorkingDays();
  return {
    records,
    cancelledDates,
    placedAt: profile.placedAt || null,
    // The calendar pages back through the intern's whole history client-side, so it
    // needs the start date too — without it every month before they joined renders
    // as a wall of absences for days they could not have attended.
    startDate: profile.startDate || null,
    nonWorkingDays: nonWorking.list,
    month: {
      key: monthKey,
      ...computeMonthStats(records, monthKey, profile.startDate, profile.placedAt, nonWorking.keys),
    },
  };
};

/**
 * An intern who has started on a real project is no longer obliged to record
 * attendance, so check-in is refused rather than merely uncounted. Without this the
 * exemption would be cosmetic: they could still create rows that the rate ignores.
 */
const assertNotPlaced = (profile, now) => {
  if (isExemptOn(profile.placedAt, officeDateKey(now))) {
    throw httpError('You are on a project, so you no longer need to record attendance.', 422);
  }
};

const assertCheckInOpen = (now) => {
  if (isOfficeWeekend(now)) {
    throw httpError('Check-in is only available on weekdays.', 422);
  }
  if (!isWithinCheckInWindow(now)) {
    const opensAt = `${String(CHECK_IN_WINDOW.startHour).padStart(2, '0')}:00`;
    const message =
      checkInWindowState(now) === 'before'
        ? `Check-in opens at ${opensAt}.`
        : `Check-in is closed for today. The window is ${CHECK_IN_WINDOW_LABEL} office time.`;
    throw httpError(message, 422);
  }
};

const getMyAttendance = async (user) => {
  const profile = await loadMyProfile(user);
  return buildSummary(profile);
};

// Turn an existing row into today's check-in. Used both for a fresh check-in
// after a cancel and for the concurrent-insert retry path.
const markPresent = async (row, { now, user, ip }) => {
  row.status = PRESENT;
  row.checkedInAt = now;
  row.hub = user.hub?._id || null;
  row.checkInIp = ip || null;
  await row.save();
};

/**
 * Record today's check-in for the signed-in intern. Idempotent per day (a second
 * click returns the same summary, keeping the original `checkedInAt`). A day the
 * intern cancelled earlier is re-opened, not blocked: cancelling only unchecks
 * the day, and re-checking-in is allowed for as long as the window is open —
 * `assertCheckInOpen` above is what closes the day for good.
 * The office-network (IP) check is a later, optional guard — see attendanceTime.
 */
const checkIn = async (user, { ip } = {}) => {
  const profile = await loadMyProfile(user);
  const now = new Date();
  assertNotPlaced(profile, now);
  assertCheckInOpen(now);

  const date = officeDateKey(now);
  const existing = await Attendance.findOne({ intern: profile._id, date });
  if (existing) {
    // Cancelled earlier today → this is a genuine new check-in, so re-stamp the
    // row. Already present → leave it exactly as it is (idempotent).
    if (existing.status === CANCELLED) await markPresent(existing, { now, user, ip });
    return buildSummary(profile);
  }

  try {
    await Attendance.create({
      intern: profile._id,
      date,
      status: PRESENT,
      checkedInAt: now,
      hub: user.hub?._id || null,
      checkInIp: ip || null,
    });
  } catch (err) {
    // Concurrent double-click: the unique { intern, date } index rejected the
    // second insert. Re-read — the winning row is already present (nothing to
    // do) unless a cancel landed in between, in which case check-in wins.
    if (err.code !== 11000) throw err;
    const raced = await Attendance.findOne({ intern: profile._id, date });
    if (raced && raced.status === CANCELLED) await markPresent(raced, { now, user, ip });
  }

  return buildSummary(profile);
};

/**
 * Cancel today's check-in: the record is marked cancelled (not deleted), which
 * unchecks the day. The intern may check in again while the window is open; once
 * it closes, a cancelled day stays cancelled and reads as absent.
 */
const cancelCheckIn = async (user) => {
  const profile = await loadMyProfile(user);
  const date = officeDateKey();
  const existing = await Attendance.findOne({ intern: profile._id, date });
  if (!existing) {
    throw httpError('You have not checked in today, so there is nothing to cancel.', 409);
  }
  if (existing.status === PRESENT) {
    existing.status = CANCELLED;
    await existing.save();
  }
  return buildSummary(profile); // already cancelled → idempotent
};

// Must be a plain string on `hub` — the roster table sorts on it.
const toInternSummary = (profile) => {
  const user = profile.user || {};
  return {
    id: profile._id,
    fullname: user.fullname || '',
    email: user.email || '',
    hub: user.hub?.name || '',
  };
};

const buildRosterEntry = (profile, rows, monthKey, nonWorkingKeys) => {
  const { records, cancelledDates, lastCheckIn } = splitRows(rows);
  return {
    intern: toInternSummary(profile),
    records,
    cancelledDates,
    placedAt: profile.placedAt || null,
    startDate: profile.startDate || null,
    ...computeMonthStats(records, monthKey, profile.startDate, profile.placedAt, nonWorkingKeys),
    lastCheckIn: lastCheckIn || null,
  };
};

/**
 * Read-only attendance roster (admin-only), scoped to a single calendar month
 * (`month` = 'YYYY-MM', defaults to the current office month). Only that month's
 * records are fetched and returned, so the payload stays bounded. `search`
 * (name/email) and `hub` (name) filter the result.
 */
const getRoster = async (_user, { month, search, hub } = {}) => {
  const monthKey = isValidMonthKey(month) ? month : officeMonthKey();
  const { start, end } = monthBounds(monthKey);

  const filter = { status: { $in: IN_PROGRAMME_STATUSES } };

  let profiles = await InternProfile.find(filter)
    .populate({
      path: 'user',
      select: 'fullname email hub',
      populate: { path: 'hub', select: 'name' },
    })
    .lean();

  profiles = profiles.filter((p) => p.user); // drop orphaned profiles

  if (search) {
    const q = search.toLowerCase();
    profiles = profiles.filter(
      (p) =>
        (p.user.fullname || '').toLowerCase().includes(q) ||
        (p.user.email || '').toLowerCase().includes(q)
    );
  }
  if (hub) {
    profiles = profiles.filter((p) => p.user.hub?.name === hub);
  }

  const profileIds = profiles.map((p) => p._id);
  const rows = profileIds.length
    ? await Attendance.find({ intern: { $in: profileIds }, date: { $gte: start, $lte: end } })
        .sort({ date: 1 })
        .lean()
    : [];

  const byIntern = new Map();
  for (const row of rows) {
    const key = row.intern.toString();
    if (!byIntern.has(key)) byIntern.set(key, []);
    byIntern.get(key).push(row);
  }

  const nonWorking = await loadNonWorkingDays();
  const roster = profiles.map((p) =>
    buildRosterEntry(p, byIntern.get(p._id.toString()) || [], monthKey, nonWorking.keys)
  );
  return { month: monthKey, roster, nonWorkingDays: nonWorking.list };
};

/**
 * One intern's full attendance history (admin-only), for the calendar modal on
 * the roster. Returns full records + cancelledDates (the calendar pages through
 * months client-side) plus a stat block for `month` (defaults to the current
 * office month — the roster passes the month it is currently showing), with the
 * intern's identity attached.
 */
const getInternAttendance = async (internProfileId, month) => {
  let profile;
  try {
    profile = await InternProfile.findById(internProfileId)
      .populate({
        path: 'user',
        select: 'fullname email hub',
        populate: { path: 'hub', select: 'name' },
      })
      .lean();
  } catch (err) {
    if (err.name === 'CastError') throw httpError('Intern not found.', 404);
    throw err;
  }
  if (!profile || !profile.user) throw httpError('Intern not found.', 404);

  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates } = splitRows(rows);
  const monthKey = isValidMonthKey(month) ? month : officeMonthKey();
  const nonWorking = await loadNonWorkingDays();
  return {
    intern: toInternSummary(profile),
    records,
    cancelledDates,
    placedAt: profile.placedAt || null,
    startDate: profile.startDate || null,
    nonWorkingDays: nonWorking.list,
    month: {
      key: monthKey,
      ...computeMonthStats(records, monthKey, profile.startDate, profile.placedAt, nonWorking.keys),
    },
  };
};

module.exports = {
  getMyAttendance,
  checkIn,
  cancelCheckIn,
  getRoster,
  getInternAttendance,
};
