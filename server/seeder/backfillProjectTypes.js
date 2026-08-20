/**
 * Backfill for the `Project.type` rollout:
 *
 *   `Project` gained a required `type` field (`client` | `internal`) with NO
 *   schema default — the admin must classify every new project explicitly.
 *   Projects created before the field existed have no value, which now fails
 *   validation the next time anyone saves them. This sets those docs to
 *   `client`, the correct value for every project that exists today (all of
 *   them are external client engagements), and `internal` for the locked
 *   `unspecified` sentinel, which is platform plumbing rather than work.
 *
 * Safe to re-run — only touches docs where `type` is missing or null. A project
 * an admin has since re-typed is left alone, so a second run can't clobber it.
 *
 * DEPLOY ORDERING: run this immediately after deploying the schema change. An
 * unset `type` fails validation on any `save()`, so editing a legacy project
 * before this runs throws. Keep the window short.
 */
const path = require('path');
// Matches index.js's env selection (`.env.${NODE_ENV}`, default 'development') so this
// script hits the same database `npm run dev` does. Older seeder scripts load plain
// `.env` instead, which can silently point at a different database — see server/CLAUDE.md.
require('dotenv').config({
  path: path.join(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

const connectDB = require('../config/db');
const Project = require('../models/Project');

// `updateMany` bypasses document validation, which is what we want here: the
// docs are invalid until this write lands, so a validating path couldn't fix them.
const UNSET_TYPE = { $or: [{ type: { $exists: false } }, { type: null }] };

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    const sentinel = await Project.updateMany(
      { slug: 'unspecified', ...UNSET_TYPE },
      { $set: { type: 'internal' } }
    );
    console.log(`✅ Typed ${sentinel.modifiedCount} sentinel project(s) as "internal".`);

    const rest = await Project.updateMany(
      { slug: { $ne: 'unspecified' }, ...UNSET_TYPE },
      { $set: { type: 'client' } }
    );
    console.log(`✅ Typed ${rest.modifiedCount} untyped project(s) as "client".`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  }
};

run();
