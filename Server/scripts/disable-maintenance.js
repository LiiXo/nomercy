/**
 * Script to disable maintenance mode
 * Run with: node scripts/disable-maintenance.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';

async function disableMaintenance() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('appsettings').updateOne(
      {},
      { $set: { 'maintenance.enabled': false } }
    );

    console.log('Maintenance mode disabled!');
    console.log('Modified:', result.modifiedCount);

    await mongoose.disconnect();
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

disableMaintenance();
