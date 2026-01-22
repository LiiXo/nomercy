import express from 'express';
import mongoose from 'mongoose';
import RankedMatch from '../models/RankedMatch.js';
import User from '../models/User.js';
import Ranking from '../models/Ranking.js';
import AppSettings from '../models/AppSettings.js';
import { verifyToken, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import { getRankedMatchRewards } from '../utils/configHelper.js';
import { getQueueStatus, joinQueue, leaveQueue, addFakePlayers, removeFakePlayers, startStaffTestMatch } from '../services/rankedMatchmaking.service.js';
import { logArbitratorCall } from '../services/discordBot.service.js';

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
    // Note: Les matchs de test distribuent maintenant les récompenses pour permettre les tests
    if (match.isTestMatch) {
      console.log(`[RANKED REWARDS] ⚡ Match de test ${match._id} - Distribution des récompenses ACTIVÉE pour test`);
    }
    
    // Récupérer la configuration des récompenses
    const rewards = await getRankedMatchRewards(match.gameMode, match.mode);
    const { pointsWin, pointsLoss, coinsWin, coinsLoss, xpWinMin, xpWinMax } = rewards;
    
    // Récupérer la configuration des points perdus par rang depuis Config
    const Config = (await import('../models/Config.js')).default;
    const config = await Config.getOrCreate();
    
    // Récupérer les seuils de rang depuis AppSettings
    const AppSettings = (await import('../models/AppSettings.js')).default;
    const appSettings = await AppSettings.getSettings();
    const rankThresholds = appSettings?.rankedSettings?.rankPointsThresholds || null;
    
    console.log(`[RANKED REWARDS] DEBUG - Config rankedPointsLossPerRank from DB:`, JSON.stringify(config?.rankedPointsLossPerRank));
    console.log(`[RANKED REWARDS] DEBUG - Rank thresholds from AppSettings:`, JSON.stringify(rankThresholds));
    
    // Default values for points loss per rank - ensures all ranks have valid negative values
    const DEFAULT_POINTS_LOSS = {
      bronze: -10,
      silver: -12,
      gold: -15,
      platinum: -18,
      diamond: -20,
      master: -22,
      grandmaster: -25,
      champion: -30
    };
    
    // Merge config values with defaults, ensuring each rank has a valid negative value
    const pointsLossPerRank = { ...DEFAULT_POINTS_LOSS };
    if (config?.rankedPointsLossPerRank) {
      Object.keys(DEFAULT_POINTS_LOSS).forEach(rank => {
        const value = config.rankedPointsLossPerRank[rank];
        console.log(`[RANKED REWARDS] DEBUG - Rank ${rank}: config value = ${value} (type: ${typeof value})`);
        // Only use the config value if it's a negative number (valid loss)
        if (typeof value === 'number' && value < 0) {
          pointsLossPerRank[rank] = value;
        }
      });
    } else {
      console.log(`[RANKED REWARDS] ⚠️ WARNING - rankedPointsLossPerRank not found in config, using defaults!`);
    }
    
    // S'assurer que winningTeam est un Number pour les comparaisons
    const winningTeam = Number(match.result.winner);
    const losingTeam = winningTeam === 1 ? 2 : 1;
    
    console.log(`[RANKED REWARDS] ====================================`);
    console.log(`[RANKED REWARDS] Match ${match._id} - Winner: Team ${winningTeam}`);
    console.log(`[RANKED REWARDS] Mode: ${match.mode} | GameMode: ${match.gameMode}`);
    console.log(`[RANKED REWARDS] Config - Gagnants: ${pointsWin}pts ladder, ${coinsWin} gold, ${xpWinMin}-${xpWinMax} XP`);
    console.log(`[RANKED REWARDS] Config - Perdants: Points par rang, ${coinsLoss} gold (consolation), 0 XP`);
    console.log(`[RANKED REWARDS] Points perdus par rang:`, pointsLossPerRank);
    console.log(`[RANKED REWARDS] Total players in match: ${match.players.length}`);
    console.log(`[RANKED REWARDS] ====================================`);
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Traiter chaque joueur INDIVIDUELLEMENT avec gestion d'erreur
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      
      try {
        // Ignorer les faux joueurs (bots)
        if (player.isFake) {
          console.log(`[RANKED REWARDS] Player ${i}: Skipped (fake player)`);
          skippedCount++;
          continue;
        }
        
        // Récupérer l'ID utilisateur (gérer les cas populé vs ObjectId)
        const userId = player.user?._id || player.user;
        
        if (!userId) {
          console.log(`[RANKED REWARDS] Player ${i}: Skipped (no user ID)`);
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
        
        console.log(`[RANKED REWARDS] Player ${i}: team=${playerTeam}, winningTeam=${winningTeam}, isWinner=${isWinner}, userId=${userId}`);
        
        // Charger l'utilisateur
        const user = await User.findById(userId);
        if (!user) {
          console.error(`[RANKED REWARDS] ⚠️ Player ${i}: User not found in database (ID: ${userId})`);
          errorCount++;
          continue;
        }
        
        // ========== METTRE À JOUR LE CLASSEMENT LADDER CLASSÉ (Ranking) ==========
        let ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: 1 });
        
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
        let rankedPointsChange;
        if (isWinner) {
          rankedPointsChange = pointsWin;
        } else {
          // Utiliser les points perdus configurés pour le rang du joueur
          const configuredLoss = pointsLossPerRank[playerDivision];
          rankedPointsChange = configuredLoss ?? pointsLoss;
          console.log(`[RANKED REWARDS] Player ${i}: Division=${playerDivision}, Points=${ranking?.points || 0}, ConfiguredLoss=${configuredLoss}, FallbackLoss=${pointsLoss}, FinalLoss=${rankedPointsChange} pts`);
        }
        
        // Gold (monnaie du jeu)
        const goldChange = isWinner ? coinsWin : coinsLoss;
        
        // XP pour le classement Top Player (expérience générale)
        const xpChange = isWinner ? Math.floor(Math.random() * (xpWinMax - xpWinMin + 1)) + xpWinMin : 0;
        if (!ranking) {
          console.log(`[RANKED REWARDS] Player ${i}: Creating new ranking entry for ${user.username}`);
          ranking = new Ranking({ 
            user: userId, 
            mode: match.mode, 
            season: 1, 
            points: 0, 
            wins: 0, 
            losses: 0 
          });
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
        console.log(`[RANKED REWARDS] Player ${i}: Ranking saved - ${ranking.wins}W/${ranking.losses}L, ${ranking.points} pts`);
        
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
        console.log(`[RANKED REWARDS] Player ${i}: User saved - ${user[statsField].wins}W/${user[statsField].losses}L, ${user.goldCoins} gold, ${user[statsField].xp} XP (${statsField})`);
        
        // ========== ENREGISTRER LES RÉCOMPENSES DANS LE MATCH ==========
        // Mettre à jour directement via l'index (plus fiable)
        match.players[i].rewards = {
          pointsChange: rankedPointsChange, // Points pour le ladder classé
          goldEarned: goldChange,
          xpEarned: xpChange,
          oldPoints: oldRankedPoints,
          newPoints: newRankedPoints
        };
        // Stocker aussi les points actuels du joueur pour calculer l'ancien/nouveau rang
        match.players[i].points = newRankedPoints;
        
        // ========== LOG DÉTAILLÉ ==========
        console.log(`[RANKED REWARDS] ✅ Joueur: ${user.username} (${isWinner ? '🏆 GAGNANT' : '💔 PERDANT'})`);
        console.log(`[RANKED REWARDS]   └─ Ladder Classé: ${oldRankedPoints} → ${newRankedPoints} (${rankedPointsChange > 0 ? '+' : ''}${rankedPointsChange})`);
        console.log(`[RANKED REWARDS]   └─ Gold: ${oldGold} → ${user.goldCoins} (+${goldChange})`);
        console.log(`[RANKED REWARDS]   └─ XP Top Player: ${oldXP} → ${user[statsField].xp} (+${xpChange}) (${statsField})`);
        console.log(`[RANKED REWARDS]   └─ Record: ${ranking.wins}V - ${ranking.losses}D (Série: ${ranking.currentStreak})`);
        
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
    
    console.log(`[RANKED REWARDS] ====================================`);
    console.log(`[RANKED REWARDS] ✅ Récompenses distribuées pour le match ${match._id}`);
    console.log(`[RANKED REWARDS]   └─ Traités: ${processedCount} joueurs`);
    console.log(`[RANKED REWARDS]   └─ Ignorés: ${skippedCount} (bots/sans ID)`);
    console.log(`[RANKED REWARDS]   └─ Erreurs: ${errorCount}`);
    console.log(`[RANKED REWARDS] ====================================\n`);
    
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
      .populate('result.playerVotes.user', 'username');

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
    const userPlayer = match.players.find(p => 
      p.user && p.user._id?.toString() === user._id.toString()
    );
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
    
    const match = await RankedMatch.findOne({
      'players.user': user._id,
      status: { $in: ['pending', 'ready', 'in_progress'] }
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
      console.log(`[RANKED] Player ${user.username} changed vote to Team ${winner}`);
    } else {
      // Ajouter un nouveau vote
      match.result.playerVotes.push({
        user: user._id,
        winner,
        votedAt: new Date()
      });
      console.log(`[RANKED] Player ${user.username} voted for Team ${winner}`);
    }

    // Calculer les votes
    const totalPlayers = match.players.length;
    const votesForTeam1 = match.result.playerVotes.filter(v => v.winner === 1).length;
    const votesForTeam2 = match.result.playerVotes.filter(v => v.winner === 2).length;
    const totalVotes = match.result.playerVotes.length;
    
    // Seuil de 60%
    const threshold = Math.ceil(totalPlayers * 0.6);
    
    console.log(`[RANKED] Votes: Team1=${votesForTeam1}, Team2=${votesForTeam2}, Total=${totalVotes}/${totalPlayers}, Threshold=${threshold}`);

    let resultMessage = '';
    let matchCompleted = false;

    // Vérifier si 60% des joueurs ont voté pour le même gagnant
    if (votesForTeam1 >= threshold) {
      match.result.winner = 1;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();

      // Attribuer les récompenses aux joueurs
      await distributeRankedRewards(match);
      
      console.log('[RANKED] ✅ Match completed with 60%+ consensus for Team 1');
      console.log(`[RANKED] Votes for Team 1: ${votesForTeam1}/${totalPlayers} (${Math.round(votesForTeam1/totalPlayers*100)}%)`);
      resultMessage = `Match validé ! L'équipe 1 gagne avec ${votesForTeam1}/${totalPlayers} votes (${Math.round(votesForTeam1/totalPlayers*100)}%)`;
      matchCompleted = true;
    } else if (votesForTeam2 >= threshold) {
      match.result.winner = 2;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();

      // Attribuer les récompenses aux joueurs
      await distributeRankedRewards(match);
      
      console.log('[RANKED] ✅ Match completed with 60%+ consensus for Team 2');
      console.log(`[RANKED] Votes for Team 2: ${votesForTeam2}/${totalPlayers} (${Math.round(votesForTeam2/totalPlayers*100)}%)`);
      resultMessage = `Match validé ! L'équipe 2 gagne avec ${votesForTeam2}/${totalPlayers} votes (${Math.round(votesForTeam2/totalPlayers*100)}%)`;
      matchCompleted = true;
    } else {
      // Pas encore de consensus
      resultMessage = `Vote enregistré. Équipe 1: ${votesForTeam1} votes, Équipe 2: ${votesForTeam2} votes. Il faut ${threshold} votes (60%) pour valider.`;
      console.log(`[RANKED] No consensus yet. Need ${threshold} votes for 60%`);
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

    console.log('[RANKED] 🚀 Emitting rankedMatchUpdate...');
    console.log('[RANKED] Match status:', match.status);
    if (matchCompleted) {
      console.log('[RANKED] Result winner:', match.result?.winner);
      console.log('[RANKED] All players rewards:');
      match.players.forEach((p, i) => {
        console.log(`[RANKED]   Player ${i}: team=${p.team}, rewards=`, p.rewards);
      });
    }

    // Émettre via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      console.log('[RANKED] ✅ Event emitted to room: ranked-match-' + matchId);
    }

    res.json({ 
      success: true, 
      match, 
      message: resultMessage,
      voteStats: {
        votesForTeam1,
        votesForTeam2,
        totalVotes,
        totalPlayers,
        threshold,
        yourVote: winner
      }
    });
  } catch (error) {
    console.error('Report ranked match result error:', error);
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
      
      // Ajouter un message système
      match.chat.push({
        isSystem: true,
        messageType: 'match_cancelled_by_players',
        message: `Match annulé par vote des joueurs (${currentVotes}/${realPlayers.length} votes)`
      });

      console.log(`[RANKED CANCELLATION] Match ${matchId} cancelled by player vote (${currentVotes}/${requiredVotes} required)`);
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
      console.log(`[ARBITRATOR CALL] ${callerUsername} called arbitrator for match ${matchId}`);
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
    
    console.log(`[RANKED CANCEL] ====================================`);
    console.log(`[RANKED CANCEL] Admin ${adminUser.username} annule le match ${matchId}`);
    console.log(`[RANKED CANCEL] Status actuel: ${match.status}, GameMode: ${match.gameMode}, Mode: ${match.mode}`);
    
    let rewardsRefunded = false;
    
    // Si le match était complété avec un gagnant, rembourser les récompenses
    if (match.status === 'completed' && match.result?.winner) {
      console.log(`[RANKED CANCEL] Match complété - Remboursement des récompenses...`);
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
        
        console.log(`[RANKED CANCEL] Remboursement joueur: ${username}`);
        console.log(`[RANKED CANCEL]   └─ Points: ${pointsChange > 0 ? '+' : ''}${pointsChange} → retrait`);
        console.log(`[RANKED CANCEL]   └─ Gold: +${goldEarned} → retrait`);
        console.log(`[RANKED CANCEL]   └─ XP: +${xpEarned} → retrait`);
        console.log(`[RANKED CANCEL]   └─ ${isWinner ? 'Victoire' : 'Défaite'} → retrait`);
        
        // Mettre à jour le Ranking (points du ladder classé + wins/losses)
        const ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: 1 });
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
          console.log(`[RANKED CANCEL]   └─ Ranking mis à jour: ${ranking.points} pts, ${ranking.wins}V/${ranking.losses}D`);
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
          console.log(`[RANKED CANCEL]   └─ User mis à jour: ${user.goldCoins} gold, ${user[statsField].xp} XP, ${user[statsField].wins}V/${user[statsField].losses}D`);
        }
      }
      
      console.log(`[RANKED CANCEL] Remboursement terminé pour ${match.players.filter(p => !p.isFake && p.user).length} joueurs`);
    }
    
    match.status = 'cancelled';
    match.cancelledAt = new Date();
    match.cancelledBy = req.user._id;
    match.cancelReason = reason || 'Annulé par un administrateur';
    await match.save();
    
    console.log(`[RANKED CANCEL] Match annulé avec succès`);
    console.log(`[RANKED CANCEL] ====================================`);
    
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
    
    await match.save();
    
    // Repopuler le match avec toutes les données
    await match.populate([
      { path: 'players.user', select: 'username avatar discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatar discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' }
    ]);
    
    console.log('[RANKED] 🚀 Emitting rankedMatchUpdate with rewards...');
    console.log('[RANKED] Match status:', match.status);
    console.log('[RANKED] Winner:', match.result.winner);
    console.log('[RANKED] Sample player rewards:', match.players[0]?.rewards);
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      console.log('[RANKED] ✅ Event emitted to room: ranked-match-' + matchId);
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
    
    console.log('[RANKED] 🚀 Emitting rankedMatchUpdate with rewards (dispute resolved)...');
    console.log('[RANKED] Match status:', match.status);
    console.log('[RANKED] Winner:', match.result.winner);
    console.log('[RANKED] Sample player rewards:', match.players[0]?.rewards);
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      console.log('[RANKED] ✅ Event emitted to room: ranked-match-' + matchId);
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
    } else if (status === 'completed') {
      match.completedAt = new Date();
    } else if (status === 'in_progress') {
      match.startedAt = new Date();
    }
    
    await match.save();
    
    console.log(`[RANKED ADMIN] Match ${matchId} status changed: ${oldStatus} → ${status}`);
    
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
    
    console.log(`[RANKED DELETE] ====================================`);
    console.log(`[RANKED DELETE] Admin ${adminUser.username} supprime le match ${matchId}`);
    console.log(`[RANKED DELETE] Status: ${match.status}, GameMode: ${match.gameMode}, Mode: ${match.mode}`);
    
    // Si le match est complété, on doit rembourser les récompenses
    if (match.status === 'completed' && match.result?.winner) {
      console.log(`[RANKED DELETE] Match complété - Remboursement des récompenses...`);
      
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
        
        console.log(`[RANKED DELETE] Remboursement joueur: ${username}`);
        console.log(`[RANKED DELETE]   └─ Points: ${pointsChange > 0 ? '+' : ''}${pointsChange} → retrait`);
        console.log(`[RANKED DELETE]   └─ Gold: +${goldEarned} → retrait`);
        console.log(`[RANKED DELETE]   └─ XP: +${xpEarned} → retrait`);
        console.log(`[RANKED DELETE]   └─ ${isWinner ? 'Victoire' : 'Défaite'} → retrait`);
        
        // Mettre à jour le Ranking (points du ladder classé + wins/losses)
        const ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: 1 });
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
          console.log(`[RANKED DELETE]   └─ Ranking mis à jour: ${ranking.points} pts, ${ranking.wins}V/${ranking.losses}D`);
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
          console.log(`[RANKED DELETE]   └─ User mis à jour: ${user.goldCoins} gold, ${user[statsFieldDel].xp} XP, ${user[statsFieldDel].wins}V/${user[statsFieldDel].losses}D (${statsFieldDel})`);
        }
      }
      
      console.log(`[RANKED DELETE] Remboursement terminé pour ${match.players.filter(p => !p.isFake && p.user).length} joueurs`);
    } else {
      console.log(`[RANKED DELETE] Match non complété - Pas de remboursement nécessaire`);
    }
    
    // Supprimer le match
    await RankedMatch.findByIdAndDelete(matchId);
    
    console.log(`[RANKED DELETE] Match supprimé avec succès`);
    console.log(`[RANKED DELETE] ====================================`);
    
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
    const { limit = 10 } = req.query;
    
    // IMPORTANT: Convertir playerId en ObjectId pour la recherche MongoDB
    let playerObjectId;
    try {
      playerObjectId = new mongoose.Types.ObjectId(playerId);
    } catch (e) {
      console.error(`[PLAYER HISTORY] Invalid playerId format: ${playerId}`);
      return res.status(400).json({ success: false, message: 'ID joueur invalide' });
    }

    console.log(`[PLAYER HISTORY] Recherche matchs pour joueur: ${playerId}`);

    // Récupérer les matchs classés où le joueur a participé
    // Utiliser ObjectId pour la recherche
    const matches = await RankedMatch.find({
      'players.user': playerObjectId,
      status: 'completed'
    })
      .populate('players.user', 'username avatarUrl discordAvatar discordId')
      .select('gameMode mode teamSize players result status completedAt createdAt')
      .sort({ completedAt: -1 })
      .limit(parseInt(limit));
    
    console.log(`[PLAYER HISTORY] Trouvé ${matches.length} matchs pour le joueur ${playerId}`);

    // Transformer les données pour le frontend
    const formattedMatches = matches.map(match => {
      // Trouver le joueur dans ce match (gérer les cas populé vs ObjectId)
      const playerInfo = match.players.find(p => {
        if (!p.user) return false;
        const pUserId = p.user?._id?.toString() || p.user?.toString();
        return pUserId === playerId;
      });
      
      if (!playerInfo) {
        console.log(`[PLAYER HISTORY] ⚠️ Match ${match._id}: Joueur ${playerId} non trouvé dans players malgré la requête!`);
        console.log(`[PLAYER HISTORY]   Players dans ce match:`, match.players.map(p => ({
          userId: p.user?._id?.toString() || p.user?.toString(),
          username: p.username || p.user?.username,
          team: p.team,
          isFake: p.isFake
        })));
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
      
      console.log(`[PLAYER HISTORY] Match ${match._id}: playerTeam=${playerTeam}, winnerTeam=${winnerTeam}, isWinner=${isWinner}, rewards=${JSON.stringify(playerInfo?.rewards)}`);
      
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
