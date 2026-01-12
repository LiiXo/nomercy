import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Match from '../src/models/Match.js';
import Squad from '../src/models/Squad.js';

dotenv.config();

/**
 * Script de test pour vérifier le système d'historique de match
 * 
 * Ce script vérifie que:
 * 1. Les joueurs des rosters ont bien le match dans leur historique
 * 2. Les joueurs de l'escouade qui ne sont PAS dans le roster n'ont PAS le match
 * 3. L'historique contient les bonnes informations (résultat, escouade, date)
 */

async function testMatchHistory() {
  try {
    console.log('🔍 Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Récupérer un match complété récent avec des rosters
    console.log('📋 Récupération d\'un match complété récent...');
    const recentMatch = await Match.findOne({ 
      status: 'completed',
      $or: [
        { 'challengerRoster.0': { $exists: true } },
        { 'opponentRoster.0': { $exists: true } }
      ]
    })
      .populate('challenger', 'name members')
      .populate('opponent', 'name members')
      .populate('challengerRoster.user', 'username matchHistory')
      .populate('opponentRoster.user', 'username matchHistory')
      .populate('result.winner', 'name')
      .sort({ 'result.confirmedAt': -1 })
      .limit(1);

    if (!recentMatch) {
      console.log('⚠️ Aucun match complété trouvé avec des rosters');
      return;
    }

    console.log(`\n📊 Match trouvé: ${recentMatch._id}`);
    console.log(`   Challenger: ${recentMatch.challenger?.name || 'N/A'}`);
    console.log(`   Opponent: ${recentMatch.opponent?.name || 'N/A'}`);
    console.log(`   Gagnant: ${recentMatch.result?.winner?.name || 'N/A'}`);
    console.log(`   Date: ${recentMatch.result?.confirmedAt || recentMatch.updatedAt}\n`);

    // 2. Vérifier les joueurs du roster challenger
    console.log('🔹 ROSTER CHALLENGER:');
    if (recentMatch.challengerRoster && recentMatch.challengerRoster.length > 0) {
      console.log(`   ${recentMatch.challengerRoster.length} joueurs dans le roster`);
      
      for (const rosterEntry of recentMatch.challengerRoster) {
        const player = rosterEntry.user;
        if (!player) continue;

        const hasMatchInHistory = player.matchHistory?.some(mh => 
          (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
        );

        const status = hasMatchInHistory ? '✅' : '❌';
        console.log(`   ${status} ${player.username}${rosterEntry.isHelper ? ' (Helper)' : ''}`);
        
        if (hasMatchInHistory) {
          const historyEntry = player.matchHistory.find(mh => 
            (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
          );
          console.log(`      → Résultat: ${historyEntry.result}, Squad: ${historyEntry.squad}`);
        }
      }
    } else {
      console.log('   ⚠️ Roster vide');
    }

    // 3. Vérifier les joueurs du roster opponent
    console.log('\n🔹 ROSTER OPPONENT:');
    if (recentMatch.opponentRoster && recentMatch.opponentRoster.length > 0) {
      console.log(`   ${recentMatch.opponentRoster.length} joueurs dans le roster`);
      
      for (const rosterEntry of recentMatch.opponentRoster) {
        const player = rosterEntry.user;
        if (!player) continue;

        const hasMatchInHistory = player.matchHistory?.some(mh => 
          (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
        );

        const status = hasMatchInHistory ? '✅' : '❌';
        console.log(`   ${status} ${player.username}${rosterEntry.isHelper ? ' (Helper)' : ''}`);
        
        if (hasMatchInHistory) {
          const historyEntry = player.matchHistory.find(mh => 
            (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
          );
          console.log(`      → Résultat: ${historyEntry.result}, Squad: ${historyEntry.squad}`);
        }
      }
    } else {
      console.log('   ⚠️ Roster vide');
    }

    // 4. Vérifier que les membres de l'escouade qui NE SONT PAS dans le roster n'ont PAS le match
    console.log('\n🔹 MEMBRES DE L\'ESCOUADE NON-PARTICIPANTS:');
    
    // Challenger
    if (recentMatch.challenger?.members) {
      const rosterUserIds = recentMatch.challengerRoster?.map(r => 
        (r.user?._id || r.user)?.toString()
      ) || [];
      
      const nonParticipants = recentMatch.challenger.members.filter(m => 
        !rosterUserIds.includes((m.user?._id || m.user)?.toString())
      );

      if (nonParticipants.length > 0) {
        console.log(`   Challenger - ${nonParticipants.length} membre(s) non-participant(s):`);
        
        for (const member of nonParticipants) {
          const userId = member.user?._id || member.user;
          const player = await User.findById(userId).select('username matchHistory');
          
          if (!player) continue;

          const hasMatchInHistory = player.matchHistory?.some(mh => 
            (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
          );

          const status = hasMatchInHistory ? '❌ ERREUR' : '✅';
          console.log(`   ${status} ${player.username} (ne devrait PAS avoir le match)`);
        }
      } else {
        console.log('   Challenger - Tous les membres ont participé');
      }
    }

    // Opponent
    if (recentMatch.opponent?.members) {
      const rosterUserIds = recentMatch.opponentRoster?.map(r => 
        (r.user?._id || r.user)?.toString()
      ) || [];
      
      const nonParticipants = recentMatch.opponent.members.filter(m => 
        !rosterUserIds.includes((m.user?._id || m.user)?.toString())
      );

      if (nonParticipants.length > 0) {
        console.log(`   Opponent - ${nonParticipants.length} membre(s) non-participant(s):`);
        
        for (const member of nonParticipants) {
          const userId = member.user?._id || member.user;
          const player = await User.findById(userId).select('username matchHistory');
          
          if (!player) continue;

          const hasMatchInHistory = player.matchHistory?.some(mh => 
            (mh.match?._id || mh.match)?.toString() === recentMatch._id.toString()
          );

          const status = hasMatchInHistory ? '❌ ERREUR' : '✅';
          console.log(`   ${status} ${player.username} (ne devrait PAS avoir le match)`);
        }
      } else {
        console.log('   Opponent - Tous les membres ont participé');
      }
    }

    // 5. Statistiques globales
    console.log('\n📊 STATISTIQUES:');
    const totalMatches = await Match.countDocuments({ status: 'completed' });
    const matchesWithRosters = await Match.countDocuments({ 
      status: 'completed',
      $or: [
        { 'challengerRoster.0': { $exists: true } },
        { 'opponentRoster.0': { $exists: true } }
      ]
    });
    
    console.log(`   Total matchs complétés: ${totalMatches}`);
    console.log(`   Matchs avec rosters: ${matchesWithRosters}`);
    console.log(`   Matchs sans rosters: ${totalMatches - matchesWithRosters}`);

    console.log('\n✅ Test terminé!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le test
testMatchHistory();









