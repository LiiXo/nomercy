/**
 * Script pour corriger l'historique des matchs des joueurs
 * Y compris les joueurs qui ont participé en tant qu'AIDE (helper)
 * 
 * Usage: node scripts/fix-player-match-history.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Match from '../src/models/Match.js';
import User from '../src/models/User.js';

async function fixPlayerMatchHistory() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer tous les matchs terminés
    const completedMatches = await Match.find({ status: 'completed' });
    console.log(`📋 ${completedMatches.length} matchs terminés trouvés`);

    let entriesAdded = 0;
    let matchesProcessed = 0;

    for (const match of completedMatches) {
      matchesProcessed++;
      const matchId = match._id;
      const winnerId = match.result?.winner?.toString();
      const challengerId = match.challenger?.toString();
      const opponentId = match.opponent?.toString();
      
      if (!winnerId) {
        console.log(`⚠️ Match ${matchId}: pas de gagnant, ignoré`);
        continue;
      }

      const isWinnerChallenger = winnerId === challengerId;
      const winnerSquadId = isWinnerChallenger ? challengerId : opponentId;
      const loserSquadId = isWinnerChallenger ? opponentId : challengerId;

      // Traiter tous les joueurs du roster challenger (incluant les helpers)
      if (match.challengerRoster && match.challengerRoster.length > 0) {
        for (const entry of match.challengerRoster) {
          const playerId = entry.user?.toString();
          if (!playerId) continue;
          
          const result = isWinnerChallenger ? 'win' : 'loss';
          const squadId = challengerId;
          
          const added = await addMatchToHistory(playerId, matchId, squadId, result, match);
          if (added) {
            entriesAdded++;
            console.log(`✅ Challenger roster: ${entry.username || playerId} (helper: ${entry.isHelper}) - ${result}`);
          }
        }
      }

      // Traiter tous les joueurs du roster opponent (incluant les helpers)
      if (match.opponentRoster && match.opponentRoster.length > 0) {
        for (const entry of match.opponentRoster) {
          const playerId = entry.user?.toString();
          if (!playerId) continue;
          
          const result = !isWinnerChallenger ? 'win' : 'loss';
          const squadId = opponentId;
          
          const added = await addMatchToHistory(playerId, matchId, squadId, result, match);
          if (added) {
            entriesAdded++;
            console.log(`✅ Opponent roster: ${entry.username || playerId} (helper: ${entry.isHelper}) - ${result}`);
          }
        }
      }

      if (matchesProcessed % 20 === 0) {
        console.log(`📊 Progression: ${matchesProcessed}/${completedMatches.length} matchs`);
      }
    }

    // Vérification finale
    console.log('\n🔍 Vérification des joueurs avec stats incohérentes...');
    
    const usersWithStats = await User.find({
      $or: [
        { 'stats.wins': { $gt: 0 } },
        { 'stats.losses': { $gt: 0 } }
      ]
    });

    let inconsistent = 0;
    for (const user of usersWithStats) {
      const totalStats = (user.stats?.wins || 0) + (user.stats?.losses || 0);
      const historyCount = user.matchHistory?.length || 0;
      
      if (totalStats > historyCount) {
        inconsistent++;
        console.log(`⚠️ ${user.username}: ${totalStats} matchs (stats) vs ${historyCount} (historique) - Manque ${totalStats - historyCount}`);
      }
    }

    console.log('\n========================================');
    console.log('✅ TERMINÉ');
    console.log(`📋 Matchs traités: ${matchesProcessed}`);
    console.log(`👥 Entrées d'historique ajoutées: ${entriesAdded}`);
    console.log(`⚠️ Joueurs avec incohérence: ${inconsistent}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

async function addMatchToHistory(playerId, matchId, squadId, result, match) {
  try {
    const player = await User.findById(playerId);
    if (!player) return false;

    // Vérifier si le match est déjà dans l'historique
    const alreadyHas = player.matchHistory?.some(mh => 
      (mh.match?.toString() || mh.match) === matchId.toString()
    );

    if (alreadyHas) return false;

    // Ajouter le match à l'historique
    await User.findByIdAndUpdate(playerId, {
      $push: {
        matchHistory: {
          match: matchId,
          squad: squadId,
          result: result,
          playedAt: match.result?.confirmedAt || match.updatedAt || match.createdAt
        }
      }
    });

    return true;
  } catch (err) {
    console.error(`Erreur pour joueur ${playerId}:`, err.message);
    return false;
  }
}

// Lancer le script
fixPlayerMatchHistory();
