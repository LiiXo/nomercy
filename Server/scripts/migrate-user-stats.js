import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected for migration'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const migrateUserStats = async () => {
  try {
    console.log('Starting user stats migration...');
    console.log('This will copy existing stats to statsHardcore for all users.');
    
    // Find all users with stats that have any data
    const users = await User.find({
      $or: [
        { 'stats.xp': { $gt: 0 } },
        { 'stats.wins': { $gt: 0 } },
        { 'stats.losses': { $gt: 0 } },
        { 'stats.points': { $gt: 0 } }
      ]
    });
    
    console.log(`Found ${users.length} users with stats to migrate.`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      // Check if hardcore stats already have data (skip if already migrated)
      const hardcoreStats = user.statsHardcore || {};
      if (hardcoreStats.xp > 0 || hardcoreStats.wins > 0 || hardcoreStats.losses > 0) {
        console.log(`Skipping ${user.username || user.discordUsername}: statsHardcore already has data`);
        skippedCount++;
        continue;
      }
      
      // Copy stats to statsHardcore
      user.statsHardcore = {
        xp: user.stats?.xp || 0,
        wins: user.stats?.wins || 0,
        losses: user.stats?.losses || 0,
        points: user.stats?.points || 0,
        rank: user.stats?.rank || 0
      };
      
      await user.save();
      console.log(`Migrated ${user.username || user.discordUsername}: ${user.statsHardcore.xp} XP, ${user.statsHardcore.wins}W/${user.statsHardcore.losses}L`);
      migratedCount++;
    }
    
    console.log(`\nMigration complete:`);
    console.log(`  - Migrated: ${migratedCount} users`);
    console.log(`  - Skipped: ${skippedCount} users (already had statsHardcore data)`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    mongoose.disconnect();
  }
};

migrateUserStats();
