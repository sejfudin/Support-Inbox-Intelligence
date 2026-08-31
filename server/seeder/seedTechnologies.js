#!/usr/bin/env node
/**
 * Technology catalog sync — `npm run seed:technologies`
 *
 * NON-DESTRUCTIVE. Upserts the entries in defaultTechnologies.js with `$setOnInsert`, so it
 * only ever *adds* technologies that are missing. It never renames, reactivates or removes an
 * existing one, and it touches no other collection — safe to run against any environment,
 * including one with live intern data.
 *
 * The one field it does re-assert on existing rows is `category`, which is what decides
 * whether a row lists under technologies or under AI skills. Declarations, readiness flags and
 * staffing rows key off the slug and are untouched by a category move — the row just changes
 * which section it appears in.
 *
 * Reach for this after adding entries to defaultTechnologies.js: the destructive `npm run seed`
 * is the only other path that seeds them, and you do not want to run that on a shared database.
 *
 *   npm run seed:technologies -- --dry-run           list what would be added, change nothing
 *   npm run seed:technologies                        add the missing technologies
 *   npm run seed:technologies -- --category=ai       only the AI skills half of the catalog
 *
 * `--category` narrows the run to one half (`general` | `ai`). Entries in the other half are
 * not read and their rows are not written to at all — reach for it on a shared database when
 * the change you are shipping is only one half of the catalog.
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
const { DEFAULT_TECHNOLOGY_CATEGORY, TECHNOLOGY_CATEGORIES } = require('../constants/technologies');

const isDryRun = process.argv.includes('--dry-run');

// `--category=ai`, or `--category ai`. Returns null when the flag is absent and the raw value
// (possibly '') when it is present — a present-but-empty flag (`--category`, `--category=`) is
// rejected below rather than falling through to an unscoped full run over the whole catalog.
const readCategoryArg = () => {
  const inline = process.argv.find((arg) => arg.startsWith('--category='));
  if (inline) return inline.slice('--category='.length);
  const index = process.argv.indexOf('--category');
  if (index === -1) return null;
  return process.argv[index + 1] ?? '';
};

const categoryFilter = readCategoryArg();

if (categoryFilter !== null && !TECHNOLOGY_CATEGORIES.includes(categoryFilter)) {
  const reason = categoryFilter
    ? `Unknown --category "${categoryFilter}"`
    : '--category needs a value';
  console.error(`❌ ${reason}. Expected one of: ${TECHNOLOGY_CATEGORIES.join(', ')}.`);
  process.exit(1);
}

// Same slug resolution seedTechnologies() uses, so "missing" here means exactly what it
// would insert.
const resolveCatalog = () =>
  DEFAULT_TECHNOLOGIES.map((entry) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const slug = typeof entry === 'string' ? slugify(name) : entry.slug || slugify(name);
    const category =
      (typeof entry === 'string' ? undefined : entry.category) || DEFAULT_TECHNOLOGY_CATEGORY;
    return { name, slug, category };
  });

const run = async () => {
  try {
    await connectDB();
    console.log(`🟢 Connected using ${ENV_FILE} — database "${mongoose.connection.name}".`);

    const catalog = resolveCatalog().filter(
      (entry) => !categoryFilter || entry.category === categoryFilter
    );
    if (categoryFilter) console.log(`🎯 Scoped to category "${categoryFilter}".`);
    const existing = new Map(
      (await Technology.find({}).select('slug category').lean()).map((t) => [t.slug, t])
    );
    const missing = catalog.filter((t) => !existing.has(t.slug));
    // A row whose stored category no longer matches the catalog — either it predates the
    // field entirely, or the catalog moved it between the two lists.
    const recategorized = catalog.filter((t) => {
      const row = existing.get(t.slug);
      return row && (row.category || DEFAULT_TECHNOLOGY_CATEGORY) !== t.category;
    });

    console.log(
      `📚 Catalog: ${catalog.length} entries${categoryFilter ? ' in scope' : ''}. In database: ${existing.size} (all categories).`
    );

    if (!missing.length && !recategorized.length) {
      console.log('✅ Nothing to do — every catalog technology exists with the right category.');
      process.exit(0);
    }

    if (missing.length) {
      console.log(`${isDryRun ? '📝 Would add' : '➕ Adding'} ${missing.length}:`);
      for (const { name, slug, category } of missing) {
        console.log(`   • ${name} (${slug})${category === 'ai' ? ' — AI skill' : ''}`);
      }
    }

    if (recategorized.length) {
      console.log(
        `${isDryRun ? '📝 Would recategorize' : '🔀 Recategorizing'} ${recategorized.length}:`
      );
      for (const { name, slug, category } of recategorized) {
        const from = existing.get(slug).category || '(unset)';
        console.log(`   • ${name} (${slug}): ${from} → ${category}`);
      }
    }

    if (isDryRun) {
      console.log('\n🚫 Dry run — nothing was written.');
      process.exit(0);
    }

    await seedTechnologies(categoryFilter ? { category: categoryFilter } : {});
    const total = await Technology.countDocuments();
    const aiTotal = await Technology.countDocuments({ category: 'ai' });
    console.log(`\n✅ Done. ${total} technologies in the catalog (${aiTotal} AI skills).`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

run();
