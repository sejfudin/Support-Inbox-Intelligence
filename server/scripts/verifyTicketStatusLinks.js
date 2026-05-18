/**
 * Read-only verification after linkTicketStatusIds.js --execute.
 * Exits with code 1 if any tickets still have string status or broken ObjectId refs.
 *
 * Usage:
 *   node scripts/verifyTicketStatusLinks.js
 *   node scripts/verifyTicketStatusLinks.js --json
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');

const verifyWorkspace = async (workspace) => {
  const workspaceId = workspace._id;
  const statusIds = new Set(
    (await TicketStatus.find({ workspace: workspaceId }).select('_id').lean()).map((s) =>
      s._id.toString()
    )
  );

  const tickets = await Ticket.find({ workspace: workspaceId })
    .select('_id status')
    .lean();

  let stringStatus = 0;
  let brokenRef = 0;
  const stringSamples = [];
  const brokenSamples = [];

  for (const ticket of tickets) {
    const status = ticket.status;

    if (typeof status === 'string') {
      stringStatus += 1;
      if (stringSamples.length < 5) {
        stringSamples.push({ ticketId: ticket._id.toString(), status });
      }
      continue;
    }

    const idStr = status?.toString?.() || '';
    if (!idStr || !statusIds.has(idStr)) {
      brokenRef += 1;
      if (brokenSamples.length < 5) {
        brokenSamples.push({ ticketId: ticket._id.toString(), status: idStr });
      }
    }
  }

  return {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    ticketCount: tickets.length,
    stringStatus,
    brokenRef,
    stringSamples,
    brokenSamples,
    ok: stringStatus === 0 && brokenRef === 0,
  };
};

const run = async () => {
  const jsonOutput = process.argv.includes('--json');

  await connectDB();
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .select('_id name')
    .lean();

  const reports = [];
  for (const workspace of workspaces) {
    reports.push(await verifyWorkspace(workspace));
  }

  const totals = {
    workspaces: reports.length,
    stringStatus: reports.reduce((s, r) => s + r.stringStatus, 0),
    brokenRef: reports.reduce((s, r) => s + r.brokenRef, 0),
    ok: reports.every((r) => r.ok),
  };

  const payload = { generatedAt: new Date().toISOString(), totals, reports };

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('\n=== Verify ticket.status ObjectId links ===\n');
    console.log(`Workspaces: ${totals.workspaces}`);
    console.log(`Tickets with string status: ${totals.stringStatus}`);
    console.log(`Tickets with broken status ref: ${totals.brokenRef}`);
    console.log(totals.ok ? '\nAll workspaces OK.\n' : '\nISSUES FOUND — fix before deploying app code.\n');

    for (const report of reports) {
      if (report.ok) continue;
      console.log(`• ${report.workspaceName || report.workspaceId}`);
      if (report.stringStatus) {
        console.log(`    string status: ${report.stringStatus}`);
        for (const s of report.stringSamples) {
          console.log(`      ${s.ticketId}: "${s.status}"`);
        }
      }
      if (report.brokenRef) {
        console.log(`    broken ref: ${report.brokenRef}`);
        for (const s of report.brokenSamples) {
          console.log(`      ${s.ticketId}: ${s.status}`);
        }
      }
    }
  }

  await mongoose.disconnect();
  process.exit(totals.ok ? 0 : 1);
};

run().catch((err) => {
  console.error('Verify failed:', err);
  process.exit(1);
});
