/**
 * Script pour diagnostiquer et corriger les victoires manquantes en mode classé
 * 
 * Usage: node scripts/fix-ranked-victories.js [--fix]
 * 
 * Sans --fix: mode diagnostic seulement (affiche les problèmes)
 * Avec --fix: corrige les problèmes trouvés
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
const rankedMatchSchema = new mongoose.Schema({}, { strict: false });
const RankedMatch = mongoose.model('RankedMatch', rankedMatchSchema);

const rankingSchema = new mongoose.Schema({}, { strict: false });
const Ranking = mongoose.model('Ranking', rankingSchema);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';
const FIX_MODE = process.argv.includes('--fix');

async function main() {
  try {
    console.log('🔍 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    if (FIX_MODE) {
      console.log('⚠️  MODE CORRECTION ACTIVÉ - Les modifications seront appliquées\n');
    } else {
      console.log('ℹ️  MODE DIAGNOSTIC SEULEMENT - Utilisez --fix pour corriger\n');
    }

    // Récupérer tous les matchs classés complétés
    const completedMatches = await RankedMatch.find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(50); // Limiter aux 50 derniers matchs

    console.log(`📊 Analyse de ${completedMatches.length} matchs complétés récents...\n`);

    let totalIssues = 0;
    let fixedIssues = 0;

    for (const match of completedMatches) {
      const winnerTeam = Number(match.result?.winner);
      
      if (!winnerTeam || (winnerTeam !== 1 && winnerTeam !== 2)) {
        console.log(`⚠️  Match ${match._id}: Équipe gagnante invalide (${match.result?.winner})`);
        totalIssues++;
        continue;
      }

      console.log(`\n📋 Match ${match._id} (${match.gameMode} ${match.mode})`);
      console.log(`   Équipe gagnante: ${winnerTeam}`);
      console.log(`   Complété le: ${match.completedAt}`);
      console.log(`   Joueurs:`);

      for (let i = 0; i < match.players.length; i++) {
        const player = match.players[i];
        
        // Skip fake players
        if (player.isFake) {
          console.log(`   [${i}] ${player.username} - BOT (ignoré)`);
          continue;
        }

        const userId = player.user?._id || player.user;
        if (!userId) {
          console.log(`   [${i}] ${player.username} - Pas de userId (ignoré)`);
          continue;
        }

        const playerTeam = Number(player.team);
        const isWinner = playerTeam === winnerTeam;

        // Vérifier le ranking du joueur
        const ranking = await Ranking.findOne({ 
          user: userId, 
          mode: match.mode, 
          season: 1 
        });

        const user = await User.findById(userId).select('username stats goldCoins');

        if (!ranking) {
          console.log(`   [${i}] ${player.username || user?.username} - ⚠️  PAS DE RANKING TROUVÉ`);
          totalIssues++;
          
          if (FIX_MODE) {
            // Créer le ranking
            const newRanking = new Ranking({
              user: userId,
              mode: match.mode,
              season: 1,
              points: isWinner ? 25 : 0,
              wins: isWinner ? 1 : 0,
              losses: isWinner ? 0 : 1,
              currentStreak: isWinner ? 1 : 0,
              bestStreak: isWinner ? 1 : 0
            });
            await newRanking.save();
            console.log(`         ✅ Ranking créé`);
            fixedIssues++;
          }
          continue;
        }

        // Vérifier si le résultat est cohérent
        const expectedResult = isWinner ? 'VICTOIRE' : 'DÉFAITE';
        const hasRewards = player.rewards && (player.rewards.pointsChange !== undefined);
        
        let status = '✅';
        let issues = [];

        // Vérifier les rewards enregistrés dans le match
        if (!hasRewards) {
          status = '⚠️ ';
          issues.push('pas de rewards enregistrés');
        } else if (isWinner && player.rewards.pointsChange < 0) {
          status = '❌';
          issues.push(`rewards incorrects (points: ${player.rewards.pointsChange} au lieu de positif)`);
        } else if (!isWinner && player.rewards.pointsChange > 0) {
          status = '❌';
          issues.push(`rewards incorrects (points: ${player.rewards.pointsChange} au lieu de négatif/0)`);
        }

        // Vérifier la cohérence team
        if (playerTeam !== 1 && playerTeam !== 2) {
          status = '❌';
          issues.push(`équipe invalide: ${player.team}`);
        }

        console.log(`   [${i}] ${player.username || user?.username}`);
        console.log(`       Team: ${playerTeam}, ${expectedResult}`);
        console.log(`       Ranking: ${ranking.wins}V/${ranking.losses}D, ${ranking.points} pts`);
        console.log(`       Rewards: ${hasRewards ? `${player.rewards.pointsChange} pts, ${player.rewards.goldEarned} gold` : 'N/A'}`);
        console.log(`       Status: ${status} ${issues.length > 0 ? issues.join(', ') : 'OK'}`);

        if (issues.length > 0) {
          totalIssues++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RÉSUMÉ:`);
    console.log(`   Matchs analysés: ${completedMatches.length}`);
    console.log(`   Problèmes trouvés: ${totalIssues}`);
    if (FIX_MODE) {
      console.log(`   Problèmes corrigés: ${fixedIssues}`);
    }
    console.log('='.repeat(60));

    if (totalIssues > 0 && !FIX_MODE) {
      console.log('\n💡 Pour corriger les problèmes, lancez: node scripts/fix-ranked-victories.js --fix');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Déconnecté de MongoDB');
  }
}

main();
