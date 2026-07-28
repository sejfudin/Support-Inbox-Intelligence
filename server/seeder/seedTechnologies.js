#!/usr/bin/env node
/**
 * Technology catalog sync — `npm run seed:technologies`
 *
 * NON-DESTRUCTIVE. Upserts the entries in defaultTechnologies.js with `$setOnInsert`, so it
 * only ever *adds* technologies that are missing. It never renames, reactivates or removes an
 * existing one, and it touches no other collection — safe to run against any environment,
 * including one with live intern data.
 *
 * Reach for this after adding entries to defaultTechnologies.js: the destructive `npm run seed`
 * is the only other path that seeds them, and you do not want to run that on a shared database.
 *
 *   npm run seed:technologies -- --dry-run    list what would be added, change nothing
 *   npm run seed:technologies                 add the missing technologies
 */

const path = require('path');

// Load env the way index.js does, so this hits the database `npm run dev` actually reads.
// Older scripts in this directory load plain `.env`, which points at a DIFFERENT cluster —
// see server/CLAUDE.md. ENV_FILE is captured BEFORE the load because .env.development itself
// sets NODE_ENV=staging, which would make the banner below report the wrong file.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;

require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Technology = require('../models/Technology');
const { slugify } = require('../helpers/slugify');
const DEFAULT_TECHNOLOGIES = require('./defaultTechnologies');
const { seedTechnologies } = require('./referenceData');

const isDryRun = process.argv.includes('--dry-run');

// Same slug resolution seedTechnologies() uses, so "missing" here means exactly what it
// would insert.
const resolveCatalog = () =>
  DEFAULT_TECHNOLOGIES.map((entry) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const slug = typeof entry === 'string' ? slugify(name) : entry.slug || slugify(name);
    return { name, slug };
  });

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} — database "${mongoose.connection.name}".`);

    const catalog = resolveCatalog();
    const existing = new Set((await Technology.find({}).select('slug').lean()).map((t) => t.slug));
    const missing = catalog.filter((t) => !existing.has(t.slug));

    console.log(`📚 Catalog: ${catalog.length} entries. In database: ${existing.size}.`);

    if (!missing.length) {
      console.log('✅ Nothing to add — every catalog technology already exists.');
      process.exit(0);
    }

    console.log(`${isDryRun ? '📝 Would add' : '➕ Adding'} ${missing.length}:`);
    for (const { name, slug } of missing) console.log(`   • ${name} (${slug})`);

    if (isDryRun) {
      console.log('\n🚫 Dry run — nothing was written.');
      process.exit(0);
    }

    await seedTechnologies();
    const total = await Technology.countDocuments();
    console.log(`\n✅ Done. ${total} technologies in the catalog.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

run();
