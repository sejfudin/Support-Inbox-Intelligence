const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// One-off cleanup for the readyForPlacement removal: the field was dropped from
// the InternProfile schema (placement readiness is now expressed by the `ready`
// lifecycle status), but documents written before that change still carry the
// orphaned boolean, which Mongoose keeps echoing through API responses.
// Idempotent — documents without the field are untouched.
const run = async () => {
  await connectDB();

  const collection = mongoose.connection.db.collection('internprofiles');
  const withField = await collection.countDocuments({ readyForPlacement: { $exists: true } });

  if (withField === 0) {
    console.log('✅ No intern profiles carry readyForPlacement. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  const result = await collection.updateMany({}, { $unset: { readyForPlacement: 1 } });
  console.log(`🧹 Removed readyForPlacement from ${result.modifiedCount} intern profile(s).`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
