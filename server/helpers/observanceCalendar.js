/**
 * Religious observance dates, computed rather than typed.
 *
 * The attendance calendar shows these as an advance notice so an intern can see
 * when Bajram or Uskrs falls before requesting a religious-holiday day off. Twenty
 * years of them is about four hundred dates, which is far too many to hand-write
 * and check — so the ones that *can* be derived exactly are derived, and the ones
 * that cannot are flagged as provisional rather than quietly guessed.
 *
 * ── What is exact, and what is not ───────────────────────────────────────────
 *
 * **Exact.** Fixed-date observances, Western Easter (the Gregorian computus, via
 * Meeus/Jones/Butcher), Orthodox Easter (the Julian computus plus the 13-day offset
 * that holds for 1900–2099), and the Hebrew calendar — which is arithmetic, not
 * observational, so Rosh Hashanah, Yom Kippur and Pesach are computable to the day.
 * Every one of these is pinned against published dates in `observanceCalendar.test.js`.
 *
 * **Provisional.** The Islamic dates. `tabularIslamic` below is the standard
 * arithmetic approximation of a calendar that is, in practice, observational: in
 * Bosnia the dates are announced by the Islamic Community (Islamska zajednica) and
 * land within about a day either side of the calculation. Every Islamic entry is
 * therefore marked `provisional: true` — the UI says so, and
 * `npm run seed:observances -- --replace` is how a corrected year gets in.
 *
 * That distinction is the point of this file. An intern planning leave around a
 * date the app stated confidently and got wrong is precisely the failure the
 * feature exists to prevent, so the app does not state it confidently.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const utcMs = (year, month, day) => Date.UTC(year, month - 1, day);
const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (ms, days) => ms + days * DAY_MS;

/**
 * Western (Gregorian) Easter Sunday — Meeus/Jones/Butcher. Exact for any year in
 * the Gregorian calendar.
 */
const gregorianEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcMs(year, month, day);
};

/**
 * Orthodox Easter Sunday — the Julian computus, shifted into the Gregorian
 * calendar. The +13 day offset is correct for 1900–2099 and becomes +14 in 2100,
 * which is comfortably past any year this seeder covers.
 */
const orthodoxEaster = (year) => {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(utcMs(year, month, day), 13);
};

// ── Hebrew calendar ──────────────────────────────────────────────────────────
// Days elapsed to 1 Tishrei of a Hebrew year, from the molad plus the postponement
// rules (dechiyot). Arithmetic, so exact.

const hebrewElapsedDays = (year) => {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let day = monthsElapsed * 29 + Math.floor(partsElapsed / 25920);
  // Lo ADU rosh: 1 Tishrei may not fall on Sunday, Wednesday or Friday.
  if ((3 * (day + 1)) % 7 < 3) day += 1;
  return day;
};

// The two remaining postponements, both detected by the length they would give the
// year: 356 days is impossible and 382 means the year before must absorb a day.
const hebrewPostponement = (year) => {
  const last = hebrewElapsedDays(year - 1);
  const present = hebrewElapsedDays(year);
  const next = hebrewElapsedDays(year + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
};

const hebrewNewYearDays = (hebrewYear) =>
  hebrewElapsedDays(hebrewYear) + hebrewPostponement(hebrewYear);

// Anchored on a published date (Rosh Hashanah 5787 = 12 September 2026) rather than
// on a derived epoch constant, so the calibration is a fact anyone can check rather
// than a magic number. The test file pins several further years against it.
const HEBREW_ANCHOR_YEAR = 5787;
const HEBREW_ANCHOR_MS = utcMs(2026, 9, 12);
const HEBREW_OFFSET_MS = HEBREW_ANCHOR_MS - hebrewNewYearDays(HEBREW_ANCHOR_YEAR) * DAY_MS;

/** 1 Tishrei (Rosh Hashanah) of a Hebrew year, as a UTC timestamp. */
const roshHashanah = (hebrewYear) => hebrewNewYearDays(hebrewYear) * DAY_MS + HEBREW_OFFSET_MS;

// From 15 Nisan to 1 Tishrei of the following Hebrew year is a fixed 163 days: only
// Cheshvan and Kislev vary in length, and both fall on the other side of Nisan.
const DAYS_PESACH_TO_NEW_YEAR = 163;

// ── Islamic calendar (tabular approximation) ─────────────────────────────────

const tabularIslamicDays = (year, month, day) =>
  day +
  29 * (month - 1) +
  Math.floor(month / 2) +
  354 * (year - 1) +
  Math.floor((3 + 11 * year) / 30);

// Anchored the same way, on Eid al-Fitr 1447 ≈ 20 March 2026.
const ISLAMIC_ANCHOR_MS = utcMs(2026, 3, 20);
const ISLAMIC_OFFSET_MS = ISLAMIC_ANCHOR_MS - tabularIslamicDays(1447, 10, 1) * DAY_MS;

const tabularIslamic = (year, month, day) =>
  tabularIslamicDays(year, month, day) * DAY_MS + ISLAMIC_OFFSET_MS;

// ── Building a year ──────────────────────────────────────────────────────────

const FIXED = [
  { month: 1, day: 7, label: 'Orthodox Christmas (Božić)', tradition: 'orthodox' },
  {
    month: 1,
    day: 14,
    label: 'Orthodox New Year (Pravoslavna Nova godina)',
    tradition: 'orthodox',
  },
  { month: 11, day: 1, label: "All Saints' Day (Svi sveti)", tradition: 'catholic' },
  { month: 12, day: 25, label: 'Christmas (Božić)', tradition: 'catholic' },
];

/**
 * Every observance falling in one Gregorian year, sorted by date.
 *
 * Multi-day observances are emitted as one row per day so a single date lookup
 * finds them — the calendar asks "what is on this day", never "when does this
 * start".
 */
const observancesForYear = (year) => {
  const rows = [];
  const add = (ms, label, tradition, provisional = false) =>
    rows.push({ date: toKey(ms), label, tradition, provisional });

  for (const { month, day, label, tradition } of FIXED) {
    add(utcMs(year, month, day), label, tradition);
  }

  const western = gregorianEaster(year);
  add(addDays(western, -2), 'Good Friday (Veliki petak)', 'catholic');
  add(western, 'Easter (Uskrs)', 'catholic');
  add(addDays(western, 1), 'Easter Monday (Uskrsni ponedjeljak)', 'catholic');

  const eastern = orthodoxEaster(year);
  add(addDays(eastern, -2), 'Orthodox Good Friday (Veliki petak)', 'orthodox');
  add(eastern, 'Orthodox Easter (Vaskrs)', 'orthodox');
  add(addDays(eastern, 1), 'Orthodox Easter Monday', 'orthodox');

  // The Hebrew year beginning in this Gregorian year, and the one that began in the
  // previous — Pesach belongs to the latter.
  const hebrewYear = year + 3761;
  const newYear = roshHashanah(hebrewYear);
  add(newYear, 'Rosh Hashanah', 'jewish');
  add(addDays(newYear, 1), 'Rosh Hashanah, day 2', 'jewish');
  add(addDays(newYear, 9), 'Yom Kippur', 'jewish');
  add(
    addDays(roshHashanah(hebrewYear), -DAYS_PESACH_TO_NEW_YEAR),
    'Passover (Pesach) begins',
    'jewish'
  );

  // Islamic years drift about eleven days earlier each Gregorian year, so a given
  // Gregorian year can contain a festival twice or not at all. Scanning a window of
  // Hijri years and keeping what lands in range is what handles both.
  const hijriGuess = Math.floor((year - 622) * (33 / 32));
  for (let hijri = hijriGuess - 2; hijri <= hijriGuess + 2; hijri += 1) {
    const fitr = tabularIslamic(hijri, 10, 1);
    const adha = tabularIslamic(hijri, 12, 10);
    if (toKey(fitr).startsWith(String(year))) {
      add(fitr, 'Eid al-Fitr (Ramazanski bajram)', 'muslim', true);
      add(addDays(fitr, 1), 'Eid al-Fitr (Ramazanski bajram), day 2', 'muslim', true);
    }
    if (toKey(adha).startsWith(String(year))) {
      add(adha, 'Eid al-Adha (Kurban bajram)', 'muslim', true);
      add(addDays(adha, 1), 'Eid al-Adha (Kurban bajram), day 2', 'muslim', true);
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
};

/** Every observance across an inclusive span of Gregorian years. */
const observancesForYears = (startYear, endYear) => {
  const rows = [];
  for (let year = startYear; year <= endYear; year += 1) rows.push(...observancesForYear(year));
  return rows;
};

module.exports = {
  gregorianEaster,
  orthodoxEaster,
  roshHashanah,
  tabularIslamic,
  observancesForYear,
  observancesForYears,
  toKey,
};
