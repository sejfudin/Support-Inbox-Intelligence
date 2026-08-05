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
 * Classify a single calendar day.
 * @param {Date} date
 * @param {Set<string>} presentKeys - 'yyyy-MM-dd' the intern checked in
 * @param {Set<string>} [cancelledKeys] - 'yyyy-MM-dd' the intern cancelled
 * @param {Date} [now]
 */
export const classifyDay = (date, presentKeys, cancelledKeys = new Set(), now = new Date()) => {
  const key = toKey(date);
  if (presentKeys.has(key)) return DAY_STATUS.PRESENT;
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
export const buildMonthGrid = (monthDate, records = [], cancelledDates = []) => {
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
    cells.push({ date, status: classifyDay(date, presentKeys, cancelledKeys) })
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
export const computeStreak = (records = []) => {
  const presentKeys = new Set(records.map((r) => r.date));
  let streak = 0;
  const cursor = officeToday();
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
export const buildWeekStrip = (records = [], cancelledDates = [], now = new Date()) => {
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
      status: classifyDay(date, presentKeys, cancelledKeys, now),
    };
  });
};

/**
 * Present vs elapsed working days within the current week — the hero's
 * "4 of 5 days in" line. Future days are excluded from the denominator so a
 * Monday morning doesn't read as "1 of 5" and look like a bad week.
 */
export const weekAttendance = (weekStrip = []) => {
  const working = weekStrip.filter((day) => day.status !== DAY_STATUS.WEEKEND);
  return {
    present: working.filter((day) => day.status === DAY_STATUS.PRESENT).length,
    elapsed: working.filter((day) => day.status !== DAY_STATUS.FUTURE).length,
    workingDays: working.length,
  };
};

/** Badge variant for an attendance rate. */
export const attendanceRateTone = (rate) => {
  if (rate >= 90) return 'success';
  if (rate >= 75) return 'default';
  if (rate >= 60) return 'warning';
  return 'destructive';
};

/** Tailwind text color class for an attendance rate (for non-badge contexts). */
export const attendanceRateTextClass = (rate) => {
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
export const internStatusOnDate = (entry, date) => {
  const presentKeys = new Set((entry.records || []).map((r) => r.date));
  const cancelledKeys = new Set(entry.cancelledDates || []);
  const status = classifyDay(date, presentKeys, cancelledKeys);
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
  })[status] || status;

export const dayStatusBadgeVariant = (status) =>
  ({
    [DAY_STATUS.PRESENT]: 'success',
    [DAY_STATUS.ABSENT]: 'destructive',
    [DAY_STATUS.WEEKEND]: 'outline',
    [DAY_STATUS.FUTURE]: 'outline',
    [DAY_STATUS.TODAY_PENDING]: 'warning',
  })[status] || 'secondary';
