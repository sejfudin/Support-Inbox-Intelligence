const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// One-off cleanup for the cvTechnologies removal: the field was dropped from
// the InternProfile schema (a CV scan now only ever adds to
// `selfTechnologies`, so there's nothing left to reconcile), but documents
// written before that change still carry the orphaned array, which Mongoose
// keeps echoing through API responses.
// Idempotent — documents without the field are untouched.
const run = async () => {
  await connectDB();

  const collection = mongoose.connection.db.collection('internprofiles');
  const withField = await collection.countDocuments({ cvTechnologies: { $exists: true } });

  if (withField === 0) {
    console.log('✅ No intern profiles carry cvTechnologies. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  const result = await collection.updateMany({}, { $unset: { cvTechnologies: 1 } });
  console.log(`🧹 Removed cvTechnologies from ${result.modifiedCount} intern profile(s).`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
