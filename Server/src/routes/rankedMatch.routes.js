import express from 'express';
import RankedMatch from '../models/RankedMatch.js';
import User from '../models/User.js';
import Ranking from '../models/Ranking.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';
import { getRankedMatchRewards } from '../utils/configHelper.js';
import { getQueueStatus, joinQueue, leaveQueue } from '../services/rankedMatchmaking.service.js';

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
    // Récupérer la configuration des récompenses
    const rewards = await getRankedMatchRewards(match.gameMode, match.mode);
    const { pointsWin, pointsLoss, coinsWin, coinsLoss, xpWinMin, xpWinMax } = rewards;
    
    const winningTeam = match.result.winner;
    const losingTeam = winningTeam === 1 ? 2 : 1;
    
    console.log(`[RANKED REWARDS] ====================================`);
    console.log(`[RANKED REWARDS] Match ${match._id} - Winner: Team ${winningTeam}`);
    console.log(`[RANKED REWARDS] Mode: ${match.mode} | GameMode: ${match.gameMode}`);
    console.log(`[RANKED REWARDS] Config - Gagnants: ${pointsWin}pts ladder, ${coinsWin} gold, ${xpWinMin}-${xpWinMax} XP`);
    console.log(`[RANKED REWARDS] Config - Perdants: ${pointsLoss}pts ladder, ${coinsLoss} gold (consolation), 0 XP`);
    console.log(`[RANKED REWARDS] ====================================`);
    
    // Traiter chaque joueur
    for (const player of match.players) {
      // Ignorer les faux joueurs (bots)
      if (player.isFake || !player.user) continue;
      
      const isWinner = player.team === winningTeam;
      const userId = player.user;
      
      // Charger l'utilisateur
      const user = await User.findById(userId);
      if (!user) continue;
      
      // ========== CALCULER LES RÉCOMPENSES ==========
      
      // Points pour le ladder classé (Ranking - avec rangs Bronze/Silver/Gold etc.)
      const rankedPointsChange = isWinner ? pointsWin : pointsLoss;
      
      // Gold (monnaie du jeu)
      const goldChange = isWinner ? coinsWin : coinsLoss;
      
      // XP pour le classement Top Player (expérience générale)
      const xpChange = isWinner ? Math.floor(Math.random() * (xpWinMax - xpWinMin + 1)) + xpWinMin : 0;
      
      // ========== METTRE À JOUR LE CLASSEMENT LADDER CLASSÉ (Ranking) ==========
      let ranking = await Ranking.findOne({ user: userId, mode: match.mode, season: 1 });
      if (!ranking) {
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
      const oldRankedPoints = ranking.points;
      ranking.points = Math.max(0, ranking.points + rankedPointsChange);
      const newRankedPoints = ranking.points;
      
      // Mettre à jour les stats win/loss du ladder classé
      if (isWinner) {
        ranking.wins += 1;
        ranking.currentStreak = (ranking.currentStreak || 0) + 1;
        if (ranking.currentStreak > (ranking.bestStreak || 0)) {
          ranking.bestStreak = ranking.currentStreak;
        }
      } else {
        ranking.losses += 1;
        ranking.currentStreak = 0;
      }
      
      await ranking.save();
      
      // ========== METTRE À JOUR LES STATS GÉNÉRALES DU JOUEUR (User) ==========
      if (!user.stats) user.stats = {};
      
      // Gold (monnaie)
      const oldGold = user.stats.gold || 0;
      user.stats.gold = oldGold + goldChange;
      
      // XP pour Top Player (classement général des joueurs basé sur l'XP)
      const oldXP = user.stats.xp || 0;
      user.stats.xp = oldXP + xpChange;
      
      // Mettre à jour les stats globales win/loss
      if (isWinner) {
        user.stats.wins = (user.stats.wins || 0) + 1;
      } else {
        user.stats.losses = (user.stats.losses || 0) + 1;
      }
      
      await user.save();
      
      // ========== ENREGISTRER LES RÉCOMPENSES DANS LE MATCH ==========
      const playerIndex = match.players.findIndex(p => 
        p.user?.toString() === userId.toString() || p.user?._id?.toString() === userId.toString()
      );
      if (playerIndex !== -1) {
        match.players[playerIndex].rewards = {
          pointsChange: rankedPointsChange, // Points pour le ladder classé
          goldEarned: goldChange,
          xpEarned: xpChange,
          // Stocker explicitement les points avant/après pour le rapport
          oldPoints: oldRankedPoints,
          newPoints: newRankedPoints
        };
        // Stocker aussi les points actuels du joueur pour calculer l'ancien/nouveau rang
        match.players[playerIndex].points = newRankedPoints;
      }
      
      // ========== LOG DÉTAILLÉ ==========
      console.log(`[RANKED REWARDS] Joueur: ${user.username} (${isWinner ? '🏆 GAGNANT' : '💔 PERDANT'})`);
      console.log(`[RANKED REWARDS]   └─ Ladder Classé: ${oldRankedPoints} → ${newRankedPoints} (${rankedPointsChange > 0 ? '+' : ''}${rankedPointsChange})`);
      console.log(`[RANKED REWARDS]   └─ Gold: ${oldGold} → ${user.stats.gold} (+${goldChange})`);
      console.log(`[RANKED REWARDS]   └─ XP Top Player: ${oldXP} → ${user.stats.xp} (+${xpChange})`);
      console.log(`[RANKED REWARDS]   └─ Record: ${ranking.wins}V - ${ranking.losses}D (Série: ${ranking.currentStreak})`);
    }
    
    await match.save();
    console.log(`[RANKED REWARDS] ✅ Récompenses distribuées avec succès pour le match ${match._id}`);
    console.log(`[RANKED REWARDS] ====================================\n`);
    
  } catch (error) {
    console.error('[RANKED REWARDS] ❌ Erreur lors de la distribution des récompenses:', error);
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
      minPlayers: queueStatus.minPlayers || 6,
      maxPlayers: queueStatus.maxPlayers || 10,
      match: null
    });
    
  } catch (error) {
    console.error('Error fetching matchmaking status:', error);
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
      .populate('dispute.evidence.uploadedBy', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier l'accès : participant ou staff
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
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

    res.json({ 
      success: true, 
      match: {
        ...match.toJSON(),
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
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));

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

// Signaler le résultat d'un match classé (référent uniquement)
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body; // 1 ou 2 (équipe gagnante)

    if (!winner || ![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Équipe gagnante invalide (1 ou 2)' });
    }

    const user = await User.findById(req.user._id);
    const match = await RankedMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (!['ready', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'Ce match ne peut plus être modifié' });
    }

    // Vérifier si l'utilisateur est un référent
    const isTeam1Referent = match.team1Referent?.toString() === user._id.toString();
    const isTeam2Referent = match.team2Referent?.toString() === user._id.toString();

    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul un référent peut signaler le résultat' });
    }

    // Enregistrer le rapport de cette équipe
    const myTeam = isTeam1Referent ? 1 : 2;
    if (isTeam1Referent) {
      match.result.team1Report = { winner, reportedAt: new Date() };
    } else {
      match.result.team2Report = { winner, reportedAt: new Date() };
    }

    // En mode classé, un seul référent peut valider le gagnant (pas besoin de confirmation)
    const team1Report = match.result.team1Report;
    const team2Report = match.result.team2Report;

    let resultMessage = '';
    let waitingForOther = false;

    // Un seul référent suffit pour valider le résultat
    if (team1Report?.winner || team2Report?.winner) {
      // Prendre le premier rapport disponible comme résultat final
      const reportedWinner = team1Report?.winner || team2Report?.winner;
      
      match.result.winner = reportedWinner;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();

      // Attribuer les récompenses aux joueurs
      await distributeRankedRewards(match);
      
      console.log('[RANKED] ✅ Match completed by single referent validation');
      console.log('[RANKED] Winner: Team', match.result.winner);
      console.log('[RANKED] Validated by: Team', myTeam);
      resultMessage = 'Match validé ! Résultat enregistré.';
    }

    await match.save();

    // Repopuler le match
    await match.populate([
      { path: 'players.user', select: 'username avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'chat.user', select: 'username roles' }
    ]);

    console.log('[RANKED] 🚀 Emitting rankedMatchUpdate...');
    console.log('[RANKED] Match status:', match.status);
    if (match.status === 'completed') {
      console.log('[RANKED] Sample player rewards:', match.players[0]?.rewards);
      console.log('[RANKED] Sample player points:', match.players[0]?.points);
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
      waitingForOther,
      myReport: { team: myTeam, winner }
    });
  } catch (error) {
    console.error('Report ranked match result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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
      { path: 'players.user', select: 'username avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatarUrl discordAvatar discordId' },
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
      { path: 'players.user', select: 'username avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatarUrl discordAvatar discordId' }
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

// ==================== ADMIN ROUTES ====================

// Lister tous les matchs classés (admin/staff)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
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

// Annuler un match (admin/staff)
router.post('/admin/:matchId/cancel', verifyToken, requireStaff, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed' || match.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Ce match ne peut plus être annulé' });
    }
    
    match.status = 'cancelled';
    match.cancelledAt = new Date();
    match.cancelledBy = req.user._id;
    match.cancelReason = reason || 'Annulé par un administrateur';
    await match.save();
    
    // Notifier les joueurs
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchCancelled', {
        matchId,
        reason: match.cancelReason
      });
    }
    
    res.json({ success: true, message: 'Match annulé', match });
  } catch (error) {
    console.error('Error cancelling ranked match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Forcer un résultat (admin/staff)
router.post('/admin/:matchId/force-result', verifyToken, requireStaff, async (req, res) => {
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
      { path: 'players.user', select: 'username avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatarUrl discordAvatar discordId' },
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

// Résoudre un litige (admin/staff)
router.post('/admin/:matchId/resolve-dispute', verifyToken, requireStaff, async (req, res) => {
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
      { path: 'players.user', select: 'username avatarUrl discordAvatar discordId activisionId platform' },
      { path: 'team1Referent', select: 'username avatarUrl discordAvatar discordId' },
      { path: 'team2Referent', select: 'username avatarUrl discordAvatar discordId' },
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

export default router;
