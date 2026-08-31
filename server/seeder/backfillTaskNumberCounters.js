/**
 * Backfill for the atomic ticket-numbering rollout:
 *
 *   `Ticket.taskNumber` used to be computed as `max(taskNumber) + 1` by a read
 *   followed by a write, which handed concurrent creates in one workspace the
 *   same number. It now comes from a per-workspace `Counter` document
 *   (`services/ticketNumberService.js`), incremented atomically. Workspaces that
 *   existed before that change have no counter document.
 *
 * Optional: the service seeds a missing counter from the workspace's current
 * highest `taskNumber` on the next create, so nothing breaks without this. What
 * running it up front buys is that no workspace pays that seeding query on its
 * first create, and that the counters are inspectable straight away.
 *
 * Safe to re-run. A counter is only ever raised, never lowered, so a workspace
 * that has already handed out numbers past its current maximum (a failed save
 * burns a number — gaps are expected) keeps its position.
 */
const path = require('path');
// Matches index.js's env selection (`.env.${NODE_ENV}`, default 'development') so this
// script hits the same database `npm run dev` does. Older seeder scripts load plain
// `.env` instead, which can silently point at a different database — see server/CLAUDE.md.
require('dotenv').config({
  path: path.join(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const { syncTaskNumberCounter } = require('../services/ticketNumberService');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    const workspaces = await Workspace.find().select('name').lean();

    for (const workspace of workspaces) {
      const seq = await syncTaskNumberCounter(workspace._id);
      console.log(`   ${workspace.name || workspace._id} → next ticket is #${seq + 1}`);
    }

    console.log(`✅ Counters set for ${workspaces.length} workspace(s).`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  }
};

run();
