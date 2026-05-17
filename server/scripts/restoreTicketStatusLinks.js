/**
 * Repairs tickets incorrectly linked to a single status (e.g. all "to do") when
 * linkTicketStatusIds.js ran after the ObjectId model was deployed and could not
 * read legacy string slugs from MongoDB.
 *
 * Reconstructs status from ticket history + lifecycle fields (doneAt, inProgressAt).
 *
 * Usage:
 *   node scripts/restoreTicketStatusLinks.js --dry-run
 *   node scripts/restoreTicketStatusLinks.js --execute
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const History = require('../models/History');
const { slugifyLabel, resolveTicketStatusSlug, pickFallbackSlug } = require('../helpers/statusSlugAliases');

const STATUS_CHANGE_RE =
  /status (?:automatically )?changed from .+? to (.+?)(?:\s*\(|$)/i;

const parseStatusSlugFromHistoryAction = (action) => {
  const match = String(action || '').match(STATUS_CHANGE_RE);
  if (!match) return '';
  return slugifyLabel(match[1]);
};

const inferSlugFromLifecycle = (ticket, statusByFlag) => {
  if (ticket.doneAt) {
    return statusByFlag.done?.slug || null;
  }
  if (ticket.inProgressAt) {
    return statusByFlag.tracksTime?.slug || null;
  }
  if (ticket.isArchived && statusByFlag.done) {
    return statusByFlag.done.slug;
  }
  return null;
};

const buildStatusMaps = (statuses) => {
  const slugToId = new Map(statuses.map((s) => [s.slug, s._id]));
  const validSlugs = new Set(statuses.map((s) => s.slug));
  const statusByFlag = {
    backlog: statuses.find((s) => s.isBacklog),
    tracksTime: statuses.find((s) => s.tracksTime),
    done: statuses.find((s) => s.isDone),
  };
  const fallbackSlug = pickFallbackSlug(statuses);
  return { slugToId, validSlugs, statusByFlag, fallbackSlug };
};

const restoreWorkspace = async (workspace, { dryRun }) => {
  const workspaceId = workspace._id;
  const summary = {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    dryRun,
    ticketCount: 0,
    updated: 0,
    unchanged: 0,
    fromHistory: 0,
    fromLifecycle: 0,
    fromFallback: 0,
    samples: [],
  };

  const statuses = await TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
  if (statuses.length === 0) {
    summary.error = 'No TicketStatus rows';
    return summary;
  }

  const { slugToId, validSlugs, statusByFlag, fallbackSlug } = buildStatusMaps(statuses);
  const mainBoardId = slugToId.get(fallbackSlug);

  const tickets = await Ticket.find({ workspace: workspaceId })
    .select('_id status doneAt inProgressAt isArchived updatedAt')
    .lean();

  const ticketIds = tickets.map((t) => t._id);
  const historyRows = await History.find({
    ticketId: { $in: ticketIds },
    action: /status changed/i,
  })
    .sort({ timestamp: -1 })
    .select('ticketId action timestamp')
    .lean();

  const latestSlugByTicket = new Map();
  for (const row of historyRows) {
    const ticketKey = row.ticketId.toString();
    if (latestSlugByTicket.has(ticketKey)) continue;
    const slug = parseStatusSlugFromHistoryAction(row.action);
    if (slug) latestSlugByTicket.set(ticketKey, slug);
  }

  const ticketsCollection = mongoose.connection.collection('tickets');
  let bulkOps = [];

  const flushBulk = async () => {
    if (bulkOps.length === 0) return;
    if (!dryRun) {
      await ticketsCollection.bulkWrite(bulkOps, { ordered: false });
    }
    bulkOps = [];
  };

  for (const ticket of tickets) {
    summary.ticketCount += 1;
    const ticketKey = ticket._id.toString();
    const currentId = ticket.status?.toString?.() || String(ticket.status || '');

    let inferredSlug = latestSlugByTicket.get(ticketKey) || '';
    let source = 'history';

    if (!inferredSlug) {
      inferredSlug = inferSlugFromLifecycle(ticket, statusByFlag) || '';
      source = 'lifecycle';
    }

    if (!inferredSlug) {
      inferredSlug = fallbackSlug;
      source = 'fallback';
    }

    const resolved = resolveTicketStatusSlug(inferredSlug, validSlugs, { fallbackSlug });
    const targetId = slugToId.get(resolved.slug) || mainBoardId;

    if (!targetId) continue;

    if (currentId === targetId.toString()) {
      summary.unchanged += 1;
      continue;
    }

    summary.updated += 1;
    if (source === 'history') summary.fromHistory += 1;
    else if (source === 'lifecycle') summary.fromLifecycle += 1;
    else summary.fromFallback += 1;

    if (summary.samples.length < 8) {
      summary.samples.push({
        ticketId: ticketKey,
        source,
        inferredSlug,
        resolvedSlug: resolved.slug,
        fromStatusId: currentId,
        toStatusId: targetId.toString(),
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: ticket._id },
        update: { $set: { status: targetId } },
      },
    });

    if (bulkOps.length >= 500) {
      await flushBulk();
    }
  }

  await flushBulk();
  return summary;
};

const printSummary = (results, dryRun) => {
  console.log(`\n=== Restore ticket.status links (${dryRun ? 'DRY RUN' : 'EXECUTE'}) ===\n`);

  for (const row of results) {
    const label = row.error
      ? `ERROR: ${row.error}`
      : `updated=${row.updated}, unchanged=${row.unchanged} (history=${row.fromHistory}, lifecycle=${row.fromLifecycle}, fallback=${row.fromFallback})`;
    console.log(`• ${row.workspaceName || row.workspaceId}: ${label}`);
    for (const sample of row.samples || []) {
      console.log(
        `    ${sample.ticketId}: ${sample.source} "${sample.inferredSlug}" -> ${sample.resolvedSlug}`
      );
    }
  }

  const totals = results.reduce(
    (acc, row) => ({
      updated: acc.updated + (row.updated || 0),
      fromHistory: acc.fromHistory + (row.fromHistory || 0),
      fromLifecycle: acc.fromLifecycle + (row.fromLifecycle || 0),
    }),
    { updated: 0, fromHistory: 0, fromLifecycle: 0 }
  );

  console.log('\nTotals:');
  console.log(`  updated: ${totals.updated}`);
  console.log(`  from history: ${totals.fromHistory}`);
  console.log(`  from lifecycle: ${totals.fromLifecycle}`);
  console.log('');
};

const run = async () => {
  const dryRun = !process.argv.includes('--execute');
  if (!dryRun) {
    console.warn('WARNING: --execute will rewrite ticket.status ObjectIds from history/lifecycle evidence.');
  }

  await connectDB();
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .select('_id name')
    .lean();

  const results = [];
  for (const workspace of workspaces) {
    results.push(await restoreWorkspace(workspace, { dryRun }));
  }

  printSummary(results, dryRun);

  const outPath = path.join(__dirname, 'last-status-restore.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ dryRun, results, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`Full JSON written to ${outPath}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
