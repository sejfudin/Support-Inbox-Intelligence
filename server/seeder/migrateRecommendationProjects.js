/**
 * One-off migration for the Project entity rollout:
 *
 *   `Recommendation.project` used to be a free-text string; it is now an
 *   ObjectId ref to the new `Project` collection. This repoints every
 *   legacy recommendation (one whose `project` is still a string, null, or
 *   missing) at a locked "Unspecified" sentinel project so the model's
 *   `required` ref validation is satisfied. The original free-text values
 *   are intentionally discarded (per product decision) — mentors re-assign
 *   the real project by editing each recommendation.
 *
 * Safe to re-run — upserts the sentinel, then repoints ONLY recommendations
 * whose `project` is not already a valid ObjectId ref. Records that already
 * point at a project (the sentinel, or a real project a mentor has since
 * re-assigned) are left untouched, so a second run can't clobber reassignments.
 *
 * Run standalone, NOT as part of the destructive `seed.js` (which wipes all
 * recommendations anyway — there's nothing to migrate right after a fresh seed).
 * This is for a database that already has recommendation data from before the
 * Project entity existed.
 */
const path = require('path');
// Matches index.js's env selection (`.env.${NODE_ENV}`, default 'development') so this
// script hits the same database `npm run dev` does. Older seeder scripts load plain
// `.env` instead, which can silently point at a different database — see server/CLAUDE.md.
require('dotenv').config({
  path: path.join(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

const connectDB = require('../config/db');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    const sentinel = await Project.findOneAndUpdate(
      { slug: 'unspecified' },
      {
        $setOnInsert: {
          name: 'Unspecified',
          slug: 'unspecified',
          isSystem: true,
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Sentinel "Unspecified" project ready (${sentinel._id}).`);

    // Only repoint legacy records (project not yet a valid ObjectId ref).
    // Anything already pointing at a project — the sentinel from a prior run,
    // or a real project a mentor re-assigned — is left as-is, keeping re-runs
    // non-destructive.
    const result = await Recommendation.updateMany(
      { project: { $not: { $type: 'objectId' } } },
      { $set: { project: sentinel._id } }
    );
    console.log(
      `✅ Repointed ${result.modifiedCount} legacy recommendation(s) at the Unspecified project.`
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

run();
