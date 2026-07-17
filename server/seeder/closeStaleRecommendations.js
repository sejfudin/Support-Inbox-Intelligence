const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Recommendation = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

// One-off cleanup: placing an intern now auto-closes their other open
// recommendations, but recommendations placed before that change can still sit
// in `recommended`/`interviewing` for interns whose profile is already
// `placed`, keeping them in the "In pipeline" KPI forever. Resolve those as
// not_placed with an explanatory note. Idempotent — reruns find nothing.
const run = async () => {
  await connectDB();

  const placedProfileIds = await InternProfile.find({ status: 'placed' }).distinct('_id');

  const staleFilter = {
    internProfile: { $in: placedProfileIds },
    status: { $in: ['recommended', 'interviewing'] },
  };

  const staleCount = await Recommendation.countDocuments(staleFilter);

  if (staleCount === 0) {
    console.log('✅ No open recommendations belong to placed interns. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  // Attribute the close to an admin/leadership user so seeder-closed records
  // carry the same decidedBy/updatedBy the service sets — the UI reads
  // result.decidedBy and would otherwise show "Unknown".
  const actor = await User.findOne({ role: { $in: [ROLES.ADMIN, ROLES.LEADERSHIP] } })
    .select('_id')
    .lean();

  const result = await Recommendation.updateMany(staleFilter, {
    $set: {
      status: 'resulted',
      result: {
        outcome: 'not_placed',
        note: 'Closed automatically because the intern was placed.',
        decidedAt: new Date(),
        ...(actor ? { decidedBy: actor._id } : {}),
      },
      ...(actor ? { updatedBy: actor._id } : {}),
    },
  });

  console.log(`🧹 Closed ${result.modifiedCount} stale recommendation(s) of placed interns.`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
