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
  countWorkingDays,
  CHECK_IN_WINDOW,
  CHECK_IN_WINDOW_LABEL,
} = require('../helpers/attendanceTime');

const { PRESENT, CANCELLED } = Attendance;
const { READY_STATUS } = InternProfile;

// Which interns appear on the admin roster. Attendance is only meaningful for
// interns currently in the programme, so terminal states (placed/completed/
// discontinued) are excluded. Widen this if past interns should show up.
const ROSTER_STATUSES = ['active', READY_STATUS];

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const loadMyProfile = async (user) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) {
    throw httpError(404, 'No intern profile is linked to your account.');
  }
  return profile;
};

/**
 * Attendance stats for a single calendar month. Working days (Mon–Fri) are
 * counted within the month, clamped to `[max(monthStart, startDate), min(monthEnd,
 * today)]` — so a mid-month joiner isn't penalised for days before they started,
 * and the current month only counts elapsed days. Always computed from raw
 * records, never stored, so it can't go stale.
 * `records` may be the full history or already month-scoped — the date clamp
 * makes both correct.
 */
const computeMonthStats = (records, monthKey, startDate) => {
  const { start, end } = monthBounds(monthKey);
  const todayKey = officeDateKey();
  const startKey = startDate ? officeDateKey(startDate) : null;
  const rangeStart = startKey && startKey > start ? startKey : start;
  const rangeEnd = todayKey < end ? todayKey : end;
  const workingDays = rangeStart <= rangeEnd ? countWorkingDays(rangeStart, rangeEnd) : 0;
  const presentDays = records.filter((r) => r.date >= rangeStart && r.date <= rangeEnd).length;
  const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  return { presentDays, workingDays, attendanceRate };
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
const buildSummary = async (profile) => {
  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates } = splitRows(rows);
  const monthKey = officeMonthKey();
  return {
    records,
    cancelledDates,
    month: { key: monthKey, ...computeMonthStats(records, monthKey, profile.startDate) },
  };
};

const assertCheckInOpen = (now) => {
  if (isOfficeWeekend(now)) {
    throw httpError(422, 'Check-in is only available on weekdays.');
  }
  if (!isWithinCheckInWindow(now)) {
    const opensAt = `${String(CHECK_IN_WINDOW.startHour).padStart(2, '0')}:00`;
    const message =
      checkInWindowState(now) === 'before'
        ? `Check-in opens at ${opensAt}.`
        : `Check-in is closed for today. The window is ${CHECK_IN_WINDOW_LABEL} office time.`;
    throw httpError(422, message);
  }
};

const LOCKED_MESSAGE = 'You cancelled today’s check-in earlier — the day is locked.';

const getMyAttendance = async (user) => {
  const profile = await loadMyProfile(user);
  return buildSummary(profile);
};

/**
 * Record today's check-in for the signed-in intern. Idempotent per day (a second
 * click returns the same summary), and blocked if the day was already cancelled.
 * The office-network (IP) check is a later, optional guard — see attendanceTime.
 */
const checkIn = async (user, { ip } = {}) => {
  const profile = await loadMyProfile(user);
  const now = new Date();
  assertCheckInOpen(now);

  const date = officeDateKey(now);
  const existing = await Attendance.findOne({ intern: profile._id, date });
  if (existing) {
    if (existing.status === CANCELLED) throw httpError(409, LOCKED_MESSAGE);
    return buildSummary(profile); // already checked in → idempotent
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
    // second insert. Re-read to decide idempotent-success vs locked.
    if (err.code !== 11000) throw err;
    const raced = await Attendance.findOne({ intern: profile._id, date });
    if (raced && raced.status === CANCELLED) throw httpError(409, LOCKED_MESSAGE);
  }

  return buildSummary(profile);
};

/**
 * Cancel today's check-in. One-way: the record is marked cancelled (not deleted),
 * which locks the day as absent — no re-check-in — via the unique index.
 */
const cancelCheckIn = async (user) => {
  const profile = await loadMyProfile(user);
  const date = officeDateKey();
  const existing = await Attendance.findOne({ intern: profile._id, date });
  if (!existing) {
    throw httpError(409, 'You have not checked in today, so there is nothing to cancel.');
  }
  if (existing.status === PRESENT) {
    existing.status = CANCELLED;
    await existing.save();
  }
  return buildSummary(profile); // already cancelled → idempotent
};

const buildRosterEntry = (profile, rows, monthKey) => {
  const { records, cancelledDates, lastCheckIn } = splitRows(rows);
  const user = profile.user || {};
  return {
    intern: {
      id: profile._id,
      fullname: user.fullname || '',
      email: user.email || '',
      hub: user.hub?.name || '', // must be a string — the table sorts on it
    },
    records,
    cancelledDates,
    ...computeMonthStats(records, monthKey, profile.startDate),
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

  const filter = { status: { $in: ROSTER_STATUSES } };

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

  const roster = profiles.map((p) =>
    buildRosterEntry(p, byIntern.get(p._id.toString()) || [], monthKey)
  );
  return { month: monthKey, roster };
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
    if (err.name === 'CastError') throw httpError(404, 'Intern not found.');
    throw err;
  }
  if (!profile || !profile.user) throw httpError(404, 'Intern not found.');

  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates } = splitRows(rows);
  const monthKey = isValidMonthKey(month) ? month : officeMonthKey();
  const user = profile.user;
  return {
    intern: {
      id: profile._id,
      fullname: user.fullname || '',
      email: user.email || '',
      hub: user.hub?.name || '',
    },
    records,
    cancelledDates,
    month: { key: monthKey, ...computeMonthStats(records, monthKey, profile.startDate) },
  };
};

module.exports = {
  getMyAttendance,
  checkIn,
  cancelCheckIn,
  getRoster,
  getInternAttendance,
};
