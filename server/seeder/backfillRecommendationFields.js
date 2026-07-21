/**
 * One-off migration for the recommendation redesign:
 *   1. Rewrites every recommendation still in the retired 'draft' status to
 *      'recommended' (draft was removed from the status set).
 *   2. Backfills the now-required `position` field on any legacy recommendation
 *      that predates it, so those records still satisfy model validation and
 *      remain editable. Falls back to the intern's declaredPosition, then to
 *      any Position. (`project` used to be backfilled here too, but it's now
 *      an ObjectId ref — see `migrateRecommendationProjects.js` instead, which
 *      repoints every recommendation at the "Unspecified" sentinel project.)
 *   3. Removes any stale 'placed' status-history rows from an earlier version
 *      of this migration (the timeline now tracks 'resulted', not 'placed').
 *   4. Seeds append-only status History rows for recommendations that have none,
 *      reconstructing recommended/interviewing/resulted dates from the record's
 *      current status so the new table date columns aren't empty.
 *
 * Safe to re-run — only touches records that still need it.
 *
 * Uses `updateOne`/`updateMany` (not `save`) so legacy docs missing the new
 * required fields aren't blocked by validation before the backfill sets them.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const Recommendation = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const Position = require('../models/Position');
const History = require('../models/History');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    // 1. draft -> recommended
    const draftResult = await Recommendation.updateMany(
      { status: 'draft' },
      { $set: { status: 'recommended' } }
    );
    console.log(`✅ Migrated ${draftResult.modifiedCount} draft recommendation(s) → recommended.`);

    // 2. Backfill missing position (per-record, using the intern's declared
    //    position when available, else the first available Position).
    const fallbackPosition = await Position.findOne().sort({ name: 1 });
    if (!fallbackPosition) {
      console.log('⚠️  No positions found — run `npm run seed:positions` first.');
      return process.exit(1);
    }

    const missingPosition = await Recommendation.find({
      $or: [{ position: { $exists: false } }, { position: null }],
    }).select('_id internProfile');

    let positionCount = 0;
    for (const recommendation of missingPosition) {
      const profile = await InternProfile.findById(recommendation.internProfile).select(
        'declaredPosition'
      );
      const positionId = profile?.declaredPosition || fallbackPosition._id;
      await Recommendation.updateOne(
        { _id: recommendation._id },
        { $set: { position: positionId } }
      );
      positionCount += 1;
    }
    console.log(`✅ Backfilled position on ${positionCount} recommendation(s).`);

    // 3b. Drop stale 'placed' status rows from the earlier migration version —
    //     the timeline tracks 'resulted' now; placed/not_placed is the Result.
    const stale = await History.deleteMany({
      entityType: 'recommendation',
      statusKey: 'placed',
    });
    console.log(`✅ Removed ${stale.deletedCount} stale 'placed' history row(s).`);

    // 4. Ensure each recommendation has the status milestones it should, per
    //    its current status. Idempotent top-up: adds only the missing milestones
    //    (so records seeded by the earlier 'placed' version get their 'resulted'
    //    row, and records with no history get the full lifecycle).
    const allRecs = await Recommendation.find()
      .select('_id status result createdAt updatedAt createdBy')
      .lean();

    let historyCount = 0;
    for (const rec of allRecs) {
      const created = rec.createdAt || new Date();
      const decided = rec.result?.decidedAt || rec.updatedAt || created;

      const expected = [{ statusKey: 'recommended', at: created }];
      if (rec.status === 'interviewing' || rec.status === 'resulted') {
        expected.push({ statusKey: 'interviewing', at: rec.updatedAt || created });
      }
      if (rec.status === 'resulted') {
        expected.push({ statusKey: 'resulted', at: decided });
      }

      const existingKeys = new Set(
        await History.distinct('statusKey', {
          entityType: 'recommendation',
          entityId: rec._id,
        })
      );
      const missing = expected.filter((row) => !existingKeys.has(row.statusKey));
      if (missing.length === 0) continue;

      await History.insertMany(
        missing.map((row) => ({
          entityType: 'recommendation',
          entityId: rec._id,
          statusKey: row.statusKey,
          action: `Status set to ${row.statusKey.charAt(0).toUpperCase() + row.statusKey.slice(1)}`,
          userId: rec.createdBy || null,
          userName: 'History backfill',
          timestamp: row.at,
        }))
      );
      historyCount += 1;
    }
    console.log(`✅ Topped up status history for ${historyCount} recommendation(s).`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  }
};

run();
