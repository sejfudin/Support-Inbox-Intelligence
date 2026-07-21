const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const { ROLES } = require('../constants/roles');
const {
  officeDateKey,
  isOfficeWeekend,
  isWithinCheckInWindow,
  checkInWindowState,
  countWorkingDays,
  CHECK_IN_WINDOW_LABEL,
} = require('../helpers/attendanceTime');

const { PRESENT, CANCELLED } = Attendance;
const { READY_STATUS } = InternProfile;

// Which interns appear on the mentor/admin roster. Attendance is only meaningful
// for interns currently in the programme, so terminal states (placed/completed/
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
 * Attendance stats over the whole internship: working days (Mon–Fri) from the
 * intern's start date to today, and how many of those they were present for.
 * Always computed from raw records — never stored — so it can't go stale.
 */
const computeStats = (records, startDate) => {
  const todayKey = officeDateKey();
  const startKey = startDate ? officeDateKey(startDate) : null;
  const workingDays = startKey && startKey <= todayKey ? countWorkingDays(startKey, todayKey) : 0;
  const presentDays = records.filter(
    (r) => r.date <= todayKey && (!startKey || r.date >= startKey)
  ).length;
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

const buildSummary = async (profile) => {
  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates } = splitRows(rows);
  return { records, cancelledDates, ...computeStats(records, profile.startDate) };
};

const assertCheckInOpen = (now) => {
  if (isOfficeWeekend(now)) {
    throw httpError(422, 'Check-in is only available on weekdays.');
  }
  if (!isWithinCheckInWindow(now)) {
    const opensAt = CHECK_IN_WINDOW_LABEL.split('–')[0];
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

const buildRosterEntry = (profile, rows) => {
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
    ...computeStats(records, profile.startDate),
    lastCheckIn: lastCheckIn || null,
  };
};

/**
 * Read-only attendance roster for mentors/admins. Mentors are scoped to their
 * assigned interns (primary or secondary); admins see everyone — the same rule
 * the recommendations list uses. `search` (name/email) and `hub` (name) filter
 * the result.
 */
const getRoster = async (user, { search, hub } = {}) => {
  const filter = { status: { $in: ROSTER_STATUSES } };
  if (user.role === ROLES.MENTOR) {
    filter.$or = [{ primaryMentor: user._id }, { secondaryMentor: user._id }];
  }

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
    ? await Attendance.find({ intern: { $in: profileIds } })
        .sort({ date: 1 })
        .lean()
    : [];

  const byIntern = new Map();
  for (const row of rows) {
    const key = row.intern.toString();
    if (!byIntern.has(key)) byIntern.set(key, []);
    byIntern.get(key).push(row);
  }

  const roster = profiles.map((p) => buildRosterEntry(p, byIntern.get(p._id.toString()) || []));
  return { roster };
};

module.exports = {
  getMyAttendance,
  checkIn,
  cancelCheckIn,
  getRoster,
};
