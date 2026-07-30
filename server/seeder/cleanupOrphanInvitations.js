const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Invitation = require('../models/Invitation');
const User = require('../models/User');

// Finds "orphaned" pending invitations: invitations whose referenced user no
// longer exists (or is missing). These render as "Unassigned / Pending user" in
// the Workspace Management UI and, before the cancel-by-id fix, could not be
// cancelled because the cancel action keyed off a (now missing) user id.
const findOrphanedInvitations = async () => {
  const pending = await Invitation.find({ status: 'pending' }).select('_id user workspace').lean();

  const userIds = [...new Set(pending.filter((inv) => inv.user).map((inv) => inv.user.toString()))];
  const existingUsers = await User.find({ _id: { $in: userIds } })
    .select('_id')
    .lean();
  const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

  return pending.filter((inv) => !inv.user || !existingUserIds.has(inv.user.toString()));
};

const confirm = (count) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`\n⚠️  About to permanently delete ${count} orphaned pending invitation(s).`);
    console.log(`    Connected to: ${process.env.MONGODB_URI}\n`);
    rl.question('    Type "delete" to confirm, or anything else to cancel: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'delete');
    });
  });

const run = async () => {
  await connectDB();

  const orphans = await findOrphanedInvitations();

  if (orphans.length === 0) {
    console.log('✅ No orphaned pending invitations found. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  console.log(`Found ${orphans.length} orphaned pending invitation(s):`);
  orphans.forEach((inv) => {
    console.log(
      `  - invitation ${inv._id} (workspace ${inv.workspace}, user ${inv.user ?? 'none'})`
    );
  });

  // `--yes` skips the interactive prompt (useful for CI / non-interactive runs).
  const skipPrompt = process.argv.includes('--yes');
  const confirmed = skipPrompt || (await confirm(orphans.length));

  if (!confirmed) {
    console.log('Cancelled. No changes made.');
    await mongoose.connection.close();
    return;
  }

  const ids = orphans.map((inv) => inv._id);
  const result = await Invitation.deleteMany({ _id: { $in: ids } });
  console.log(`🧹 Deleted ${result.deletedCount} orphaned pending invitation(s).`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
