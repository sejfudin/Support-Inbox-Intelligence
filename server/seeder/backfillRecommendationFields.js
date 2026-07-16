/**
 * One-off migration for the recommendation redesign:
 *   1. Rewrites every recommendation still in the retired 'draft' status to
 *      'recommended' (draft was removed from the status set).
 *   2. Backfills the now-required `position` and `project` fields on any legacy
 *      recommendation that predates them, so those records still satisfy model
 *      validation and remain editable. Position falls back to the intern's
 *      declaredPosition, then to any Position; project gets a neutral marker.
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

const LEGACY_PROJECT = 'Unspecified project';

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

    // 2. Backfill missing project.
    const projectResult = await Recommendation.updateMany(
      { $or: [{ project: { $exists: false } }, { project: null }, { project: '' }] },
      { $set: { project: LEGACY_PROJECT } }
    );
    console.log(`✅ Backfilled project on ${projectResult.modifiedCount} recommendation(s).`);

    // 3. Backfill missing position (per-record, using the intern's declared
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

    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  }
};

run();
