// Pure, clock-free rules for Workspace Dailies. These are the feature's only
// branchy logic (working-day math + derived counts), split out so they can be
// unit-tested without a DB or a real clock. `now` is always injected — nothing
// here reads the system time.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Anchored to the business timezone (not the host process's own), so "today"
// and the (workspace, date) index mean the same instant regardless of where
// this runs — a local machine and a deployed container can disagree on system
// timezone otherwise. Dependency-free, same technique as
// helpers/attendanceTime.js and seeder/demo/clock.js's officeOffset().
const BUSINESS_TIMEZONE = 'Europe/Sarajevo';

const businessDateParts = (date) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
  return parts;
};

// BUSINESS_TIMEZONE's UTC offset ('+02:00' summer, '+01:00' winter) for the
// instant `date` falls in — derived from Intl, not hardcoded, so DST is
// handled on both sides of the switch.
const businessOffset = (date) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: 'longOffset',
  });
  const part = fmt.formatToParts(date).find((p) => p.type === 'timeZoneName');
  const match = /GMT([+-]\d{2}:\d{2})/.exec(part?.value || '');
  return match ? match[1] : '+00:00';
};

// Start-of-day in BUSINESS_TIMEZONE, matching the Daily model's date
// normalization.
const startOfDay = (value) => {
  const date = new Date(value);
  const { year, month, day } = businessDateParts(date);
  return new Date(`${year}-${month}-${day}T00:00:00${businessOffset(date)}`);
};

// BUSINESS_TIMEZONE weekday, not `date.getDay()` — `date` here is usually a
// startOfDay() instant sitting close to a UTC day boundary (22:00/23:00Z), so
// a host-local weekday getter can name the wrong day on a host in a different
// timezone.
const isWeekend = (date) => {
  const { weekday } = businessDateParts(date);
  return weekday === 'Sat' || weekday === 'Sun';
};

// The working day immediately before `date` (Sat/Sun skipped). Monday's
// previous working day is the prior Friday; a mid-week day's is the prior day.
const previousWorkingDay = (date) => {
  const cursor = startOfDay(date);
  do {
    cursor.setTime(cursor.getTime() - MS_PER_DAY);
  } while (isWeekend(cursor));
  return cursor;
};

// A Daily is editable on its date and up to one working day afterward
// (weekends skipped), so Monday can still edit Friday's. Older dailies and
// future dates are read-only. Weekend-dated dailies are never editable — the
// window is a working-day notion, so a Sat/Sun date must not be treated as
// editable just because it falls inside the [prev-working-day, today] span.
const isDailyEditable = (date, now) => {
  const target = startOfDay(date);
  if (isWeekend(target)) return false;
  const today = startOfDay(now);
  const earliestEditable = previousWorkingDay(today);
  return target.getTime() >= earliestEditable.getTime() && target.getTime() <= today.getTime();
};

// Header counts derived from a Daily's entries. `present` is how many interns
// have an entry; `total` is the workspace's current active-intern count
// (passed in, computed live at view time). `shipped`/`inFlight`/`blockers`
// sum the done/todo/blocker items across all entries.
const deriveCounts = (entries = [], activeInternCount = 0) => {
  const sumBy = (pick) =>
    entries.reduce(
      (total, entry) => total + (Array.isArray(pick(entry)) ? pick(entry).length : 0),
      0
    );

  return {
    covered: {
      present: entries.length,
      total: activeInternCount,
    },
    shipped: sumBy((entry) => entry.done),
    inFlight: sumBy((entry) => entry.todo),
    blockers: sumBy((entry) => entry.blockers),
  };
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const isValidMonthKey = (key) => typeof key === 'string' && MONTH_KEY_PATTERN.test(key);

const currentMonthKey = (now = new Date()) => {
  const { year, month } = businessDateParts(now);
  return `${year}-${month}`;
};

// First/last business-timezone calendar day of a 'YYYY-MM' month, as
// start-of-day Dates. Seeds startOfDay() with noon UTC, not a host-local
// `new Date(year, month, day)` — on a host far enough ahead of Sarajevo
// (e.g. Asia/Tokyo, UTC+9), host-local midnight can land a calendar day
// earlier once reinterpreted in Sarajevo, shifting the whole range back a day.
const monthBounds = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const start = startOfDay(new Date(Date.UTC(year, month - 1, 1, 12)));
  const end = startOfDay(new Date(Date.UTC(year, month, 0, 12))); // day 0 of next month = last day of this one
  return { start, end };
};

module.exports = {
  previousWorkingDay,
  isDailyEditable,
  deriveCounts,
  startOfDay,
  isWeekend,
  isValidMonthKey,
  currentMonthKey,
  monthBounds,
};
