#!/usr/bin/env node
/**
 * Retire superseded technologies — `npm run cleanup:superseded-technologies`
 *
 * Some environments carry legacy combined catalog rows ("HTML & CSS") that newer, granular
 * entries replace ("HTML", "CSS"). Left active, a CV written as "HTML/CSS" matches all three
 * and auto-declares one skill as three overlapping technologies — three unassessed readiness
 * items for a mentor to work through.
 *
 * Deactivates rather than deletes: `matchTechnologiesInText` and `getAllTechnologies` both skip
 * `isActive: false`, so the row disappears from CV scanning and every picker, while any intern
 * who already declared it keeps a valid reference (their profile still renders it). Delete would
 * leave dangling ObjectIds in `selfTechnologies`.
 *
 * Idempotent, and refuses to retire a row whose replacements are not seeded yet — run
 * `npm run seed:technologies` first.
 *
 *   npm run cleanup:superseded-technologies -- --dry-run   report only, change nothing
 *   npm run cleanup:superseded-technologies                deactivate the superseded rows
 */

const path = require('path');

// Load env the way index.js does — see server/CLAUDE.md. ENV_FILE is captured BEFORE the load
// because .env.development itself sets NODE_ENV=staging.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Technology = require('../models/Technology');
const InternProfile = require('../models/InternProfile');

// slug -> the granular slugs that replace it. A row is only retired once every replacement
// exists in the catalog, so this can never strand a skill with nothing to match instead.
const SUPERSEDED_BY = {
  'html-css': ['html', 'css'],
};

const isDryRun = process.argv.includes('--dry-run');

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} — database "${mongoose.connection.name}".`);

    const slugs = Object.keys(SUPERSEDED_BY);
    const rows = await Technology.find({ slug: { $in: slugs } })
      .select('_id name slug isActive')
      .lean();

    const retirable = [];

    for (const slug of slugs) {
      const row = rows.find((r) => r.slug === slug);
      if (!row) {
        console.log(`⏭️  ${slug} — not in this database, nothing to do.`);
        continue;
      }
      if (row.isActive === false) {
        console.log(`⏭️  ${row.name} (${slug}) — already retired.`);
        continue;
      }

      const replacements = SUPERSEDED_BY[slug];
      const present = await Technology.find({ slug: { $in: replacements }, isActive: true })
        .select('slug')
        .lean();
      const absent = replacements.filter((r) => !present.some((p) => p.slug === r));

      if (absent.length) {
        console.log(
          `⚠️  ${row.name} (${slug}) — SKIPPED, replacement(s) missing: ${absent.join(', ')}. ` +
            'Run `npm run seed:technologies` first.'
        );
        continue;
      }

      const declaredBy = await InternProfile.countDocuments({ selfTechnologies: row._id });
      console.log(
        `${isDryRun ? '📝 Would retire' : '🧹 Retiring'} ${row.name} (${slug}) → ` +
          `superseded by ${replacements.join(', ')}. Declared by ${declaredBy} intern(s)` +
          `${declaredBy ? ' — their existing declarations stay visible.' : '.'}`
      );
      retirable.push(row);
    }

    if (!retirable.length) {
      console.log('✅ Nothing to retire.');
      process.exit(0);
    }

    if (isDryRun) {
      console.log('\n🚫 Dry run — nothing was written.');
      process.exit(0);
    }

    const result = await Technology.updateMany(
      { _id: { $in: retirable.map((r) => r._id) } },
      { $set: { isActive: false } }
    );
    console.log(`\n✅ Retired ${result.modifiedCount} technolog(ies).`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
};

run();
