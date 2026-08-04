#!/usr/bin/env node
/**
 * Stale workspace-pointer cleanup — `npm run cleanup:stale-workspace-pointers`
 *
 * `User.workspaceId` records the workspace a user last switched to. It is only a
 * pointer, never proof of membership, and it can outlive the membership that
 * made it valid:
 *
 *   - `switchWorkspace` sets it for platform admins without adding a member
 *     entry (admins bypass membership by design).
 *   - A role downgrade (admin/mentor → intern/leadership) removes the
 *     `canAccessAnyWorkspace` bypass but leaves the pointer behind.
 *   - A membership can be flipped to `invited` / `disabled` without the pointer
 *     being touched.
 *
 * Server-side reads now verify the pointer via `resolveActiveWorkspaceId`, so a
 * stale one no longer grants access. This script clears the leftover data, which
 * still drives what the UI offers (workspace switcher, "no workspace" state).
 *
 * Only users WITHOUT the any-workspace bypass are considered — a platform admin
 * or mentor pointing at a workspace they aren't a member of is legitimate.
 *
 * Idempotent and non-destructive beyond the single field: it `$unset`s
 * `workspaceId` when no active membership backs it, and repoints the user to
 * another workspace they *are* an active member of when one exists (same
 * fallback rule as `workspaceService.removeMember`).
 *
 *   npm run cleanup:stale-workspace-pointers -- --dry-run   report only
 *   npm run cleanup:stale-workspace-pointers -- --yes       skip the prompt
 */

const path = require('path');
const readline = require('readline');

// Capture the env filename before dotenv runs: `.env.development` itself sets
// NODE_ENV=staging, so reading process.env.NODE_ENV afterwards is misleading.
const ENV_FILE = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', ENV_FILE) });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { canAccessAnyWorkspace, isActiveWorkspaceMember } = require('../helpers/workspaceAuthz');

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_PROMPT = process.argv.includes('--yes');

// Every user whose pointer is set and whose role does not bypass membership.
const findCandidates = async () => {
  const users = await User.find({ workspaceId: { $ne: null, $exists: true } }).select(
    '_id fullname email role workspaceId'
  );

  return users.filter((user) => !canAccessAnyWorkspace(user.role));
};

const buildPlan = async (candidates) => {
  const workspaceIds = [...new Set(candidates.map((user) => user.workspaceId.toString()))];
  const workspaces = await Workspace.find({ _id: { $in: workspaceIds } }).select('name members');
  const workspaceById = new Map(workspaces.map((ws) => [ws._id.toString(), ws]));

  const plan = [];

  for (const user of candidates) {
    const pointerId = user.workspaceId.toString();
    const workspace = workspaceById.get(pointerId);

    if (isActiveWorkspaceMember(workspace, user._id)) continue;

    const fallback = await Workspace.findOne({
      _id: { $ne: user.workspaceId },
      members: { $elemMatch: { user: user._id, status: 'active' } },
    }).select('name');

    plan.push({
      user,
      reason: workspace ? 'no active membership' : 'workspace missing',
      workspaceName: workspace?.name ?? '(deleted)',
      fallback,
    });
  }

  return plan;
};

const confirm = (count) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`\n⚠️  About to rewrite workspaceId on ${count} user(s).`);
    console.log(`    Env file: ${ENV_FILE}`);
    console.log(`    Connected to: ${process.env.MONGODB_URI}\n`);
    rl.question('    Type "apply" to confirm, or anything else to cancel: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'apply');
    });
  });

const run = async () => {
  await connectDB();

  const candidates = await findCandidates();
  console.log(`Checked ${candidates.length} non-bypass user(s) with a workspace pointer.`);

  const plan = await buildPlan(candidates);

  if (plan.length === 0) {
    console.log('✅ No stale workspace pointers found. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  console.log(`\nFound ${plan.length} stale pointer(s):`);
  plan.forEach(({ user, reason, workspaceName, fallback }) => {
    const action = fallback ? `repoint → "${fallback.name}"` : 'unset';
    console.log(`  - ${user.email} (${user.role}) → "${workspaceName}" [${reason}] :: ${action}`);
  });

  if (DRY_RUN) {
    console.log('\n--dry-run: no changes made.');
    await mongoose.connection.close();
    return;
  }

  const confirmed = SKIP_PROMPT || (await confirm(plan.length));

  if (!confirmed) {
    console.log('Cancelled. No changes made.');
    await mongoose.connection.close();
    return;
  }

  let unset = 0;
  let repointed = 0;

  for (const { user, fallback } of plan) {
    if (fallback) {
      await User.findByIdAndUpdate(user._id, { workspaceId: fallback._id });
      repointed += 1;
    } else {
      await User.findByIdAndUpdate(user._id, { $unset: { workspaceId: '' } });
      unset += 1;
    }
  }

  console.log(`\n🧹 Unset ${unset} pointer(s), repointed ${repointed} to an active membership.`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
