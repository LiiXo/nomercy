/**
 * Fix Golden Eagles squad stats
 * They have 5 wins but should have only 1 win (1 completed match)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Squad from '../src/models/Squad.js';
import StrickerMatch from '../src/models/StrickerMatch.js';

async function fixGEStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find Golden Eagles squad
    const geSquad = await Squad.findOne({ tag: 'GE' });
    if (!geSquad) {
      console.log('❌ Golden Eagles squad not found');
      return;
    }
    
    console.log('\n🔍 Current Golden Eagles stats:');
    console.log(`  Wins: ${geSquad.statsStricker?.wins || 0}`);
    console.log(`  Losses: ${geSquad.statsStricker?.losses || 0}`);
    console.log(`  Points: ${geSquad.statsStricker?.points || 0}`);
    console.log(`  Munitions: ${geSquad.cranes || 0}`);
    
    // Count actual completed matches
    const completedMatches = await StrickerMatch.find({
      $or: [
        { team1Squad: geSquad._id },
        { team2Squad: geSquad._id }
      ],
      status: 'completed',
      winner: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`\n📊 Found ${completedMatches.length} completed matches`);
    
    let actualWins = 0;
    let actualLosses = 0;
    let totalPoints = 0;
    
    completedMatches.forEach(match => {
      const isTeam1 = match.team1Squad?.toString() === geSquad._id.toString();
      const won = (isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2);
      
      if (won) {
        actualWins++;
        totalPoints += 30; // POINTS_WIN
      } else {
        actualLosses++;
        // Calculate points loss based on rank (simplified, using 0 points as base)
        // For now, just subtract based on current logic
        totalPoints -= 5; // Assuming Recrues rank (0-249 pts)
      }
    });
    
    console.log(`\n✅ Calculated correct stats:`);
    console.log(`  Wins: ${actualWins}`);
    console.log(`  Losses: ${actualLosses}`);
    console.log(`  Points: ${Math.max(0, totalPoints)}`);
    
    // Update squad stats
    if (!geSquad.statsStricker) geSquad.statsStricker = {};
    
    geSquad.statsStricker.wins = actualWins;
    geSquad.statsStricker.losses = actualLosses;
    geSquad.statsStricker.points = Math.max(0, totalPoints);
    
    // Munitions: 1 win = 50 munitions
    // Current munitions: 20, should be 50 for 1 win
    // But let's keep current munitions if they're already correct or have been spent
    // Actually, 20 munitions suggests they got 50 initially but spent 30
    // Let's not touch munitions for now
    
    await geSquad.save();
    
    console.log(`\n✨ Squad stats updated successfully!`);
    console.log(`\nNew stats:`);
    console.log(`  Wins: ${geSquad.statsStricker.wins}`);
    console.log(`  Losses: ${geSquad.statsStricker.losses}`);
    console.log(`  Points: ${geSquad.statsStricker.points}`);
    console.log(`  Munitions: ${geSquad.cranes || 0} (unchanged)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixGEStats();
