/**
 * Deterministic office-time clock for the demo seeder.
 *
 * Every date in the demo dataset is expressed as an offset in WORKING DAYS from
 * a single anchor, resolved once at the start of a run and then frozen. Two
 * reasons this matters:
 *
 *   1. Re-seeding must be reproducible. The demo is narrated from a script
 *      ("notice her attendance is 95%"), so the same dataset run twice has to
 *      produce the same numbers. Nothing here uses Math.random(), and no phase
 *      module is allowed to call `new Date()` — they all read this clock.
 *   2. Days are office-local. Attendance keys are 'YYYY-MM-DD' in
 *      Europe/Sarajevo (see helpers/attendanceTime.js), never a UTC
 *      toISOString() slice, which would drift a day for anyone running this
 *      late in the evening.
 *
 * The anchor is today when today is a weekday, else the most recent Friday, so
 * a weekend run still produces a fully-populated "latest working day" instead
 * of a blank current column.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { officeDateKey, isWeekendKey, OFFICE_TIMEZONE } = require('../../helpers/attendanceTime');

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

// A 'YYYY-MM-DD' key -> UTC noon for that day. Noon keeps ±1h DST shifts from
// ever crossing a date boundary while walking day by day.
const keyToUtcNoon = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** Shift a 'YYYY-MM-DD' key by whole days, staying in office-local terms. */
const shiftKey = (key, days) =>
  officeDateKey(new Date(keyToUtcNoon(key).getTime() + days * DAY_MS));

// Office-local UTC offset ('+02:00' in summer, '+01:00' in winter) for a given
// day, derived from Intl rather than hardcoded so `at()` lands on the intended
// wall-clock hour on both sides of the DST switch.
const officeOffset = (key) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIMEZONE,
    timeZoneName: 'longOffset',
  });
  const part = fmt.formatToParts(keyToUtcNoon(key)).find((p) => p.type === 'timeZoneName');
  const match = /GMT([+-]\d{2}:\d{2})/.exec(part?.value || '');
  return match ? match[1] : '+00:00';
};

const createClock = () => {
  const now = new Date();
  const todayKey = officeDateKey(now);

  let anchorKey = todayKey;
  while (isWeekendKey(anchorKey)) anchorKey = shiftKey(anchorKey, -1);

  /** The working-day key `n` working days before the anchor (0 = anchor). */
  const workdaysAgo = (n) => {
    let key = anchorKey;
    let left = n;
    while (left > 0) {
      key = shiftKey(key, -1);
      if (!isWeekendKey(key)) left -= 1;
    }
    return key;
  };

  /** The working-day key `n` working days after the anchor (for upcoming events). */
  const workdaysAhead = (n) => {
    let key = anchorKey;
    let left = n;
    while (left > 0) {
      key = shiftKey(key, 1);
      if (!isWeekendKey(key)) left -= 1;
    }
    return key;
  };

  /** Every working-day key in [fromKey, toKey], inclusive and ascending. */
  const workdayRange = (fromKey, toKey = anchorKey) => {
    const out = [];
    for (let key = fromKey; key <= toKey; key = shiftKey(key, 1)) {
      if (!isWeekendKey(key)) out.push(key);
    }
    return out;
  };

  /** 'YYYY-MM-DD' + office-local wall clock -> a real Date. */
  const at = (key, hour = 9, minute = 0) =>
    new Date(`${key}T${pad(hour)}:${pad(minute)}:00${officeOffset(key)}`);

  /** Local midnight for a key — matches Daily's start-of-day normalization. */
  const startOfDay = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const officeHourNow = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: OFFICE_TIMEZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  );

  return Object.freeze({
    now,
    todayKey,
    anchorKey,
    // True when the run happens on a Sat/Sun, so the anchor is the prior Friday
    // and nothing seeded today will be live-editable during the demo.
    isWeekendToday: todayKey !== anchorKey,
    officeHourNow,
    workdaysAgo,
    workdaysAhead,
    workdayRange,
    shiftKey,
    at,
    startOfDay,
  });
};

/**
 * Deterministic ObjectId from a symbolic key. Re-seeding keeps every _id, so
 * deep links the presenter has bookmarked (or has open in another tab) survive.
 */
const stableId = (key) =>
  new mongoose.Types.ObjectId(
    crypto.createHash('md5').update(`demo:${key}`).digest('hex').slice(0, 24)
  );

module.exports = { createClock, stableId, shiftKey };
