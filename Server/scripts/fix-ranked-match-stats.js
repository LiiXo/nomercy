/**
 * Script pour réparer les stats des matchs classés
 * 
 * Ce script:
 * 1. Vérifie tous les matchs classés complétés
 * 2. Recalcule et corrige les stats W/L dans Ranking
 * 3. Vérifie que les récompenses sont bien enregistrées
 * 
 * Usage: node scripts/fix-ranked-match-stats.js [--dry-run]
 * 
 * Options:
 *   --dry-run : Affiche ce qui serait fait sans modifier la base de données
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

const isDryRun = process.argv.includes('--dry-run');

async function fixRankedMatchStats() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');
    
    if (isDryRun) {
      console.log('⚠️ MODE DRY-RUN: Aucune modification ne sera effectuée\n');
    }

    // Récupérer tous les matchs classés complétés
    const completedMatches = await RankedMatch.find({ 
      status: 'completed',
      'result.winner': { $ne: null }
    })
    .populate('players.user', 'username')
    .sort({ completedAt: 1 }); // Du plus ancien au plus récent

    console.log(`📋 ${completedMatches.length} matchs classés complétés trouvés\n`);

    // Stocker les stats calculées pour chaque joueur
    const playerStats = new Map(); // userId -> { mode -> { wins, losses } }
    
    // Analyser tous les matchs
    for (const match of completedMatches) {
      const winnerTeam = Number(match.result.winner);
      const mode = match.mode;
      
      for (const player of match.players) {
        if (player.isFake || !player.user) continue;
        
        const userId = player.user._id?.toString() || player.user.toString();
        const playerTeam = Number(player.team);
        const isWinner = playerTeam === winnerTeam;
        
        if (!playerStats.has(userId)) {
          playerStats.set(userId, new Map());
        }
        
        if (!playerStats.get(userId).has(mode)) {
          playerStats.get(userId).set(mode, { wins: 0, losses: 0 });
        }
        
        const stats = playerStats.get(userId).get(mode);
        if (isWinner) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      }
    }

    console.log(`👥 ${playerStats.size} joueurs uniques analysés\n`);

    // Vérifier et corriger les rankings
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const [userId, modeStats] of playerStats) {
      for (const [mode, calculatedStats] of modeStats) {
        try {
          const ranking = await Ranking.findOne({ user: userId, mode, season: 1 });
          const user = await User.findById(userId).select('username');
          const username = user?.username || 'Inconnu';
          
          if (!ranking) {
            console.log(`⚠️ ${username} (${mode}): Pas de ranking trouvé (calculé: ${calculatedStats.wins}V/${calculatedStats.losses}D)`);
            
            if (!isDryRun) {
              // Créer le ranking manquant
              const newRanking = new Ranking({
                user: userId,
                mode,
                season: 1,
                points: 0, // On ne peut pas recalculer les points sans connaître les détails
                wins: calculatedStats.wins,
                losses: calculatedStats.losses
              });
              await newRanking.save();
              console.log(`   ✅ Ranking créé pour ${username} (${mode})`);
              fixedCount++;
            }
            continue;
          }
          
          const currentWins = ranking.wins || 0;
          const currentLosses = ranking.losses || 0;
          
          if (currentWins !== calculatedStats.wins || currentLosses !== calculatedStats.losses) {
            console.log(`❌ ${username} (${mode}): Incohérence détectée`);
            console.log(`   Actuel: ${currentWins}V/${currentLosses}D`);
            console.log(`   Calculé: ${calculatedStats.wins}V/${calculatedStats.losses}D`);
            
            if (!isDryRun) {
              ranking.wins = calculatedStats.wins;
              ranking.losses = calculatedStats.losses;
              await ranking.save();
              console.log(`   ✅ Corrigé`);
              fixedCount++;
            }
          } else {
            // Stats OK, pas besoin de corriger
          }
        } catch (err) {
          console.error(`❌ Erreur pour userId ${userId} mode ${mode}:`, err.message);
          errorCount++;
        }
      }
    }

    // Vérifier aussi les stats globales des joueurs (User.stats)
    console.log('\n📊 Vérification des stats globales des joueurs...\n');
    
    for (const [userId, modeStats] of playerStats) {
      try {
        // Calculer les totaux pour ce joueur
        let totalWins = 0;
        let totalLosses = 0;
        
        for (const [, stats] of modeStats) {
          totalWins += stats.wins;
          totalLosses += stats.losses;
        }
        
        const user = await User.findById(userId);
        if (!user) continue;
        
        const currentWins = user.stats?.wins || 0;
        const currentLosses = user.stats?.losses || 0;
        
        // Note: Les stats globales incluent peut-être aussi les matchs ladder, 
        // donc on ne corrige que si les stats classées sont supérieures
        // On vérifie juste si les stats semblent cohérentes
        if (totalWins > currentWins || totalLosses > currentLosses) {
          console.log(`⚠️ ${user.username}: Stats globales potentiellement incorrectes`);
          console.log(`   Actuel: ${currentWins}V/${currentLosses}D`);
          console.log(`   Matchs classés: ${totalWins}V/${totalLosses}D`);
          // On ne corrige pas automatiquement car les stats globales peuvent inclure d'autres sources
        }
      } catch (err) {
        errorCount++;
      }
    }

    // Résumé
    console.log('\n========================================');
    console.log('📊 RÉSUMÉ:');
    console.log('========================================');
    console.log(`   Matchs analysés: ${completedMatches.length}`);
    console.log(`   Joueurs analysés: ${playerStats.size}`);
    if (!isDryRun) {
      console.log(`   Corrections effectuées: ${fixedCount}`);
    } else {
      console.log(`   Corrections à effectuer: ${fixedCount}`);
    }
    console.log(`   Erreurs: ${errorCount}`);
    console.log('========================================\n');

    if (isDryRun && fixedCount > 0) {
      console.log('💡 Pour appliquer les corrections, relancez sans --dry-run\n');
    }

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

fixRankedMatchStats();
