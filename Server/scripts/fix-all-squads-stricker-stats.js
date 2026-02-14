/**
 * Fix all squads AND users Stricker stats based on actual completed matches.
 * 
 * This script replays all completed Stricker matches chronologically and:
 * 1. Recalculates squad statsStricker/statsStricker3v3 (wins, losses, points) based on match format
 * 2. Recalculates user statsStricker/statsStricker3v3 (wins, losses, points) based on match format
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

// Get stats field name based on format (3v3 or 5v5)
function getStatsField(format) {
  return format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
}

async function fixAllSquadsStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // ========== 1. FIX SQUAD STATS ==========
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  PHASE 1: FIXING SQUAD STATS (FORMAT-SPECIFIC)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Find all squads that have participated in Stricker matches
    const allMatches = await StrickerMatch.find({
      status: 'completed',
      winner: { $exists: true, $ne: null }
    }).sort({ completedAt: 1 }).lean();
    
    console.log(`📊 Found ${allMatches.length} completed Stricker matches\n`);
    
    // Build squad stats from match history (format-specific)
    const squadStats = {}; // { squadId: { '5v5': { wins, losses, points }, '3v3': { wins, losses, points } } }
    
    for (const match of allMatches) {
      const format = match.format || '5v5'; // Default to 5v5 for old matches
      
      // Process team1Squad
      if (match.team1Squad) {
        const squadId = match.team1Squad.toString();
        if (!squadStats[squadId]) squadStats[squadId] = { '5v5': { wins: 0, losses: 0, points: 0 }, '3v3': { wins: 0, losses: 0, points: 0 } };
        
        const stats = squadStats[squadId][format];
        const isWinner = match.winner === 1;
        
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
      
      // Process team2Squad
      if (match.team2Squad) {
        const squadId = match.team2Squad.toString();
        if (!squadStats[squadId]) squadStats[squadId] = { '5v5': { wins: 0, losses: 0, points: 0 }, '3v3': { wins: 0, losses: 0, points: 0 } };
        
        const stats = squadStats[squadId][format];
        const isWinner = match.winner === 2;
        
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
    
    const squadIds = Object.keys(squadStats);
    console.log(`🦅 Found ${squadIds.length} squads in Stricker matches\n`);
    
    let squadsFixed = 0;
    let squadsOk = 0;
    
    for (const squadId of squadIds) {
      const squad = await Squad.findById(squadId);
      if (!squad) {
        console.log(`  ⚠️ Squad ${squadId} not found, skipping`);
        continue;
      }
      
      const expected = squadStats[squadId];
      let needsUpdate = false;
      
      console.log(`\n🦅 Squad: [${squad.tag}] ${squad.name}`);
      
      // Check and update 5v5 stats
      const current5v5 = squad.statsStricker || {};
      if ((current5v5.wins || 0) !== expected['5v5'].wins ||
          (current5v5.losses || 0) !== expected['5v5'].losses ||
          (current5v5.points || 0) !== expected['5v5'].points) {
        console.log(`  5v5: ${current5v5.wins || 0}W/${current5v5.losses || 0}L/${current5v5.points || 0}pts → ${expected['5v5'].wins}W/${expected['5v5'].losses}L/${expected['5v5'].points}pts`);
        squad.statsStricker = { 
          points: expected['5v5'].points, 
          wins: expected['5v5'].wins, 
          losses: expected['5v5'].losses,
          rank: getRankFromPoints(expected['5v5'].points)
        };
        needsUpdate = true;
      }
      
      // Check and update 3v3 stats
      const current3v3 = squad.statsStricker3v3 || {};
      if ((current3v3.wins || 0) !== expected['3v3'].wins ||
          (current3v3.losses || 0) !== expected['3v3'].losses ||
          (current3v3.points || 0) !== expected['3v3'].points) {
        console.log(`  3v3: ${current3v3.wins || 0}W/${current3v3.losses || 0}L/${current3v3.points || 0}pts → ${expected['3v3'].wins}W/${expected['3v3'].losses}L/${expected['3v3'].points}pts`);
        squad.statsStricker3v3 = { 
          points: expected['3v3'].points, 
          wins: expected['3v3'].wins, 
          losses: expected['3v3'].losses,
          rank: getRankFromPoints(expected['3v3'].points)
        };
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await squad.save();
        console.log(`  ✨ Stats UPDATED`);
        squadsFixed++;
      } else {
        console.log(`  ✅ Stats already correct`);
        squadsOk++;
      }
    }
    
    // ========== 2. FIX USER STATS ==========
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 2: FIXING USER STATS (FORMAT-SPECIFIC)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Build user stats from match history (format-specific)
    const userStats = {}; // { odUserId: { '5v5': { wins, losses, points }, '3v3': { wins, losses, points }, username } }
    
    for (const match of allMatches) {
      const format = match.format || '5v5';
      
      for (const player of match.players || []) {
        if (player.isFake || !player.user) continue;
        
        const odUserId = player.user.toString();
        const isWinner = player.team === match.winner;
        
        if (!userStats[odUserId]) {
          userStats[odUserId] = { 
            '5v5': { wins: 0, losses: 0, points: 0 }, 
            '3v3': { wins: 0, losses: 0, points: 0 },
            username: player.username 
          };
        }
        
        const stats = userStats[odUserId][format];
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
      
      let needsUpdate = false;
      
      // Check and update 5v5 stats
      const current5v5 = user.statsStricker || {};
      if ((current5v5.wins || 0) !== expected['5v5'].wins ||
          (current5v5.losses || 0) !== expected['5v5'].losses ||
          (current5v5.points || 0) !== expected['5v5'].points) {
        console.log(`  ${user.username} 5v5: ${current5v5.wins || 0}W/${current5v5.losses || 0}L/${current5v5.points || 0}pts → ${expected['5v5'].wins}W/${expected['5v5'].losses}L/${expected['5v5'].points}pts`);
        if (!user.statsStricker) user.statsStricker = { points: 0, wins: 0, losses: 0, xp: 0 };
        user.statsStricker.wins = expected['5v5'].wins;
        user.statsStricker.losses = expected['5v5'].losses;
        user.statsStricker.points = expected['5v5'].points;
        needsUpdate = true;
      }
      
      // Check and update 3v3 stats
      const current3v3 = user.statsStricker3v3 || {};
      if ((current3v3.wins || 0) !== expected['3v3'].wins ||
          (current3v3.losses || 0) !== expected['3v3'].losses ||
          (current3v3.points || 0) !== expected['3v3'].points) {
        console.log(`  ${user.username} 3v3: ${current3v3.wins || 0}W/${current3v3.losses || 0}L/${current3v3.points || 0}pts → ${expected['3v3'].wins}W/${expected['3v3'].losses}L/${expected['3v3'].points}pts`);
        if (!user.statsStricker3v3) user.statsStricker3v3 = { points: 0, wins: 0, losses: 0, xp: 0 };
        user.statsStricker3v3.wins = expected['3v3'].wins;
        user.statsStricker3v3.losses = expected['3v3'].losses;
        user.statsStricker3v3.points = expected['3v3'].points;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
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
