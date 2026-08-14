/**
 * Office-time helpers for attendance. The server is the authority on "what day
 * is it" and "is the check-in window open", so all of this is anchored to the
 * office timezone (all three hubs are in Bosnia) regardless of where the server
 * runs. Mirrors the client rule in frontend/src/helpers/attendance.js, but the
 * client copy is UX-only — this is the source of truth.
 *
 * Dependency-free: uses Intl for timezone conversion and a UTC-noon walk for
 * working-day counting (noon avoids any DST/midnight edge cases).
 */

const OFFICE_TIMEZONE = 'Europe/Sarajevo';

// Check-in is only open 07:00–11:00 office time, Mon–Fri.
const CHECK_IN_WINDOW = Object.freeze({ startHour: 7, endHour: 11 });
const CHECK_IN_WINDOW_LABEL = '07:00–11:00';

const DAY_MS = 24 * 60 * 60 * 1000;

// Break a Date down into office-local calendar/clock parts.
const officeParts = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
  return parts;
};

/** Office-local calendar day as 'YYYY-MM-DD'. */
const officeDateKey = (date = new Date()) => {
  const { year, month, day } = officeParts(date);
  return `${year}-${month}-${day}`;
};

/** Office-local hour (0–23). */
const officeHour = (date = new Date()) => Number(officeParts(date).hour);

/** Office-local minute (0–59). */
const officeMinute = (date = new Date()) => Number(officeParts(date).minute);

/** True on Saturday/Sunday in office time. */
const isOfficeWeekend = (date = new Date()) => {
  const { weekday } = officeParts(date);
  return weekday === 'Sat' || weekday === 'Sun';
};

/** Window state relative to `now`: 'before' | 'open' | 'closed' (ignores weekend). */
const checkInWindowState = (date = new Date()) => {
  const hour = officeHour(date);
  if (hour < CHECK_IN_WINDOW.startHour) return 'before';
  if (hour < CHECK_IN_WINDOW.endHour) return 'open';
  return 'closed';
};

/** Whether check-in is allowed right now: a weekday, inside the window. */
const isWithinCheckInWindow = (date = new Date()) => {
  if (isOfficeWeekend(date)) return false;
  const hour = officeHour(date);
  return hour >= CHECK_IN_WINDOW.startHour && hour < CHECK_IN_WINDOW.endHour;
};

const keyToUtcNoon = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
};

/** Whether a 'YYYY-MM-DD' key falls on a weekend. */
const isWeekendKey = (key) => {
  const day = new Date(keyToUtcNoon(key)).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 || day === 6;
};

/**
 * The 'YYYY-MM-DD' key for the day before `key`.
 *
 * Used to turn an exclusive boundary into an inclusive one: an intern's attendance
 * obligation ends the day *before* `placedAt`, so the last owed day is
 * `previousDayKey(placedAt)`. Walks from UTC noon so the subtraction can't slip a
 * day across a DST boundary.
 */
const previousDayKey = (key) => new Date(keyToUtcNoon(key) - DAY_MS).toISOString().slice(0, 10);

const NO_EXCLUSIONS = new Set();

/**
 * Walk back `count` working days from `key` and return where you land.
 *
 * `count` of 0 returns `key` unchanged. Weekends are skipped, and so is anything in
 * `excluded` (holidays, breaks) — walking back "two working days" from a Wednesday
 * that follows a long weekend has to reach the previous Thursday, not Monday.
 *
 * Used for the sick-day backdating window: the earliest day an intern may still
 * claim is `previousWorkingDayKey(today, backdateWorkingDays)`.
 */
const previousWorkingDayKey = (key, count, excluded = NO_EXCLUSIONS) => {
  let current = key;
  let remaining = count;
  // Bounded so a pathological `excluded` set can never spin forever; a fortnight
  // of exclusions is already far beyond anything the office calendar produces.
  let guard = 0;
  while (remaining > 0 && guard < 365) {
    current = previousDayKey(current);
    guard += 1;
    if (isWeekendKey(current) || excluded.has(current)) continue;
    remaining -= 1;
  }
  return current;
};

/**
 * Count working days (Mon–Fri) between two 'YYYY-MM-DD' keys, inclusive.
 * Returns 0 if the range is empty or inverted.
 *
 * `excluded` is a Set of 'YYYY-MM-DD' keys nobody was expected to attend — public
 * holidays, programme breaks, remote weeks (see `models/NonWorkingDay.js`). They
 * drop out of the denominator exactly like a weekend; a day nobody owed is not an
 * absence. Weekends are derived here and never need listing.
 */
const countWorkingDays = (startKey, endKey, excluded = NO_EXCLUSIONS) => {
  if (!startKey || !endKey || startKey > endKey) return 0;
  const end = keyToUtcNoon(endKey);
  let count = 0;
  for (let t = keyToUtcNoon(startKey); t <= end; t += DAY_MS) {
    const date = new Date(t);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) continue;
    if (excluded.has(date.toISOString().slice(0, 10))) continue;
    count += 1;
  }
  return count;
};

/** Office-local month as 'YYYY-MM'. */
const officeMonthKey = (date = new Date()) => officeDateKey(date).slice(0, 7);

/** Whether a string is a valid 'YYYY-MM' month key. */
const isValidMonthKey = (key) => typeof key === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(key);

/** First and last day of a 'YYYY-MM' month, as inclusive 'YYYY-MM-DD' keys. */
const monthBounds = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
};

module.exports = {
  OFFICE_TIMEZONE,
  CHECK_IN_WINDOW,
  CHECK_IN_WINDOW_LABEL,
  officeDateKey,
  officeHour,
  officeMinute,
  isOfficeWeekend,
  checkInWindowState,
  isWithinCheckInWindow,
  isWeekendKey,
  previousDayKey,
  previousWorkingDayKey,
  countWorkingDays,
  officeMonthKey,
  isValidMonthKey,
  monthBounds,
};
