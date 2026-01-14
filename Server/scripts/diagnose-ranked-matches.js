/**
 * Script de diagnostic pour les matchs classés (RankedMatch)
 * 
 * Ce script vérifie:
 * - Les matchs classés complétés
 * - Les récompenses attribuées aux joueurs
 * - Les stats de classement (Ranking)
 * - La cohérence entre matchs et stats joueurs
 * 
 * Usage: node scripts/diagnose-ranked-matches.js [userId]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import RankedMatch from '../src/models/RankedMatch.js';
import User from '../src/models/User.js';
import Ranking from '../src/models/Ranking.js';

async function diagnoseRankedMatches() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    const specificUserId = process.argv[2];
    
    // 1. Statistiques générales des matchs classés
    console.log('📊 STATISTIQUES DES MATCHS CLASSÉS:');
    console.log('========================================');
    
    const statuses = ['pending', 'ready', 'in_progress', 'completed', 'cancelled', 'disputed'];
    for (const status of statuses) {
      const count = await RankedMatch.countDocuments({ status });
      console.log(`   ${status}: ${count} matchs`);
    }
    
    const totalMatches = await RankedMatch.countDocuments({});
    console.log(`   TOTAL: ${totalMatches} matchs`);
    console.log('========================================\n');

    // 2. Vérifier les matchs complétés et leurs récompenses
    console.log('🎮 MATCHS COMPLÉTÉS AVEC DÉTAILS:');
    console.log('========================================');
    
    const completedMatches = await RankedMatch.find({ status: 'completed' })
      .populate('players.user', 'username')
      .sort({ completedAt: -1 })
      .limit(10);

    for (const match of completedMatches) {
      console.log(`\n📋 Match ID: ${match._id}`);
      console.log(`   GameMode: ${match.gameMode} | Mode: ${match.mode} | TeamSize: ${match.teamSize}v${match.teamSize}`);
      console.log(`   Résultat: Équipe ${match.result?.winner} gagnante`);
      console.log(`   Complété le: ${match.completedAt}`);
      
      console.log(`   Joueurs:`);
      let rewardsDistributed = false;
      for (const player of match.players) {
        const username = player.user?.username || player.username || 'Inconnu';
        const userId = player.user?._id?.toString() || player.user?.toString() || 'N/A';
        const team = player.team;
        const isWinner = Number(team) === Number(match.result?.winner);
        const rewards = player.rewards;
        
        if (rewards && (rewards.pointsChange !== 0 || rewards.goldEarned !== 0 || rewards.xpEarned !== 0)) {
          rewardsDistributed = true;
        }
        
        console.log(`      - ${username} (ID: ${userId})`);
        console.log(`        Équipe: ${team} | ${isWinner ? '🏆 GAGNANT' : '💔 PERDANT'} | Fake: ${player.isFake || false}`);
        if (rewards) {
          console.log(`        Récompenses: ${rewards.pointsChange >= 0 ? '+' : ''}${rewards.pointsChange} pts, +${rewards.goldEarned} gold, +${rewards.xpEarned} XP`);
          console.log(`        Points: ${rewards.oldPoints} → ${rewards.newPoints}`);
        } else {
          console.log(`        ⚠️ Pas de récompenses enregistrées!`);
        }
      }
      
      if (!rewardsDistributed) {
        console.log(`   ⚠️ ATTENTION: Aucune récompense distribuée pour ce match!`);
      }
    }

    // 3. Si un userId spécifique est fourni, analyser ce joueur
    if (specificUserId) {
      console.log('\n\n👤 ANALYSE DU JOUEUR SPÉCIFIQUE:');
      console.log('========================================');
      
      let playerObjectId;
      try {
        playerObjectId = new mongoose.Types.ObjectId(specificUserId);
      } catch (e) {
        console.error(`❌ ID joueur invalide: ${specificUserId}`);
        return;
      }
      
      const user = await User.findById(playerObjectId).select('username stats goldCoins');
      if (!user) {
        console.log(`❌ Joueur non trouvé: ${specificUserId}`);
        return;
      }
      
      console.log(`\n   Joueur: ${user.username}`);
      console.log(`   Stats globales: ${user.stats?.wins || 0}V / ${user.stats?.losses || 0}D`);
      console.log(`   Gold: ${user.goldCoins || 0}`);
      console.log(`   XP: ${user.stats?.xp || 0}`);
      
      // Ranking pour chaque mode
      const rankings = await Ranking.find({ user: playerObjectId });
      console.log(`\n   Classements:`);
      for (const ranking of rankings) {
        console.log(`      - Mode ${ranking.mode}: ${ranking.points} pts, ${ranking.wins}V/${ranking.losses}D, Série: ${ranking.currentStreak}`);
      }
      
      // Matchs du joueur
      const playerMatches = await RankedMatch.find({
        'players.user': playerObjectId,
        status: 'completed'
      })
      .populate('players.user', 'username')
      .sort({ completedAt: -1 });
      
      console.log(`\n   Matchs trouvés: ${playerMatches.length}`);
      
      let totalWins = 0;
      let totalLosses = 0;
      let totalPointsChange = 0;
      let totalGoldEarned = 0;
      let totalXpEarned = 0;
      
      for (const match of playerMatches) {
        const playerInfo = match.players.find(p => {
          const pUserId = p.user?._id?.toString() || p.user?.toString();
          return pUserId === specificUserId;
        });
        
        if (!playerInfo) {
          console.log(`   ⚠️ Match ${match._id}: Joueur non trouvé dans la liste des participants!`);
          continue;
        }
        
        const isWinner = Number(playerInfo.team) === Number(match.result?.winner);
        if (isWinner) totalWins++;
        else totalLosses++;
        
        if (playerInfo.rewards) {
          totalPointsChange += playerInfo.rewards.pointsChange || 0;
          totalGoldEarned += playerInfo.rewards.goldEarned || 0;
          totalXpEarned += playerInfo.rewards.xpEarned || 0;
        }
        
        console.log(`   📋 Match ${match._id.toString().slice(-6)}: ${isWinner ? '🏆 V' : '💔 D'} | Équipe ${playerInfo.team} | Rewards: ${playerInfo.rewards ? `${playerInfo.rewards.pointsChange}pts` : 'N/A'}`);
      }
      
      console.log(`\n   RÉSUMÉ CALCULÉ DEPUIS LES MATCHS:`);
      console.log(`      Victoires: ${totalWins}`);
      console.log(`      Défaites: ${totalLosses}`);
      console.log(`      Points totaux gagnés/perdus: ${totalPointsChange}`);
      console.log(`      Gold total gagné: ${totalGoldEarned}`);
      console.log(`      XP total gagné: ${totalXpEarned}`);
      
      // Comparer avec les stats réelles
      const expectedWins = rankings.reduce((sum, r) => sum + (r.wins || 0), 0);
      const expectedLosses = rankings.reduce((sum, r) => sum + (r.losses || 0), 0);
      
      console.log(`\n   COMPARAISON:`);
      if (totalWins !== expectedWins || totalLosses !== expectedLosses) {
        console.log(`      ⚠️ INCOHÉRENCE DÉTECTÉE!`);
        console.log(`      Matchs: ${totalWins}V/${totalLosses}D vs Rankings: ${expectedWins}V/${expectedLosses}D`);
      } else {
        console.log(`      ✅ Stats cohérentes`);
      }
    }

    // 4. Trouver des anomalies (matchs complétés sans récompenses)
    console.log('\n\n🔍 RECHERCHE D\'ANOMALIES:');
    console.log('========================================');
    
    const matchesWithoutRewards = await RankedMatch.find({
      status: 'completed',
      'result.winner': { $ne: null }
    });
    
    let anomalyCount = 0;
    for (const match of matchesWithoutRewards) {
      const hasNoRewards = match.players.every(p => 
        !p.rewards || (p.rewards.pointsChange === 0 && p.rewards.goldEarned === 0 && p.rewards.xpEarned === 0)
      );
      
      const hasNullTeams = match.players.some(p => 
        !p.isFake && p.team === null
      );
      
      if (hasNoRewards && !match.isTestMatch) {
        anomalyCount++;
        console.log(`   ⚠️ Match ${match._id}: Complété sans récompenses`);
      }
      
      if (hasNullTeams) {
        console.log(`   ⚠️ Match ${match._id}: Des joueurs ont team=null`);
      }
    }
    
    if (anomalyCount === 0) {
      console.log('   ✅ Aucune anomalie majeure détectée');
    } else {
      console.log(`\n   Total anomalies: ${anomalyCount}`);
    }

    console.log('\n========================================');
    console.log('✅ DIAGNOSTIC TERMINÉ');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

diagnoseRankedMatches();
