/**
 * Pure helpers for the Attendance feature: day-status classification, calendar
 * grid construction, and attendance-rate tone. No React, no data fetching.
 */

// `isToday` / `isAfter` / `startOfDay` are deliberately absent: they answer in the
// browser's timezone, and every day comparison in this file has to answer in the
// office's. Use `isOfficeToday` / `officeDateKey` below instead.
import {
  format,
  isWeekend,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInCalendarDays,
  getDay,
} from 'date-fns';

export const DAY_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  WEEKEND: 'weekend',
  FUTURE: 'future',
  TODAY_PENDING: 'today-pending', // a working today with no check-in yet
  // An approved remote-work day. Counts exactly like PRESENT in every rate — the
  // server puts it in `records` alongside real check-ins — and exists as a status
  // of its own purely so the day can be coloured and named "remote work" instead
  // of green and "Present".
  REMOTE: 'remote',
  // The three approved-absence days. Unlike REMOTE these are **not work**: the
  // server keeps them out of `records` entirely and subtracts them from the
  // denominator, so a week of leave reads as nothing owed and nothing missed
  // rather than as a week of absences or a fabricated 100%.
  //
  // They are three statuses rather than one because the intern asked for a
  // specific thing and the calendar should say which — but everything downstream
  // treats them identically, which is what `LEAVE_STATUSES` below is for.
  VACATION: 'vacation',
  RELIGIOUS: 'religious',
  SICK: 'sick',
  // On or after the intern's first day on a real project: they are no longer
  // obliged to record attendance, so the day is inert and greyed out like a
  // weekend — never an absence.
  EXEMPT: 'exempt',
  // A weekday nobody was expected to attend: public holiday, programme break,
  // remote week. Greyed out like a weekend, and never an absence. Comes from the
  // server's NonWorkingDay collection, not derived here.
  NON_WORKING: 'non-working',
  // Before the intern joined the programme. The calendar pages back through the
  // whole year, so without this every month before `startDate` renders as a wall of
  // absences for days the intern could not possibly have attended.
  BEFORE_START: 'before-start',
});

/**
 * The approved-absence statuses, in the order the legend lists them.
 *
 * Anything that asks "was this day owed?" should test against this rather than
 * naming the three individually — that is how a fourth kind of leave gets added
 * without a hunt through the render surfaces.
 */
export const LEAVE_STATUSES = Object.freeze([
  DAY_STATUS.VACATION,
  DAY_STATUS.RELIGIOUS,
  DAY_STATUS.SICK,
]);

const LEAVE_SET = new Set(LEAVE_STATUSES);

/** Whether a classified day is approved leave, and so was never owed. */
export const isLeaveStatus = (status) => LEAVE_SET.has(status);

// The `Attendance.status` values the server sends in `requestedDays` map onto
// DAY_STATUS one-for-one; keeping the map explicit means an unknown status from a
// newer server renders as an ordinary day rather than as `undefined`.
const REQUESTED_STATUS_TO_DAY = Object.freeze({
  remote: DAY_STATUS.REMOTE,
  vacation: DAY_STATUS.VACATION,
  religious: DAY_STATUS.RELIGIOUS,
  sick: DAY_STATUS.SICK,
});

// Check-in is an office-time concept: the server keys every Attendance record with
// `officeDateKey` (Europe/Sarajevo, see server/helpers/attendanceTime.js). Day
// identity here has to agree with that, or a viewer in another timezone gets the
// wrong cell highlighted as "today" and a denominator off by one — at 22:00 in
// UTC-5 it is already tomorrow in Sarajevo.
const OFFICE_TIMEZONE = 'Europe/Sarajevo';

/**
 * A calendar day is represented as a LOCAL date at noon, anchored on the office
 * calendar. Local-noon rather than local-midnight so adding days can never slip
 * across a DST boundary, and local rather than an office-time instant so
 * date-fns's local `format`/`getDay`/`isWeekend` all read the intended day.
 */
const toKey = (date) => format(date, 'yyyy-MM-dd');

/**
 * The inverse of `toKey`: a 'yyyy-MM-dd' key back to a local date at **noon**.
 *
 * Noon, not midnight, and local rather than `parseISO` — `parseISO('2026-08-13')`
 * yields UTC midnight, which is the previous day for anyone west of Greenwich, so a
 * request for Thursday would render as Wednesday for them. Only ever used for
 * display; comparisons stay on the string keys.
 */
const parseKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/**
 * 'yyyy-MM-dd' for `date` in office time — the same key the server stores.
 *
 * Exported because anything that has to agree with an office *calendar day* needs
 * it, not just this file: the attendance cutover notice, for one, must flip on the
 * office's 10 August rather than the viewer's.
 */
export const officeDateKey = (date = new Date()) =>
  // en-CA gives ISO order (YYYY-MM-DD) directly, no part juggling.
  new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/** Today's office calendar day, as a local-noon Date. */
const officeToday = (now = new Date()) => {
  const [year, month, day] = officeDateKey(now).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

/**
 * Whether it is the weekend on the office calendar.
 *
 * The dashboard strip is Mon–Fri, so "is today a weekend?" can no longer be read
 * off a cell in it — and the hero still has to say "Weekend — no check-in needed"
 * rather than counting Saturday as a missed day.
 */
export const isOfficeWeekend = (now = new Date()) => isWeekend(officeToday(now));

/** Whether `date` is the office calendar's today. */
const isOfficeToday = (date, now = new Date()) => toKey(date) === officeDateKey(now);

/**
 * 'yyyy-MM-dd' from which the intern is exempt from recording attendance, or null.
 *
 * Mirrors `InternProfile.placedAt` and is **inclusive-from** — the day itself is
 * already exempt, matching the server's `isExemptOn`. Read in office time so the
 * boundary flips on Sarajevo's calendar day, not the viewer's.
 */
export const exemptFromKey = (placedAt) => (placedAt ? officeDateKey(new Date(placedAt)) : null);

/**
 * Whether the intern owes no attendance *as of today* — actually on the project,
 * not merely booked onto one.
 *
 * A `placedAt` in the future is deliberately NOT exempt. Placements are routinely
 * recorded days or weeks before the start date, and until that day arrives the
 * intern is still on the programme: the server keeps counting them in the
 * denominator, so any surface that says "not required" has to wait for the same
 * day the maths does. Reading `Boolean(placedAt)` instead is the easy mistake.
 */
export const isExemptToday = (placedAt, now = new Date()) => {
  const exemptFrom = exemptFromKey(placedAt);
  return Boolean(exemptFrom) && officeDateKey(now) >= exemptFrom;
};

/**
 * Whether today falls before the intern's first day in the programme.
 *
 * The mirror of `assertStarted` in `server/services/attendanceService.js`: the
 * server refuses a check-in with a 422 until the start date arrives, so every
 * surface that offers the button has to withdraw it on the same days. Read in
 * office time, so the boundary flips on Sarajevo's calendar day.
 */
export const isBeforeStartToday = (startDate, now = new Date()) => {
  if (!startDate) return false;
  return officeDateKey(now) < officeDateKey(new Date(startDate));
};

const EMPTY_KEYS = new Set();
const EMPTY_REQUESTED = Object.freeze({});

/** `[{date,label}]` from the API → a Set of keys for the classifiers. */
export const nonWorkingKeySet = (nonWorkingDays = []) =>
  new Set(nonWorkingDays.map((d) => (typeof d === 'string' ? d : d.date)));

/** Why a day is non-working ("Labour Day"), for the tooltip. */
export const nonWorkingLabel = (nonWorkingDays = [], key) =>
  nonWorkingDays.find((d) => (typeof d === 'string' ? d : d.date) === key)?.label || '';

/**
 * Which sort of non-working day this is — 'holiday' | 'break' | 'remote'.
 *
 * Presentation only: every kind is already out of the denominator by the time
 * anything asks. It exists so a remote week can be coloured apart from a public
 * holiday. Anything unrecognised (a plain string key, a row written before `kind`)
 * reads as 'holiday', which is the conservative default — a day is only special-
 * cased when it says so.
 */
export const nonWorkingKind = (nonWorkingDays = [], key) => {
  const day = nonWorkingDays.find((d) => (typeof d === 'string' ? d : d.date) === key);
  return (typeof day === 'string' ? null : day?.kind) || 'holiday';
};

/**
 * Classify a single calendar day.
 * @param {Date} date
 * @param {Set<string>} presentKeys - 'yyyy-MM-dd' the intern checked in
 * @param {Set<string>} [cancelledKeys] - 'yyyy-MM-dd' the intern cancelled
 * @param {Date} [now]
 * @param {string|Date|null} [placedAt] - first day on a real project; from here the
 *   intern owes nothing, so every day reads EXEMPT
 * @param {Set<string>} [nonWorkingKeys] - 'yyyy-MM-dd' nobody was expected to attend
 * @param {string|Date|null} [startDate] - the intern's first day in the programme;
 *   anything before it was never owed
 * @param {Record<string,string>} [requestedDays] - 'yyyy-MM-dd' → the
 *   `Attendance.status` an approved request wrote (remote | vacation | religious |
 *   sick). One map rather than a Set per type, so adding a type is a row in
 *   `REQUESTED_STATUS_TO_DAY` and nothing else.
 */
export const classifyDay = (
  date,
  presentKeys,
  cancelledKeys = new Set(),
  now = new Date(),
  placedAt = null,
  nonWorkingKeys = EMPTY_KEYS,
  startDate = null,
  requestedDays = EMPTY_REQUESTED
) => {
  const key = toKey(date);
  // Checked ahead of everything else, including PRESENT: once an intern is on a
  // project the whole rest of the calendar is greyed out, so a stray check-in after
  // that date cannot make the day read as counted attendance.
  const exemptFrom = exemptFromKey(placedAt);
  if (exemptFrom && key >= exemptFrom) return DAY_STATUS.EXEMPT;
  // Also ahead of PRESENT: the day was not owed, so a check-in on it is not
  // attendance that counts — the server drops it from the rate for the same reason.
  if (nonWorkingKeys.has(key)) return DAY_STATUS.NON_WORKING;
  // Above PRESENT because a remote day is in `records` too — the server keeps it
  // there so the rate counts it — and whichever of the two is checked first is the
  // one the cell shows. The three leave statuses are not in `records` at all, so
  // for them this rung is the only one that can fire.
  //
  // Below NON_WORKING because a cohort holiday outranks all four: that day was owed
  // by nobody, so it is not remote work and not leave, it is no work. The request
  // rules refuse such a day up front, so this only catches a holiday declared after
  // the approval.
  const requested = REQUESTED_STATUS_TO_DAY[requestedDays[key]];
  if (requested) return requested;
  // After PRESENT would hide a genuine record; before ABSENT is the whole point.
  // A record cannot legitimately predate `startDate` (the importer pulls the start
  // back to the first attended day), so this ordering loses nothing.
  if (presentKeys.has(key)) return DAY_STATUS.PRESENT;
  const startKey = startDate ? officeDateKey(new Date(startDate)) : null;
  if (startKey && key < startKey) return DAY_STATUS.BEFORE_START;
  if (isWeekend(date)) return DAY_STATUS.WEEKEND;
  // Cancelled today while the window is still open (or not yet open) can be
  // re-checked-in — treat as pending, not locked absent.
  if (cancelledKeys.has(key)) {
    if (isOfficeToday(date, now) && checkInWindowState(now) !== 'closed') {
      return DAY_STATUS.TODAY_PENDING;
    }
    return DAY_STATUS.ABSENT;
  }
  if (isOfficeToday(date, now)) {
    // Once the check-in window closes, a no-show today is absent, not pending.
    return checkInWindowState(now) === 'closed' ? DAY_STATUS.ABSENT : DAY_STATUS.TODAY_PENDING;
  }
  // Compared as office calendar keys, so a day is "future" only once it is future
  // in Sarajevo — string comparison is safe on 'yyyy-MM-dd'.
  if (toKey(date) > officeDateKey(now)) return DAY_STATUS.FUTURE;
  return DAY_STATUS.ABSENT;
};

/**
 * Build a Monday-first calendar grid for the given month, with leading/trailing
 * blanks so each row is a full 7-day week.
 * @param {Date} monthDate - any date within the target month
 * @param {Array<{date: string}>} records - check-in records
 * @returns {{ weeks: Array<Array<{date: Date|null, status: string}|null>>, monthLabel: string }}
 */
export const buildMonthGrid = (
  monthDate,
  records = [],
  cancelledDates = [],
  placedAt = null,
  nonWorkingKeys = EMPTY_KEYS,
  startDate = null,
  requestedDays = EMPTY_REQUESTED
) => {
  const presentKeys = new Set(records.map((r) => r.date));
  const cancelledKeys = new Set(cancelledDates);
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });

  // date-fns getDay: 0=Sun..6=Sat. Convert to Monday-first index 0=Mon..6=Sun.
  const leadingBlanks = (getDay(start) + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  days.forEach((date) =>
    cells.push({
      date,
      status: classifyDay(
        date,
        presentKeys,
        cancelledKeys,
        new Date(),
        placedAt,
        nonWorkingKeys,
        startDate,
        requestedDays
      ),
    })
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { weeks, monthLabel: format(monthDate, 'MMMM yyyy') };
};

/**
 * Current consecutive-present-working-day streak ending at the most recent
 * working day (skips weekends). Counts back from today.
 */
export const computeStreak = (records = [], placedAt = null) => {
  const presentKeys = new Set(records.map((r) => r.date));
  let streak = 0;
  // A placed intern's streak is historical: count back from their last owed day,
  // not from today, or the exempt stretch since placement reads as a broken streak.
  const exemptFrom = exemptFromKey(placedAt);
  const cursor = officeToday();
  if (exemptFrom && toKey(cursor) >= exemptFrom) {
    const [y, m, d] = exemptFrom.split('-').map(Number);
    cursor.setFullYear(y, m - 1, d);
    cursor.setDate(cursor.getDate() - 1); // last owed day
  }
  for (let i = 0; i < 400; i += 1) {
    const day = new Date(cursor);
    day.setDate(day.getDate() - i);
    if (isWeekend(day)) continue;
    if (isOfficeToday(day) && !presentKeys.has(toKey(day))) continue; // today not yet in — don't break streak
    if (presentKeys.has(toKey(day))) streak += 1;
    else break;
  }
  return streak;
};

/**
 * This week's **working** days Mon–Fri, classified, for the dashboard hero's strip.
 *
 * Five cells, not seven. The weekend is not a state of the intern's week — nobody
 * is expected in, nothing is owed, and the two inert cells only took a seventh of
 * the strip each away from the days that carry a verdict. Anything that needs to
 * know whether *today* is a weekend asks `isOfficeWeekend` rather than looking for
 * a cell that is no longer there.
 */
export const buildWeekStrip = (
  records = [],
  cancelledDates = [],
  now = new Date(),
  placedAt = null,
  nonWorkingKeys = EMPTY_KEYS,
  startDate = null,
  requestedDays = EMPTY_REQUESTED
) => {
  const presentKeys = new Set(records.map((r) => r.date));
  const cancelledKeys = new Set(cancelledDates);
  // Anchored on the office calendar's today, not the browser's, so the strip shows
  // the week Sarajevo is in and its keys match the stored records.
  const monday = officeToday(now);
  // date-fns getDay: 0=Sun..6=Sat → walk back to Monday.
  monday.setDate(monday.getDate() - ((getDay(monday) + 6) % 7));

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: toKey(date),
      label: format(date, 'EEEEE'), // single letter: M T W T F
      isToday: isOfficeToday(date, now),
      status: classifyDay(
        date,
        presentKeys,
        cancelledKeys,
        now,
        placedAt,
        nonWorkingKeys,
        startDate,
        requestedDays
      ),
    };
  });
};

/**
 * Present vs elapsed working days across any strip of classified days — the
 * hero's "4 of 5 days in" line for a week, and the per-month rate on the intern
 * profile's six-month heatmap. Future days are excluded from the denominator so a
 * Monday morning doesn't read as "1 of 5" and look like a bad week.
 *
 * Strip-shaped rather than week-shaped on purpose: the INERT list below is what
 * makes a derived rate agree with the server's, so every rate computed on the
 * client has to come through here rather than re-deriving the rule.
 */
export const stripAttendance = (strip = []) => {
  // Exempt days are as inert as weekends — they were never owed, so they must not
  // enter the denominator. Approved leave joins them for exactly the same reason,
  // and this has to match the server: `computeMonthStats` subtracts those days from
  // the month's denominator, so a week showing "3 of 5" beside a month showing 100%
  // would be the two halves of the app disagreeing about the same fact.
  const INERT = [
    DAY_STATUS.WEEKEND,
    DAY_STATUS.EXEMPT,
    DAY_STATUS.NON_WORKING,
    DAY_STATUS.BEFORE_START,
    ...LEAVE_STATUSES,
  ];
  const working = strip.filter((day) => !INERT.includes(day.status));
  return {
    // Remote days count here for the same reason they count in the server's
    // numerator: the intern worked. A remote week that read "0 of 5 days in"
    // would contradict the 100% the same page shows.
    present: working.filter(
      (day) => day.status === DAY_STATUS.PRESENT || day.status === DAY_STATUS.REMOTE
    ).length,
    elapsed: working.filter((day) => day.status !== DAY_STATUS.FUTURE).length,
    workingDays: working.length,
  };
};

/**
 * A null rate means nothing was owed that month — a placed intern, or a month
 * before the intern started. It is NOT 0%: rendering it as a number would invent a
 * measurement, so every display path goes through these three helpers.
 */
export const hasAttendanceRate = (rate) => typeof rate === 'number';

/** '92%', or '—' when nothing was owed. */
export const formatAttendanceRate = (rate) => (hasAttendanceRate(rate) ? `${rate}%` : '—');

/** Badge variant for an attendance rate. */
export const attendanceRateTone = (rate) => {
  if (!hasAttendanceRate(rate)) return 'outline';
  if (rate >= 90) return 'success';
  if (rate >= 75) return 'default';
  if (rate >= 60) return 'warning';
  return 'destructive';
};

/** Tailwind text color class for an attendance rate (for non-badge contexts). */
export const attendanceRateTextClass = (rate) => {
  if (!hasAttendanceRate(rate)) return 'text-muted-foreground';
  if (rate >= 90) return 'text-[hsl(var(--tone-success-fg))]';
  if (rate >= 75) return 'text-foreground';
  if (rate >= 60) return 'text-[hsl(var(--tone-warning-fg))]';
  return 'text-[hsl(var(--tone-danger-fg))]';
};

/**
 * Bar fill for an attendance rate — the same four bands as
 * `attendanceRateTextClass`, so a bar and the number beside it can never
 * disagree about whether a month was good. (They used to: the roster table
 * carried its own copy of the thresholds.)
 */
export const attendanceRateFillClass = (rate) => {
  if (!hasAttendanceRate(rate)) return 'bg-muted-foreground/30';
  if (rate >= 90) return 'bg-[hsl(var(--tone-success))]';
  if (rate >= 75) return 'bg-foreground/70';
  if (rate >= 60) return 'bg-[hsl(var(--tone-warning))]';
  return 'bg-[hsl(var(--tone-danger))]';
};

export const todayRecord = (records = []) => {
  const key = officeDateKey();
  return records.find((r) => r.date === key) || null;
};

export const isCheckedInToday = (records = []) => Boolean(todayRecord(records));

/** Whether the intern cancelled today's check-in (may still re-check-in while open). */
export const isCancelledToday = (cancelledDates = []) => cancelledDates.includes(officeDateKey());

/**
 * The DAY_STATUS an approved request wrote for today, or null if none did.
 *
 * Returns a DAY_STATUS rather than the raw server status so callers can hand it
 * straight to `dayStatusLabel` / the visuals. The two vocabularies happen to use
 * identical strings, and `REQUESTED_STATUS_TO_DAY` is the one place that is allowed
 * to depend on it — a status a newer server invents reads as null here instead of
 * rendering as a bare word.
 *
 * Note that for `remote` — and only remote — `isCheckedInToday` is ALSO true, since
 * a remote day is in `records` so that it counts. So anywhere both are shown, check
 * this first or the day reports as an ordinary office check-in. The three leave
 * statuses never appear in `records`, so they cannot be mistaken for one.
 */
export const requestedStatusToday = (requestedDays = {}) =>
  REQUESTED_STATUS_TO_DAY[requestedDays[officeDateKey()]] || null;

/** Whether today is an approved day off (not remote, which is still work). */
export const isOnLeaveToday = (requestedDays = {}) =>
  isLeaveStatus(requestedStatusToday(requestedDays));

// Check-in is only open 07:00–11:00 office time (Europe/Sarajevo), regardless of
// where the browser is. This mirrors server/helpers/attendanceTime.js for UX only
// — the backend is the source of truth and enforces the same window server-side.
export const CHECK_IN_WINDOW = Object.freeze({ startHour: 7, endHour: 11 });
export const CHECK_IN_WINDOW_LABEL = '07:00–11:00';

/** Office-local hour (0–23) for `date`. */
const officeHour = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIMEZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  return Number(fmt.format(date));
};

/** Whether `now` falls within the daily check-in window (office time). */
export const isWithinCheckInWindow = (now = new Date()) => {
  const h = officeHour(now);
  return h >= CHECK_IN_WINDOW.startHour && h < CHECK_IN_WINDOW.endHour;
};

/** Window state relative to `now`, in office time: 'before' | 'open' | 'closed'. */
export const checkInWindowState = (now = new Date()) => {
  const h = officeHour(now);
  if (h < CHECK_IN_WINDOW.startHour) return 'before';
  if (h < CHECK_IN_WINDOW.endHour) return 'open';
  return 'closed';
};

/** Office-local minute (0–59) for `date`. */
const officeMinute = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: OFFICE_TIMEZONE, minute: '2-digit' });
  return Number(fmt.format(date));
};

/**
 * The daily-reminder window: 10:30 up to (but not including) 11:00 office time,
 * the last half hour before check-in closes. Mirrors `REMINDER_WINDOW` in
 * server/services/dailyReminderService.js — the server re-checks the clock
 * itself, so this is only here to keep the client from asking outside the window.
 */
export const REMINDER_WINDOW = Object.freeze({ hour: 10, fromMinute: 30 });

/** Whether `now` sits inside the daily-reminder window (weekday, office time). */
export const isWithinReminderWindow = (now = new Date()) => {
  if (isWeekend(now)) return false;
  if (officeHour(now) !== REMINDER_WINDOW.hour) return false;
  return officeMinute(now) >= REMINDER_WINDOW.fromMinute;
};

/**
 * Minutes until the check-in window's next boundary — until it opens while
 * 'before', until it closes while 'open', and `null` once it has closed, because
 * there is nothing left to count down to.
 *
 * Computed in office time, like everything else about the window: an intern
 * travelling with a laptop still on Sarajevo's clock should see Sarajevo's
 * countdown, not their browser's.
 */
export const checkInWindowMinutesLeft = (now = new Date()) => {
  const state = checkInWindowState(now);
  if (state === 'closed') return null;
  const boundaryHour = state === 'before' ? CHECK_IN_WINDOW.startHour : CHECK_IN_WINDOW.endHour;
  return boundaryHour * 60 - (officeHour(now) * 60 + officeMinute(now));
};

/**
 * "2h 14m" / "14m", or `null` when there is nothing to show.
 *
 * Null rather than "0m" at the boundary: a countdown that has run out is not a
 * countdown, and the caller drops the clause entirely instead of printing
 * "closes in 0m" for a minute.
 */
export const formatMinutesLeft = (minutes) => {
  if (minutes === null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
};

export const formatCheckInTime = (iso) => (iso ? format(new Date(iso), 'HH:mm') : '—');
export const formatCheckInDate = (iso) => (iso ? format(new Date(iso), 'MMM d, HH:mm') : '—');

/**
 * Status of one intern's attendance on a specific day, for the mentor's daily
 * view. Returns { status, checkInTime } where status is a DAY_STATUS value.
 * Weekends and future days are reported as such; a working past/today day with
 * no check-in (and not cancelled) is absent.
 * @param {{ records: Array<{date:string, checkedInAt?:string}>, cancelledDates?: string[] }} entry
 * @param {Date} date
 */
export const internStatusOnDate = (entry, date, nonWorkingKeys = EMPTY_KEYS) => {
  const presentKeys = new Set((entry.records || []).map((r) => r.date));
  const cancelledKeys = new Set(entry.cancelledDates || []);
  const status = classifyDay(
    date,
    presentKeys,
    cancelledKeys,
    new Date(),
    entry.placedAt || null,
    nonWorkingKeys,
    entry.startDate || null,
    entry.requestedDays || EMPTY_REQUESTED
  );
  const rec = (entry.records || []).find((r) => r.date === toKey(date));
  return { status, checkInTime: rec?.checkedInAt || null };
};

/**
 * The dates of one request, as a single line.
 *
 * A multi-day request renders as **first — last**, not as a list, with the count
 * carried separately in its own column. The days need not be consecutive, so the
 * range is a span rather than a promise about what is inside it: "20 Aug — 28 Aug"
 * beside "5 days" reads correctly for Thu/Fri then Mon–Wed, which listing seven
 * dates would not.
 *
 * The month is repeated on both sides deliberately. "16 — 20 Jun" saves four
 * characters and makes a reader check whether the range crosses a month boundary.
 */
export const formatRequestDates = (dates = []) => {
  const sorted = [...dates].filter(Boolean).sort();
  if (sorted.length === 0) return '—';
  const day = (key) => format(parseKey(key), 'd MMM');
  if (sorted.length === 1) return format(parseKey(sorted[0]), 'EEE, d MMM');
  return `${day(sorted[0])} — ${day(sorted[sorted.length - 1])}`;
};

/**
 * The dates of one request as runs: consecutive days collapse into a span, and
 * separate runs are listed side by side.
 *
 *   Mon–Fri            → "Mon, 20 Aug — Fri, 24 Aug"
 *   Mon and the next Mon → "Mon, 16 Aug · Mon, 23 Aug"
 *
 * The admin queue used to print every day of a week off, which pushed the row's
 * decision buttons off the line and made a five-day holiday look like five
 * separate asks. `formatRequestDates` above stays as it is: it answers a
 * different question — the outer span of a request in a fixed-width column.
 */
export const formatRequestDayRuns = (dates = []) => {
  const sorted = [...dates].filter(Boolean).sort();
  if (sorted.length === 0) return '—';

  const runs = [];
  for (const key of sorted) {
    const previous = runs[runs.length - 1];
    const isNextDay =
      previous && differenceInCalendarDays(parseKey(key), parseKey(previous.to)) === 1;
    if (isNextDay) previous.to = key;
    else runs.push({ from: key, to: key });
  }

  const label = (key) => format(parseKey(key), 'EEE, d MMM');
  return runs
    .map((run) => (run.from === run.to ? label(run.from) : `${label(run.from)} — ${label(run.to)}`))
    .join(' · ');
};

/**
 * Whether a request still concerns the intern *now* — pending, or approved with a
 * day that has not yet passed.
 *
 * This is what splits the "Time away" card from the history table below it: the
 * card is a short list of things still in play, and everything else is history. It
 * mirrors `isOutstanding` on the server, which decides the same question for the
 * day-claim rules.
 */
export const isRequestActive = (request, todayKey = officeDateKey()) => {
  if (!request) return false;
  if (request.status === 'pending') return true;
  if (request.status !== 'approved') return false;
  return (request.dates || []).some((date) => date >= todayKey);
};

export const dayStatusLabel = (status) =>
  ({
    [DAY_STATUS.PRESENT]: 'Present',
    [DAY_STATUS.ABSENT]: 'Absent',
    [DAY_STATUS.WEEKEND]: 'Weekend',
    [DAY_STATUS.FUTURE]: 'Upcoming',
    [DAY_STATUS.TODAY_PENDING]: 'Not yet',
    [DAY_STATUS.EXEMPT]: 'On project',
    [DAY_STATUS.NON_WORKING]: 'Non-working',
    [DAY_STATUS.BEFORE_START]: 'Before joining',
    [DAY_STATUS.REMOTE]: 'Remote work',
    [DAY_STATUS.VACATION]: 'Vacation',
    [DAY_STATUS.RELIGIOUS]: 'Religious holiday',
    // "Sick day", not "Sick", so this matches the server's own label for the type
    // (`constants/absenceRequestTypes.js`). The balance card reads its label from
    // the API and the history table reads it from here; when they disagreed, the
    // same request read as two different things on one screen.
    [DAY_STATUS.SICK]: 'Sick day',
  })[status] || status;

export const dayStatusBadgeVariant = (status) =>
  ({
    [DAY_STATUS.PRESENT]: 'success',
    [DAY_STATUS.ABSENT]: 'destructive',
    [DAY_STATUS.WEEKEND]: 'outline',
    [DAY_STATUS.FUTURE]: 'outline',
    [DAY_STATUS.TODAY_PENDING]: 'warning',
    [DAY_STATUS.EXEMPT]: 'outline',
    [DAY_STATUS.NON_WORKING]: 'outline',
    [DAY_STATUS.BEFORE_START]: 'outline',
    [DAY_STATUS.REMOTE]: 'info',
    // The three leave types share `outline` rather than each claiming a badge
    // variant. In a table the label already says which one it is, and three more
    // filled badges would make a roster of ordinary months look alarming.
    [DAY_STATUS.VACATION]: 'outline',
    [DAY_STATUS.RELIGIOUS]: 'outline',
    [DAY_STATUS.SICK]: 'outline',
  })[status] || 'secondary';
