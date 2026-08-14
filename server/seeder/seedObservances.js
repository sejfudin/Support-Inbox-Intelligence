#!/usr/bin/env node
/**
 * Religious observance calendar sync — `npm run seed:observances`
 *
 * NON-DESTRUCTIVE. Upserts the entries in defaultObservances.js with `$setOnInsert`,
 * so it only ever *adds* observances that are missing. It never edits or removes an
 * existing one, and it touches no other collection — safe to run against any
 * environment, including one with live intern data.
 *
 * An observance is a **notice only**: it marks a day on the attendance calendar and
 * changes nobody's attendance denominator. It is not a `NonWorkingDay` and must
 * never be seeded into that collection — see models/Observance.js.
 *
 * The catalog covers twenty years and is computed, not typed — see
 * defaultObservances.js. Run this once and the calendar is populated to 2045.
 *
 * Reach for it again after extending the span, or after correcting a Bajram date
 * once the Islamic Community has announced it: those rows are seeded provisional
 * and can move by a day. A correction is an edit, and the default path only ever
 * inserts — see --replace below.
 *
 *   npm run seed:observances -- --dry-run    list what would be added, change nothing
 *   npm run seed:observances                 add the missing observances
 *   npm run seed:observances -- --replace    delete and re-insert the listed years
 */

const path = require('path');

// Load env the way index.js does, so this hits the database `npm run dev` actually
// reads. Older scripts in this directory load plain `.env`, which points at a
// DIFFERENT cluster — see server/CLAUDE.md. ENV_FILE is captured BEFORE the load
// because .env.development itself sets NODE_ENV=staging, which would make the
// banner below report the wrong file.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Observance = require('../models/Observance');
const DEFAULT_OBSERVANCES = require('./defaultObservances');

const isDryRun = process.argv.includes('--dry-run');
// `--replace` exists for the one case adding cannot cover: a date that was seeded
// as an estimate and has since been announced differently. It deletes only the
// years present in defaultObservances.js, so untouched years survive.
const isReplace = process.argv.includes('--replace');

const yearsCovered = () => [...new Set(DEFAULT_OBSERVANCES.map((o) => o.date.slice(0, 4)))].sort();

const run = async () => {
  console.log(`\nObservance calendar sync — env file: ${ENV_FILE}`);
  console.log(`Years in the catalog: ${yearsCovered().join(', ')}`);
  if (isDryRun) console.log('DRY RUN — nothing will be written.\n');

  await connectDB();

  const existing = await Observance.find({}).select('date label').lean();
  const seen = new Set(existing.map((row) => `${row.date}|${row.label}`));

  const missing = DEFAULT_OBSERVANCES.filter((o) => !seen.has(`${o.date}|${o.label}`));

  if (isReplace) {
    const years = yearsCovered();
    const pattern = new RegExp(`^(${years.join('|')})-`);
    const { deletedCount } = isDryRun
      ? { deletedCount: existing.filter((row) => pattern.test(row.date)).length }
      : await Observance.deleteMany({ date: { $regex: pattern } });
    console.log(`--replace: ${isDryRun ? 'would remove' : 'removed'} ${deletedCount} row(s).`);
    if (!isDryRun) {
      await Observance.insertMany(DEFAULT_OBSERVANCES);
      console.log(`Inserted ${DEFAULT_OBSERVANCES.length} observance(s).`);
    }
  } else if (!missing.length) {
    console.log('Nothing to add — every observance in the catalog is already present.');
  } else {
    console.log(`${isDryRun ? 'Would add' : 'Adding'} ${missing.length} observance(s):`);
    for (const o of missing) console.log(`  ${o.date}  ${o.label}  (${o.tradition})`);
    if (!isDryRun) await Observance.insertMany(missing);
  }

  await mongoose.connection.close();
  console.log('\nDone.\n');
};

run().catch(async (error) => {
  console.error('\nObservance sync failed:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
