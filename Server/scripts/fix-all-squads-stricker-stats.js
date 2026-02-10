/**
 * Fix all squads AND users Stricker stats based on actual completed matches.
 * 
 * This script replays all completed Stricker matches chronologically and:
 * 1. Recalculates squad statsStricker (wins, losses, points)
 * 2. Recalculates user statsStricker (wins, losses, points)
 * 3. Marks all completed matches as rewardsDistributed=true
 * 
 * Point loss values match the LIVE hardcoded values in strickerMatch.routes.js
 * 
 * Usage: node scripts/fix-all-squads-stricker-stats.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Squad from '../src/models/Squad.js';
import User from '../src/models/User.js';
import StrickerMatch from '../src/models/StrickerMatch.js';

// Points configuration - MUST match strickerMatch.routes.js HARDCODED values
const POINTS_WIN = 30;
const POINTS_LOSS_BY_RANK = {
  'Recrues': -15,
  'Opérateurs': -20,
  'Vétérans': -25,
  'Commandants': -30,
  'Seigneurs de Guerre': -40,
  'Immortel': -50
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
    console.log('✅ Connected to MongoDB\n');
    
    // ========== 1. FIX SQUAD STATS ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  PHASE 1: FIXING SQUAD STATS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Find all squads with Stricker stats
    const squads = await Squad.find({
      $or: [
        { 'statsStricker.points': { $gt: 0 } },
        { 'statsStricker.wins': { $gt: 0 } },
        { 'statsStricker.losses': { $gt: 0 } }
      ]
    });
    
    console.log(`🔍 Found ${squads.length} squads with Stricker stats\n`);
    
    let squadsFixed = 0;
    let squadsOk = 0;
    
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
        } else {
          actualLosses++;
          const currentRank = getRankFromPoints(totalPoints);
          const pointsLoss = POINTS_LOSS_BY_RANK[currentRank];
          totalPoints = Math.max(0, totalPoints + pointsLoss);
        }
      });
      
      const recalculatedStats = {
        wins: actualWins,
        losses: actualLosses,
        points: totalPoints
      };
      
      // Check if stats need update
      const needsUpdate = 
        (squad.statsStricker?.wins || 0) !== recalculatedStats.wins ||
        (squad.statsStricker?.losses || 0) !== recalculatedStats.losses ||
        (squad.statsStricker?.points || 0) !== recalculatedStats.points;
      
      if (needsUpdate) {
        console.log(`  ❌ WRONG: ${squad.statsStricker?.wins || 0}W/${squad.statsStricker?.losses || 0}L/${squad.statsStricker?.points || 0}pts → ✅ CORRECT: ${recalculatedStats.wins}W/${recalculatedStats.losses}L/${recalculatedStats.points}pts`);
        if (!squad.statsStricker) squad.statsStricker = {};
        squad.statsStricker.wins = recalculatedStats.wins;
        squad.statsStricker.losses = recalculatedStats.losses;
        squad.statsStricker.points = recalculatedStats.points;
        
        await squad.save();
        console.log(`  ✨ Stats UPDATED`);
        squadsFixed++;
      } else {
        console.log(`  ✅ Stats already correct: ${recalculatedStats.wins}W/${recalculatedStats.losses}L/${recalculatedStats.points}pts`);
        squadsOk++;
      }
    }
    
    // ========== 2. FIX USER STATS ==========
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 2: FIXING USER STATS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Find all completed stricker matches
    const allMatches = await StrickerMatch.find({
      status: 'completed',
      winner: { $exists: true, $ne: null }
    }).sort({ completedAt: 1 }).lean();
    
    console.log(`📊 Found ${allMatches.length} completed Stricker matches\n`);
    
    // Build user stats from match history
    const userStats = {}; // { odUserId: { wins, losses, points } }
    
    for (const match of allMatches) {
      for (const player of match.players || []) {
        if (player.isFake || !player.user) continue;
        
        const odUserId = player.user.toString();
        const isWinner = player.team === match.winner;
        
        if (!userStats[odUserId]) {
          userStats[odUserId] = { wins: 0, losses: 0, points: 0, username: player.username };
        }
        
        const stats = userStats[odUserId];
        if (isWinner) {
          stats.wins++;
          stats.points += POINTS_WIN;
        } else {
          stats.losses++;
          const currentRank = getRankFromPoints(stats.points);
          const pointsLoss = POINTS_LOSS_BY_RANK[currentRank];
          stats.points = Math.max(0, stats.points + pointsLoss);
        }
      }
    }
    
    const userIds = Object.keys(userStats);
    console.log(`👥 Found ${userIds.length} users in Stricker matches\n`);
    
    let usersFixed = 0;
    let usersOk = 0;
    
    for (const odUserId of userIds) {
      const expected = userStats[odUserId];
      const user = await User.findById(odUserId);
      if (!user) {
        console.log(`  ⚠️ User ${expected.username} (${odUserId}) not found, skipping`);
        continue;
      }
      
      const current = user.statsStricker || {};
      const needsUpdate = 
        (current.wins || 0) !== expected.wins ||
        (current.losses || 0) !== expected.losses ||
        (current.points || 0) !== expected.points;
      
      if (needsUpdate) {
        console.log(`  ❌ ${user.username}: ${current.wins || 0}W/${current.losses || 0}L/${current.points || 0}pts → ✅ ${expected.wins}W/${expected.losses}L/${expected.points}pts`);
        if (!user.statsStricker) user.statsStricker = { points: 0, wins: 0, losses: 0, xp: 0 };
        user.statsStricker.wins = expected.wins;
        user.statsStricker.losses = expected.losses;
        user.statsStricker.points = expected.points;
        await user.save();
        usersFixed++;
      } else {
        usersOk++;
      }
    }
    
    // ========== 3. MARK ALL COMPLETED MATCHES AS rewardsDistributed ==========
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 3: MARKING rewardsDistributed FLAG');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const flagResult = await StrickerMatch.updateMany(
      { status: 'completed', winner: { $exists: true, $ne: null }, rewardsDistributed: { $ne: true } },
      { $set: { rewardsDistributed: true } }
    );
    console.log(`🏁 Marked ${flagResult.modifiedCount} matches as rewardsDistributed=true\n`);
    
    // ========== SUMMARY ==========
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Squads: ${squadsFixed} fixed, ${squadsOk} already correct`);
    console.log(`  Users:  ${usersFixed} fixed, ${usersOk} already correct`);
    console.log(`  Matches flagged: ${flagResult.modifiedCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAllSquadsStats();
