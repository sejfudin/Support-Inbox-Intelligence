#!/usr/bin/env node
/**
 * QA test accounts — `npm run seed:test-accounts`
 *
 * ADDITIVE and IDEMPOTENT: creates exactly two real, login-capable accounts —
 * one `mentor`, one `leadership` — both flagged `isTestAccount: true`. Matched
 * by email; an account that already exists is left untouched and reported as
 * present, never recreated or overwritten. Touches nothing else: no deletes, no
 * updates to any other user.
 *
 * `isTestAccount` is what keeps these two out of every user-facing listing
 * that shows mentors/leadership (mentor pickers, the mentor-notes audience
 * picker, the specialization picker, ...) — see `server/models/User.js` and
 * `adminService.getUsers`'s `includeTestAccounts` param, which only Platform
 * Management's "All Users" screen opts into. That exclusion is enforced at
 * read time regardless of which database this script populates.
 *
 * Unlike `seed:recommendations`, this deliberately has NO "refuse a database
 * that looks like production" guard — running this against production is the
 * actual point (per the task these accounts are for). The typed
 * database-name confirmation below is the safety gate instead: nothing is
 * written until a human reads the target and types its name back.
 *
 * The password is never hardcoded — required via TEST_ACCOUNT_PASSWORD in the
 * environment, so no real credential (however low-stakes) sits in git
 * history. Both accounts share one password; that's fine for a QA login, not
 * something anyone reuses for a real one.
 *
 *   TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts -- --dry-run
 *   TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts
 *   TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts -- --yes=<dbname>
 */

const path = require('path');
const readline = require('readline');

// Load env the way index.js does, so this hits the database `npm run dev`
// actually reads locally, or whatever MONGODB_URI is exported in the shell for
// a remote/production run. Captured BEFORE the load: .env.development itself
// sets NODE_ENV=staging, so reading process.env.NODE_ENV afterwards would name
// the wrong file in the banner. Never branch on NODE_ENV below either.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const Hub = require('../models/Hub');
const { ROLES } = require('../constants/roles');

const ACCOUNTS = [
  {
    role: ROLES.MENTOR,
    fullname: 'QA Mentor',
    email: 'qa.mentor@symphony.is',
  },
  {
    role: ROLES.LEADERSHIP,
    fullname: 'QA Leadership',
    email: 'qa.leadership@symphony.is',
  },
];

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
║  QA TEST ACCOUNTS — additive, nothing is deleted                 ║
╚══════════════════════════════════════════════════════════════════╝

  env file : ${ENV_FILE}
  host     : ${target.host}${target.isLocal ? '  (local)' : '  ⚠️  REMOTE / SHARED CLUSTER'}
  database : ${target.db}

  CREATES  ${ACCOUNTS.map((a) => `${a.email} (${a.role})`).join(', ')}, each
           active and login-ready, flagged isTestAccount: true.
  LEAVES   every existing user exactly as it is — an account that already
           exists (by email) is reported as present, not recreated.
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
    console.error(`   Use:  npm run seed:test-accounts -- --yes=${target.db}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(
      `  To proceed, type the database name exactly:  ${target.db}\n  (anything else cancels)\n\n> `,
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

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error(`❌ MONGODB_URI is not set. Expected it in server/${ENV_FILE}.`);
    process.exit(1);
  }

  const password = process.env.TEST_ACCOUNT_PASSWORD;
  if (!password && !options.dryRun) {
    console.error('❌ TEST_ACCOUNT_PASSWORD is not set. Refusing to invent a password.');
    console.error('   Usage: TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts');
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

  // A URI with no path resolves to `test` at the driver level — close the gap
  // between what the banner claimed and what we are about to write to.
  if (mongoose.connection.name !== target.db) {
    console.error(
      `❌ Connected to "${mongoose.connection.name}" but the banner said "${target.db}". Aborting.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const hub = await Hub.findOne().sort({ name: 1 });
  if (!hub && !options.dryRun) {
    console.error('❌ No hub exists in this database yet — seed reference data first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const results = [];
  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ email: account.email }).select('_id isTestAccount role');
    if (existing) {
      results.push({ ...account, outcome: existing.isTestAccount ? 'present' : 'CONFLICT' });
      continue;
    }
    results.push({ ...account, outcome: 'insert' });
  }

  const conflicts = results.filter((r) => r.outcome === 'CONFLICT');
  if (conflicts.length) {
    console.error('❌ Refusing to continue — email already belongs to a real (non-test) user:');
    conflicts.forEach((c) => console.error(`   ${c.email}`));
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('  Plan');
  results.forEach((r) =>
    console.log(
      `   ${r.outcome === 'insert' ? '+' : '·'} ${r.email.padEnd(28)} ${r.role.padEnd(10)} ${r.outcome}`
    )
  );

  if (options.dryRun) {
    console.log('\n  --dry-run: nothing was written.\n');
    await mongoose.disconnect();
    return;
  }

  const toInsert = results.filter((r) => r.outcome === 'insert');
  if (toInsert.length === 0) {
    console.log('\n✅ Both accounts already exist. Nothing to do.\n');
    await mongoose.disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  for (const account of toInsert) {
    await User.create({
      fullname: account.fullname,
      email: account.email,
      password: hashedPassword,
      role: account.role,
      hub: hub._id,
      active: true,
      status: 'active',
      isTestAccount: true,
    });
    console.log(`   created ${account.email}`);
  }

  console.log(`\n✅ Created ${toInsert.length} account(s). Hub: ${hub.name}.\n`);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`\n❌ Seeding test accounts failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exitCode = 1;
});
