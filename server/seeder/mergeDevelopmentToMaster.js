/**
 * Runs, in order, every non-destructive migration/backfill needed to bring an
 * existing main-branch database up to date with the `development` schema
 * changes (Recommendation redesign, InternProfile.readyForPlacement removal).
 *
 * Deliberately does NOT include `backfillInternPositions.js` — that script
 * assigns a RANDOM Position to any intern profile missing `declaredPosition`,
 * which is fine for demo data but wrong for real intern records. Leave
 * `declaredPosition` null on main; `backfillRecommendationFields.js` already
 * falls back to a default Position per-record when it's missing, and mentors
 * can set the real declaredPosition manually.
 *
 * Each step below is its own idempotent, safe-to-re-run script (see the
 * comment block at the top of each for what it does). This wrapper just
 * enforces the order they must run in and stops at the first failure so a
 * partial migration can be retried without duplicating work already done.
 *
 * Usage: NODE_ENV=production node seeder/mergeDevelopmentToMaster.js
 *
 * The 4 underlying scripts don't agree on how they load env: some read plain
 * `.env`, `migrateRecommendationProjects.js` reads `.env.${NODE_ENV}`. Left
 * alone, that split could point different steps at different databases. This
 * wrapper resolves `.env.${NODE_ENV}` itself and loads it into `process.env`
 * *before* spawning any child — dotenv's `.config()` never overrides a
 * variable already present in `process.env`, so every child's own (differing)
 * dotenv call becomes a no-op for `MONGODB_URI` and all 4 steps hit the same
 * database this wrapper resolved.
 *
 * Capture NODE_ENV before the load, not after: `.env.development` itself sets
 * NODE_ENV=staging, so reading it post-load would be misleading (same
 * footgun `seedDemoData.js` avoids).
 */
const path = require('path');
const { execFileSync } = require('child_process');

const capturedNodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.join(__dirname, '..', `.env.${capturedNodeEnv}`);
require('dotenv').config({ path: envPath });

if (!process.env.MONGODB_URI) {
  console.error(`❌ No MONGODB_URI found after loading ${envPath}. Aborting before any step runs.`);
  process.exit(1);
}

let dbHost = process.env.MONGODB_URI;
try {
  dbHost = new URL(process.env.MONGODB_URI).host;
} catch {
  // Not a parseable URL (e.g. mongodb+srv without a host-only form) — fall
  // through and print the raw value's origin only if parsing fails harmlessly.
}
console.log(`🔎 Target database host: ${dbHost} (from ${path.basename(envPath)})`);
console.log('   Ctrl+C now if this is not the intended database.\n');

const STEPS = [
  {
    file: 'seedPositions.js',
    why: 'Position catalog must exist before recommendation position backfill can fall back to it.',
  },
  {
    file: 'migrateRecommendationProjects.js',
    why: 'Creates the "Unspecified" sentinel Project and repoints legacy free-text `project` values at it. Must run before backfillRecommendationFields since that script assumes `project` is already a valid ref.',
  },
  {
    file: 'backfillRecommendationFields.js',
    why: 'Rewrites retired `draft` status to `recommended`, backfills the now-required `position`, drops stale history rows, and tops up status History for old records.',
  },
  {
    file: 'unsetReadyForPlacement.js',
    why: 'Removes the orphaned `readyForPlacement` boolean now that InternProfile.status covers the same concept via the `ready` value.',
  },
];

const run = () => {
  for (const step of STEPS) {
    const scriptPath = path.join(__dirname, step.file);
    console.log(`\n▶️  Running ${step.file}`);
    console.log(`   ${step.why}`);
    execFileSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  }
  console.log('\n✅ All migrations complete.');
};

run();
