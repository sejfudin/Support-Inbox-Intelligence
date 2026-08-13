#!/usr/bin/env node
/**
 * Retire whole-discipline technologies — `npm run cleanup:discipline-technologies`
 *
 * A handful of catalog rows named a whole discipline rather than a concrete tool, language,
 * or framework ('devops', 'data-engineering', 'data-science', 'machine-learning') — each one
 * duplicates a Position title (DevOps Engineer, Data Engineer, ML Engineer). Picking "DevOps"
 * under Technologies when it's really a specialization was confusing, so these were dropped
 * from seeder/defaultTechnologies.js; this retires any copy a previous seed run already wrote.
 * createTechnology now rejects new entries that overlap a position name the same way — see
 * helpers/roleCatalog.js.
 *
 * Deactivates rather than deletes: matchTechnologiesInText and getAllTechnologies both skip
 * isActive: false, so the row disappears from CV scanning and every picker, while any intern
 * who already declared it keeps a valid reference (their profile still renders it).
 *
 *   npm run cleanup:discipline-technologies -- --dry-run   report only, change nothing
 *   npm run cleanup:discipline-technologies                deactivate the discipline rows
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

const DISCIPLINE_SLUGS = ['devops', 'data-engineering', 'data-science', 'machine-learning'];

const isDryRun = process.argv.includes('--dry-run');

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} — database "${mongoose.connection.name}".`);

    const rows = await Technology.find({ slug: { $in: DISCIPLINE_SLUGS } })
      .select('_id name slug isActive')
      .lean();

    const retirable = [];

    for (const slug of DISCIPLINE_SLUGS) {
      const row = rows.find((r) => r.slug === slug);
      if (!row) {
        console.log(`⏭️  ${slug} — not in this database, nothing to do.`);
        continue;
      }
      if (row.isActive === false) {
        console.log(`⏭️  ${row.name} (${slug}) — already retired.`);
        continue;
      }

      const declaredBy = await InternProfile.countDocuments({
        $or: [{ selfTechnologies: row._id }, { cvTechnologies: row._id }],
      });
      console.log(
        `${isDryRun ? '📝 Would retire' : '🧹 Retiring'} ${row.name} (${slug}) — duplicates a ` +
          `position title. Declared by ${declaredBy} intern(s)` +
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
