/**
 * Non-destructive: upserts the Position catalog only. Safe to run anytime,
 * against dev or prod, without touching any other data.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const { seedPositions } = require('./referenceData');

const run = async () => {
  try {
    await connectDB();
    console.log('🟢 Connected to database.');

    await seedPositions();
    console.log('✅ Positions seeded.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

run();
