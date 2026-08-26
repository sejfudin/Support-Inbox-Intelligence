/**
 * Naming the database a repair script is about to write to, and making the
 * operator say that name back.
 *
 * The repair scripts deliberately do NOT refuse a production-looking database
 * name — repairing production is the reason they exist. That removes the guard
 * the seeders rely on, so this one takes its place: a write always names its own
 * target out loud.
 */

const readline = require('readline');

/**
 * Host and database name from `MONGODB_URI`, for the banner. A URI with no path
 * is the case worth knowing about: the driver silently falls back to `test`, so
 * a deployment that forgot the database name is running on a database called
 * `test`, and the banner should say so rather than guess something friendlier.
 */
const describeTarget = () => {
  const uri = process.env.MONGODB_URI || '';
  let host = '(unparseable URI)';
  let db = '(unknown)';
  try {
    const parsed = new URL(uri);
    host = parsed.hostname;
    db = parsed.pathname.replace(/^\//, '') || 'test';
  } catch {
    /* leave the placeholders — the banner will show them */
  }
  return { host, db, isLocal: ['localhost', '127.0.0.1', '::1'].includes(host) };
};

/**
 * Block until the operator asserts the database name, or exit.
 *
 * `options.yes` is either absent (prompt), the string the operator passed
 * (`--yes=<db>`, compared against the target), or `true` for a bare `--yes`,
 * which is refused. No localhost exemption: a bare `--yes` accepted on a local
 * database is how the habit of typing it gets built, and the habit is what
 * eventually meets a remote URI.
 *
 * `command` is the npm script name and `writeFlag` the flag that asked for the
 * write, so the error text is the exact line to re-run rather than a generic
 * shape. Getting `writeFlag` wrong is not cosmetic: an operator who copies a
 * suggested command that names a flag the script does not have learns to distrust
 * the message and reaches for `--yes` on its own.
 */
const confirmDatabaseName = async (target, options, command, writeFlag = '--apply') => {
  const rerun = `npm run ${command} -- ${writeFlag} --yes=${target.db}`;

  if (options.yes === true) {
    console.error('❌ Bare --yes is not accepted. Assert the database name:');
    console.error(`   ${rerun}`);
    process.exit(1);
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
    console.error(`   Use:  ${rerun}`);
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
    console.log('\n  Cancelled. Nothing was written.\n');
    process.exit(0);
  }
  console.log('');
};

module.exports = { describeTarget, confirmDatabaseName };
