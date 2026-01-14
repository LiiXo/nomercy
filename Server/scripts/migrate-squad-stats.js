/**
 * Migration Script: Copy existing stats to statsHardcore
 * 
 * This script migrates the legacy 'stats' field to 'statsHardcore'
 * for all squads. The stats field contained hardcore data.
 * 
 * Run with: node scripts/migrate-squad-stats.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

const squadSchema = new mongoose.Schema({
  name: String,
  stats: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  statsHardcore: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  statsCdl: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  }
}, { strict: false });

const Squad = mongoose.model('Squad', squadSchema);

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all squads
    const squads = await Squad.find({});
    console.log(`Found ${squads.length} squads to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const squad of squads) {
      // Check if stats exist and statsHardcore doesn't have data yet
      const hasLegacyStats = squad.stats && (
        squad.stats.totalWins > 0 || 
        squad.stats.totalLosses > 0 || 
        squad.stats.totalPoints > 0
      );
      
      const hasHardcoreStats = squad.statsHardcore && (
        squad.statsHardcore.totalWins > 0 || 
        squad.statsHardcore.totalLosses > 0 || 
        squad.statsHardcore.totalPoints > 0
      );

      if (hasLegacyStats && !hasHardcoreStats) {
        // Copy stats to statsHardcore
        await Squad.updateOne(
          { _id: squad._id },
          {
            $set: {
              'statsHardcore.totalWins': squad.stats.totalWins || 0,
              'statsHardcore.totalLosses': squad.stats.totalLosses || 0,
              'statsHardcore.totalPoints': squad.stats.totalPoints || 0
            }
          }
        );
        console.log(`✅ Migrated: ${squad.name} (W:${squad.stats.totalWins} L:${squad.stats.totalLosses} P:${squad.stats.totalPoints})`);
        migratedCount++;
      } else if (hasHardcoreStats) {
        console.log(`⏭️ Skipped (already migrated): ${squad.name}`);
        skippedCount++;
      } else {
        console.log(`⏭️ Skipped (no stats): ${squad.name}`);
        skippedCount++;
      }
    }

    console.log('\n========================================');
    console.log(`Migration completed!`);
    console.log(`✅ Migrated: ${migratedCount} squads`);
    console.log(`⏭️ Skipped: ${skippedCount} squads`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate();
