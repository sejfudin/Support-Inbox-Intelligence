/**
 * Read-only audit for custom ticket status rollout.
 *
 * Usage:
 *   node scripts/auditTicketStatuses.js
 *   node scripts/auditTicketStatuses.js --json > audit.json
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const {
  auditAllWorkspaces,
  summarizeReports,
} = require('../helpers/statusWorkspaceAudit');

const printHumanReport = (reports, totals) => {
  console.log('\n=== Ticket status audit (read-only) ===\n');
  console.log(`Workspaces: ${totals.workspaces}`);
  console.log(`Need status seed: ${totals.needsStatusSeed}`);
  console.log(`Orphan tickets (unknown status slug): ${totals.orphanTicketCount}`);
  console.log(`Missing doneAt on done statuses: ${totals.missingDoneAt}`);
  console.log(`Missing inProgressAt on tracks-time statuses: ${totals.missingInProgressAt}`);
  console.log(`Stale doneAt on non-done statuses: ${totals.staleDoneAt}`);
  console.log(`Stale inProgressAt on non-tracks-time statuses: ${totals.staleInProgressAt}`);
  console.log(`Invalid GitHub target slugs: ${totals.invalidIntegrationTargets}\n`);

  for (const report of reports) {
    const issues = [];
    if (report.needsStatusSeed) issues.push('needs seed');
    if (report.orphanTicketCount > 0) issues.push(`${report.orphanTicketCount} orphan tickets`);
    if (report.lifecycle.missingDoneAt > 0) {
      issues.push(`${report.lifecycle.missingDoneAt} missing doneAt`);
    }
    if (report.lifecycle.missingInProgressAt > 0) {
      issues.push(`${report.lifecycle.missingInProgressAt} missing inProgressAt`);
    }
    if (report.lifecycle.staleDoneAt > 0) {
      issues.push(`${report.lifecycle.staleDoneAt} stale doneAt`);
    }
    if (report.lifecycle.staleInProgressAt > 0) {
      issues.push(`${report.lifecycle.staleInProgressAt} stale inProgressAt`);
    }
    if (report.integration.invalidTargets.length > 0) {
      issues.push(`${report.integration.invalidTargets.length} invalid GitHub targets`);
    }

    const statusLabel = issues.length ? issues.join('; ') : 'ok';
    console.log(`• ${report.workspaceName || report.workspaceId} — ${statusLabel}`);

    if (report.orphanSlugs.length) {
      for (const row of report.orphanSlugs) {
        console.log(`    orphan slug "${row.slug}": ${row.count} tickets`);
      }
    }
  }

  console.log('');
};

const run = async () => {
  const jsonOutput = process.argv.includes('--json');

  await connectDB();
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .select('_id name')
    .lean();

  const reports = await auditAllWorkspaces(workspaces);
  const totals = summarizeReports(reports);
  const payload = { generatedAt: new Date().toISOString(), totals, reports };

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanReport(reports, totals);
    const outPath = path.join(__dirname, 'last-status-audit.json');
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`Full JSON written to ${outPath}`);
  }

  await require('mongoose').disconnect();
};

run().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
