#!/usr/bin/env node
/**
 * Backfill — null legacy `secondaryMentor` values (ADR 0002)
 *
 * `secondaryMentor` used to be set ad-hoc at invite time and meant nothing
 * consistent. It is now repurposed to mean exactly "the specialization
 * mentor", marked by `specializationAssignedAt`. This script brings existing
 * data in line: it nulls `secondaryMentor` on any InternProfile where
 * `specializationAssignedAt` is still null, and leaves specialized profiles
 * untouched.
 *
 * ADDITIVE / IDEMPOTENT in the seeder sense — no documents are deleted, and a
 * second run modifies nothing (the filter only ever matches profiles that
 * still have the legacy value).
 *
 * CAUTION — this revokes real access: a legacy `secondaryMentor` currently
 * grants that mentor `isAssignedMentor` access to the intern. Nulling it
 * removes that access. This is intended, but it is a behavior change on live
 * data — run it once the team is ready to (re)assign specializations for
 * anyone who genuinely needs the pairing (see ticket 06).
 *
 *   npm run backfill:legacy-secondary-mentor -- --dry-run          report the plan, write nothing
 *   npm run backfill:legacy-secondary-mentor                       interactive; type the database name
 *   npm run backfill:legacy-secondary-mentor -- --yes=<dbname>     non-interactive (assertion required)
 */

const path = require('path');
const readline = require('readline');

// Load env the way index.js does, so this hits the database `npm run dev`
// (or the deployed process) actually reads. See server/CLAUDE.md.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const InternProfile = require('../models/InternProfile');

// ─────────────────────────────────────────────────────────────────────────────
// argv
// ─────────────────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const options = { dryRun: false, yes: undefined };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('--yes=')) options.yes = arg.slice('--yes='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
};

// ─────────────────────────────────────────────────────────────────────────────
// Target + confirmation
// ─────────────────────────────────────────────────────────────────────────────

const describeTarget = (uri) => {
  let host = '(unparseable)';
  let db = '(unparseable)';
  try {
    const parsed = new URL(uri);
    host = parsed.hostname;
    db = parsed.pathname.replace(/^\//, '') || 'test';
  } catch {
    /* leave the placeholders — the banner will show them */
  }
  return { host, db, isLocal: ['localhost', '127.0.0.1', '::1'].includes(host) };
};

const printBanner = (target) => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  LEGACY secondaryMentor BACKFILL — revokes real access           ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}

  NULLS    secondaryMentor on every InternProfile where
           specializationAssignedAt is still null.
  LEAVES   every specialized profile (specializationAssignedAt set) exactly
           as it is. Re-running touches nothing further.
`);
};

const confirm = async (target, options) => {
  printBanner(target);

  if (options.yes === true) {
    if (!target.isLocal) {
      console.error('❌ Bare --yes is only allowed against localhost.');
      console.error(`   For a remote target, assert the name:  --yes=${target.db}`);
      process.exit(1);
    }
    console.log('  --yes: skipping prompt (local target).\n');
    return;
  }

  if (typeof options.yes === 'string') {
    if (options.yes !== target.db) {
      console.error(`❌ --yes=${options.yes} does not match target database "${target.db}".`);
      process.exit(1);
    }
    console.log(`  --yes=${target.db}: assertion matched, skipping prompt.\n`);
    return;
  }

  if (!process.stdin.isTTY) {
    console.error('❌ Not a TTY and no --yes given — refusing to prompt into the void.');
    console.error(`   Use:  npm run backfill:legacy-secondary-mentor -- --yes=${target.db}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(
      `  This revokes real mentor access on live data. To proceed, type the\n` +
        `  database name exactly:  ${target.db}\n  (anything else cancels)\n\n> `,
      (value) => {
        rl.close();
        resolve(value.trim());
      }
    );
  });

  if (answer !== target.db) {
    console.log('\n❌ Cancelled. Nothing was changed.\n');
    process.exit(0);
  }
  console.log('');
};

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_FILTER = { specializationAssignedAt: null, secondaryMentor: { $ne: null } };

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error(`❌ MONGODB_URI is not set. Expected it in server/${ENV_FILE}.`);
    process.exit(1);
  }

  const target = describeTarget(process.env.MONGODB_URI);
  if (options.dryRun) {
    printBanner(target);
    console.log('  --dry-run: nothing will be written.\n');
  } else {
    await confirm(target, options);
  }

  await connectDB();

  if (mongoose.connection.name !== target.db) {
    console.error(
      `❌ Connected to "${mongoose.connection.name}" but the banner said "${target.db}". Aborting.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const matching = await InternProfile.countDocuments(LEGACY_FILTER);
  console.log(`  ${matching} profile(s) carry a legacy secondaryMentor.\n`);

  if (options.dryRun) {
    console.log('  --dry-run: nothing was written.\n');
    await mongoose.disconnect();
    return;
  }

  const result = await InternProfile.updateMany(LEGACY_FILTER, { $set: { secondaryMentor: null } });
  console.log(`✅ Nulled secondaryMentor on ${result.modifiedCount} profile(s).`);

  const violations = await InternProfile.countDocuments({
    secondaryMentor: { $ne: null },
    specializationAssignedAt: null,
  });
  console.log(
    violations === 0
      ? '✅ Invariant holds: every profile with a secondaryMentor also has specializationAssignedAt.'
      : `❌ Invariant violated: ${violations} profile(s) still carry secondaryMentor without a specializationAssignedAt.`
  );
  if (violations > 0) process.exitCode = 1;

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`\n❌ Backfill failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
