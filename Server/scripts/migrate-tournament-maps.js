/**
 * Migration script to enable all maps for tournaments
 * This adds tournament configuration to all existing maps with:
 * - All formats: 1v1, 2v2, 3v3, 4v4, 5v5, 6v6
 * - All types: solo, switch, squads
 * - Both modes: hardcore and cdl
 * 
 * Run with: node scripts/migrate-tournament-maps.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

// Map schema (simplified for script)
const mapSchema = new mongoose.Schema({
  name: String,
  tournamentConfig: {
    hardcore: {
      enabled: Boolean,
      gameModes: [String],
      formats: [String],
      types: [String]
    },
    cdl: {
      enabled: Boolean,
      gameModes: [String],
      formats: [String],
      types: [String]
    }
  }
}, { strict: false });

const Map = mongoose.model('Map', mapSchema);

async function migrateTournamentMaps() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Default tournament configuration for all maps
    const defaultTournamentConfig = {
      hardcore: {
        enabled: true,
        gameModes: ['Search & Destroy', 'Team Deathmatch', 'Duel'],
        formats: ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6'],
        types: ['solo', 'switch', 'squads']
      },
      cdl: {
        enabled: true,
        gameModes: ['Hardpoint', 'Search & Destroy', 'Control'],
        formats: ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6'],
        types: ['solo', 'switch', 'squads']
      }
    };

    // Get all maps
    const maps = await Map.find({});
    console.log(`Found ${maps.length} maps to update`);

    let updated = 0;
    let alreadyConfigured = 0;

    for (const map of maps) {
      // Check if already configured
      const hasHardcore = map.tournamentConfig?.hardcore?.enabled && 
                          map.tournamentConfig?.hardcore?.formats?.length > 0;
      const hasCdl = map.tournamentConfig?.cdl?.enabled && 
                     map.tournamentConfig?.cdl?.formats?.length > 0;

      if (hasHardcore && hasCdl) {
        console.log(`  [SKIP] ${map.name} - already configured`);
        alreadyConfigured++;
        continue;
      }

      // Update map with tournament config
      map.tournamentConfig = defaultTournamentConfig;
      await map.save();
      console.log(`  [OK] ${map.name} - tournament config added`);
      updated++;
    }

    console.log('\n========================================');
    console.log(`Migration completed!`);
    console.log(`  Updated: ${updated} maps`);
    console.log(`  Already configured: ${alreadyConfigured} maps`);
    console.log(`  Total: ${maps.length} maps`);
    console.log('========================================');

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateTournamentMaps();
