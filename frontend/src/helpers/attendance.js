/**
 * Pure helpers for the Attendance feature: day-status classification, calendar
 * grid construction, and attendance-rate tone. No React, no data fetching.
 */

import {
  format,
  isWeekend,
  isToday,
  isAfter,
  isSameMonth,
  startOfDay,
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

const toKey = (date) => format(date, 'yyyy-MM-dd');

/**
 * Classify a single calendar day.
 * @param {Date} date
 * @param {Set<string>} presentKeys - 'yyyy-MM-dd' the intern checked in
 * @param {Set<string>} [cancelledKeys] - 'yyyy-MM-dd' the intern cancelled (locked absent)
 * @param {Date} [now]
 */
export const classifyDay = (date, presentKeys, cancelledKeys = new Set(), now = new Date()) => {
  const key = toKey(date);
  if (presentKeys.has(key)) return DAY_STATUS.PRESENT;
  if (isWeekend(date)) return DAY_STATUS.WEEKEND;
  // A cancelled day is locked absent even if it's today.
  if (cancelledKeys.has(key)) return DAY_STATUS.ABSENT;
  if (isToday(date)) {
    // Once the check-in window closes, a no-show today is absent, not pending.
    return checkInWindowState(now) === 'closed' ? DAY_STATUS.ABSENT : DAY_STATUS.TODAY_PENDING;
  }
  if (isAfter(startOfDay(date), startOfDay(now))) return DAY_STATUS.FUTURE;
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
  const cursor = startOfDay(new Date());
  for (let i = 0; i < 400; i += 1) {
    const day = new Date(cursor);
    day.setDate(day.getDate() - i);
    if (isWeekend(day)) continue;
    if (isToday(day) && !presentKeys.has(toKey(day))) continue; // today not yet in — don't break streak
    if (presentKeys.has(toKey(day))) streak += 1;
    else break;
  }
  return streak;
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
  const key = toKey(new Date());
  return records.find((r) => r.date === key) || null;
};

export const isCheckedInToday = (records = []) => Boolean(todayRecord(records));

/** Whether the intern cancelled today's check-in (locked absent, no re-check-in). */
export const isCancelledToday = (cancelledDates = []) => cancelledDates.includes(toKey(new Date()));

// Check-in is only open 07:00–11:00 office time (Europe/Sarajevo), regardless of
// where the browser is. This mirrors server/helpers/attendanceTime.js for UX only
// — the backend is the source of truth and enforces the same window server-side.
const OFFICE_TIMEZONE = 'Europe/Sarajevo';
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
