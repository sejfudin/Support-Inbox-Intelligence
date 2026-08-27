/**
 * One-off migration for the "unknown project" feature:
 *
 *   `Recommendation.project` is no longer required — `null` is now the
 *   stored meaning of "we don't know the project yet". The locked
 *   "Unspecified" sentinel Project (created by `migrateRecommendationProjects.js`
 *   back when `project` was still free text) is the old, document-shaped
 *   version of that same state, so it is retired here: every recommendation
 *   pointing at it is repointed to `null`, then the sentinel document itself
 *   is deleted.
 *
 * Safe to re-run — idempotent, exits clean when the sentinel is already
 * gone. Aborts WITHOUT deleting the sentinel if any recommendation still
 * references it after the repoint, rather than risk orphaning those rows.
 *
 * DEPLOY ORDERING: run any time after `migrateRecommendationProjects.js` and
 * `backfillProjectTypes.js` have already run against this database. Neither
 * of those depends on this migration having run.
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

    const sentinel = await Project.findOne({ slug: 'unspecified' }).select('_id');
    if (!sentinel) {
      console.log('✅ No "unspecified" sentinel project found — nothing to do.');
      process.exit(0);
    }

    const result = await Recommendation.updateMany(
      { project: sentinel._id },
      { $set: { project: null } }
    );
    console.log(
      `✅ Repointed ${result.modifiedCount} recommendation(s) from the sentinel to null.`
    );

    const stillReferenced = await Recommendation.countDocuments({ project: sentinel._id });
    if (stillReferenced > 0) {
      console.error(
        `❌ ${stillReferenced} recommendation(s) still reference the sentinel after the repoint — aborting without deleting it.`
      );
      process.exit(1);
    }

    await Project.deleteOne({ _id: sentinel._id });
    console.log('✅ Deleted the "unspecified" sentinel project.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

run();
