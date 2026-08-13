#!/usr/bin/env node
/**
 * Retire superseded positions — `npm run cleanup:superseded-positions`
 *
 * The canonical Position catalog (seeder/defaultPositions.js) was replaced with a fixed
 * 15-title list. A handful of positions from the old catalog aren't on it anymore
 * ('data-analyst', 'cloud-engineer', 'security-engineer', 'product-designer').
 *
 * Deactivates rather than deletes: getAllPositions skips isActive: false, so the row
 * disappears from every picker (recommendation form, intern position declaration) while any
 * intern or recommendation that already references it keeps a valid ObjectId. Delete would
 * leave InternProfile.declaredPosition/secondaryPosition and Recommendation.position dangling.
 *
 *   npm run cleanup:superseded-positions -- --dry-run   report only, change nothing
 *   npm run cleanup:superseded-positions                deactivate the superseded rows
 */

const path = require('path');

// Load env the way index.js does — see server/CLAUDE.md. ENV_FILE is captured BEFORE the load
// because .env.development itself sets NODE_ENV=staging.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Position = require('../models/Position');
const InternProfile = require('../models/InternProfile');
const Recommendation = require('../models/Recommendation');

const SUPERSEDED_SLUGS = [
  'data-analyst',
  'cloud-engineer',
  'security-engineer',
  'product-designer',
];

const isDryRun = process.argv.includes('--dry-run');

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} — database "${mongoose.connection.name}".`);

    const rows = await Position.find({ slug: { $in: SUPERSEDED_SLUGS } })
      .select('_id name slug isActive')
      .lean();

    const retirable = [];

    for (const slug of SUPERSEDED_SLUGS) {
      const row = rows.find((r) => r.slug === slug);
      if (!row) {
        console.log(`⏭️  ${slug} — not in this database, nothing to do.`);
        continue;
      }
      if (row.isActive === false) {
        console.log(`⏭️  ${row.name} (${slug}) — already retired.`);
        continue;
      }

      const [declaredBy, recommendedFor] = await Promise.all([
        InternProfile.countDocuments({
          $or: [{ declaredPosition: row._id }, { secondaryPosition: row._id }],
        }),
        Recommendation.countDocuments({ position: row._id }),
      ]);

      console.log(
        `${isDryRun ? '📝 Would retire' : '🧹 Retiring'} ${row.name} (${slug}). ` +
          `Declared by ${declaredBy} intern(s), used on ${recommendedFor} recommendation(s)` +
          `${declaredBy || recommendedFor ? ' — those references stay valid.' : '.'}`
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

    const result = await Position.updateMany(
      { _id: { $in: retirable.map((r) => r._id) } },
      { $set: { isActive: false } }
    );
    console.log(`\n✅ Retired ${result.modifiedCount} position(s).`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
};

run();
