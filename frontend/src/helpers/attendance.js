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
  getDay,
} from 'date-fns';

export const DAY_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  WEEKEND: 'weekend',
  FUTURE: 'future',
  TODAY_PENDING: 'today-pending', // a working today with no check-in yet
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

const EMPTY_KEYS = new Set();

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
 */
export const classifyDay = (
  date,
  presentKeys,
  cancelledKeys = new Set(),
  now = new Date(),
  placedAt = null,
  nonWorkingKeys = EMPTY_KEYS,
  startDate = null
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
  startDate = null
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
        startDate
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
 * This week's days Mon–Sun, classified, for the dashboard hero's strip.
 *
 * Always seven cells so the strip's columns line up with its M T W T F S S
 * labels — the weekend cells render as inert rather than being dropped, which
 * would shift Friday under the "S" heading.
 */
export const buildWeekStrip = (
  records = [],
  cancelledDates = [],
  now = new Date(),
  placedAt = null,
  nonWorkingKeys = EMPTY_KEYS,
  startDate = null
) => {
  const presentKeys = new Set(records.map((r) => r.date));
  const cancelledKeys = new Set(cancelledDates);
  // Anchored on the office calendar's today, not the browser's, so the strip shows
  // the week Sarajevo is in and its keys match the stored records.
  const monday = officeToday(now);
  // date-fns getDay: 0=Sun..6=Sat → walk back to Monday.
  monday.setDate(monday.getDate() - ((getDay(monday) + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: toKey(date),
      label: format(date, 'EEEEE'), // single letter: M T W T F S S
      isToday: isOfficeToday(date, now),
      status: classifyDay(
        date,
        presentKeys,
        cancelledKeys,
        now,
        placedAt,
        nonWorkingKeys,
        startDate
      ),
    };
  });
};

/**
 * Present vs elapsed working days within the current week — the hero's
 * "4 of 5 days in" line. Future days are excluded from the denominator so a
 * Monday morning doesn't read as "1 of 5" and look like a bad week.
 */
export const weekAttendance = (weekStrip = []) => {
  // Exempt days are as inert as weekends — they were never owed, so they must not
  // enter the denominator.
  const INERT = [
    DAY_STATUS.WEEKEND,
    DAY_STATUS.EXEMPT,
    DAY_STATUS.NON_WORKING,
    DAY_STATUS.BEFORE_START,
  ];
  const working = weekStrip.filter((day) => !INERT.includes(day.status));
  return {
    present: working.filter((day) => day.status === DAY_STATUS.PRESENT).length,
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
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 75) return 'text-foreground';
  if (rate >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

export const todayRecord = (records = []) => {
  const key = officeDateKey();
  return records.find((r) => r.date === key) || null;
};

export const isCheckedInToday = (records = []) => Boolean(todayRecord(records));

/** Whether the intern cancelled today's check-in (may still re-check-in while open). */
export const isCancelledToday = (cancelledDates = []) => cancelledDates.includes(officeDateKey());

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
    entry.startDate || null
  );
  const rec = (entry.records || []).find((r) => r.date === toKey(date));
  return { status, checkInTime: rec?.checkedInAt || null };
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
  })[status] || 'secondary';
