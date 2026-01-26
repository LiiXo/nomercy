/**
 * Script to fix CDL stats - Reset statsCdl for users who have never played CDL matches
 * 
 * This script will:
 * 1. Find all users with statsCdl.xp > 0
 * 2. Check if they have actually played any CDL matches (ladder or ranked)
 * 3. If they haven't played any CDL matches, reset their statsCdl to 0
 * 
 * Run with: node scripts/fix-cdl-stats.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import User from '../src/models/User.js';
import Match from '../src/models/Match.js';
import RankedMatch from '../src/models/RankedMatch.js';

async function fixCdlStats() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with CDL XP > 0
    const usersWithCdlXp = await User.find({
      'statsCdl.xp': { $gt: 0 }
    }).select('_id username statsCdl statsHardcore roles');

    console.log(`\n📊 Found ${usersWithCdlXp.length} users with CDL XP > 0\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const user of usersWithCdlXp) {
      console.log(`\n--- Checking user: ${user.username || user._id} ---`);
      console.log(`   Current CDL XP: ${user.statsCdl?.xp || 0}`);
      console.log(`   Roles: ${user.roles?.join(', ') || 'user'}`);

      // Check for CDL ladder matches where user participated
      const cdlLadderMatches = await Match.countDocuments({
        mode: 'cdl',
        status: 'completed',
        $or: [
          { 'challengerRoster.user': user._id },
          { 'opponentRoster.user': user._id }
        ]
      });

      // Check for CDL ranked matches where user participated
      const cdlRankedMatches = await RankedMatch.countDocuments({
        mode: 'cdl',
        status: 'completed',
        'players.user': user._id
      });

      const totalCdlMatches = cdlLadderMatches + cdlRankedMatches;

      console.log(`   CDL Ladder matches: ${cdlLadderMatches}`);
      console.log(`   CDL Ranked matches: ${cdlRankedMatches}`);
      console.log(`   Total CDL matches: ${totalCdlMatches}`);

      if (totalCdlMatches === 0) {
        // User has CDL XP but never played CDL - reset their stats
        console.log(`   ⚠️  User has CDL XP but NO CDL matches played!`);
        console.log(`   🔄 Resetting statsCdl to 0...`);

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              'statsCdl.xp': 0,
              'statsCdl.points': 0,
              'statsCdl.wins': 0,
              'statsCdl.losses': 0,
              'statsCdl.rank': 0
            }
          }
        );

        console.log(`   ✅ Reset complete for ${user.username}`);
        fixedCount++;
      } else {
        console.log(`   ✓ User has legitimate CDL matches, keeping stats`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total users checked: ${usersWithCdlXp.length}`);
    console.log(`Users fixed (stats reset): ${fixedCount}`);
    console.log(`Users skipped (legitimate CDL players): ${skippedCount}`);
    console.log('='.repeat(50));

    console.log('\n✅ Script completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
fixCdlStats();
