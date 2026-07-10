/**
 * Mock attendance data for the Attendance feature (frontend-only showcase).
 *
 * This module fabricates a deterministic set of check-in records so the UI can be
 * demonstrated without a backend. When the real API lands, delete this file and
 * point `@/api/attendance` at the live endpoints (see that file for the mapping).
 *
 * Data shape returned to the app mirrors the intended API contract:
 *   - A check-in record: { date: 'YYYY-MM-DD', checkedInAt: ISO string }
 *   - A cancelled day:   a 'YYYY-MM-DD' string in `cancelledDates`. An intern who
 *     cancels a check-in cannot check in again that day; the day counts as absent.
 *   - A roster entry:   { intern, records, cancelledDates, presentDays, workingDays,
 *                         attendanceRate, lastCheckIn }
 */

import {
  format,
  subDays,
  isWeekend,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

export const ATTENDANCE_MOCK_ENABLED = true;

// A fixed "today" is not used — we derive from the real clock so the calendar and
// "check in today" always look live in a demo. Records are seeded relative to now.
const toKey = (date) => format(date, 'yyyy-MM-dd');

/**
 * Deterministic pseudo-random in [0,1) from a string seed + index, so a given
 * intern always gets the same attendance pattern across reloads (no Math.random,
 * which would reshuffle the demo on every render).
 */
const seededRand = (seed, i) => {
  let h = 2166136261 ^ i;
  for (let c = 0; c < seed.length; c += 1) {
    h ^= seed.charCodeAt(c);
    h = Math.imul(h, 16777619);
  }
  // Map to [0,1)
  return ((h >>> 0) % 100000) / 100000;
};

/**
 * Build a list of check-in records over the trailing `days` window for one intern.
 * `presentBias` (0..1) shifts how likely a working day is marked present.
 * The current day is only checked in when `checkedInToday` is true.
 */
const buildRecords = ({ seed, days = 60, presentBias = 0.9, checkedInToday }) => {
  const today = new Date();
  const records = [];

  for (let i = days; i >= 0; i -= 1) {
    const date = subDays(today, i);
    if (isWeekend(date)) continue; // weekends are non-working, never "absent"

    const isToday = i === 0;
    if (isToday && !checkedInToday) continue; // no record yet today

    const present = isToday ? true : seededRand(seed, i) < presentBias;
    if (!present) continue; // absent days simply have no record

    // Fabricate a plausible arrival time between 08:30 and 09:45
    const minuteOffset = Math.floor(seededRand(seed, i * 7) * 75);
    const checkedInAt = new Date(date);
    checkedInAt.setHours(8, 30 + minuteOffset, 0, 0);

    records.push({ date: toKey(date), checkedInAt: checkedInAt.toISOString() });
  }

  return records;
};

// ---- Roster of interns for the mentor/admin overview -----------------------

const ROSTER_SEED = [
  { id: 'i-1', fullname: 'Amina Kovač', email: 'amina.kovac@symphony.is', hub: 'Sarajevo', bias: 0.98, today: true },
  { id: 'i-2', fullname: 'Bilal Mehić', email: 'bilal.mehic@symphony.is', hub: 'Sarajevo', bias: 0.72, today: false },
  { id: 'i-3', fullname: 'Carla Orozco', email: 'carla.orozco@symphony.is', hub: 'Mostar', bias: 0.88, today: true },
  { id: 'i-4', fullname: 'Deniz Arslan', email: 'deniz.arslan@symphony.is', hub: 'Sarajevo', bias: 0.95, today: true },
  { id: 'i-5', fullname: 'Elena Petrova', email: 'elena.petrova@symphony.is', hub: 'Banja Luka', bias: 0.6, today: false },
  { id: 'i-6', fullname: 'Faris Hodžić', email: 'faris.hodzic@symphony.is', hub: 'Mostar', bias: 0.83, today: true },
  { id: 'i-7', fullname: 'Goran Ilić', email: 'goran.ilic@symphony.is', hub: 'Sarajevo', bias: 0.91, today: true },
  { id: 'i-8', fullname: 'Hana Suljić', email: 'hana.suljic@symphony.is', hub: 'Banja Luka', bias: 0.77, today: false },
];

export const MOCK_HUBS = ['Sarajevo', 'Mostar', 'Banja Luka'];

/**
 * Count working days (Mon–Fri) in the trailing `days` window, inclusive of today.
 */
const countWorkingDays = (days = 60) => {
  const today = new Date();
  return eachDayOfInterval({ start: subDays(today, days), end: today }).filter(
    (d) => !isWeekend(d)
  ).length;
};

const WINDOW_DAYS = 60;

export const getMockRoster = () => {
  const workingDays = countWorkingDays(WINDOW_DAYS);

  return ROSTER_SEED.map((intern) => {
    const records = buildRecords({
      seed: intern.id,
      days: WINDOW_DAYS,
      presentBias: intern.bias,
      checkedInToday: intern.today,
    });
    const presentDays = records.length;
    const attendanceRate = Math.round((presentDays / workingDays) * 100);
    const lastCheckIn = records.length ? records[records.length - 1].checkedInAt : null;

    return {
      intern: {
        id: intern.id,
        fullname: intern.fullname,
        email: intern.email,
        hub: intern.hub,
      },
      records,
      cancelledDates: [],
      presentDays,
      workingDays,
      attendanceRate,
      lastCheckIn,
    };
  });
};

// ---- The signed-in intern's own attendance ---------------------------------

// Module-level store so a check-in during the session persists across navigations
// (until reload). This stands in for a server write.
let myRecords = buildRecords({
  seed: 'me-current-intern',
  days: WINDOW_DAYS,
  presentBias: 0.9,
  checkedInToday: false, // start "not checked in today" so the button is actionable
});

// Days the intern cancelled their check-in. A cancelled day is locked — no
// re-check-in — and counts as absent.
let myCancelledDates = [];

export const getMyMockAttendance = () => {
  const workingDays = countWorkingDays(WINDOW_DAYS);
  const presentDays = myRecords.length;
  return {
    records: [...myRecords],
    cancelledDates: [...myCancelledDates],
    presentDays,
    workingDays,
    attendanceRate: Math.round((presentDays / workingDays) * 100),
  };
};

export const checkInMock = () => {
  const today = new Date();
  const key = toKey(today);
  // Cannot check in on a day already cancelled.
  if (myCancelledDates.includes(key)) return getMyMockAttendance();
  const already = myRecords.some((r) => r.date === key);
  if (!already) {
    myRecords = [...myRecords, { date: key, checkedInAt: today.toISOString() }];
  }
  return getMyMockAttendance();
};

// Cancel today's check-in: remove the record and lock the day as absent.
export const cancelCheckInMock = () => {
  const key = toKey(new Date());
  myRecords = myRecords.filter((r) => r.date !== key);
  if (!myCancelledDates.includes(key)) {
    myCancelledDates = [...myCancelledDates, key];
  }
  return getMyMockAttendance();
};
