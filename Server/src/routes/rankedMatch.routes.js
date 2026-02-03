import express from 'express';
import mongoose from 'mongoose';
import RankedMatch from '../models/RankedMatch.js';
import User from '../models/User.js';
import Ranking from '../models/Ranking.js';
import AppSettings from '../models/AppSettings.js';
import ItemUsage from '../models/ItemUsage.js';
import { verifyToken, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import { getRankedMatchRewards } from '../utils/configHelper.js';
import { getQueueStatus, joinQueue, leaveQueue, addFakePlayers, removeFakePlayers, startStaffTestMatch, joinStaffQueue, leaveStaffQueue, getStaffQueueStatus, addBotsToStaffQueue, clearStaffQueueBots, forceStartStaffMatch } from '../services/rankedMatchmaking.service.js';
import { logArbitratorCall, deleteMatchVoiceChannels, createMatchVoiceChannels } from '../services/discordBot.service.js';

const router = express.Router();

/**
 * Distribue les récompenses aux joueurs après un match classé
 * - Gagnants: +points ladder classé, +gold, +XP, +points top player
 * - Perdants: -points ladder classé, +gold consolation, 0 XP
 * 
 * Explications:
 * - Points Ladder Classé (Ranking): utilisés pour le classement spécifique du mode classé (avec rangs Bronze, Silver, Gold, etc.)
 * - Points Top Player: utilisés pour le classement général des joueurs (stats.xp dans User)
 * - Gold: monnaie du jeu (stats.gold dans User)
 * - XP: expérience générale pour le classement top player (stats.xp dans User)
 */
async function distributeRankedRewards(match) {
  try {
    // ========== PROTECTION ATOMIQUE CONTRE LES RACE CONDITIONS ==========
    // Utiliser findOneAndUpdate atomique pour marquer le match comme "en cours de distribution"
    // Cela empêche deux requêtes simultanées de distribuer les récompenses
    const lockResult = await RankedMatch.findOneAndUpdate(
      { 
        _id: match._id, 
        rewardsDistributed: { $ne: true } // Seulement si pas déjà distribué
      },
      { 
        $set: { rewardsDistributed: true } 
      },
      { new: false } // Retourner l'ancien document pour voir l'état avant modification
    );
    
    // Si lockResult est null, cela signifie que le match avait déjà rewardsDistributed=true
    // ou qu'un autre processus vient de le mettre à true (race condition évitée!)
    if (!lockResult) {
      console.log(`[RANKED REWARDS] ⚠️ Match ${match._id}: Récompenses déjà distribuées ou en cours, skip (atomic lock).`);
      return;
    }
    
    console.log(`[RANKED REWARDS] 🔒 Match ${match._id}: Lock acquis, distribution des récompenses...`);
    
    // Mettre à jour l'objet match en mémoire pour refléter le changement
    match.rewardsDistributed = true;
    
    // Double vérification: s'assurer qu'aucun joueur n'a déjà reçu des récompenses
    // (protection supplémentaire au cas où)
    const hasExistingRewards = match.players.some(p => 
      p.rewards && 
      ((p.rewards.oldPoints !== undefined && p.rewards.oldPoints !== 0) ||
       (p.rewards.newPoints !== undefined && p.rewards.newPoints !== 0))
    );
    if (hasExistingRewards) {
      console.log(`[RANKED REWARDS] ⚠️ Match ${match._id}: Des récompenses existent déjà dans players, skip.`);
      return;
    }
    
    // Note: Les matchs de test distribuent maintenant les récompenses pour permettre les tests
    if (match.isTestMatch) {
    }
    
    // Récupérer la configuration des récompenses
    const rewards = await getRankedMatchRewards(match.gameMode, match.mode);
    const { pointsWin, pointsLoss, coinsWin, coinsLoss, xpWinMin, xpWinMax } = rewards;
    
    // Récupérer les seuils de rang et points perdus par rang depuis AppSettings
    const AppSettings = (await import('../models/AppSettings.js')).default;
    const appSettings = await AppSettings.getSettings();
    const rankThresholds = appSettings?.rankedSettings?.rankPointsThresholds || null;
    
    // Vérifier les événements actifs (Double XP, Double Gold)
    // Un événement est actif si: enabled=true ET (startsAt <= now OU pas de startsAt) ET (expiresAt > now OU pas d'expiresAt)
    const now = new Date();
    
    const doubleXPEnabled = appSettings?.events?.doubleXP?.enabled;
    const doubleXPStarted = !appSettings?.events?.doubleXP?.startsAt || new Date(appSettings.events.doubleXP.startsAt) <= now;
    const doubleXPNotExpired = !appSettings?.events?.doubleXP?.expiresAt || new Date(appSettings.events.doubleXP.expiresAt) > now;
    const isDoubleXP = doubleXPEnabled && doubleXPStarted && doubleXPNotExpired;
    
    const doubleGoldEnabled = appSettings?.events?.doubleGold?.enabled;
    const doubleGoldStarted = !appSettings?.events?.doubleGold?.startsAt || new Date(appSettings.events.doubleGold.startsAt) <= now;
    const doubleGoldNotExpired = !appSettings?.events?.doubleGold?.expiresAt || new Date(appSettings.events.doubleGold.expiresAt) > now;
    const isDoubleGold = doubleGoldEnabled && doubleGoldStarted && doubleGoldNotExpired;
    
    // Log détaillé des événements pour debug
    
    if (isDoubleXP) {
    }
    if (isDoubleGold) {
    }
    
    
    // Points perdus par rang - HARDCODÉ (ne lit plus depuis la DB)
    const pointsLossPerRank = {
      bronze: -15,
      silver: -20,
      gold: -25,
      platinum: -30,
      diamond: -35,
      master: -40,
      grandmaster: -45,
      champion: -50
    };
    
    // S'assurer que winningTeam est un Number pour les comparaisons
    const winningTeam = Number(match.result.winner);
    const losingTeam = winningTeam === 1 ? 2 : 1;
    
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Traiter chaque joueur INDIVIDUELLEMENT avec gestion d'erreur
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      
      try {
        // Ignorer les faux joueurs (bots)
        if (player.isFake) {
          skippedCount++;
          continue;
        }
        
        // Récupérer l'ID utilisateur (gérer les cas populé vs ObjectId)
        const userId = player.user?._id || player.user;
        
        if (!userId) {
          skippedCount++;
          continue;
        }
        
        // S'assurer que la comparaison est faite avec des nombres
        // Vérifier que player.team est défini et valide
        const playerTeam = Number(player.team);
        
        if (isNaN(playerTeam) || (playerTeam !== 1 && playerTeam !== 2)) {
          console.error(`[RANKED REWARDS] ⚠️ Player ${i}: Invalid team value: ${player.team} (type: ${typeof player.team})`);
          errorCount++;
          continue;
        }
        
        const isWinner = playerTeam === winningTeam;
        
        
        // Charger l'utilisateur
        const user = await User.findById(userId);
        if (!user) {
          console.error(`[RANKED REWARDS] ⚠️ Player ${i}: User not found in database (ID: ${userId})`);
          errorCount++;
          continue;
        }
        
        // ========== METTRE À JOUR LE CLASSEMENT LADDER CLASSÉ (Ranking) ==========
        // Get current season from month (Season 1 = January, Season 2 = February, etc.)
        const currentSeason = new Date().getMonth() + 1;
        let ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: currentSeason });
        
        // ========== CHECK FOR ACTIVE BOOSTERS ==========
        // Now using match-count-based boosters (count decrements after each match)
        // Rechercher les boosters actifs pour ce joueur
        // IMPORTANT: Ne PAS traiter remainingMatches: null comme illimité
        // Seuls les boosters avec remainingMatches > 0 sont valides
        const activeBoosters = await ItemUsage.find({
          user: userId,
          isActive: true,
          wasConsumed: false,
          effectType: { $in: ['double_pts', 'double_gold'] },
          remainingMatches: { $gt: 0 } // SEULEMENT les boosters avec des matchs restants
        });
        
        const hasDoublePts = activeBoosters.some(b => b.effectType === 'double_pts');
        const hasDoubleGold = activeBoosters.some(b => b.effectType === 'double_gold');
        
        // Log détaillé des boosters pour debug
        if (activeBoosters.length > 0) {
          activeBoosters.forEach(b => {
          });
        } else {
        }
        
        // ========== CALCULER LES RÉCOMPENSES ==========
        
        // Déterminer le rang actuel du joueur pour calculer les points perdus
        // Utiliser les seuils dynamiques depuis AppSettings
        let playerDivision = 'bronze';
        if (ranking) {
          const points = ranking.points || 0;
          const thresholds = rankThresholds || {};
          
          // Vérifier chaque rang du plus haut au plus bas
          if (points >= (thresholds.champion?.min ?? 3500)) playerDivision = 'champion';
          else if (points >= (thresholds.grandmaster?.min ?? 3000)) playerDivision = 'grandmaster';
          else if (points >= (thresholds.master?.min ?? 2500)) playerDivision = 'master';
          else if (points >= (thresholds.diamond?.min ?? 2000)) playerDivision = 'diamond';
          else if (points >= (thresholds.platinum?.min ?? 1500)) playerDivision = 'platinum';
          else if (points >= (thresholds.gold?.min ?? 1000)) playerDivision = 'gold';
          else if (points >= (thresholds.silver?.min ?? 500)) playerDivision = 'silver';
          else playerDivision = 'bronze';
        }
        
        // Points pour le ladder classé - utiliser les points par rang pour les perdants
        // DOUBLE XP: Si l'événement est actif, doubler les points gagnés en victoire
        // BOOSTER: Si le joueur a un booster double_pts actif, doubler les points en victoire
        let rankedPointsChange;
        if (isWinner) {
          let basePoints = pointsWin;
          if (isDoubleXP) basePoints *= 2; // Event double XP
          if (hasDoublePts) basePoints *= 2; // Personal booster
          rankedPointsChange = basePoints;
        } else {
          // Utiliser les points perdus configurés pour le rang du joueur
          const configuredLoss = pointsLossPerRank[playerDivision];
          rankedPointsChange = configuredLoss ?? pointsLoss;
        }
        
        // Gold (monnaie du jeu)
        // DOUBLE GOLD: Si l'événement est actif, doubler les pièces gagnées
        // BOOSTER: Si le joueur a un booster double_gold actif, doubler les golds en victoire
        let goldChange;
        if (isWinner) {
          let baseGold = coinsWin;
          if (isDoubleGold) baseGold *= 2; // Event double gold
          if (hasDoubleGold) baseGold *= 2; // Personal booster
          goldChange = baseGold;
        } else {
          goldChange = isDoubleGold ? coinsLoss * 2 : coinsLoss;
        }
        
        // XP pour le classement Top Player (expérience générale)
        const xpChange = isWinner ? Math.floor(Math.random() * (xpWinMax - xpWinMin + 1)) + xpWinMin : 0;
        if (!ranking) {
          ranking = new Ranking({ 
            user: userId, 
            mode: match.mode, 
            season: currentSeason, 
            points: 0, 
            wins: 0, 
            losses: 0 
          });
        } else {
        }
        
        // Appliquer les changements de points ladder classé (minimum 0)
        const oldRankedPoints = ranking.points || 0;
        ranking.points = Math.max(0, (ranking.points || 0) + rankedPointsChange);
        const newRankedPoints = ranking.points;
        
        // Mettre à jour les stats win/loss du ladder classé
        if (isWinner) {
          ranking.wins = (ranking.wins || 0) + 1;
          ranking.currentStreak = (ranking.currentStreak || 0) + 1;
          if (ranking.currentStreak > (ranking.bestStreak || 0)) {
            ranking.bestStreak = ranking.currentStreak;
          }
        } else {
          ranking.losses = (ranking.losses || 0) + 1;
          ranking.currentStreak = 0;
        }
        
        await ranking.save();
        
        // ========== METTRE À JOUR LES STATS DU JOUEUR PAR MODE (User) ==========
        // Use mode-specific stats field
        const statsField = match.mode === 'cdl' ? 'statsCdl' : 'statsHardcore';
        if (!user[statsField]) user[statsField] = {};
        
        // Gold (monnaie) - stocké dans user.goldCoins (shared between modes)
        const oldGold = user.goldCoins || 0;
        user.goldCoins = oldGold + goldChange;
        
        // XP pour Top Player (classement par mode basé sur l'XP)
        const oldXP = user[statsField].xp || 0;
        user[statsField].xp = oldXP + xpChange;
        
        // Mettre à jour les stats win/loss par mode
        if (isWinner) {
          user[statsField].wins = (user[statsField].wins || 0) + 1;
        } else {
          user[statsField].losses = (user[statsField].losses || 0) + 1;
        }
        
        await user.save();
        
        // ========== ENREGISTRER LES RÉCOMPENSES DANS LE MATCH ==========
        // Mettre à jour directement via l'index (plus fiable)
        // Stocker les flags pour afficher x2 dans le rapport de match:
        // - doublePts: true si EVENT Double XP actif OU si BOOSTER double_pts actif
        // - doubleGold: true si EVENT Double Gold actif OU si BOOSTER double_gold actif
        match.players[i].rewards = {
          pointsChange: rankedPointsChange, // Points pour le ladder classé
          goldEarned: goldChange,
          xpEarned: xpChange,
          oldPoints: oldRankedPoints,
          newPoints: newRankedPoints,
          // Flags pour l'affichage x2 dans le rapport (EVENT ou BOOSTER)
          doublePts: (isDoubleXP || hasDoublePts) && isWinner,
          doubleGold: (isDoubleGold || hasDoubleGold) && isWinner,
          // Détail des boosters utilisés (pour référence)
          boostersUsed: {
            doublePts: hasDoublePts && isWinner,
            doubleGold: hasDoubleGold && isWinner
          },
          // Events actifs au moment du match
          eventsActive: {
            doubleXP: isDoubleXP,
            doubleGold: isDoubleGold
          }
        };
        // Stocker aussi les points actuels du joueur pour calculer l'ancien/nouveau rang
        match.players[i].points = newRankedPoints;
        
        // ========== LOG DÉTAILLÉ ==========
        
        // ========== DECREMENT MATCH COUNT FOR BOOSTERS ==========
        if (activeBoosters.length > 0) {
          for (const booster of activeBoosters) {
            // Decrement remainingMatches if it has a count
            if (booster.remainingMatches !== null && booster.remainingMatches > 0) {
              const newRemainingMatches = booster.remainingMatches - 1;
              
              await ItemUsage.findByIdAndUpdate(booster._id, {
                $set: {
                  remainingMatches: newRemainingMatches,
                  inMatch: false,
                  matchStartTime: null,
                  isActive: newRemainingMatches > 0 // Deactivate if no matches left
                },
                $inc: {
                  totalMatchesUsed: 1
                }
              });
              
            } else {
              // Unlimited booster - just reset inMatch flag and increment counter
              await ItemUsage.findByIdAndUpdate(booster._id, {
                $set: {
                  inMatch: false,
                  matchStartTime: null
                },
                $inc: {
                  totalMatchesUsed: 1
                }
              });
            }
          }
        }
        
        processedCount++;
        
      } catch (playerError) {
        console.error(`[RANKED REWARDS] ❌ Error processing player ${i}:`, playerError);
        errorCount++;
        // Continue avec le joueur suivant au lieu d'arrêter tout le processus
      }
    }
    
    // Marquer le document comme modifié pour s'assurer que les subdocuments sont sauvegardés
    match.markModified('players');
    await match.save();
    
    
  } catch (error) {
    console.error('[RANKED REWARDS] ❌ Erreur globale lors de la distribution des récompenses:', error);
  }
}

// Obtenir le statut du matchmaking pour un joueur
router.get('/matchmaking/status', verifyToken, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.query;
    const userId = req.user._id;
    
    // Obtenir le statut de la file d'attente depuis le service
    const queueStatus = await getQueueStatus(userId, gameMode, mode);
    
    // Chercher si le joueur est dans un match actif (pending, ready, in_progress)
    const activeMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'ready', 'in_progress'] },
      gameMode,
      mode
    })
    .populate('players.user', 'username avatarUrl discordAvatar discordId')
    .populate('team1Referent', 'username')
    .populate('team2Referent', 'username');
    
    if (activeMatch) {
      // Le joueur est dans un match actif
      const playerInfo = activeMatch.players.find(p => 
        p.user?._id?.toString() === userId.toString()
      );
      
      return res.json({
        success: true,
        inQueue: false,
        inMatch: true,
        queueSize: queueStatus.queueSize || 0,
        match: {
          _id: activeMatch._id,
          status: activeMatch.status,
          gameMode: activeMatch.gameMode,
          mode: activeMatch.mode,
          team: playerInfo?.team,
          players: activeMatch.players,
          hostTeam: activeMatch.hostTeam,
          team1Referent: activeMatch.team1Referent,
          team2Referent: activeMatch.team2Referent
        }
      });
    }
    
    // Pas de match actif - retourner le statut de la file d'attente
    res.json({
      success: true,
      inQueue: queueStatus.inQueue || false,
      inMatch: false,
      queueSize: queueStatus.queueSize || 0,
      position: queueStatus.position || null,
      timerActive: queueStatus.timerActive || false,
      timerEndTime: queueStatus.timerEndTime || null,
      currentFormat: queueStatus.currentFormat || null,
      nextFormat: queueStatus.nextFormat || null,
      playersNeeded: queueStatus.playersNeeded || 0,
      minPlayers: queueStatus.minPlayers || 4,
      maxPlayers: queueStatus.maxPlayers || 10,
      match: null
    });
    
  } catch (error) {
    console.error('Error fetching matchmaking status:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les statistiques des matchs en cours (public)
router.get('/active-matches/stats', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;
    
    // Récupérer tous les matchs actifs (ready ou in_progress)
    const activeMatches = await RankedMatch.find({
      mode,
      status: { $in: ['ready', 'in_progress'] }
    }).select('gameMode teamSize status');
    
    // Grouper par mode de jeu et format
    const matchesByGameMode = {};
    
    activeMatches.forEach(match => {
      const key = `${match.gameMode}`;
      if (!matchesByGameMode[key]) {
        matchesByGameMode[key] = {
          gameMode: match.gameMode,
          formats: {},
          total: 0
        };
      }
      
      const formatKey = `${match.teamSize}v${match.teamSize}`;
      if (!matchesByGameMode[key].formats[formatKey]) {
        matchesByGameMode[key].formats[formatKey] = 0;
      }
      matchesByGameMode[key].formats[formatKey]++;
      matchesByGameMode[key].total++;
    });
    
    // Convertir en tableau
    const stats = Object.values(matchesByGameMode).map(gm => ({
      gameMode: gm.gameMode,
      total: gm.total,
      formats: Object.entries(gm.formats).map(([format, count]) => ({
        format,
        count
      }))
    }));
    
    res.json({
      success: true,
      totalMatches: activeMatches.length,
      stats,
      mode
    });
  } catch (error) {
    console.error('Error fetching active matches stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Historique des matchs classés récents (public)
router.get('/history/recent', async (req, res) => {
  try {
    const { mode = 'hardcore', limit = 30 } = req.query;
    
    // Récupérer les matchs complétés récents
    const matches = await RankedMatch.find({
      mode,
      status: 'completed',
      isTestMatch: { $ne: true } // Exclure les matchs de test
    })
      .populate('players.user', 'username avatarUrl discordAvatar discordId platform')
      .populate('team1Referent', 'username avatarUrl discordAvatar discordId')
      .populate('team2Referent', 'username avatarUrl discordAvatar discordId')
      .select('gameMode mode teamSize players team1Referent team2Referent hostTeam status result maps startedAt completedAt createdAt')
      .sort({ completedAt: -1 })
      .limit(Math.min(parseInt(limit), 50)); // Max 50 matchs
    
    // Formater les données pour le frontend
    const formattedMatches = matches.map(match => {
      const team1Players = match.players.filter(p => p.team === 1);
      const team2Players = match.players.filter(p => p.team === 2);
      
      return {
        _id: match._id,
        gameMode: match.gameMode,
        mode: match.mode,
        teamSize: match.teamSize,
        format: `${match.teamSize}v${match.teamSize}`,
        result: {
          winner: match.result?.winner,
          team1Score: match.result?.team1Score || 0,
          team2Score: match.result?.team2Score || 0
        },
        team1: {
          players: team1Players.map(p => ({
            username: p.user?.username || p.username || 'Joueur',
            avatarUrl: p.user?.avatarUrl || null,
            discordId: p.user?.discordId || null,
            discordAvatar: p.user?.discordAvatar || null,
            isReferent: p.isReferent
          })),
          referent: match.team1Referent ? {
            username: match.team1Referent.username,
            avatarUrl: match.team1Referent.avatarUrl
          } : null,
          isHost: match.hostTeam === 1
        },
        team2: {
          players: team2Players.map(p => ({
            username: p.user?.username || p.username || 'Joueur',
            avatarUrl: p.user?.avatarUrl || null,
            discordId: p.user?.discordId || null,
            discordAvatar: p.user?.discordAvatar || null,
            isReferent: p.isReferent
          })),
          referent: match.team2Referent ? {
            username: match.team2Referent.username,
            avatarUrl: match.team2Referent.avatarUrl
          } : null,
          isHost: match.hostTeam === 2
        },
        maps: match.maps || [],
        startedAt: match.startedAt,
        completedAt: match.completedAt,
        createdAt: match.createdAt
      };
    });
    
    res.json({
      success: true,
      matches: formattedMatches,
      total: formattedMatches.length,
      mode
    });
  } catch (error) {
    console.error('Error fetching recent matches history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Rejoindre la file d'attente du matchmaking
router.post('/matchmaking/join', verifyToken, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    const userId = req.user._id;
    
    const result = await joinQueue(userId, gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error joining matchmaking queue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Quitter la file d'attente du matchmaking
router.post('/matchmaking/leave', verifyToken, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    const userId = req.user._id;
    
    const result = await leaveQueue(userId, gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error leaving matchmaking queue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Check for pending MVP vote (for when user returns to ranked mode page)
// IMPORTANT: This route MUST be defined BEFORE /:matchId to avoid being caught by it
router.get('/pending-mvp-vote', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // MVP voting cutoff date - only require MVP votes for matches completed after this date
    // This prevents old matches from blocking users
    const mvpVotingCutoffDate = new Date('2026-02-03T00:00:00.000Z');

    // Find ALL completed matches where:
    // 1. User is a participant
    // 2. MVP voting is active but not confirmed
    // 3. Match was completed AFTER the cutoff date (ignore old matches)
    // Sort by completedAt DESC to get the most recent match first
    const pendingMatches = await RankedMatch.find({
      'players.user': user._id,
      status: 'completed',
      'result.confirmed': true,
      'mvp.votingActive': true,
      'mvp.confirmed': { $ne: true },
      completedAt: { $gte: mvpVotingCutoffDate }
    }).sort({ completedAt: -1 }).populate([
      { path: 'players.user', select: 'username avatar avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'mvp.player', select: 'username avatar avatarUrl discordAvatar discordId' },
      { path: 'mvp.votes.voter', select: 'username' },
      { path: 'mvp.votes.votedFor', select: 'username avatar avatarUrl discordAvatar discordId' }
    ]);
    
    // Find the first match where user is on losing team and hasn't voted
    let pendingMatch = null;
    for (const match of pendingMatches) {
      const winningTeam = match.result.winner;
      const losingTeam = winningTeam === 1 ? 2 : 1;
      const playerInMatch = match.players.find(p => 
        p.user && (p.user._id || p.user).toString() === user._id.toString()
      );
      
      // Check if user is on losing team
      if (playerInMatch && playerInMatch.team === losingTeam) {
        // Check if user hasn't voted yet
        const hasVoted = match.mvp.votes.some(v => 
          v.voter && (v.voter._id || v.voter).toString() === user._id.toString()
        );
        
        if (!hasVoted) {
          pendingMatch = match;
          break;
        }
      }
    }
    
    // Backward compatibility: use pendingMatch from the loop

    if (!pendingMatch) {
      return res.json({ success: true, hasPendingVote: false });
    }

    // We already verified in the loop that user is on losing team and hasn't voted
    const winningTeam = pendingMatch.result.winner;
    const losingTeam = winningTeam === 1 ? 2 : 1;
    const playerInMatch = pendingMatch.players.find(p => 
      p.user && (p.user._id || p.user).toString() === user._id.toString()
    );

    // Get match report data for the user
    const isWinner = playerInMatch.team === winningTeam;
    const rewards = playerInMatch.rewards || {};

    // Get winning team players for voting (include fake players for test matches)
    const winningTeamPlayers = pendingMatch.players.filter(p => p.team === winningTeam);
    // Losing team real players only (for counting required votes)
    const losingTeamPlayers = pendingMatch.players.filter(p => p.team === losingTeam && !p.isFake);

    res.json({
      success: true,
      hasPendingVote: true,
      match: {
        _id: pendingMatch._id,
        mode: pendingMatch.mode,
        players: pendingMatch.players,
        result: pendingMatch.result,
        mvp: pendingMatch.mvp,
        isTestMatch: pendingMatch.isTestMatch
      },
      userTeam: playerInMatch.team,
      isWinner,
      rewards,
      winningTeam,
      losingTeam,
      winningTeamPlayers,
      losingTeamPlayers,
      requiredVotes: pendingMatch.isTestMatch ? 1 : losingTeamPlayers.length
    });
  } catch (error) {
    console.error('Check pending MVP vote error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir un match classé par ID
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const user = await User.findById(req.user._id);

    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('team1Referent', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('team2Referent', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles')
      .populate('dispute.reportedBy', 'username')
      .populate('dispute.resolvedBy', 'username')
      .populate('dispute.evidence.uploadedBy', 'username')
      .populate('result.playerVotes.user', 'username')
      .populate('mvp.player', 'username avatarUrl discordAvatar discordId')
      .populate('mvp.votes.voter', 'username')
      .populate('mvp.votes.votedFor', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier l'accès : participant ou staff/arbitre
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    const isParticipant = match.players.some(p => 
      p.user && p.user._id?.toString() === user._id.toString()
    );

    if (!isStaff && !isParticipant) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    // Déterminer l'équipe de l'utilisateur
    
    const userPlayer = match.players.find(p => {
      const pUserId = p.user?._id?.toString() || p.user?.toString();
      const matches = pUserId === user._id.toString();
      if (matches) {
      }
      return matches;
    });
    const myTeam = userPlayer?.team || null;

    // Vérifier si l'utilisateur est référent
    const isReferent = 
      (match.team1Referent?._id?.toString() === user._id.toString()) ||
      (match.team2Referent?._id?.toString() === user._id.toString());

    // Récupérer les vrais points de classement pour chaque joueur réel
    const matchData = match.toJSON();
    const realPlayerIds = matchData.players
      .filter(p => !p.isFake && p.user)
      .map(p => p.user._id || p.user);
    
    if (realPlayerIds.length > 0) {
      const rankings = await Ranking.find({ 
        user: { $in: realPlayerIds }, 
        mode: match.mode 
      });
      
      // Map des rankings par ID utilisateur
      const rankingMap = {};
      rankings.forEach(r => {
        rankingMap[r.user.toString()] = r.points;
      });
      
      // Mettre à jour les points des joueurs avec leurs vrais points de classement
      matchData.players = matchData.players.map(p => {
        if (!p.isFake && p.user) {
          const playerId = p.user._id?.toString() || p.user.toString();
          const currentPoints = rankingMap[playerId];
          if (currentPoints !== undefined) {
            return { ...p, points: currentPoints };
          }
        }
        return p;
      });
    }

    res.json({ 
      success: true, 
      match: {
        ...matchData,
        isRanked: true // Flag pour identifier un match classé
      },
      isStaff,
      myTeam,
      isReferent
    });
  } catch (error) {
    console.error('Get ranked match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir le match actif de l'utilisateur
router.get('/active/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Ne pas inclure les matchs de test dans les matchs "actifs" qui bloquent l'utilisateur
    const match = await RankedMatch.findOne({
      'players.user': user._id,
      status: { $in: ['pending', 'ready', 'in_progress'] },
      isTestMatch: { $ne: true }
    })
      .populate('players.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('team1Referent', 'username avatarUrl discordAvatar discordId')
      .populate('team2Referent', 'username avatarUrl discordAvatar discordId');

    res.json({ 
      success: true, 
      match: match || null,
      hasActiveMatch: !!match
    });
  } catch (error) {
    console.error('Get active ranked match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Envoyer un message dans le chat du match classé
router.post('/:matchId/chat', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    if (message.length > 500) {
      return res.status(400).json({ success: false, message: 'Message trop long (max 500 caractères)' });
    }

    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore'].includes(r));

    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier si l'utilisateur est participant ou staff
    const player = match.players.find(p => 
      p.user && p.user.toString() === user._id.toString()
    );
    const isParticipant = !!player;

    if (!isStaff && !isParticipant) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const newMessage = {
      user: user._id,
      message: message.trim(),
      team: player?.team || null,
      isSystem: false,
      createdAt: new Date()
    };

    match.chat.push(newMessage);
    await match.save();

    // Populate le message ajouté
    await match.populate('chat.user', 'username roles');
    const addedMessage = match.chat[match.chat.length - 1];

    // Émettre via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchMessage', addedMessage);
    }

    res.json({ success: true, message: addedMessage });
  } catch (error) {
    console.error('Send ranked match message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Signaler le résultat d'un match classé (tous les joueurs peuvent voter)
// Requiert 60% des joueurs pour valider le même gagnant
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    let { winner } = req.body; // 1 ou 2 (équipe gagnante)
    
    // S'assurer que winner est un Number (peut arriver en string depuis le JSON)
    winner = Number(winner);

    if (!winner || ![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Équipe gagnante invalide (1 ou 2)' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (!['ready', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'Ce match ne peut plus être modifié' });
    }

    // Vérifier si l'utilisateur fait partie du match ou est staff (pour les matchs de test)
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    const playerInMatch = match.players.find(p => p.user && p.user.toString() === user._id.toString());
    
    if (!playerInMatch && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous ne faites pas partie de ce match' });
    }

    // Pour les matchs de test ou si staff, permettre le vote même si pas directement dans le match
    const isTestMatch = match.isTestMatch === true;

    // Initialiser playerVotes si non existant
    if (!match.result.playerVotes) {
      match.result.playerVotes = [];
    }

    // Vérifier si le joueur a déjà voté
    const existingVoteIndex = match.result.playerVotes.findIndex(
      v => v.user && v.user.toString() === user._id.toString()
    );

    if (existingVoteIndex !== -1) {
      // Mettre à jour le vote existant
      match.result.playerVotes[existingVoteIndex].winner = winner;
      match.result.playerVotes[existingVoteIndex].votedAt = new Date();
    } else {
      // Ajouter un nouveau vote
      match.result.playerVotes.push({
        user: user._id,
        winner,
        votedAt: new Date()
      });
    }

    // Calculer les votes - seuls les vrais joueurs comptent (pas les bots)
    const realPlayers = match.players.filter(p => !p.isFake);
    const totalRealPlayers = realPlayers.length;
    const totalAllPlayers = match.players.length;
    const votesForTeam1 = match.result.playerVotes.filter(v => v.winner === 1).length;
    const votesForTeam2 = match.result.playerVotes.filter(v => v.winner === 2).length;
    const totalVotes = match.result.playerVotes.length;
    
    // Seuil de 60% basé sur les vrais joueurs uniquement (pas les bots)
    const threshold = Math.ceil(totalRealPlayers * 0.6);
    

    let resultMessage = '';
    let matchCompleted = false;

    // ========== EARLY EXIT - Vérification rapide (optimisation) ==========
    // Cette vérification est une optimisation pour éviter le traitement inutile
    // La vraie protection atomique contre les race conditions est dans distributeRankedRewards()
    if (match.rewardsDistributed === true) {
      await match.save(); // Sauvegarder quand même le vote
      return res.json({ 
        success: true, 
        match, 
        message: 'Vote enregistré. Le match a déjà été finalisé.',
        voteStats: {
          votesForTeam1,
          votesForTeam2,
          totalVotes,
          totalPlayers: totalRealPlayers,
          threshold,
          yourVote: winner
        }
      });
    }

    // Vérifier si 60% des joueurs ont voté pour le même gagnant
    if (votesForTeam1 >= threshold) {
      match.result.winner = 1;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();
          
      // Activate MVP voting phase
      match.mvp = {
        player: null,
        votes: [],
        bonusPoints: 5,
        votingActive: true,
        confirmed: false
      };
    
      // Attribuer les récompenses aux joueurs
      await distributeRankedRewards(match);
          
      resultMessage = `Match validé ! L'équipe 1 gagne avec ${votesForTeam1}/${totalRealPlayers} votes (${Math.round(votesForTeam1/totalRealPlayers*100)}%). Votez maintenant pour le MVP !`;
      matchCompleted = true;
            
      // Supprimer les salons vocaux Discord
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
    } else if (votesForTeam2 >= threshold) {
      match.result.winner = 2;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();
          
      // Activate MVP voting phase
      match.mvp = {
        player: null,
        votes: [],
        bonusPoints: 5,
        votingActive: true,
        confirmed: false
      };
    
      // Attribuer les récompenses aux joueurs
      await distributeRankedRewards(match);
          
      resultMessage = `Match validé ! L'équipe 2 gagne avec ${votesForTeam2}/${totalRealPlayers} votes (${Math.round(votesForTeam2/totalRealPlayers*100)}%). Votez maintenant pour le MVP !`;
      matchCompleted = true;
            
      // Supprimer les salons vocaux Discord
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
    } else {
      // Pas encore de consensus
      resultMessage = `Vote enregistré. Équipe 1: ${votesForTeam1} votes, Équipe 2: ${votesForTeam2} votes. Il faut ${threshold} votes (60%) pour valider.`;
    }

    await match.save();

    // Repopuler le match
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' },
      { path: 'result.playerVotes.user', select: 'username' }
    ]);

    if (matchCompleted) {
      match.players.forEach((p, i) => {
      });
    }

    // Émettre via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({ 
      success: true, 
      match, 
      message: resultMessage,
      voteStats: {
        votesForTeam1,
        votesForTeam2,
        totalVotes,
        totalPlayers: totalRealPlayers,
        threshold,
        yourVote: winner
      },
      // If match is completed, activate MVP voting
      mvpVotingActive: matchCompleted
    });
  } catch (error) {
    console.error('Report ranked match result error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Vote for MVP (Most Valuable Player) after match winner is confirmed
// NEW RULES: Only LOSING team votes for a player from the WINNING team
router.post('/:matchId/mvp-vote', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { mvpPlayerId } = req.body; // ID of the player being voted as MVP

    if (!mvpPlayerId) {
      return res.status(400).json({ success: false, message: 'ID du joueur MVP requis' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Only allow MVP voting when match is completed
    if (match.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Le match doit être terminé pour voter pour le MVP' });
    }

    // Check if winner voting is confirmed
    if (!match.result?.confirmed) {
      return res.status(400).json({ success: false, message: 'Le résultat du match doit d\'abord être confirmé' });
    }

    // MVP voting already confirmed
    if (match.mvp?.confirmed) {
      return res.status(400).json({ success: false, message: 'Le vote MVP est déjà terminé' });
    }

    // Verify user is a participant
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    const playerInMatch = match.players.find(p => p.user && p.user.toString() === user._id.toString());
    
    if (!playerInMatch && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous ne faites pas partie de ce match' });
    }

    // Get winning and losing teams
    const winningTeam = match.result.winner; // 1 or 2
    const losingTeam = winningTeam === 1 ? 2 : 1;
    
    // Only LOSING team can vote for MVP
    if (playerInMatch && playerInMatch.team !== losingTeam && !isStaff) {
      return res.status(403).json({ success: false, message: 'Seule l\'équipe perdante peut voter pour le MVP' });
    }

    // Check if mvpPlayerId is for a fake player (format: "fake:username")
    const isFakeMvp = mvpPlayerId.toString().startsWith('fake:');
    const fakeMvpUsername = isFakeMvp ? mvpPlayerId.toString().replace('fake:', '') : null;

    // Verify the voted MVP player is in the WINNING team
    // For fake players, we check by username; for real players, by user ID
    const mvpCandidate = match.players.find(p => {
      if (isFakeMvp) {
        // Match fake player by username
        return p.isFake && p.username === fakeMvpUsername;
      } else {
        // Check by user ID for real players
        const pUserId = p.user?._id || p.user;
        return pUserId && pUserId.toString() === mvpPlayerId.toString();
      }
    });

    if (!mvpCandidate) {
      return res.status(400).json({ success: false, message: 'Ce joueur n\'est pas un participant valide de ce match' });
    }

    // MVP candidate must be from winning team
    if (mvpCandidate.team !== winningTeam) {
      return res.status(400).json({ success: false, message: 'Le MVP doit être un joueur de l\'équipe gagnante' });
    }

    // Initialize MVP object if needed
    if (!match.mvp) {
      match.mvp = {
        player: null,
        votes: [],
        bonusPoints: 5,
        votingActive: true,
        confirmed: false
      };
    }

    // Check if user already voted
    const existingVoteIndex = match.mvp.votes.findIndex(
      v => v.voter && v.voter.toString() === user._id.toString()
    );

    if (existingVoteIndex !== -1) {
      // Update existing vote
      match.mvp.votes[existingVoteIndex].votedFor = isFakeMvp ? null : mvpPlayerId;
      match.mvp.votes[existingVoteIndex].votedForFake = isFakeMvp ? fakeMvpUsername : null;
      match.mvp.votes[existingVoteIndex].votedAt = new Date();
    } else {
      // Add new vote
      match.mvp.votes.push({
        voter: user._id,
        votedFor: isFakeMvp ? null : mvpPlayerId,
        votedForFake: isFakeMvp ? fakeMvpUsername : null,
        votedAt: new Date()
      });
    }

    // Count votes for each player
    const realPlayers = match.players.filter(p => !p.isFake);
    // Only losing team players can vote
    const losingTeamPlayers = realPlayers.filter(p => p.team === losingTeam);
    const totalLosingTeamPlayers = losingTeamPlayers.length;
    const voteCount = {};

    // Count votes - handle both real players (votedFor) and fake players (votedForFake)
    match.mvp.votes.forEach(v => {
      const votedForId = v.votedForFake ? `fake:${v.votedForFake}` : (v.votedFor ? v.votedFor.toString() : null);
      if (votedForId) {
        voteCount[votedForId] = (voteCount[votedForId] || 0) + 1;
      }
    });

    // Check if enough votes to confirm MVP
    // In test matches, 1 vote is enough (like winner voting)
    // In normal matches, all LOSING team players must vote
    const totalMvpVotes = match.mvp.votes.length;
    const isTestMatch = match.isTestMatch === true;
    const requiredVotes = isTestMatch ? 1 : totalLosingTeamPlayers;
    
    let mvpMessage = '';
    let mvpConfirmed = false;

    if (totalMvpVotes >= requiredVotes) {
      // All players have voted - determine MVP
      let maxVotes = 0;
      let mvpWinner = null;

      Object.entries(voteCount).forEach(([playerId, votes]) => {
        if (votes > maxVotes) {
          maxVotes = votes;
          mvpWinner = playerId;
        }
      });

      if (mvpWinner) {
        // Check if winner is a fake player
        const isFakeMvpWinner = mvpWinner.startsWith('fake:');
        const fakeMvpWinnerUsername = isFakeMvpWinner ? mvpWinner.replace('fake:', '') : null;

        match.mvp.confirmed = true;
        match.mvp.confirmedAt = new Date();
        mvpConfirmed = true;

        if (isFakeMvpWinner) {
          // Fake player MVP - no bonus points, just store the username
          match.mvp.player = null;
          match.mvp.playerFake = fakeMvpWinnerUsername;
          mvpMessage = `MVP désigné ! ${fakeMvpWinnerUsername} (Bot) a été élu MVP avec ${maxVotes} votes !`;
        } else {
          // Real player MVP - award bonus points
          match.mvp.player = mvpWinner;
          match.mvp.playerFake = null;

          const mvpUser = await User.findById(mvpWinner);
          if (mvpUser) {
            // Update MVP count for the appropriate mode
            const mvpCountField = match.mode === 'cdl' ? 'mvpCountCdl' : 'mvpCountHardcore';
            mvpUser[mvpCountField] = (mvpUser[mvpCountField] || 0) + 1;
            await mvpUser.save();

            // Add bonus points to ranking
            const currentSeasonMvp = new Date().getMonth() + 1;
            let mvpRanking = await Ranking.findOne({ user: mvpWinner, mode: match.mode, season: currentSeasonMvp });
            if (mvpRanking) {
              mvpRanking.points = (mvpRanking.points || 0) + match.mvp.bonusPoints;
              await mvpRanking.save();
            }

            // Update player's rewards in the match to show MVP bonus
            const mvpPlayerIndex = match.players.findIndex(p => {
              const pUserId = p.user?._id || p.user;
              return pUserId && pUserId.toString() === mvpWinner.toString();
            });

            if (mvpPlayerIndex !== -1) {
              if (!match.players[mvpPlayerIndex].rewards) {
                match.players[mvpPlayerIndex].rewards = {};
              }
              match.players[mvpPlayerIndex].rewards.mvpBonus = match.mvp.bonusPoints;
              match.players[mvpPlayerIndex].rewards.isMvp = true;
              match.players[mvpPlayerIndex].rewards.newPoints = (match.players[mvpPlayerIndex].rewards.newPoints || match.players[mvpPlayerIndex].points || 0) + match.mvp.bonusPoints;
              match.markModified('players');
            }

            mvpMessage = `MVP désigné ! ${mvpUser.username} a été élu MVP avec ${maxVotes} votes et reçoit +${match.mvp.bonusPoints} points bonus !`;
          }
        }
      }
    } else {
      mvpMessage = `Vote MVP enregistré. ${totalMvpVotes}/${requiredVotes} votes (${isTestMatch ? 'mode test' : `${totalLosingTeamPlayers} joueurs équipe perdante`}).`;
    }

    await match.save();

    // Re-populate the match
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' },
      { path: 'result.playerVotes.user', select: 'username' },
      { path: 'mvp.player', select: 'username avatar discordAvatar discordId' },
      { path: 'mvp.votes.voter', select: 'username' },
      { path: 'mvp.votes.votedFor', select: 'username' }
    ]);

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      if (mvpConfirmed) {
        io.to(`ranked-match-${matchId}`).emit('mvpConfirmed', {
          mvp: match.mvp.player,
          bonusPoints: match.mvp.bonusPoints,
          voteCount
        });
      }
    }

    res.json({
      success: true,
      match,
      message: mvpMessage,
      mvpStats: {
        votes: voteCount,
        totalVotes: totalMvpVotes,
        totalPlayers: totalLosingTeamPlayers,
        requiredVotes,
        winningTeam,
        losingTeam,
        confirmed: mvpConfirmed,
        mvpWinner: mvpConfirmed ? match.mvp.player : null
      }
    });
  } catch (error) {
    console.error('MVP vote error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Signaler un litige
router.post('/:matchId/dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Raison requise' });
    }

    const user = await User.findById(req.user._id);
    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier si l'utilisateur est un référent
    const isTeam1Referent = match.team1Referent?.toString() === user._id.toString();
    const isTeam2Referent = match.team2Referent?.toString() === user._id.toString();

    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul un référent peut signaler un litige' });
    }

    match.status = 'disputed';
    match.dispute = {
      isActive: true,
      reportedBy: user._id,
      reportedByTeam: isTeam1Referent ? 1 : 2,
      reportedAt: new Date(),
      reason: reason.trim()
    };

    await match.save();

    // Repopuler et émettre
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'dispute.reportedBy', select: 'username' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({ success: true, match });
  } catch (error) {
    console.error('Report ranked match dispute error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Soumettre le code de partie (équipe hôte uniquement)
router.post('/:matchId/code', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { code } = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Code requis' });
    }

    const user = await User.findById(req.user._id);
    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier si l'utilisateur fait partie de l'équipe hôte
    const player = match.players.find(p => 
      p.user && p.user.toString() === user._id.toString()
    );

    if (!player || player.team !== match.hostTeam) {
      return res.status(403).json({ success: false, message: 'Seule l\'équipe hôte peut soumettre le code' });
    }

    match.gameCode = code.trim();
    if (match.status === 'ready') {
      match.status = 'in_progress';
      match.startedAt = new Date();
      
      // ========== TRACK BOOSTER MATCH TIME ==========
      // Set inMatch: true and matchStartTime for all players with active boosters
      const playerUserIds = match.players
        .filter(p => !p.isFake && p.user)
        .map(p => p.user._id || p.user);
      
      if (playerUserIds.length > 0) {
        const matchStartTime = new Date();
        const boosterUpdateResult = await ItemUsage.updateMany(
          {
            user: { $in: playerUserIds },
            isActive: true,
            wasConsumed: false,
            effectType: { $in: ['double_pts', 'double_gold', 'double_xp'] },
            $or: [
              { remainingMs: null },
              { remainingMs: { $gt: 0 } }
            ]
          },
          {
            $set: {
              inMatch: true,
              matchStartTime: matchStartTime
            }
          }
        );
        
        if (boosterUpdateResult.modifiedCount > 0) {
        }
      }
    }
    await match.save();

    // Repopuler et émettre
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({ success: true, match });
  } catch (error) {
    console.error('Submit ranked match code error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== CANCELLATION REQUEST ROUTES ====================

// Vote pour l'annulation du match (toggle)
router.post('/:matchId/cancellation/vote', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;

    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que le match peut être annulé (pending, ready ou in_progress)
    if (!['pending', 'ready', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'Ce match ne peut plus être annulé' });
    }

    // Vérifier que l'utilisateur est un participant du match
    const player = match.players.find(p => 
      p.user && p.user.toString() === userId.toString() && !p.isFake
    );

    if (!player) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas un participant de ce match' });
    }

    // Initialiser la demande d'annulation si pas encore fait
    if (!match.cancellationRequest) {
      match.cancellationRequest = {
        isActive: false,
        votes: [],
        requiredVotes: 0
      };
    }

    // Calculer le nombre de votes requis selon le format, le statut et si c'est un match de test
    const realPlayers = match.players.filter(p => !p.isFake && p.user);
    const totalPlayers = realPlayers.length;
    
    // Si le match est en phase de vote de map (pending), utiliser des seuils spécifiques
    let requiredVotes;
    if (match.status === 'pending') {
      // Pour les matchs de test, un seul vote suffit
      if (match.isTestMatch === true) {
        requiredVotes = 1;
      }
      // Phase de vote de map: 6/10 pour 4v4, 8/10 pour 5v5
      else if (match.teamSize === 4) {
        // 4v4 = 8 joueurs total, besoin de 6 votes
        requiredVotes = 6;
      } else if (match.teamSize === 5) {
        // 5v5 = 10 joueurs total, besoin de 8 votes
        requiredVotes = 8;
      } else {
        // Formats plus petits: 80% arrondi au supérieur
        requiredVotes = Math.ceil(totalPlayers * 0.8);
      }
    } else {
      // Phases ready/in_progress: 80% standard
      requiredVotes = Math.ceil(totalPlayers * 0.8);
    }
    
    match.cancellationRequest.requiredVotes = requiredVotes;

    // Vérifier si l'utilisateur a déjà voté
    const existingVoteIndex = match.cancellationRequest.votes.findIndex(
      v => v.user.toString() === userId.toString()
    );

    let hasVoted;
    if (existingVoteIndex > -1) {
      // Retirer le vote (toggle off)
      match.cancellationRequest.votes.splice(existingVoteIndex, 1);
      hasVoted = false;
    } else {
      // Ajouter le vote (toggle on)
      match.cancellationRequest.votes.push({
        user: userId,
        votedAt: new Date()
      });
      hasVoted = true;

      // Si c'est le premier vote, enregistrer qui l'a initié
      if (match.cancellationRequest.votes.length === 1) {
        match.cancellationRequest.initiatedBy = userId;
        match.cancellationRequest.initiatedAt = new Date();
      }
    }

    // Marquer comme actif s'il y a des votes
    match.cancellationRequest.isActive = match.cancellationRequest.votes.length > 0;

    // Vérifier si on atteint les 80% requis
    const currentVotes = match.cancellationRequest.votes.length;
    if (currentVotes >= requiredVotes) {
      // Annuler le match
      match.status = 'cancelled';
      match.cancellationRequest.cancelledAt = new Date();
      
      // Supprimer les salons vocaux Discord
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
      
      // Ajouter un message système
      match.chat.push({
        isSystem: true,
        messageType: 'match_cancelled_by_players',
        message: `Match annulé par vote des joueurs (${currentVotes}/${realPlayers.length} votes)`
      });

    }

    await match.save();

    // Repopuler pour l'événement socket
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'cancellationRequest.votes.user', select: 'username' },
      { path: 'cancellationRequest.initiatedBy', select: 'username' }
    ]);

    // Émettre via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      io.to(`ranked-match-${matchId}`).emit('cancellationVoteUpdate', {
        matchId,
        currentVotes,
        requiredVotes,
        totalPlayers: realPlayers.length,
        isCancelled: match.status === 'cancelled',
        hasVoted,
        votedBy: req.user._id,
        mode: match.mode // Inclure le mode pour la redirection côté client
      });
    }

    res.json({
      success: true,
      hasVoted,
      currentVotes,
      requiredVotes,
      totalPlayers: realPlayers.length,
      isCancelled: match.status === 'cancelled',
      message: hasVoted 
        ? 'Vote enregistré pour l\'annulation' 
        : 'Vote retiré'
    });
  } catch (error) {
    console.error('Cancellation vote error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir le statut de la demande d'annulation
router.get('/:matchId/cancellation/status', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;

    const match = await RankedMatch.findById(matchId)
      .populate('cancellationRequest.votes.user', 'username')
      .populate('cancellationRequest.initiatedBy', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Calculer les stats avec la même logique que le vote
    const realPlayers = match.players.filter(p => !p.isFake && p.user);
    const totalPlayers = realPlayers.length;
    
    // Calculer les votes requis selon le format, le statut et si c'est un match de test (même logique que le vote)
    let requiredVotes;
    if (match.status === 'pending') {
      // Pour les matchs de test, un seul vote suffit
      if (match.isTestMatch === true) {
        requiredVotes = 1;
      }
      else if (match.teamSize === 4) {
        requiredVotes = 6;
      } else if (match.teamSize === 5) {
        requiredVotes = 8;
      } else {
        requiredVotes = Math.ceil(totalPlayers * 0.8);
      }
    } else {
      requiredVotes = Math.ceil(totalPlayers * 0.8);
    }
    
    const currentVotes = match.cancellationRequest?.votes?.length || 0;
    const hasVoted = match.cancellationRequest?.votes?.some(
      v => v.user?._id?.toString() === userId.toString() || v.user?.toString() === userId.toString()
    ) || false;

    res.json({
      success: true,
      isActive: match.cancellationRequest?.isActive || false,
      currentVotes,
      requiredVotes,
      totalPlayers: realPlayers.length,
      hasVoted,
      isCancelled: match.status === 'cancelled',
      votes: match.cancellationRequest?.votes || [],
      initiatedBy: match.cancellationRequest?.initiatedBy || null,
      initiatedAt: match.cancellationRequest?.initiatedAt || null
    });
  } catch (error) {
    console.error('Cancellation status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ARBITRATOR CALL ROUTES ====================

// Appeler un arbitre (un seul appel par match au total)
router.post('/:matchId/call-arbitrator', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;

    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que le match est en cours (ready ou in_progress)
    if (!['ready', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'L\'appel arbitre n\'est possible que pendant un match en cours' });
    }

    // Vérifier que l'utilisateur est un participant du match
    const player = match.players.find(p => 
      p.user && (p.user._id?.toString() === userId.toString() || p.user.toString() === userId.toString()) && !p.isFake
    );

    if (!player) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas un participant de ce match' });
    }

    // Initialiser le tableau des appels si pas encore fait
    if (!match.arbitratorCalls) {
      match.arbitratorCalls = [];
    }

    // Vérifier si un arbitre a déjà été appelé pour ce match (un seul appel par match)
    if (match.arbitratorCalls.length > 0) {
      return res.status(400).json({ success: false, message: 'Un arbitre a déjà été appelé pour ce match' });
    }

    // Enregistrer l'appel
    match.arbitratorCalls.push({
      user: userId,
      calledAt: new Date()
    });

    // Ajouter un message système dans le chat
    const callerUsername = req.user.username || player.user?.username || player.username || 'Un joueur';
    match.chat.push({
      isSystem: true,
      messageType: 'arbitrator_called',
      message: `${callerUsername} a demandé l'intervention d'un arbitre`
    });

    await match.save();

    // Envoyer la notification Discord
    try {
      const callerUser = await User.findById(userId).select('username');
      await logArbitratorCall(match, callerUser);
    } catch (discordError) {
      console.error('Error sending Discord notification for arbitrator call:', discordError);
      // On ne fait pas échouer la requête si Discord échoue
    }

    // Émettre via socket
    const io = req.app.get('io');
    if (io) {
      // Repopuler pour l'événement socket
      await match.populate([
        { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
        { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
        { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
        { path: 'chat.user', select: 'username roles' }
      ]);
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({
      success: true,
      message: 'Un arbitre a été appelé. Il interviendra dès que possible.',
      calledAt: new Date()
    });
  } catch (error) {
    console.error('Call arbitrator error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN/DEV ROUTES ====================

// Ajouter des faux joueurs à la file d'attente (staff/admin)
router.post('/matchmaking/add-fake-players', verifyToken, requireStaff, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore', count = 5 } = req.body;
    
    const result = await addFakePlayers(gameMode, mode, count);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error adding fake players:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer les faux joueurs de la file d'attente (staff/admin)
router.post('/matchmaking/remove-fake-players', verifyToken, requireStaff, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    
    const result = await removeFakePlayers(gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error removing fake players:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lancer un match de test pour le staff (matchmaking séparé avec bots)
router.post('/matchmaking/start-test-match', verifyToken, requireStaff, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore', teamSize = 4 } = req.body;
    const userId = req.user._id;
    
    // Valider la taille de l'équipe
    const validTeamSize = [4, 5].includes(teamSize) ? teamSize : 4;
    
    const result = await startStaffTestMatch(userId, gameMode, mode, validTeamSize);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error starting staff test match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== STAFF TEST QUEUE ROUTES ====================

// Middleware pour vérifier que l'utilisateur est admin
const requireAdmin = (req, res, next) => {
  if (!req.user?.roles?.includes('admin')) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
};

// Rejoindre la file d'attente staff (admin uniquement)
router.post('/staff-queue/join', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    const userId = req.user._id;
    
    const result = await joinStaffQueue(userId, gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error joining staff queue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Quitter la file d'attente staff
router.post('/staff-queue/leave', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    const userId = req.user._id;
    
    const result = await leaveStaffQueue(userId, gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error leaving staff queue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir le statut de la file staff
router.get('/staff-queue/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.query;
    const userId = req.user._id;
    
    const result = await getStaffQueueStatus(userId, gameMode, mode);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting staff queue status:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Ajouter des bots à la file staff
router.post('/staff-queue/add-bots', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore', count = 1 } = req.body;
    
    const result = await addBotsToStaffQueue(gameMode, mode, Math.min(count, 10));
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error adding bots to staff queue:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer tous les bots de la file staff
router.post('/staff-queue/clear-bots', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    
    const result = await clearStaffQueueBots(gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error clearing staff queue bots:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Forcer le démarrage d'un match staff
router.post('/staff-queue/force-start', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { gameMode = 'Search & Destroy', mode = 'hardcore' } = req.body;
    const result = await forceStartStaffMatch(gameMode, mode);
    
    if (result && result.success) {
      res.json({ success: true, message: 'Match staff lancé.', matchId: result.matchId });
    } else {
      res.status(400).json({ success: false, message: result?.message || 'Impossible de créer le match.' });
    }
  } catch (error) {
    console.error('Error force starting staff match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lister tous les matchs classés (admin/staff/arbitre)
router.get('/admin/all', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { status, mode, gameMode, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (mode) query.mode = mode;
    if (gameMode) query.gameMode = gameMode;
    
    const matches = await RankedMatch.find(query)
      .populate('players.user', 'username avatarUrl discordAvatar discordId')
      .populate('team1Referent', 'username')
      .populate('team2Referent', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await RankedMatch.countDocuments(query);
    
    res.json({
      success: true,
      matches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin ranked matches:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Annuler un match (admin/staff/arbitre) - Avec remboursement des récompenses si le match était terminé
router.post('/admin/:matchId/cancel', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    const adminUser = await User.findById(req.user._id);
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Ce match est déjà annulé' });
    }
    
    
    let rewardsRefunded = false;
    
    // Si le match était complété avec un gagnant, rembourser les récompenses
    if (match.status === 'completed' && match.result?.winner) {
      rewardsRefunded = true;
      
      const winningTeam = Number(match.result.winner);
      
      for (const player of match.players) {
        // Ignorer les faux joueurs
        if (player.isFake || !player.user) continue;
        
        const userId = player.user._id || player.user;
        const username = player.user.username || player.username || 'Inconnu';
        const playerTeam = Number(player.team);
        const isWinner = playerTeam === winningTeam;
        
        // Récupérer les récompenses données
        const rewards = player.rewards || {};
        const pointsChange = rewards.pointsChange || 0;
        const goldEarned = rewards.goldEarned || 0;
        const xpEarned = rewards.xpEarned || 0;
        
        
        // Mettre à jour le Ranking (points du ladder classé + wins/losses)
        const currentSeasonCancel = new Date().getMonth() + 1;
        const ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: currentSeasonCancel });
        if (ranking) {
          // Retirer les points (mais ne pas descendre en dessous de 0)
          ranking.points = Math.max(0, ranking.points - pointsChange);
          
          // Retirer la victoire ou défaite
          if (isWinner) {
            ranking.wins = Math.max(0, ranking.wins - 1);
            if (ranking.currentStreak > 0) {
              ranking.currentStreak = Math.max(0, ranking.currentStreak - 1);
            }
          } else {
            ranking.losses = Math.max(0, ranking.losses - 1);
          }
          
          await ranking.save();
        }
        
        // Mettre à jour l'User (gold, XP, wins/losses par mode)
        const user = await User.findById(userId);
        if (user) {
          const statsField = match.mode === 'cdl' ? 'statsCdl' : 'statsHardcore';
          if (!user[statsField]) user[statsField] = {};
          
          // Retirer le gold
          user.goldCoins = Math.max(0, (user.goldCoins || 0) - goldEarned);
          
          // Retirer l'XP par mode
          user[statsField].xp = Math.max(0, (user[statsField].xp || 0) - xpEarned);
          
          // Retirer la victoire ou défaite des stats par mode
          if (isWinner) {
            user[statsField].wins = Math.max(0, (user[statsField].wins || 0) - 1);
          } else {
            user[statsField].losses = Math.max(0, (user[statsField].losses || 0) - 1);
          }
          
          await user.save();
        }
      }
      
    }
    
    match.status = 'cancelled';
    match.cancelledAt = new Date();
    match.cancelledBy = req.user._id;
    match.cancelReason = reason || 'Annulé par un administrateur';
    
    // Supprimer les salons vocaux Discord
    if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
      deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
    }
    
    await match.save();
    
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchCancelled', {
        matchId,
        reason: match.cancelReason
      });
    }
    
    res.json({ 
      success: true, 
      message: rewardsRefunded 
        ? 'Match annulé et récompenses remboursées' 
        : 'Match annulé',
      rewardsRefunded,
      match 
    });
  } catch (error) {
    console.error('Error cancelling ranked match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Forcer un résultat (admin/staff/arbitre)
router.post('/admin/:matchId/force-result', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner, reason } = req.body;
    
    if (!winner || ![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Équipe gagnante invalide (1 ou 2)' });
    }
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed' || match.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Ce match est déjà terminé' });
    }
    
    // Forcer le résultat
    match.result.winner = winner;
    match.result.confirmed = true;
    match.result.confirmedAt = new Date();
    match.result.forcedBy = req.user._id;
    match.result.forceReason = reason || 'Résultat forcé par un administrateur';
    match.status = 'completed';
    match.completedAt = new Date();
    
    // Distribuer les récompenses
    await distributeRankedRewards(match);
    
    // Supprimer les salons vocaux Discord
    if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
      deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
    }
    
    await match.save();
    
    // Repopuler le match avec toutes les données
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' }
    ]);
    
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ success: true, message: 'Résultat forcé', match });
  } catch (error) {
    console.error('Error forcing ranked match result:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Résoudre un litige (admin/staff/arbitre)
router.post('/admin/:matchId/resolve-dispute', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner, resolution } = req.body;
    
    if (!winner || ![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Équipe gagnante invalide (1 ou 2)' });
    }
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status !== 'disputed') {
      return res.status(400).json({ success: false, message: 'Ce match n\'est pas en litige' });
    }
    
    // Résoudre le litige
    match.dispute.isActive = false;
    match.dispute.resolvedBy = req.user._id;
    match.dispute.resolvedAt = new Date();
    match.dispute.resolution = resolution || 'Résolu par un administrateur';
    
    match.result.winner = winner;
    match.result.confirmed = true;
    match.result.confirmedAt = new Date();
    match.status = 'completed';
    match.completedAt = new Date();
    
    // Distribuer les récompenses
    await distributeRankedRewards(match);
    
    // Supprimer les salons vocaux Discord
    if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
      deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
    }
    
    await match.save();
    
    // Repopuler le match avec toutes les données
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' },
      { path: 'dispute.reportedBy', select: 'username' },
      { path: 'dispute.resolvedBy', select: 'username' }
    ]);
    
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ success: true, message: 'Litige résolu', match });
  } catch (error) {
    console.error('Error resolving ranked match dispute:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'un match classé (admin/staff/arbitre)
router.patch('/admin/:matchId/status', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'ready', 'in_progress', 'completed', 'cancelled', 'disputed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    const oldStatus = match.status;
    match.status = status;
    
    // Ajouter des timestamps selon le statut
    if (status === 'cancelled') {
      match.cancelledAt = new Date();
      match.cancelledBy = req.user._id;
      // Supprimer les salons vocaux Discord
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
    } else if (status === 'completed') {
      match.completedAt = new Date();
      // Supprimer les salons vocaux Discord
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
    } else if (status === 'in_progress') {
      match.startedAt = new Date();
    }
    
    await match.save();
    
    
    // Notifier les joueurs via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({
      success: true,
      message: 'Statut du match classé mis à jour',
      match
    });
  } catch (error) {
    console.error('Error updating ranked match status:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Refund points for a specific player in a completed ranked match (admin/staff/arbitre)
router.post('/admin/:matchId/refund-player/:playerId', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId, playerId } = req.params;
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status !== 'completed' || !match.result?.winner) {
      return res.status(400).json({ success: false, message: 'Seuls les matchs complétés peuvent être remboursés' });
    }
    
    // Find the player in the match
    const playerIndex = match.players.findIndex(p => {
      const pUserId = p.user?._id?.toString() || p.user?.toString();
      return pUserId === playerId;
    });
    
    if (playerIndex === -1) {
      return res.status(404).json({ success: false, message: 'Joueur non trouvé dans ce match' });
    }
    
    const player = match.players[playerIndex];
    const userId = player.user?._id || player.user;
    
    // Check if player is a loser
    const playerTeam = Number(player.team);
    const winnerTeam = Number(match.result.winner);
    const isWinner = playerTeam === winnerTeam;
    
    if (isWinner) {
      return res.status(400).json({ success: false, message: 'Impossible de rembourser un joueur gagnant' });
    }
    
    // Check if already refunded
    if (player.refunded) {
      return res.status(400).json({ success: false, message: 'Ce joueur a déjà été remboursé' });
    }
    
    // Get the points that were lost (negative value)
    const pointsLost = player.rewards?.pointsChange || 0;
    
    if (pointsLost >= 0) {
      return res.status(400).json({ success: false, message: 'Ce joueur n\'a pas perdu de points dans ce match' });
    }
    
    // Find the user and their ranking
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const currentSeasonRefund = new Date().getMonth() + 1;
    let ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: currentSeasonRefund });
    if (!ranking) {
      return res.status(404).json({ success: false, message: 'Classement du joueur non trouvé' });
    }
    
    // Refund the points (add back the absolute value of points lost)
    const refundAmount = Math.abs(pointsLost);
    ranking.points = Math.max(0, (ranking.points || 0) + refundAmount);
    ranking.losses = Math.max(0, (ranking.losses || 0) - 1);
    
    await ranking.save();
    
    // Mark player as refunded in the match
    match.players[playerIndex].refunded = true;
    match.players[playerIndex].refundedAt = new Date();
    match.players[playerIndex].refundedBy = req.user._id;
    match.players[playerIndex].refundAmount = refundAmount;
    
    await match.save();
    
    // Repopulate match
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' }
    ]);
    
    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ 
      success: true, 
      message: `${refundAmount} points remboursés à ${user.username}`,
      refundAmount,
      match
    });
  } catch (error) {
    console.error('Error refunding player:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer manuellement les salons vocaux Discord pour un match classé (admin/staff/arbitre)
router.post('/admin/:matchId/create-voice-channels', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'discordId username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Vérifier que le match n'est pas terminé ou annulé
    if (['completed', 'cancelled'].includes(match.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de créer des salons vocaux pour un match terminé ou annulé' 
      });
    }
    
    // Extraire les Discord IDs par équipe
    const team1DiscordIds = match.players
      .filter(p => p.team === 1 && p.user?.discordId && !p.isFake)
      .map(p => p.user.discordId);
    
    const team2DiscordIds = match.players
      .filter(p => p.team === 2 && p.user?.discordId && !p.isFake)
      .map(p => p.user.discordId);
    
    
    // Supprimer les anciens salons vocaux s'ils existent
    if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
      await deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId, { force: true });
    }
    
    // Créer les salons vocaux
    const voiceChannels = await createMatchVoiceChannels(matchId, team1DiscordIds, team2DiscordIds, match.mode);
    
    if (!voiceChannels) {
      return res.status(500).json({ 
        success: false, 
        message: 'Échec de la création des salons vocaux. Le bot Discord n\'est peut-être pas prêt ou configuré.' 
      });
    }
    
    // Mettre à jour le match avec les infos des salons vocaux
    match.team1VoiceChannel = voiceChannels.team1;
    match.team2VoiceChannel = voiceChannels.team2;
    await match.save();
    
    
    // Notifier les joueurs via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({
      success: true,
      message: 'Salons vocaux créés avec succès',
      team1VoiceChannel: voiceChannels.team1,
      team2VoiceChannel: voiceChannels.team2,
      match
    });
  } catch (error) {
    console.error('Error creating voice channels:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la création des salons vocaux' });
  }
});

// Supprimer un match classé et rembourser les récompenses (admin/staff/arbitre)
router.delete('/admin/:matchId', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    const adminUser = await User.findById(req.user._id);
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    
    // Si le match est complété, on doit rembourser les récompenses
    if (match.status === 'completed' && match.result?.winner) {
      
      const winningTeam = Number(match.result.winner);
      
      for (const player of match.players) {
        // Ignorer les faux joueurs
        if (player.isFake || !player.user) continue;
        
        const userId = player.user._id || player.user;
        const username = player.user.username || player.username || 'Inconnu';
        const playerTeam = Number(player.team);
        const isWinner = playerTeam === winningTeam;
        
        // Récupérer les récompenses données
        const rewards = player.rewards || {};
        const pointsChange = rewards.pointsChange || 0;
        const goldEarned = rewards.goldEarned || 0;
        const xpEarned = rewards.xpEarned || 0;
        
        
        // Mettre à jour le Ranking (points du ladder classé + wins/losses)
        const currentSeasonDelete = new Date().getMonth() + 1;
        const ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: currentSeasonDelete });
        if (ranking) {
          // Retirer les points (mais ne pas descendre en dessous de 0)
          ranking.points = Math.max(0, ranking.points - pointsChange);
          
          // Retirer la victoire ou défaite
          if (isWinner) {
            ranking.wins = Math.max(0, ranking.wins - 1);
            // Reset de la série actuelle (on ne peut pas vraiment savoir l'état précédent)
            if (ranking.currentStreak > 0) {
              ranking.currentStreak = Math.max(0, ranking.currentStreak - 1);
            }
          } else {
            ranking.losses = Math.max(0, ranking.losses - 1);
          }
          
          await ranking.save();
        }
        
        // Mettre à jour l'User (gold, XP, wins/losses par mode)
        const user = await User.findById(userId);
        if (user) {
          // Use mode-specific stats field
          const statsFieldDel = match.mode === 'cdl' ? 'statsCdl' : 'statsHardcore';
          if (!user[statsFieldDel]) user[statsFieldDel] = {};
          
          // Retirer le gold (shared between modes)
          user.goldCoins = Math.max(0, (user.goldCoins || 0) - goldEarned);
          
          // Retirer l'XP par mode
          user[statsFieldDel].xp = Math.max(0, (user[statsFieldDel].xp || 0) - xpEarned);
          
          // Retirer la victoire ou défaite des stats par mode
          if (isWinner) {
            user[statsFieldDel].wins = Math.max(0, (user[statsFieldDel].wins || 0) - 1);
          } else {
            user[statsFieldDel].losses = Math.max(0, (user[statsFieldDel].losses || 0) - 1);
          }
          
          await user.save();
        }
      }
      
    } else {
    }
    
    // Supprimer les salons vocaux Discord si présents
    if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
      deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
    }
    
    // Supprimer le match
    await RankedMatch.findByIdAndDelete(matchId);
    
    
    // Notifier via socket si disponible
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchDeleted', { matchId });
    }
    
    res.json({ 
      success: true, 
      message: match.status === 'completed' 
        ? 'Match supprimé et récompenses remboursées' 
        : 'Match supprimé'
    });
  } catch (error) {
    console.error('Error deleting ranked match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Historique des matchs classés d'un joueur (public)
router.get('/player-history/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { limit = 10, mode } = req.query;
    
    // IMPORTANT: Convertir playerId en ObjectId pour la recherche MongoDB
    let playerObjectId;
    try {
      playerObjectId = new mongoose.Types.ObjectId(playerId);
    } catch (e) {
      console.error(`[PLAYER HISTORY] Invalid playerId format: ${playerId}`);
      return res.status(400).json({ success: false, message: 'ID joueur invalide' });
    }

    // Get user's statsResetAt to filter out old matches
    const user = await User.findById(playerObjectId).select('statsResetAt');
    const statsResetAt = user?.statsResetAt || null;


    // Build query - filter out matches before stats reset if applicable
    const query = {
      'players.user': playerObjectId,
      status: 'completed'
    };
    
    // Filter by mode if specified (hardcore or cdl)
    if (mode && ['hardcore', 'cdl'].includes(mode)) {
      query.mode = mode;
    }
    
    // If user has reset their stats, only show matches after the reset
    if (statsResetAt) {
      query.completedAt = { $gt: statsResetAt };
    }

    // Récupérer les matchs classés où le joueur a participé
    const matches = await RankedMatch.find(query)
      .populate('players.user', 'username avatarUrl discordAvatar discordId')
      .select('gameMode mode teamSize players result status completedAt createdAt')
      .sort({ completedAt: -1 })
      .limit(parseInt(limit));
    

    // Transformer les données pour le frontend
    const formattedMatches = matches.map(match => {
      // Trouver le joueur dans ce match (gérer les cas populé vs ObjectId)
      const playerInfo = match.players.find(p => {
        if (!p.user) return false;
        const pUserId = p.user?._id?.toString() || p.user?.toString();
        return pUserId === playerId;
      });
      
      if (!playerInfo) {
      }
      
      const team1Players = match.players.filter(p => Number(p.team) === 1);
      const team2Players = match.players.filter(p => Number(p.team) === 2);
      
      // S'assurer que la comparaison est faite avec des nombres
      // Vérifier que les deux valeurs sont des nombres valides avant de comparer
      const playerTeam = playerInfo ? Number(playerInfo.team) : null;
      const winnerTeam = match.result?.winner != null ? Number(match.result.winner) : null;
      
      // isWinner: true seulement si les deux valeurs sont valides et égales
      const isWinner = playerTeam !== null && 
                       winnerTeam !== null && 
                       !isNaN(playerTeam) && 
                       !isNaN(winnerTeam) && 
                       playerTeam === winnerTeam;
      
      
      return {
        _id: match._id,
        gameMode: match.gameMode,
        mode: match.mode,
        teamSize: match.teamSize,
        playerTeam: playerInfo?.team || null,
        result: match.result,
        isWinner,
        rewards: playerInfo?.rewards || null,
        team1: team1Players.map(p => ({
          userId: p.user?._id || null,
          username: p.user?.username || p.username || 'Joueur',
          avatarUrl: p.user?.avatarUrl || null,
          discordId: p.user?.discordId || null,
          discordAvatar: p.user?.discordAvatar || null,
          rank: p.rank
        })),
        team2: team2Players.map(p => ({
          userId: p.user?._id || null,
          username: p.user?.username || p.username || 'Joueur',
          avatarUrl: p.user?.avatarUrl || null,
          discordId: p.user?.discordId || null,
          discordAvatar: p.user?.discordAvatar || null,
          rank: p.rank
        })),
        completedAt: match.completedAt,
        createdAt: match.createdAt
      };
    });

    res.json({ 
      success: true, 
      matches: formattedMatches 
    });
  } catch (error) {
    console.error('Error fetching ranked player history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
