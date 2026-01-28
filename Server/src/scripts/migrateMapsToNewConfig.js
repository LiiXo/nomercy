/**
 * Migration script to convert existing maps from legacy structure
 * to the new granular configuration (hardcoreConfig/cdlConfig)
 * 
 * Run with: node src/scripts/migrateMapsToNewConfig.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Map from '../models/Map.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

// Game modes mapping based on the requirements
const HARDCORE_LADDER_MODES = ['Search & Destroy'];
const HARDCORE_RANKED_MODES = ['Search & Destroy', 'Team Deathmatch', 'Duel'];
const CDL_LADDER_MODES = ['Hardpoint', 'Search & Destroy', 'Variant'];
const CDL_RANKED_MODES = ['Hardpoint', 'Search & Destroy'];

// Enable all modes and formats by default
// CDL ranked: uniquement 4v4
// Hardcore ranked: 4v4 et 5v5
function getDefaultConfig() {
  return {
    hardcoreConfig: {
      ladder: {
        enabled: true,
        gameModes: ['Search & Destroy']
      },
      ranked: {
        enabled: true,
        gameModes: ['Search & Destroy', 'Team Deathmatch', 'Duel'],
        formats: ['4v4', '5v5']
      }
    },
    cdlConfig: {
      ladder: {
        enabled: true,
        gameModes: ['Hardpoint', 'Search & Destroy', 'Variant']
      },
      ranked: {
        enabled: true,
        gameModes: ['Hardpoint', 'Search & Destroy'],
        formats: ['4v4'] // CDL ranked: uniquement format 4v4
      }
    }
  };
}

async function migrateMap(map) {
  // Simply enable all modes and formats by default
  // User can then disable what they don't want in the admin panel
  return getDefaultConfig();
}

async function runMigration() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Get all maps
    const maps = await Map.find({});
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const map of maps) {
      // Check if already migrated (has hardcoreConfig or cdlConfig with enabled sections)
      const alreadyMigrated = 
        (map.hardcoreConfig?.ladder?.enabled || map.hardcoreConfig?.ranked?.enabled) ||
        (map.cdlConfig?.ladder?.enabled || map.cdlConfig?.ranked?.enabled);
      
      if (alreadyMigrated) {
        skippedCount++;
        continue;
      }
      
      const updates = await migrateMap(map);
      
      // Apply updates
      await Map.findByIdAndUpdate(map._id, { $set: updates });
      
      
      migratedCount++;
    }
    
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the migration
runMigration();
