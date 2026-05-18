/**
 * Reconcile ticket.status slugs and lifecycle fields for custom statuses rollout.
 *
 * Usage:
 *   node scripts/reconcileTicketStatuses.js --dry-run
 *   node scripts/reconcileTicketStatuses.js --execute
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const { reconcileAllWorkspaces } = require('../helpers/statusWorkspaceReconcile');

const printSummary = (results, dryRun) => {
  console.log(`\n=== Ticket status reconcile (${dryRun ? 'DRY RUN' : 'EXECUTE'}) ===\n`);

  let slugUpdates = 0;
  let lifecycleUpdates = 0;
  let integrationRepairs = 0;
  let seeded = 0;

  for (const row of results) {
    slugUpdates += row.slugUpdates;
    lifecycleUpdates += row.lifecycleUpdates;
    integrationRepairs += row.integrationRepairs;
    if (row.statusesSeeded) seeded += 1;

    console.log(
      `• ${row.workspaceName || row.workspaceId}: slug=${row.slugUpdates}, lifecycle=${row.lifecycleUpdates}, github=${row.integrationRepairs}${row.statusesSeeded ? ' (seeded statuses)' : ''}`
    );

    if (row.postAudit?.orphanTicketCount > 0) {
      console.log(`    remaining orphans: ${row.postAudit.orphanTicketCount}`);
    }
  }

  console.log('\nTotals:');
  console.log(`  workspaces seeded: ${seeded}`);
  console.log(`  slug updates: ${slugUpdates}`);
  console.log(`  lifecycle updates: ${lifecycleUpdates}`);
  console.log(`  integration repairs: ${integrationRepairs}`);
  console.log('');
};

const run = async () => {
  const dryRun = !process.argv.includes('--execute');
  if (!dryRun) {
    console.warn('WARNING: --execute will modify tickets and integrations in the target database.');
  }

  await connectDB();
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .select('_id name')
    .lean();

  const results = await reconcileAllWorkspaces(workspaces, { dryRun });
  printSummary(results, dryRun);

  const outPath = path.join(__dirname, 'last-status-reconcile.json');
  require('fs').writeFileSync(
    outPath,
    JSON.stringify({ dryRun, results, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`Full JSON written to ${outPath}`);

  await require('mongoose').disconnect();
};

run().catch((err) => {
  console.error('Reconcile failed:', err);
  process.exit(1);
});
