/**
 * Script de diagnostic pour comprendre les incohérences entre stats et matchs
 * 
 * Usage: node scripts/diagnose-matches.js
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

async function diagnose() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Compter tous les matchs par statut
    console.log('📊 STATISTIQUES DES MATCHS:');
    console.log('========================================');
    
    const statuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired', 'disputed'];
    for (const status of statuses) {
      const count = await Match.countDocuments({ status });
      console.log(`   ${status}: ${count} matchs`);
    }
    
    const totalMatches = await Match.countDocuments({});
    console.log(`   TOTAL: ${totalMatches} matchs`);
    console.log('========================================\n');

    // 2. Lister tous les matchs avec leurs rosters
    console.log('📋 DÉTAIL DE TOUS LES MATCHS:');
    console.log('========================================');
    
    const allMatches = await Match.find({})
      .populate('challenger', 'name tag')
      .populate('opponent', 'name tag')
      .sort({ createdAt: -1 });

    for (const match of allMatches) {
      console.log(`\n🎮 Match ID: ${match._id}`);
      console.log(`   Status: ${match.status}`);
      console.log(`   Challenger: ${match.challenger?.name || 'N/A'} (roster: ${match.challengerRoster?.length || 0} joueurs)`);
      console.log(`   Opponent: ${match.opponent?.name || 'N/A'} (roster: ${match.opponentRoster?.length || 0} joueurs)`);
      console.log(`   Gagnant: ${match.result?.winner || 'Pas de résultat'}`);
      console.log(`   Date: ${match.createdAt}`);
      
      if (match.challengerRoster?.length > 0) {
        console.log(`   Challenger roster:`);
        for (const r of match.challengerRoster) {
          console.log(`      - ${r.username || r.user} (helper: ${r.isHelper})`);
        }
      }
      if (match.opponentRoster?.length > 0) {
        console.log(`   Opponent roster:`);
        for (const r of match.opponentRoster) {
          console.log(`      - ${r.username || r.user} (helper: ${r.isHelper})`);
        }
      }
    }

    // 3. Lister les joueurs avec des incohérences
    console.log('\n\n👥 JOUEURS AVEC INCOHÉRENCES:');
    console.log('========================================');
    
    const usersWithStats = await User.find({
      $or: [
        { 'stats.wins': { $gt: 0 } },
        { 'stats.losses': { $gt: 0 } }
      ]
    }).populate('squad', 'name tag');

    for (const user of usersWithStats) {
      const totalStats = (user.stats?.wins || 0) + (user.stats?.losses || 0);
      const historyCount = user.matchHistory?.length || 0;
      
      console.log(`\n👤 ${user.username} (ID: ${user._id})`);
      console.log(`   Stats: ${user.stats?.wins || 0}W / ${user.stats?.losses || 0}L = ${totalStats} matchs`);
      console.log(`   Historique: ${historyCount} matchs`);
      console.log(`   Escouade actuelle: ${user.squad?.name || 'Aucune'}`);
      
      if (totalStats > historyCount) {
        console.log(`   ⚠️ MANQUE ${totalStats - historyCount} match(s)!`);
      } else if (totalStats < historyCount) {
        console.log(`   ⚠️ TROP de matchs dans l'historique!`);
      } else {
        console.log(`   ✅ OK`);
      }
      
      // Chercher dans quels matchs ce joueur apparaît
      const matchesWithPlayer = await Match.find({
        $or: [
          { 'challengerRoster.user': user._id },
          { 'opponentRoster.user': user._id }
        ]
      }).select('_id status');
      
      console.log(`   Trouvé dans ${matchesWithPlayer.length} match(s): ${matchesWithPlayer.map(m => `${m._id}(${m.status})`).join(', ') || 'aucun'}`);
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

diagnose();




