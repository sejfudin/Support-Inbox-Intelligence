// Pure, clock-free rules for Workspace Dailies. These are the feature's only
// branchy logic (working-day math + derived counts), split out so they can be
// unit-tested without a DB or a real clock. `now` is always injected — nothing
// here reads the system time.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Local start-of-day, matching the Daily model's date normalization.
const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
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
// future dates are read-only.
const isDailyEditable = (date, now) => {
  const target = startOfDay(date);
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

module.exports = {
  previousWorkingDay,
  isDailyEditable,
  deriveCounts,
};
