/**
 * Migration script: Update stats.totalPoints for squads that have played Stricker matches
 * 
 * Rules:
 * - Win: +20 pts to stats.totalPoints
 * - Loss: -15 pts from stats.totalPoints (never below 0)
 * 
 * This script replays all completed Stricker matches chronologically
 * and calculates the correct top squad points for each squad.
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

const TOP_SQUAD_POINTS_WIN = 30;
const TOP_SQUAD_POINTS_LOSS = 15;

async function migrateStrickerTopSquadPoints() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all completed Stricker matches with a winner, sorted chronologically
    const matches = await StrickerMatch.find({
      status: 'completed',
      winner: { $exists: true, $ne: null },
      isTestMatch: { $ne: true }
    })
    .sort({ completedAt: 1 }) // Chronological order
    .populate('team1Squad', 'name tag')
    .populate('team2Squad', 'name tag')
    .lean();

    console.log(`📊 Found ${matches.length} completed Stricker matches to process\n`);

    if (matches.length === 0) {
      console.log('No matches to process. Exiting.');
      await mongoose.disconnect();
      return;
    }

    // Track points per squad (simulate chronological replay)
    const squadPoints = {}; // { squadId: totalPointsFromStricker }

    for (const match of matches) {
      const team1Id = match.team1Squad?._id?.toString();
      const team2Id = match.team2Squad?._id?.toString();

      if (!team1Id || !team2Id) {
        console.log(`⚠️  Match ${match._id} - missing squad reference, skipping`);
        continue;
      }

      // Ensure both squads are tracked
      if (!(team1Id in squadPoints)) squadPoints[team1Id] = 0;
      if (!(team2Id in squadPoints)) squadPoints[team2Id] = 0;

      const team1Name = `[${match.team1Squad?.tag}] ${match.team1Squad?.name}`;
      const team2Name = `[${match.team2Squad?.tag}] ${match.team2Squad?.name}`;

      if (match.winner === 1) {
        // Team 1 won, Team 2 lost
        squadPoints[team1Id] += TOP_SQUAD_POINTS_WIN;
        // Loss: subtract but never go below 0
        squadPoints[team2Id] = Math.max(0, squadPoints[team2Id] - TOP_SQUAD_POINTS_LOSS);
        
        console.log(`  Match ${match._id.toString().slice(-6)} | ${team1Name} WIN (+${TOP_SQUAD_POINTS_WIN} → ${squadPoints[team1Id]}) vs ${team2Name} LOSS (-${TOP_SQUAD_POINTS_LOSS} → ${squadPoints[team2Id]})`);
      } else if (match.winner === 2) {
        // Team 2 won, Team 1 lost
        squadPoints[team2Id] += TOP_SQUAD_POINTS_WIN;
        // Loss: subtract but never go below 0
        squadPoints[team1Id] = Math.max(0, squadPoints[team1Id] - TOP_SQUAD_POINTS_LOSS);
        
        console.log(`  Match ${match._id.toString().slice(-6)} | ${team2Name} WIN (+${TOP_SQUAD_POINTS_WIN} → ${squadPoints[team2Id]}) vs ${team1Name} LOSS (-${TOP_SQUAD_POINTS_LOSS} → ${squadPoints[team1Id]})`);
      }
    }

    console.log(`\n📋 Summary - Points to add from Stricker matches:\n`);

    // Now update each squad's statsHardcore.totalPoints by ADDING the stricker-earned points
    // Also revert the previous bad migration that wrote to stats.totalPoints
    const squadIds = Object.keys(squadPoints);
    let updatedCount = 0;

    for (const squadId of squadIds) {
      const strickerPts = squadPoints[squadId];
      
      const squad = await Squad.findById(squadId);
      if (!squad) {
        console.log(`  ⚠️  Squad ${squadId} not found in DB, skipping`);
        continue;
      }

      // Revert previous bad migration from stats.totalPoints
      if (squad.stats && squad.stats.totalPoints > 0) {
        const oldBadTotal = squad.stats.totalPoints;
        squad.stats.totalPoints = Math.max(0, oldBadTotal - strickerPts);
        console.log(`  [${squad.tag}] Reverted stats.totalPoints: ${oldBadTotal} -> ${squad.stats.totalPoints}`);
      }

      // Apply to correct field: statsHardcore.totalPoints
      if (!squad.statsHardcore) squad.statsHardcore = { totalWins: 0, totalLosses: 0, totalPoints: 0 };
      
      const oldTotal = squad.statsHardcore.totalPoints || 0;
      const newTotal = oldTotal + strickerPts;
      
      console.log(`  [${squad.tag}] ${squad.name}: statsHardcore.totalPoints ${oldTotal} + stricker ${strickerPts} = ${newTotal}`);
      
      squad.statsHardcore.totalPoints = newTotal;
      await squad.save();
      updatedCount++;
    }

    console.log(`\n✅ Migration complete! Updated ${updatedCount} squads.`);
    console.log(`   Processed ${matches.length} matches across ${squadIds.length} unique squads.`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

migrateStrickerTopSquadPoints();
