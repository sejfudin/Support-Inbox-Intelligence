/**
 * One-off: assigns a random declaredPosition to any existing intern
 * profile that doesn't have one yet. Safe to re-run — only touches
 * profiles where declaredPosition is still null.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const InternProfile = require('../models/InternProfile');
const Position = require('../models/Position');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    const positions = await Position.find();
    if (positions.length === 0) {
      console.log('⚠️  No positions found — run `npm run seed:positions` first.');
      return process.exit(1);
    }

    const profiles = await InternProfile.find({ declaredPosition: null });
    for (const profile of profiles) {
      const position = positions[Math.floor(Math.random() * positions.length)];
      profile.declaredPosition = position._id;
      await profile.save();
    }

    console.log(`✅ Assigned a random position to ${profiles.length} intern profile(s).`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  }
};

run();
