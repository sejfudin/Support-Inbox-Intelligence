/**
 * Converts ticket.status from slug strings to TicketStatus ObjectId references.
 * Run after migrateTicketStatuses.js and reconcileTicketStatuses.js --execute.
 *
 * IMPORTANT: Run this BEFORE deploying application code that defines Ticket.status
 * as ObjectId. If the model already expects ObjectId, use the native collection
 * reader below (enabled by default) so string slugs in MongoDB are not lost.
 *
 * Usage:
 *   node scripts/linkTicketStatusIds.js --dry-run
 *   node scripts/linkTicketStatusIds.js --execute
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const TicketStatus = require('../models/TicketStatus');
const { resolveTicketStatusSlug, pickFallbackSlug, slugifyLabel } = require('../helpers/statusSlugAliases');

const BULK_BATCH_SIZE = 500;

const buildSlugToIdMap = (statuses) => {
  const map = new Map();
  for (const status of statuses) {
    map.set(status.slug, status._id);
  }
  return map;
};

const readRawStatusValue = (rawDoc) => {
  const value = rawDoc?.status;
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) {
    return { type: 'objectId', value };
  }
  if (typeof value === 'object' && value.$oid) {
    return { type: 'objectId', value: new mongoose.Types.ObjectId(value.$oid) };
  }
  return String(value);
};

const linkWorkspace = async (workspace, { dryRun }) => {
  const workspaceId = workspace._id;
  const summary = {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    dryRun,
    ticketCount: 0,
    linked: 0,
    alreadyLinked: 0,
    skippedObjectId: 0,
    fallbackUsed: 0,
    emptySource: 0,
    samples: [],
  };

  const statuses = await TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
  if (statuses.length === 0) {
    summary.error = 'No TicketStatus rows — run migrateTicketStatuses.js first';
    return summary;
  }

  const slugToId = buildSlugToIdMap(statuses);
  const validIds = new Set(statuses.map((s) => s._id.toString()));
  const validSlugs = new Set(statuses.map((s) => s.slug));
  const fallbackSlug = pickFallbackSlug(statuses);
  const fallbackId = slugToId.get(fallbackSlug);

  const ticketsCollection = mongoose.connection.collection('tickets');
  const cursor = ticketsCollection.find(
    { workspace: workspaceId },
    { projection: { _id: 1, status: 1 } }
  );

  let bulkOps = [];

  const flushBulk = async () => {
    if (bulkOps.length === 0) return;
    if (!dryRun) {
      await ticketsCollection.bulkWrite(bulkOps, { ordered: false });
    }
    bulkOps = [];
  };

  for await (const rawDoc of cursor) {
    summary.ticketCount += 1;
    const rawStatus = readRawStatusValue(rawDoc);

    if (rawStatus && typeof rawStatus === 'object' && rawStatus.type === 'objectId') {
      const idStr = rawStatus.value.toString();
      if (validIds.has(idStr)) {
        summary.alreadyLinked += 1;
        continue;
      }
      summary.skippedObjectId += 1;
      if (summary.samples.length < 5) {
        summary.samples.push({
          ticketId: rawDoc._id.toString(),
          from: idStr,
          to: idStr,
          mapped: 'unknown_objectid',
        });
      }
      continue;
    }

    const rawSlug = typeof rawStatus === 'string' ? rawStatus : '';
    if (!slugifyLabel(rawSlug)) {
      summary.emptySource += 1;
    }

    const resolved = resolveTicketStatusSlug(rawSlug, validSlugs, { fallbackSlug });
    let targetId = slugToId.get(resolved.slug);

    if (!targetId) {
      targetId = fallbackId;
      summary.fallbackUsed += 1;
    } else if (resolved.mapped === 'fallback' || resolved.mapped === 'empty') {
      summary.fallbackUsed += 1;
    }

    if (!targetId) {
      summary.error = `Could not resolve status for ticket ${rawDoc._id}`;
      continue;
    }

    const currentIdStr =
      rawStatus && typeof rawStatus === 'object' && rawStatus.type === 'objectId'
        ? rawStatus.value.toString()
        : null;

    if (currentIdStr === targetId.toString()) {
      summary.alreadyLinked += 1;
      continue;
    }

    summary.linked += 1;
    if (summary.samples.length < 5) {
      summary.samples.push({
        ticketId: rawDoc._id.toString(),
        from: rawSlug || '(empty)',
        to: targetId.toString(),
        resolvedSlug: resolved.slug,
        mapped: resolved.mapped,
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: rawDoc._id },
        update: { $set: { status: targetId } },
      },
    });

    if (bulkOps.length >= BULK_BATCH_SIZE) {
      await flushBulk();
    }
  }

  await flushBulk();
  return summary;
};

const printSummary = (results, dryRun) => {
  console.log(`\n=== Link ticket.status to TicketStatus ObjectIds (${dryRun ? 'DRY RUN' : 'EXECUTE'}) ===\n`);

  let linked = 0;
  let alreadyLinked = 0;
  let fallbackUsed = 0;
  let emptySource = 0;
  let errors = 0;

  for (const row of results) {
    linked += row.linked || 0;
    alreadyLinked += row.alreadyLinked || 0;
    fallbackUsed += row.fallbackUsed || 0;
    emptySource += row.emptySource || 0;
    if (row.error) errors += 1;

    const label = row.error
      ? `ERROR: ${row.error}`
      : `linked=${row.linked}, already=${row.alreadyLinked}, fallback=${row.fallbackUsed}, emptySource=${row.emptySource}`;
    console.log(`• ${row.workspaceName || row.workspaceId}: ${label}`);

    for (const sample of row.samples || []) {
      const slugNote = sample.resolvedSlug ? ` -> ${sample.resolvedSlug}` : '';
      console.log(
        `    ${sample.ticketId}: "${sample.from}"${slugNote} (${sample.mapped})`
      );
    }
  }

  console.log('\nTotals:');
  console.log(`  tickets scanned: ${results.reduce((s, r) => s + (r.ticketCount || 0), 0)}`);
  console.log(`  linked: ${linked}`);
  console.log(`  already ObjectId: ${alreadyLinked}`);
  console.log(`  fallback used: ${fallbackUsed}`);
  console.log(`  empty/missing source slug: ${emptySource}`);
  console.log(`  workspace errors: ${errors}`);
  console.log('');
};

const run = async () => {
  const dryRun = !process.argv.includes('--execute');
  if (!dryRun) {
    console.warn('WARNING: --execute will set ticket.status to TicketStatus ObjectIds.');
  }

  await connectDB();
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .select('_id name')
    .lean();

  const results = [];
  for (const workspace of workspaces) {
    results.push(await linkWorkspace(workspace, { dryRun }));
  }

  printSummary(results, dryRun);

  const outPath = path.join(__dirname, 'last-status-link.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ dryRun, results, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`Full JSON written to ${outPath}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Link failed:', err);
  process.exit(1);
});
