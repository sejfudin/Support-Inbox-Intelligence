const { observancesForYears } = require('../helpers/observanceCalendar');

/**
 * The religious observance catalog seeded into the attendance calendar — twenty
 * years of it, so nobody has to remember to top it up.
 *
 * **These are notices, not days off.** Nothing here removes a day from anyone's
 * attendance denominator; see `models/Observance.js` for why that distinction is
 * load-bearing. A day that genuinely is non-working for the whole programme belongs
 * in `NonWorkingDay`, separately and deliberately.
 *
 * The dates are computed by `helpers/observanceCalendar.js` rather than typed out.
 * Four hundred hand-written dates could not be reviewed and would rot; the computed
 * ones are pinned against published dates in `observanceCalendar.test.js`.
 *
 * **Exact**: the fixed-date observances, both Easter chains (each following its own
 * computus), and the Hebrew calendar — which is arithmetic rather than
 * observational, so Rosh Hashanah, Yom Kippur and Pesach are computable to the day.
 *
 * **Provisional**: the Islamic dates. In Bosnia these are announced by the Islamic
 * Community (Islamska zajednica) rather than calculated, and land within about a day
 * either side of the tabular calendar. They carry `provisional: true`, the UI says
 * so, and `npm run seed:observances -- --replace` is how a corrected year gets in
 * once the announcement is published. An intern planning leave around a date the app
 * stated confidently and got wrong is the exact failure this feature exists to
 * prevent, so the app does not state it confidently.
 */

// A fixed span, not one relative to today: the seeder has to produce the same
// catalog on every run, or "what is missing" stops being a stable question.
const START_YEAR = 2026;
const END_YEAR = 2045;

module.exports = observancesForYears(START_YEAR, END_YEAR);
module.exports.START_YEAR = START_YEAR;
module.exports.END_YEAR = END_YEAR;
