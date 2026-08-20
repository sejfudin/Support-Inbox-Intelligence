const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const {
  officeDateKey,
  officeDateLabel,
  officeMonthKey,
  isValidMonthKey,
  monthBounds,
  isOfficeWeekend,
  isWithinCheckInWindow,
  checkInWindowState,
  CHECK_IN_WINDOW,
  CHECK_IN_WINDOW_LABEL,
} = require('../helpers/attendanceTime');
const {
  splitRows,
  computeMonthStats,
  isExemptOn,
  loadNonWorkingDays,
  loadObservances,
} = require('../helpers/attendanceStats');
const { httpError } = require('../helpers/httpError');
const { isAssignedMentor } = require('../helpers/internAccess');
const { ROLES } = require('../constants/roles');
const { userSelect } = require('../constants/userSelect');

const { PRESENT, CANCELLED, REMOTE, VACATION, RELIGIOUS, SICK } = Attendance;

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

// The intern's own summary returns their full history (the calendar pages
// through months and the streak walks back across them, all client-side) plus a
// server-computed stat block for the CURRENT month (start-date-prorated).
//
// `placedAt` is sent so the client can grey out every day from it onward instead
// of drawing them as absences — the calendar pages through months client-side, so
// it needs the boundary, not just this month's totals.
const buildSummary = async (profile) => {
  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates, exemptDates, requestedDays } = splitRows(rows);
  const monthKey = officeMonthKey();
  const nonWorking = await loadNonWorkingDays();
  const observances = await loadObservances();
  return {
    records,
    cancelledDates,
    // Every day an approved request wrote, as date → status, so the calendar can
    // colour remote apart from vacation apart from sick.
    requestedDays,
    placedAt: profile.placedAt || null,
    // The calendar pages back through the intern's whole history client-side, so it
    // needs the start date too — without it every month before they joined renders
    // as a wall of absences for days they could not have attended.
    startDate: profile.startDate || null,
    nonWorkingDays: nonWorking.list,
    observances,
    month: {
      key: monthKey,
      ...computeMonthStats(
        records,
        monthKey,
        profile.startDate,
        profile.placedAt,
        nonWorking.keys,
        exemptDates
      ),
    },
  };
};

/**
 * Every reason a check-in can be refused answers with 422 and a sentence the
 * intern can act on — see the ordering in `checkIn` for why they are asked in the
 * order they are. 422 rather than 409 or 403 throughout: the request is
 * well-formed and the caller is who they say they are, the *day* is simply not one
 * they can claim. The client turns any 422 from this route into a "you can't check
 * in today, here is why" toast rather than a red failure.
 */
const refuse = (message) => httpError(message, 422);

/**
 * An intern who has started on a real project is no longer obliged to record
 * attendance, so check-in is refused rather than merely uncounted. Without this the
 * exemption would be cosmetic: they could still create rows that the rate ignores.
 */
const assertNotPlaced = (profile, now) => {
  if (isExemptOn(profile.placedAt, officeDateKey(now))) {
    throw refuse('You are on a project, so you no longer need to record attendance.');
  }
};

/**
 * Nobody can attend before their first day. `computeMonthStats` already clamps the
 * denominator to `startDate`, so a row written before it counts for nothing — this
 * says so instead of accepting a click that silently does nothing.
 *
 * Only guards a start date that is actually set: profiles imported without one owe
 * attendance from their first record, and refusing them would lock check-in for
 * good.
 */
const assertStarted = (profile, dateKey) => {
  if (!profile.startDate) return;
  const startKey = officeDateKey(profile.startDate);
  if (dateKey >= startKey) return;
  throw refuse(
    `Your internship starts on ${officeDateLabel(profile.startDate)} — check-in opens on your first day.`
  );
};

/**
 * A day the whole cohort was excused: a public holiday, a programme break, a
 * remote week (`models/NonWorkingDay.js`).
 *
 * Refused rather than allowed-but-ignored, because allowed-but-ignored is exactly
 * what it used to be: `computeMonthStats` drops a check-in on an excluded day from
 * the numerator as well as the denominator, so the intern got a green "checked in"
 * for a row that counted for nothing.
 */
const assertNotCohortDayOff = async (dateKey) => {
  const { list } = await loadNonWorkingDays();
  const day = list.find((entry) => entry.date === dateKey);
  if (!day) return;
  const label = day.label || 'Today';
  throw refuse(
    day.kind === 'remote'
      ? `${label} — the whole programme is remote today, so there is no office check-in to record.`
      : `${label} is a non-working day for the whole programme, so no check-in is needed. It is not counted as an absence.`
  );
};

const assertCheckInOpen = (now) => {
  if (isOfficeWeekend(now)) {
    throw refuse("It's the weekend — check-in is only available on weekdays.");
  }
  if (!isWithinCheckInWindow(now)) {
    const opensAt = `${String(CHECK_IN_WINDOW.startHour).padStart(2, '0')}:00`;
    const message =
      checkInWindowState(now) === 'before'
        ? `Check-in opens at ${opensAt} office time.`
        : `Check-in is closed for today. The window is ${CHECK_IN_WINDOW_LABEL} office time.`;
    throw refuse(message);
  }
};

/**
 * What to say when today already carries a status an approval wrote.
 *
 * These are not failures and they are not the intern's mistake — an admin agreed
 * the day, and the day is already accounted for. Each one says both halves the
 * intern needs: why the button did nothing, and that the day is not being held
 * against them. Remote is the odd one out: it IS work and it already counts, so it
 * says that rather than reassuring them about an absence they are not having.
 */
const APPROVED_DAY_REFUSAL = {
  [REMOTE]:
    'Today is an approved remote-work day. It already counts as attended — there is no office check-in to add.',
  [VACATION]:
    'You are on approved vacation today, so there is nothing to check in for. The day is not counted as an absence.',
  [RELIGIOUS]:
    'Today is your approved religious holiday, so there is nothing to check in for. The day is not counted as an absence.',
  [SICK]:
    'You are on approved sick leave today, so there is nothing to check in for. The day is not counted as an absence.',
};

/**
 * Flipping such a row to `present` would look harmless and would quietly orphan
 * the approval — the row's `request` back-pointer is what a revoke matches on — so
 * the answer is a refusal, not a write. An intern who believes the approval is
 * wrong asks an admin to revoke it; that is not a thing a check-in button undoes.
 */
const approvedDayRefusal = (status) =>
  refuse(
    APPROVED_DAY_REFUSAL[status] ||
      'Today is already recorded as an approved day off, so there is nothing to check in for.'
  );

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
 *
 * **The guards run most-specific first, and that ordering is the feature.** Today's
 * stored row is read before the clock rules, so an intern on approved vacation who
 * clicks at 15:00 is told they are on vacation rather than that the window shut at
 * 11:00 — the second is true and useless. Same reason the cohort's day off is asked
 * about before the window: "Labour Day" answers the question, "check-in is closed"
 * only restates the button.
 *
 * Nothing above the write is a write, so the two read-only outcomes (already
 * checked in, or refused) are reached whatever the clock says.
 */
const checkIn = async (user, { ip } = {}) => {
  const profile = await loadMyProfile(user);
  const now = new Date();
  const date = officeDateKey(now);

  assertNotPlaced(profile, now);
  assertStarted(profile, date);

  const existing = await Attendance.findOne({ intern: profile._id, date });
  // Already present → leave it exactly as it is, and report success: a second click
  // is not an error, and re-stamping would move `checkedInAt` off the real arrival.
  if (existing && existing.status === PRESENT) return buildSummary(profile);
  // Any request-written status (remote, vacation, religious, sick) is refused with
  // the reason attached — see `approvedDayRefusal`.
  if (existing && existing.status !== CANCELLED) throw approvedDayRefusal(existing.status);

  await assertNotCohortDayOff(date);
  assertCheckInOpen(now);

  // Cancelled earlier today → a genuine new check-in, so re-stamp the same row
  // rather than inserting a second one against the unique { intern, date } index.
  if (existing) {
    await markPresent(existing, { now, user, ip });
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
    avatarUrl: user.avatarUrl || null,
    hub: user.hub?.name || '',
  };
};

const buildRosterEntry = (profile, rows, monthKey, nonWorkingKeys) => {
  const { records, cancelledDates, exemptDates, requestedDays, lastCheckIn } = splitRows(rows);
  return {
    intern: toInternSummary(profile),
    records,
    cancelledDates,
    requestedDays,
    placedAt: profile.placedAt || null,
    startDate: profile.startDate || null,
    ...computeMonthStats(
      records,
      monthKey,
      profile.startDate,
      profile.placedAt,
      nonWorkingKeys,
      exemptDates
    ),
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
      select: userSelect('hub'),
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
  const observances = await loadObservances();
  const roster = profiles.map((p) =>
    buildRosterEntry(p, byIntern.get(p._id.toString()) || [], monthKey, nonWorking.keys)
  );
  return { month: monthKey, roster, nonWorkingDays: nonWorking.list, observances };
};

/**
 * One intern's full attendance history, for the admin calendar modal on the
 * roster and the mentor-facing Attendance tab. Admin reads any intern; a mentor
 * reads only their own (enforced below). Returns full records + cancelledDates (the calendar pages through
 * months client-side) plus a stat block for `month` (defaults to the current
 * office month — the roster passes the month it is currently showing), with the
 * intern's identity attached.
 */
const getInternAttendance = async (actor, internProfileId, month) => {
  let profile;
  try {
    profile = await InternProfile.findById(internProfileId)
      .populate({
        path: 'user',
        select: userSelect('hub'),
        populate: { path: 'hub', select: 'name' },
      })
      .lean();
  } catch (err) {
    if (err.name === 'CastError') throw httpError('Intern not found.', 404);
    throw err;
  }
  if (!profile || !profile.user) throw httpError('Intern not found.', 404);

  // Admin reads any intern; a mentor reads only theirs — the roster stays
  // admin-only, but this per-intern route also serves the mentor-facing
  // Attendance tab, and that tab must not leak another mentor's intern.
  if (actor.role !== ROLES.ADMIN && !isAssignedMentor(profile, actor._id)) {
    throw httpError("Not authorized to view this intern's attendance.", 403);
  }

  const rows = await Attendance.find({ intern: profile._id }).sort({ date: 1 }).lean();
  const { records, cancelledDates, exemptDates, requestedDays } = splitRows(rows);
  const monthKey = isValidMonthKey(month) ? month : officeMonthKey();
  const nonWorking = await loadNonWorkingDays();
  const observances = await loadObservances();
  return {
    intern: toInternSummary(profile),
    records,
    cancelledDates,
    requestedDays,
    placedAt: profile.placedAt || null,
    startDate: profile.startDate || null,
    nonWorkingDays: nonWorking.list,
    observances,
    month: {
      key: monthKey,
      ...computeMonthStats(
        records,
        monthKey,
        profile.startDate,
        profile.placedAt,
        nonWorking.keys,
        exemptDates
      ),
    },
  };
};

module.exports = {
  getMyAttendance,
  checkIn,
  cancelCheckIn,
  getRoster,
  getInternAttendance,
  // Exported for remoteWorkService, which anchors requests on the same profile
  // this module does. One-directional: nothing here reaches back into it.
  loadMyProfile,
};
