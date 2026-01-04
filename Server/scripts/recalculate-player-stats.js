/**
 * Script pour recalculer les stats des joueurs basé sur les matchs completed
 * 
 * Ce script va :
 * 1. Remettre à zéro les stats wins/losses de tous les joueurs
 * 2. Parcourir tous les matchs "completed"
 * 3. Recalculer les wins/losses basé sur les rosters
 * 4. Reconstruire le matchHistory de chaque joueur
 * 
 * Usage: node scripts/recalculate-player-stats.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import Match from '../src/models/Match.js';
import User from '../src/models/User.js';

async function recalculateStats() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Récupérer tous les matchs completed
    const completedMatches = await Match.find({ status: 'completed' });
    console.log(`📋 ${completedMatches.length} matchs "completed" trouvés\n`);

    // 2. Créer un map pour stocker les stats de chaque joueur
    // playerId -> { wins: 0, losses: 0, matchHistory: [] }
    const playerStats = new Map();

    // 3. Parcourir chaque match et calculer les stats
    for (const match of completedMatches) {
      const winnerId = match.result?.winner?.toString();
      const challengerId = match.challenger?.toString();
      const opponentId = match.opponent?.toString();

      if (!winnerId) {
        console.log(`⚠️ Match ${match._id}: pas de gagnant, ignoré`);
        continue;
      }

      const isWinnerChallenger = winnerId === challengerId;

      // Traiter le roster challenger
      if (match.challengerRoster && match.challengerRoster.length > 0) {
        for (const entry of match.challengerRoster) {
          const playerId = entry.user?.toString();
          if (!playerId) continue;

          if (!playerStats.has(playerId)) {
            playerStats.set(playerId, { wins: 0, losses: 0, matchHistory: [], username: entry.username });
          }

          const stats = playerStats.get(playerId);
          if (isWinnerChallenger) {
            stats.wins++;
            stats.matchHistory.push({
              match: match._id,
              squad: challengerId,
              result: 'win',
              playedAt: match.result?.confirmedAt || match.updatedAt || match.createdAt
            });
          } else {
            stats.losses++;
            stats.matchHistory.push({
              match: match._id,
              squad: challengerId,
              result: 'loss',
              playedAt: match.result?.confirmedAt || match.updatedAt || match.createdAt
            });
          }
        }
      }

      // Traiter le roster opponent
      if (match.opponentRoster && match.opponentRoster.length > 0) {
        for (const entry of match.opponentRoster) {
          const playerId = entry.user?.toString();
          if (!playerId) continue;

          if (!playerStats.has(playerId)) {
            playerStats.set(playerId, { wins: 0, losses: 0, matchHistory: [], username: entry.username });
          }

          const stats = playerStats.get(playerId);
          if (!isWinnerChallenger) {
            stats.wins++;
            stats.matchHistory.push({
              match: match._id,
              squad: opponentId,
              result: 'win',
              playedAt: match.result?.confirmedAt || match.updatedAt || match.createdAt
            });
          } else {
            stats.losses++;
            stats.matchHistory.push({
              match: match._id,
              squad: opponentId,
              result: 'loss',
              playedAt: match.result?.confirmedAt || match.updatedAt || match.createdAt
            });
          }
        }
      }
    }

    console.log(`👥 ${playerStats.size} joueurs trouvés dans les rosters\n`);

    // 4. Mettre à jour les stats de chaque joueur
    console.log('🔄 Mise à jour des stats des joueurs...\n');

    // D'abord, remettre à zéro TOUS les joueurs qui ont des stats
    const resetResult = await User.updateMany(
      { $or: [{ 'stats.wins': { $gt: 0 } }, { 'stats.losses': { $gt: 0 } }] },
      { 
        $set: { 
          'stats.wins': 0, 
          'stats.losses': 0,
          'matchHistory': []
        } 
      }
    );
    console.log(`🔄 ${resetResult.modifiedCount} joueurs remis à zéro\n`);

    // Ensuite, appliquer les nouvelles stats
    let updatedCount = 0;
    for (const [playerId, stats] of playerStats) {
      try {
        await User.findByIdAndUpdate(playerId, {
          $set: {
            'stats.wins': stats.wins,
            'stats.losses': stats.losses,
            'matchHistory': stats.matchHistory
          }
        });
        updatedCount++;
        console.log(`✅ ${stats.username || playerId}: ${stats.wins}W / ${stats.losses}L (${stats.matchHistory.length} matchs)`);
      } catch (err) {
        console.error(`❌ Erreur pour ${playerId}:`, err.message);
      }
    }

    // 5. Vérification finale
    console.log('\n🔍 Vérification finale...');
    
    const usersWithStats = await User.find({
      $or: [
        { 'stats.wins': { $gt: 0 } },
        { 'stats.losses': { $gt: 0 } }
      ]
    });

    let allGood = true;
    for (const user of usersWithStats) {
      const totalStats = (user.stats?.wins || 0) + (user.stats?.losses || 0);
      const historyCount = user.matchHistory?.length || 0;
      
      if (totalStats !== historyCount) {
        allGood = false;
        console.log(`⚠️ ${user.username}: ${totalStats} stats vs ${historyCount} historique`);
      }
    }

    if (allGood) {
      console.log('✅ Toutes les stats correspondent à l\'historique!\n');
    }

    console.log('========================================');
    console.log('✅ RECALCUL TERMINÉ');
    console.log(`📋 Matchs traités: ${completedMatches.length}`);
    console.log(`👥 Joueurs mis à jour: ${updatedCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

recalculateStats();

