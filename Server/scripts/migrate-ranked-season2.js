/**
 * Migration Script: Ranked Season 2
 * 
 * Ce script recalcule les points de tous les joueurs pour la saison 2 du mode classé
 * en utilisant l'historique des matchs depuis le début du mois (10h du matin).
 * 
 * Règles:
 * - Victoire: +30 points
 * - Défaite: -15 points
 * - Les points ne peuvent pas être négatifs
 * - Les défaites avant la première victoire ne retirent pas de points
 * 
 * Usage: node scripts/migrate-ranked-season2.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Models
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const rankingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: ['hardcore', 'cdl'], required: true },
  season: { type: Number, default: 1 },
  points: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  division: { type: String, default: 'bronze' },
  currentStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  team: { type: String, default: '' }
}, { timestamps: true });
const Ranking = mongoose.model('Ranking', rankingSchema);

const rankedMatchSchema = new mongoose.Schema({}, { strict: false });
const RankedMatch = mongoose.model('RankedMatch', rankedMatchSchema);

// Configuration
const SEASON_NUMBER = 2;
const POINTS_WIN = 30;
const POINTS_LOSS = -15;

// Season 2 start date: First day of February 2025 at 10:00 AM French time (9:00 UTC)
const currentYear = new Date().getFullYear();
const SEASON_START = new Date(Date.UTC(currentYear, 1, 1, 9, 0, 0)); // February 1st, 9:00 UTC

async function migrate() {
  try {
    console.log('='.repeat(60));
    console.log('MIGRATION - RANKED SEASON 2');
    console.log('='.repeat(60));
    console.log(`\nSeason start date: ${SEASON_START.toISOString()}`);
    console.log(`Points per win: +${POINTS_WIN}`);
    console.log(`Points per loss: ${POINTS_LOSS}`);
    console.log(`Minimum points: 0 (no negatives)`);
    console.log(`Rule: Losses before first win don't count\n`);

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected!\n');

    // Step 0: Delete all existing season 2 rankings (clean slate)
    console.log('Step 0: Clearing old season 2 rankings...');
    const deleteResult = await Ranking.deleteMany({ season: SEASON_NUMBER });
    console.log(`   Deleted ${deleteResult.deletedCount} old ranking records\n`);

    // Step 1: Get all completed ranked matches since season start, sorted chronologically
    console.log('Step 1: Fetching ranked matches...');
    const matches = await RankedMatch.find({
      status: 'completed',
      'result.winner': { $exists: true, $ne: null },
      completedAt: { $gte: SEASON_START },
      isTestMatch: { $ne: true }
    })
    .sort({ completedAt: 1 }) // Chronological order is CRITICAL
    .select('players result completedAt mode')
    .lean();

    console.log(`   Found ${matches.length} completed matches since ${SEASON_START.toISOString()}\n`);

    // Step 2: Calculate stats for each player by mode
    console.log('Step 2: Calculating player stats...\n');
    
    // playerStats[odiserId][mode] = { wins, losses, points, hasWon }
    const playerStats = {};

    for (const match of matches) {
      const winningTeam = Number(match.result.winner);
      const mode = match.mode || 'hardcore';

      for (const player of match.players) {
        if (!player.user || player.isFake) continue;

        const odiserId = player.user.toString();
        const playerTeam = Number(player.team);
        const isWin = playerTeam === winningTeam;

        // Initialize player stats if not exists
        if (!playerStats[odiserId]) {
          playerStats[odiserId] = {
            hardcore: { wins: 0, losses: 0, points: 0, hasWon: false },
            cdl: { wins: 0, losses: 0, points: 0, hasWon: false }
          };
        }

        const stats = playerStats[odiserId][mode];

        if (isWin) {
          stats.wins++;
          stats.hasWon = true;
          stats.points += POINTS_WIN;
        } else {
          stats.losses++;
          // Only subtract points if player has won at least once in this mode
          if (stats.hasWon) {
            stats.points = Math.max(0, stats.points + POINTS_LOSS);
          }
          // If hasWon is false, we don't subtract points (player stays at 0)
        }
      }
    }

    // Step 3: Update Ranking documents
    console.log('Step 3: Updating Ranking documents...\n');
    
    let updatedRankings = 0;
    let createdRankings = 0;
    const uniquePlayers = Object.keys(playerStats);

    for (const odiserId of uniquePlayers) {
      const stats = playerStats[odiserId];

      // Update Hardcore ranking
      if (stats.hardcore.wins > 0 || stats.hardcore.losses > 0) {
        const result = await Ranking.findOneAndUpdate(
          { user: odiserId, mode: 'hardcore', season: SEASON_NUMBER },
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
          { user: odiserId, mode: 'cdl', season: SEASON_NUMBER },
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

    console.log(`   Updated ${updatedRankings} rankings`);
    console.log(`   Created ${createdRankings} new rankings\n`);

    // Step 4: Show summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total unique players: ${uniquePlayers.length}`);
    console.log(`Total matches processed: ${matches.length}`);
    console.log(`Rankings updated: ${updatedRankings}`);
    console.log(`Rankings created: ${createdRankings}`);
    console.log('='.repeat(60));

    // Show top 10 by points (separate for each mode)
    console.log('\nTop 10 Players - Hardcore:\n');
    
    const hardcorePlayers = uniquePlayers
      .filter(id => playerStats[id].hardcore.wins > 0 || playerStats[id].hardcore.losses > 0)
      .map(odiserId => ({
        odiserId,
        ...playerStats[odiserId].hardcore
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    for (let i = 0; i < hardcorePlayers.length; i++) {
      const p = hardcorePlayers[i];
      const user = await User.findById(p.odiserId).select('username');
      console.log(`${i + 1}. ${user?.username || 'Unknown'}: ${p.points} pts (${p.wins}W/${p.losses}L)`);
    }

    console.log('\nTop 10 Players - CDL:\n');
    
    const cdlPlayers = uniquePlayers
      .filter(id => playerStats[id].cdl.wins > 0 || playerStats[id].cdl.losses > 0)
      .map(odiserId => ({
        odiserId,
        ...playerStats[odiserId].cdl
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    for (let i = 0; i < cdlPlayers.length; i++) {
      const p = cdlPlayers[i];
      const user = await User.findById(p.odiserId).select('username');
      console.log(`${i + 1}. ${user?.username || 'Unknown'}: ${p.points} pts (${p.wins}W/${p.losses}L)`);
    }

    console.log('\n✓ Migration complete!');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
