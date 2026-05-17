/**
 * Maps integration settings slug fields to TicketStatus ObjectIds.
 *
 * Usage (from server/):
 *   node scripts/migrateIntegrationStatusIds.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Integration = require('../models/Integration');
const TicketStatus = require('../models/TicketStatus');
const isDryRun = process.argv.includes('--dry-run');

const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

async function migrateIntegration(integration, statuses) {
  const settings = integration.settings || {};
  const slugToId = new Map(statuses.map((s) => [s.slug, s._id]));
  const repairs = {};

  const mergeSlug = settings.onMergeTargetStatus ? slugifyLabel(settings.onMergeTargetStatus) : '';
  const prOpenSlug = settings.onPROpenTargetStatus ? slugifyLabel(settings.onPROpenTargetStatus) : '';

  if (!settings.onMergeTargetStatusId && mergeSlug && slugToId.has(mergeSlug)) {
    repairs.onMergeTargetStatusId = slugToId.get(mergeSlug);
  }
  if (!settings.onPROpenTargetStatusId && prOpenSlug && slugToId.has(prOpenSlug)) {
    repairs.onPROpenTargetStatusId = slugToId.get(prOpenSlug);
  }

  if (Object.keys(repairs).length === 0) {
    return { updated: false };
  }

  if (!isDryRun) {
    await Integration.updateOne(
      { _id: integration._id },
      {
        $set: {
          'settings.onMergeTargetStatusId':
            repairs.onMergeTargetStatusId ?? settings.onMergeTargetStatusId,
          'settings.onPROpenTargetStatusId':
            repairs.onPROpenTargetStatusId ?? settings.onPROpenTargetStatusId,
        },
      }
    );
  }

  return { updated: true, repairs };
}

async function main() {
  await connectDB();

  const integrations = await Integration.find({ isConnected: true }).lean();
  let updated = 0;

  for (const integration of integrations) {
    const statuses = await TicketStatus.find({ workspace: integration.workspace }).lean();
    if (statuses.length === 0) {
      console.warn(`Workspace ${integration.workspace}: no statuses, skipping`);
      continue;
    }

    const result = await migrateIntegration(integration, statuses);
    if (result.updated) {
      updated += 1;
      console.log(
        `${isDryRun ? '[dry-run] ' : ''}Workspace ${integration.workspace}:`,
        result.repairs
      );
    }
  }

  const normalized = await Integration.countDocuments({ isConnected: true });
  console.log(
    `${isDryRun ? 'Would update' : 'Updated'} ${updated} of ${normalized} connected integrations`
  );

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});
