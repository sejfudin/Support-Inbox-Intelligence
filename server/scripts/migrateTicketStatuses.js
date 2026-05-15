/**
 * Seeds TicketStatus for workspaces that have none. Does not modify tickets.
 * Run reconcileTicketStatuses.js after this to align ticket data.
 *
 * See scripts/README.md for full rollout order.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Workspace = require('../models/Workspace');
const TicketStatus = require('../models/TicketStatus');
const { seedDefaultStatuses } = require('../services/statusService');

const renameCollectionIfNeeded = async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);

  if (names.includes('taskstatuses') && !names.includes('ticketstatuses')) {
    await db.renameCollection('taskstatuses', 'ticketstatuses');
    console.log('Renamed collection taskstatuses -> ticketstatuses');
  }
};

const migrate = async () => {
  await connectDB();
  await renameCollectionIfNeeded();

  const workspaces = await Workspace.find({}).select('_id name').lean();
  let seeded = 0;

  for (const workspace of workspaces) {
    const count = await TicketStatus.countDocuments({ workspace: workspace._id });
    if (count === 0) {
      await seedDefaultStatuses(workspace._id);
      seeded += 1;
      console.log(`Seeded statuses for workspace: ${workspace.name} (${workspace._id})`);
    }
  }

  console.log(`Migration complete. Seeded ${seeded} of ${workspaces.length} workspaces.`);
  await mongoose.disconnect();
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
