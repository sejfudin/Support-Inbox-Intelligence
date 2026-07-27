#!/usr/bin/env node
/**
 * Technology catalog backfill — `npm run seed:technologies`
 *
 * NON-DESTRUCTIVE. Upserts every entry in defaultTechnologies.js by slug using
 * `$setOnInsert`, so existing technologies are never renamed, deactivated or removed and
 * nothing else in the database is touched. Safe to run repeatedly, and safe to run against
 * a database that already has interns declaring technologies.
 *
 * Run this after adding an entry to defaultTechnologies.js — databases seeded before the
 * addition otherwise stay on the old catalog, and CV auto-detection can only ever return
 * technologies that exist in the catalog (see helpers/cvTechnologyMatcher.js).
 *
 *   npm run seed:technologies -- --dry-run   list what would be added, change nothing
 *   npm run seed:technologies                apply
 */

const path = require('path');

// Load env the way index.js does, so this hits the database `npm run dev` actually reads.
// Captured BEFORE the load because .env.development itself sets NODE_ENV=staging — see
// server/CLAUDE.md. Never branch on NODE_ENV below.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Technology = require('../models/Technology');
const { seedTechnologies } = require('./referenceData');
const DEFAULT_TECHNOLOGIES = require('./defaultTechnologies');
const { slugify } = require('../helpers/slugify');

const isDryRun = process.argv.includes('--dry-run');

const expectedSlug = (entry) =>
  typeof entry === 'string' ? slugify(entry) : entry.slug || slugify(entry.name);

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} → ${mongoose.connection.name}`);

    const before = new Set((await Technology.find().select('slug').lean()).map((t) => t.slug));
    const missing = DEFAULT_TECHNOLOGIES.filter((entry) => !before.has(expectedSlug(entry)));

    if (!missing.length) {
      console.log(`✅ Catalog already complete — ${before.size} technologies, nothing to add.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const label = missing.map((e) => (typeof e === 'string' ? e : e.name)).join(', ');

    if (isDryRun) {
      console.log(`ℹ️  Dry run — would add ${missing.length}: ${label}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    await seedTechnologies();
    console.log(`✅ Added ${missing.length} technologies: ${label}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

run();
