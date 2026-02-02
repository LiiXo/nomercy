/**
 * Script: Recalculate Ranked Season Stats from Match History
 * 
 * This script recalculates wins, losses, and points for all players
 * from RankedMatch history starting from a specific date (season start).
 * 
 * Usage: node scripts/recalculate-ranked-season.js
 * 
 * What it does:
 * 1. Finds all completed RankedMatch after the season start date
 * 2. For each player in each match, reads the rewards (pointsChange)
 * 3. Updates the Ranking model with correct seasonal data
 * 
 * Note: This does NOT touch User.statsHardcore/statsCdl (total wins/losses for profile)
 *       It only updates Ranking model (seasonal stats for leaderboard)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Import models
import RankedMatch from '../src/models/RankedMatch.js';
import Ranking from '../src/models/Ranking.js';
import User from '../src/models/User.js';

// ============== CONFIGURATION ==============
// Season start: February 1st, 2025 at 10:00 AM UTC
const SEASON_START = new Date(Date.UTC(2025, 1, 1, 9, 0, 0)); // Month is 0-indexed, so 1 = February
const SEASON_NUMBER = 2; // February = Season 2

console.log('='.repeat(60));
console.log('RECALCULATE RANKED SEASON STATS');
console.log('='.repeat(60));
console.log(`Season: ${SEASON_NUMBER}`);
console.log(`Start Date: ${SEASON_START.toISOString()}`);
console.log('='.repeat(60));

async function recalculateRankedSeason() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Step 1: Reset all rankings for this season to 0
    console.log('Step 1: Resetting all rankings for season', SEASON_NUMBER, '...');
    const resetResult = await Ranking.updateMany(
      { season: SEASON_NUMBER },
      {
        $set: {
          points: 0,
          wins: 0,
          losses: 0,
          currentStreak: 0
        }
      }
    );
    console.log(`   Reset ${resetResult.modifiedCount} existing rankings\n`);

    // Step 2: Find all completed matches after season start
    console.log('Step 2: Finding completed matches since', SEASON_START.toISOString(), '...');
    const matches = await RankedMatch.find({
      status: 'completed',
      completedAt: { $gte: SEASON_START },
      'result.winner': { $exists: true, $ne: null },
      isTestMatch: { $ne: true }
    }).sort({ completedAt: 1 }); // Process in chronological order

    console.log(`   Found ${matches.length} completed matches\n`);

    if (matches.length === 0) {
      console.log('No matches to process. Exiting.');
      await mongoose.disconnect();
      return;
    }

    // Step 3: Process each match
    console.log('Step 3: Processing matches...\n');
    
    const playerStats = {}; // userId -> { hardcore: {wins, losses, points}, cdl: {...} }
    let processedMatches = 0;
    let processedPlayers = 0;

    for (const match of matches) {
      const winningTeam = match.result.winner;
      const mode = match.mode; // 'hardcore' or 'cdl'

      for (const player of match.players) {
        // Skip fake players
        if (player.isFake || !player.user) continue;

        const odId = player.user._id?.toString() || player.user.toString();
        const isWinner = Number(player.team) === Number(winningTeam);
        
        // Get points change from rewards (or calculate default)
        const pointsChange = player.rewards?.pointsChange || (isWinner ? 30 : -10);

        // Initialize player stats if needed
        if (!playerStats[odId]) {
          playerStats[odId] = {
            hardcore: { wins: 0, losses: 0, points: 0 },
            cdl: { wins: 0, losses: 0, points: 0 }
          };
        }

        // Update stats
        if (isWinner) {
          playerStats[odId][mode].wins += 1;
        } else {
          playerStats[odId][mode].losses += 1;
        }
        playerStats[odId][mode].points += pointsChange;
        
        // Ensure points don't go below 0
        if (playerStats[odId][mode].points < 0) {
          playerStats[odId][mode].points = 0;
        }

        processedPlayers++;
      }

      processedMatches++;
      if (processedMatches % 50 === 0) {
        console.log(`   Processed ${processedMatches}/${matches.length} matches...`);
      }
    }

    console.log(`\n   ✓ Processed ${processedMatches} matches, ${processedPlayers} player entries\n`);

    // Step 4: Update Ranking documents
    console.log('Step 4: Updating Ranking documents...\n');
    
    let updatedRankings = 0;
    let createdRankings = 0;
    const uniquePlayers = Object.keys(playerStats);

    for (const odId of uniquePlayers) {
      const stats = playerStats[odId];

      // Update Hardcore ranking
      if (stats.hardcore.wins > 0 || stats.hardcore.losses > 0) {
        const result = await Ranking.findOneAndUpdate(
          { user: odId, mode: 'hardcore', season: SEASON_NUMBER },
          {
            $set: {
              points: stats.hardcore.points,
              wins: stats.hardcore.wins,
              losses: stats.hardcore.losses
            }
          },
          { upsert: true, new: true }
        );
        if (result.isNew) createdRankings++;
        else updatedRankings++;
      }

      // Update CDL ranking
      if (stats.cdl.wins > 0 || stats.cdl.losses > 0) {
        const result = await Ranking.findOneAndUpdate(
          { user: odId, mode: 'cdl', season: SEASON_NUMBER },
          {
            $set: {
              points: stats.cdl.points,
              wins: stats.cdl.wins,
              losses: stats.cdl.losses
            }
          },
          { upsert: true, new: true }
        );
        if (result.isNew) createdRankings++;
        else updatedRankings++;
      }
    }

    console.log(`   ✓ Updated ${updatedRankings} rankings`);
    console.log(`   ✓ Created ${createdRankings} new rankings\n`);

    // Step 5: Show summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total unique players: ${uniquePlayers.length}`);
    console.log(`Total matches processed: ${processedMatches}`);
    console.log(`Rankings updated: ${updatedRankings}`);
    console.log(`Rankings created: ${createdRankings}`);
    console.log('='.repeat(60));

    // Show top 10 by points (combined)
    console.log('\nTop 10 Players by Points:\n');
    
    const sortedPlayers = uniquePlayers
      .map(odId => ({
        odId,
        totalPoints: playerStats[odId].hardcore.points + playerStats[odId].cdl.points,
        hardcore: playerStats[odId].hardcore,
        cdl: playerStats[odId].cdl
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10);

    for (let i = 0; i < sortedPlayers.length; i++) {
      const p = sortedPlayers[i];
      const user = await User.findById(p.odId).select('username');
      console.log(`${i + 1}. ${user?.username || 'Unknown'}`);
      console.log(`   Hardcore: ${p.hardcore.points} pts (${p.hardcore.wins}W/${p.hardcore.losses}L)`);
      console.log(`   CDL: ${p.cdl.points} pts (${p.cdl.wins}W/${p.cdl.losses}L)`);
    }

    console.log('\n✓ Done!');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
recalculateRankedSeason();
