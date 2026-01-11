import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Match from '../src/models/Match.js';
import Squad from '../src/models/Squad.js';

dotenv.config();

/**
 * Script de correction pour mettre à jour l'historique des matchs existants
 * 
 * Ce script:
 * 1. Récupère tous les matchs complétés
 * 2. Pour chaque match, ajoute l'entrée dans matchHistory des joueurs du roster
 * 3. Ne touche PAS aux joueurs qui ne sont pas dans le roster
 * 4. Évite les doublons (ne rajoute pas si déjà présent)
 */

async function fixMatchHistory() {
  try {
    console.log('🔍 Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer tous les matchs complétés
    console.log('📋 Récupération des matchs complétés...');
    const completedMatches = await Match.find({ 
      status: 'completed'
    })
      .populate('challengerRoster.user', '_id username matchHistory')
      .populate('opponentRoster.user', '_id username matchHistory')
      .populate('result.winner', '_id')
      .sort({ 'result.confirmedAt': -1 });

    console.log(`   Trouvé ${completedMatches.length} matchs complétés\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const match of completedMatches) {
      console.log(`\n🔄 Traitement du match ${match._id}...`);
      
      // Déterminer le gagnant et le perdant
      const winnerId = match.result?.winner?._id?.toString() || match.result?.winner?.toString();
      if (!winnerId) {
        console.log('   ⚠️ Match sans gagnant défini, ignoré');
        skippedCount++;
        continue;
      }

      const challengerId = match.challenger?.toString();
      const opponentId = match.opponent?.toString();
      
      const isWinnerChallenger = winnerId === challengerId;
      const loserId = isWinnerChallenger ? opponentId : challengerId;

      const winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
      const loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

      // Si les rosters sont vides, récupérer depuis les escouades
      let winnerRosterToUse = winnerRoster;
      let loserRosterToUse = loserRoster;

      if ((!winnerRoster || winnerRoster.length === 0) || (!loserRoster || loserRoster.length === 0)) {
        console.log('   ⚠️ Roster(s) vide(s), récupération depuis les escouades...');
        
        if (!winnerRoster || winnerRoster.length === 0) {
          const winnerSquad = await Squad.findById(winnerId).populate('members.user', '_id username');
          if (winnerSquad?.members) {
            winnerRosterToUse = winnerSquad.members.slice(0, match.teamSize || 4).map(m => ({
              user: m.user,
              username: m.user?.username || 'Unknown',
              isHelper: false
            }));
            console.log(`   ✅ ${winnerRosterToUse.length} joueurs récupérés pour le roster gagnant`);
          }
        }
        
        if (!loserRoster || loserRoster.length === 0) {
          const loserSquad = await Squad.findById(loserId).populate('members.user', '_id username');
          if (loserSquad?.members) {
            loserRosterToUse = loserSquad.members.slice(0, match.teamSize || 4).map(m => ({
              user: m.user,
              username: m.user?.username || 'Unknown',
              isHelper: false
            }));
            console.log(`   ✅ ${loserRosterToUse.length} joueurs récupérés pour le roster perdant`);
          }
        }
      }

      // Mettre à jour l'historique des gagnants
      if (winnerRosterToUse && winnerRosterToUse.length > 0) {
        for (const rosterEntry of winnerRosterToUse) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (!playerId) continue;

          try {
            const player = await User.findById(playerId).select('matchHistory username');
            if (!player) {
              console.log(`   ⚠️ Joueur ${playerId} non trouvé`);
              continue;
            }

            // Vérifier si le match est déjà dans l'historique
            const alreadyExists = player.matchHistory?.some(mh => 
              (mh.match?._id || mh.match)?.toString() === match._id.toString()
            );

            if (alreadyExists) {
              console.log(`   ⏭️  ${player.username} - déjà dans l'historique`);
              skippedCount++;
              continue;
            }

            // Ajouter le match dans l'historique
            await User.findByIdAndUpdate(playerId, {
              $push: {
                matchHistory: {
                  match: match._id,
                  squad: winnerId,
                  result: 'win',
                  playedAt: match.result?.confirmedAt || match.updatedAt
                }
              }
            });

            console.log(`   ✅ ${player.username} - victoire ajoutée`);
            updatedCount++;
          } catch (error) {
            console.error(`   ❌ Erreur pour le joueur ${playerId}:`, error.message);
            errorCount++;
          }
        }
      }

      // Mettre à jour l'historique des perdants
      if (loserRosterToUse && loserRosterToUse.length > 0) {
        for (const rosterEntry of loserRosterToUse) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (!playerId) continue;

          try {
            const player = await User.findById(playerId).select('matchHistory username');
            if (!player) {
              console.log(`   ⚠️ Joueur ${playerId} non trouvé`);
              continue;
            }

            // Vérifier si le match est déjà dans l'historique
            const alreadyExists = player.matchHistory?.some(mh => 
              (mh.match?._id || mh.match)?.toString() === match._id.toString()
            );

            if (alreadyExists) {
              console.log(`   ⏭️  ${player.username} - déjà dans l'historique`);
              skippedCount++;
              continue;
            }

            // Ajouter le match dans l'historique
            await User.findByIdAndUpdate(playerId, {
              $push: {
                matchHistory: {
                  match: match._id,
                  squad: loserId,
                  result: 'loss',
                  playedAt: match.result?.confirmedAt || match.updatedAt
                }
              }
            });

            console.log(`   ✅ ${player.username} - défaite ajoutée`);
            updatedCount++;
          } catch (error) {
            console.error(`   ❌ Erreur pour le joueur ${playerId}:`, error.message);
            errorCount++;
          }
        }
      }
    }

    console.log('\n\n📊 RÉSUMÉ:');
    console.log(`   Matchs traités: ${completedMatches.length}`);
    console.log(`   Entrées ajoutées: ${updatedCount}`);
    console.log(`   Entrées ignorées (déjà présentes): ${skippedCount}`);
    console.log(`   Erreurs: ${errorCount}`);
    console.log('\n✅ Correction terminée!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la correction
fixMatchHistory();







