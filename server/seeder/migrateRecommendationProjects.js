/**
 * One-off migration for the Project entity rollout:
 *
 *   `Recommendation.project` used to be a free-text string; it is now an
 *   ObjectId ref to the new `Project` collection. This repoints every
 *   existing recommendation at a locked "Unspecified" sentinel project so
 *   the model's `required` ref validation is satisfied. The original
 *   free-text values are intentionally discarded (per product decision) —
 *   mentors re-assign the real project by editing each recommendation.
 *
 * Safe to re-run — upserts the sentinel, then repoints every recommendation
 * (idempotent: re-running just re-sets already-correct docs to the same value).
 *
 * Run standalone, NOT as part of the destructive `seed.js` (which wipes all
 * recommendations anyway — there's nothing to migrate right after a fresh seed).
 * This is for a database that already has recommendation data from before the
 * Project entity existed.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    const sentinel = await Project.findOneAndUpdate(
      { slug: 'unspecified' },
      { $setOnInsert: { name: 'Unspecified', slug: 'unspecified', isSystem: true, status: 'active' } },
      { upsert: true, new: true }
    );
    console.log(`✅ Sentinel "Unspecified" project ready (${sentinel._id}).`);

    const result = await Recommendation.updateMany({}, { $set: { project: sentinel._id } });
    console.log(`✅ Repointed ${result.modifiedCount} recommendation(s) at the Unspecified project.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

run();
