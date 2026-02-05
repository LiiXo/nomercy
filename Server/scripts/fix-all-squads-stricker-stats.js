/**
 * Fix all squads Stricker stats based on actual completed matches
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

// Points configuration
const POINTS_WIN = 30;
const POINTS_LOSS_BY_RANK = {
  'Recrues': -5,
  'Opérateurs': -10,
  'Vétérans': -15,
  'Commandants': -20,
  'Seigneurs de Guerre': -30,
  'Immortel': -40
};

function getRankFromPoints(points) {
  if (points >= 1500) return 'Immortel';
  if (points >= 1000) return 'Seigneurs de Guerre';
  if (points >= 750) return 'Commandants';
  if (points >= 500) return 'Vétérans';
  if (points >= 250) return 'Opérateurs';
  return 'Recrues';
}

async function fixAllSquadsStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find all squads with Stricker stats
    const squads = await Squad.find({
      $or: [
        { 'statsStricker.points': { $gt: 0 } },
        { 'statsStricker.wins': { $gt: 0 } },
        { 'statsStricker.losses': { $gt: 0 } }
      ]
    });
    
    console.log(`\n🔍 Found ${squads.length} squads with Stricker stats\n`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const squad of squads) {
      console.log(`\n🦅 Squad: [${squad.tag}] ${squad.name}`);
      console.log(`Current stats: ${squad.statsStricker?.wins || 0}W - ${squad.statsStricker?.losses || 0}L - ${squad.statsStricker?.points || 0} pts`);
      
      // Find all completed matches for this squad
      const completedMatches = await StrickerMatch.find({
        $or: [
          { team1Squad: squad._id },
          { team2Squad: squad._id }
        ],
        status: 'completed',
        winner: { $exists: true, $ne: null }
      }).sort({ completedAt: 1 }).lean();
      
      console.log(`Found ${completedMatches.length} completed matches`);
      
      let actualWins = 0;
      let actualLosses = 0;
      let totalPoints = 0;
      
      // Recalculate stats match by match
      completedMatches.forEach((match, index) => {
        const isTeam1 = match.team1Squad?.toString() === squad._id.toString();
        const won = (isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2);
        
        if (won) {
          actualWins++;
          totalPoints += POINTS_WIN;
          console.log(`  Match ${index + 1}: WIN (+${POINTS_WIN} pts) -> ${totalPoints} pts`);
        } else {
          actualLosses++;
          const currentRank = getRankFromPoints(totalPoints);
          const pointsLoss = POINTS_LOSS_BY_RANK[currentRank];
          totalPoints = Math.max(0, totalPoints + pointsLoss);
          console.log(`  Match ${index + 1}: LOSS (${pointsLoss} pts) -> ${totalPoints} pts (${currentRank})`);
        }
      });
      
      const recalculatedStats = {
        wins: actualWins,
        losses: actualLosses,
        points: totalPoints
      };
      
      console.log(`\n✅ Correct stats: ${recalculatedStats.wins}W - ${recalculatedStats.losses}L - ${recalculatedStats.points} pts`);
      
      // Check if stats need update
      const needsUpdate = 
        (squad.statsStricker?.wins || 0) !== recalculatedStats.wins ||
        (squad.statsStricker?.losses || 0) !== recalculatedStats.losses ||
        (squad.statsStricker?.points || 0) !== recalculatedStats.points;
      
      if (needsUpdate) {
        if (!squad.statsStricker) squad.statsStricker = {};
        squad.statsStricker.wins = recalculatedStats.wins;
        squad.statsStricker.losses = recalculatedStats.losses;
        squad.statsStricker.points = recalculatedStats.points;
        
        await squad.save();
        console.log(`✨ Stats UPDATED`);
      } else {
        console.log(`✓ Stats already correct`);
      }
      
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n✅ All squads processed successfully!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAllSquadsStats();
