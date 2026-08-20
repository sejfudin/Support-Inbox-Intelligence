const {
  gregorianEaster,
  orthodoxEaster,
  roshHashanah,
  tabularIslamic,
  observancesForYear,
  observancesForYears,
  toKey,
} = require('./observanceCalendar');

// These dates are the whole point of the file: they are published facts, not
// outputs of the algorithm under test. If a refactor moves any of them, the
// calendar the interns plan their leave against has broken.

describe('gregorianEaster (Western)', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2030, '2030-04-21'],
    [2035, '2035-03-25'],
    [2038, '2038-04-25'], // the latest Easter can fall
    [2045, '2045-04-09'],
  ])('%i falls on %s', (year, expected) => {
    expect(toKey(gregorianEaster(year))).toBe(expected);
  });
});

describe('orthodoxEaster', () => {
  it.each([
    [2024, '2024-05-05'],
    [2025, '2025-04-20'],
    [2026, '2026-04-12'],
    [2027, '2027-05-02'],
    [2028, '2028-04-16'],
    [2030, '2030-04-28'],
  ])('%i falls on %s', (year, expected) => {
    expect(toKey(orthodoxEaster(year))).toBe(expected);
  });

  it('coincides with Western Easter in the years it is meant to', () => {
    // 2025 and 2028 are both years the two calendars agree.
    expect(toKey(orthodoxEaster(2025))).toBe(toKey(gregorianEaster(2025)));
    expect(toKey(orthodoxEaster(2028))).toBe(toKey(gregorianEaster(2028)));
  });

  it('is never earlier than Western Easter', () => {
    for (let year = 2026; year <= 2045; year += 1) {
      expect(toKey(orthodoxEaster(year)) >= toKey(gregorianEaster(year))).toBe(true);
    }
  });
});

describe('roshHashanah (Hebrew calendar)', () => {
  it.each([
    [5785, '2024-10-03'],
    [5786, '2025-09-23'],
    [5787, '2026-09-12'],
    [5788, '2027-10-02'],
    [5789, '2028-09-21'],
    [5791, '2030-09-28'],
  ])('Hebrew year %i begins on %s', (hebrewYear, expected) => {
    expect(toKey(roshHashanah(hebrewYear))).toBe(expected);
  });

  it('never falls on a Sunday, Wednesday or Friday (lo ADU rosh)', () => {
    for (let hebrewYear = 5786; hebrewYear <= 5810; hebrewYear += 1) {
      const weekday = new Date(roshHashanah(hebrewYear)).getUTCDay();
      expect([0, 3, 5]).not.toContain(weekday);
    }
  });
});

describe('tabularIslamic', () => {
  // Provisional by construction — the observed dates are announced, not computed.
  // Pinned anyway, so a change to the algorithm cannot pass unnoticed.
  it.each([
    [1447, '2026-03-20'],
    [1448, '2027-03-10'],
    [1449, '2028-02-27'],
  ])('Eid al-Fitr of AH %i lands on %s', (hijriYear, expected) => {
    expect(toKey(tabularIslamic(hijriYear, 10, 1))).toBe(expected);
  });

  it('runs a 354–355 day year, so it drifts ~11 days earlier each Gregorian year', () => {
    for (let hijriYear = 1447; hijriYear <= 1470; hijriYear += 1) {
      const thisYear = tabularIslamic(hijriYear, 10, 1);
      const nextYear = tabularIslamic(hijriYear + 1, 10, 1);
      const lengthDays = Math.round((nextYear - thisYear) / 86400000);
      expect(lengthDays).toBeGreaterThanOrEqual(354);
      expect(lengthDays).toBeLessThanOrEqual(355);
    }
  });
});

describe('observancesForYear', () => {
  const rows = observancesForYear(2026);

  it('puts every row inside the year it was asked for', () => {
    for (const row of rows) expect(row.date.startsWith('2026')).toBe(true);
  });

  it('returns rows sorted by date', () => {
    const dates = rows.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('marks the Islamic entries provisional and nothing else', () => {
    for (const row of rows) {
      expect(row.provisional).toBe(row.tradition === 'muslim');
    }
  });

  it('carries the fixed-date observances', () => {
    const byDate = new Map(rows.map((r) => [r.date, r.label]));
    expect(byDate.get('2026-01-07')).toMatch(/Orthodox Christmas/);
    expect(byDate.get('2026-12-25')).toMatch(/Christmas/);
    expect(byDate.get('2026-11-01')).toMatch(/All Saints/);
  });

  it('derives the Easter chains around the right Sundays', () => {
    const byDate = new Map(rows.map((r) => [r.date, r.label]));
    expect(byDate.get('2026-04-03')).toMatch(/Good Friday/);
    expect(byDate.get('2026-04-05')).toMatch(/Easter \(Uskrs\)/);
    expect(byDate.get('2026-04-06')).toMatch(/Easter Monday/);
    expect(byDate.get('2026-04-12')).toMatch(/Orthodox Easter \(Vaskrs\)/);
  });

  it('places Yom Kippur nine days after Rosh Hashanah', () => {
    const byLabel = new Map(rows.map((r) => [r.label, r.date]));
    expect(byLabel.get('Rosh Hashanah')).toBe('2026-09-12');
    expect(byLabel.get('Yom Kippur')).toBe('2026-09-21');
    expect(byLabel.get('Passover (Pesach) begins')).toBe('2026-04-02');
  });
});

describe('observancesForYears', () => {
  const rows = observancesForYears(2026, 2045);

  it('covers every year in the span', () => {
    const years = new Set(rows.map((r) => r.date.slice(0, 4)));
    expect(years.size).toBe(20);
    expect(years.has('2026')).toBe(true);
    expect(years.has('2045')).toBe(true);
  });

  it('gives every year all four traditions', () => {
    for (let year = 2026; year <= 2045; year += 1) {
      const traditions = new Set(
        rows.filter((r) => r.date.startsWith(String(year))).map((r) => r.tradition)
      );
      expect([...traditions].sort()).toEqual(['catholic', 'jewish', 'muslim', 'orthodox']);
    }
  });

  it('emits well-formed date keys throughout', () => {
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.label.length).toBeGreaterThan(0);
    }
  });

  it('never produces two identical (date, label) pairs', () => {
    const seen = new Set(rows.map((r) => `${r.date}|${r.label}`));
    expect(seen.size).toBe(rows.length);
  });
});
