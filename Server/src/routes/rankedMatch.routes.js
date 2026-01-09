import express from 'express';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';
import RankedMatch from '../models/RankedMatch.js';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import AppSettings from '../models/AppSettings.js';
import { joinQueue, leaveQueue, getQueueStatus, getAllQueues, addFakePlayers, removeFakePlayers } from '../services/rankedMatchmaking.service.js';

const router = express.Router();

// ==================== MATCHMAKING ROUTES ====================

// Get active match for current user
router.get('/active/me', verifyToken, async (req, res) => {
  try {
    const match = await RankedMatch.findOne({
      'players.user': req.user.id,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    })
    .populate('players.user', 'username avatar discordId discordAvatar platform')
    .populate('team1Referent', 'username')
    .populate('team2Referent', 'username');
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Get active match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get matchmaking queue status
router.get('/matchmaking/status', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode } = req.query;
    
    if (!gameMode || !mode) {
      return res.status(400).json({ success: false, message: 'gameMode et mode requis' });
    }
    
    const status = await getQueueStatus(req.user.id, gameMode, mode);
    res.json(status);
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode } = req.body;
    
    if (!gameMode || !mode) {
      return res.status(400).json({ success: false, message: 'gameMode et mode requis' });
    }
    
    const result = await joinQueue(req.user.id, gameMode, mode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Join queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode } = req.body;
    
    if (!gameMode || !mode) {
      return res.status(400).json({ success: false, message: 'gameMode et mode requis' });
    }
    
    const result = await leaveQueue(req.user.id, gameMode, mode);
    res.json(result);
  } catch (error) {
    console.error('Leave queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get all queues (admin/debug)
router.get('/matchmaking/queues', verifyToken, requireStaff, async (req, res) => {
  try {
    const queues = getAllQueues();
    res.json({ success: true, queues });
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Add fake players to queue (staff/admin only - for testing)
router.post('/matchmaking/add-fake-players', verifyToken, requireStaff, async (req, res) => {
  try {
    const { gameMode, mode, count = 5 } = req.body;
    
    if (!gameMode || !mode) {
      return res.status(400).json({ success: false, message: 'gameMode et mode requis' });
    }
    
    const result = await addFakePlayers(gameMode, mode, Math.min(count, 10));
    res.json(result);
  } catch (error) {
    console.error('Add fake players error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Remove fake players from queue (staff/admin only)
router.post('/matchmaking/remove-fake-players', verifyToken, requireStaff, async (req, res) => {
  try {
    const { gameMode, mode } = req.body;
    
    if (!gameMode || !mode) {
      return res.status(400).json({ success: false, message: 'gameMode et mode requis' });
    }
    
    const result = await removeFakePlayers(gameMode, mode);
    res.json(result);
  } catch (error) {
    console.error('Remove fake players error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Check GGSecure status and report to match chat
router.post('/matchmaking/check-ggsecure', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ success: false, message: 'matchId requis' });
    }
    
    const user = await User.findById(req.user.id).select('username platform');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Only check for PC players
    if (user.platform !== 'PC') {
      return res.json({ success: true, required: false, message: 'GGSecure non requis pour cette plateforme' });
    }
    
    // Check GGSecure status
    const GGSECURE_API_KEY = process.env.GGSECURE_API_KEY;
    let isConnected = true;
    
    if (GGSECURE_API_KEY) {
      try {
        const response = await fetch(`https://api.ggsecure.io/api/v1/fingerprints/player/${req.user.id}`, {
          headers: {
            'Authorization': `Bearer ${GGSECURE_API_KEY}`,
            'X-API-Key': GGSECURE_API_KEY
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          isConnected = data.data?.isOnline === true || 
                       data.isOnline === true ||
                       data.connected === true ||
                       data.data?.connected === true;
        } else {
          isConnected = false;
        }
      } catch (error) {
        console.error('[GGSecure Check] API error:', error);
        // En cas d'erreur API, on considère connecté pour ne pas bloquer
        isConnected = true;
      }
    }
    
    // Find the match and add system message
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Verify user is in match
    const isPlayer = match.players.some(p => p.user?.toString() === req.user.id);
    if (!isPlayer) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas dans ce match' });
    }
    
    // Add system message about GGSecure status
    const statusEmoji = isConnected ? '🟢' : '🔴';
    const statusText = isConnected ? 'GGSecure ON' : 'GGSecure OFF';
    
    const systemMessage = {
      isSystem: true,
      messageType: 'ggsecure_status',
      messageParams: { username: user.username, status: isConnected ? 'on' : 'off' },
      message: `${statusEmoji} ${user.username}: ${statusText}`,
      createdAt: new Date()
    };
    
    match.chat.push(systemMessage);
    await match.save();
    
    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('newRankedMessage', systemMessage);
    }
    
    res.json({ 
      success: true, 
      required: true,
      connected: isConnected,
      message: isConnected ? 'GGSecure connecté' : 'GGSecure non connecté'
    });
  } catch (error) {
    console.error('Check GGSecure error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== MATCH ROUTES ====================

// Get match by ID
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username avatar discordId discordAvatar platform')
      .populate('team1Referent', 'username avatar discordId discordAvatar')
      .populate('team2Referent', 'username avatar discordId discordAvatar')
      .populate('chat.user', 'username avatar discordId discordAvatar')
      .populate('dispute.reportedBy', 'username')
      .populate('dispute.resolvedBy', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Vérifier que le joueur fait partie du match ou est staff
    const isPlayer = match.players.some(p => p.user?._id?.toString() === req.user.id);
    const isStaff = req.user.roles?.includes('staff') || req.user.roles?.includes('admin');
    
    if (!isPlayer && !isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Submit game code (host referent only)
router.post('/:matchId/game-code', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { gameCode } = req.body;
    
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Vérifier que c'est le référent de l'équipe hôte
    const hostReferent = match.hostTeam === 1 ? match.team1Referent : match.team2Referent;
    if (hostReferent?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Seul le référent de l\'équipe hôte peut soumettre le code' });
    }
    
    match.gameCode = gameCode;
    if (match.status === 'ready') {
      match.status = 'in_progress';
      match.startedAt = new Date();
    }
    
    // Ajouter message système
    match.chat.push({
      isSystem: true,
      messageType: 'game_code_set',
      message: `Code de partie: ${gameCode}`
    });
    
    await match.save();
    
    // Notifier via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Submit game code error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Report match result (referent only)
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body; // 1 ou 2 (équipe gagnante)
    
    if (![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Le gagnant doit être 1 ou 2' });
    }
    
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Le match n\'est pas en cours' });
    }
    
    // Vérifier que c'est un référent
    const isTeam1Referent = match.team1Referent?.toString() === req.user.id;
    const isTeam2Referent = match.team2Referent?.toString() === req.user.id;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seuls les référents peuvent déclarer le résultat' });
    }
    
    // Enregistrer le rapport selon l'équipe
    if (isTeam1Referent) {
      match.result.team1Report = { winner, reportedAt: new Date() };
    } else {
      match.result.team2Report = { winner, reportedAt: new Date() };
    }
    
    // Vérifier si les deux équipes sont d'accord
    if (match.result.team1Report?.winner && match.result.team2Report?.winner) {
      if (match.result.team1Report.winner === match.result.team2Report.winner) {
        // Les deux équipes sont d'accord, finaliser le match
        match.result.winner = match.result.team1Report.winner;
        match.result.confirmed = true;
        match.result.confirmedAt = new Date();
        match.status = 'completed';
        match.completedAt = new Date();
        
        // Distribuer les récompenses
        await distributeRewards(match);
        
        // Message système
        match.chat.push({
          isSystem: true,
          messageType: 'match_completed',
          messageParams: { winner: match.result.winner },
          message: `L'équipe ${match.result.winner} a gagné le match !`
        });
      } else {
        // Les équipes ne sont pas d'accord, créer un litige automatique
        match.status = 'disputed';
        match.dispute.isActive = true;
        match.dispute.reportedAt = new Date();
        match.dispute.reason = 'Les référents ont déclaré des résultats différents';
        
        // Message système
        match.chat.push({
          isSystem: true,
          messageType: 'auto_dispute',
          message: 'Les référents ont déclaré des résultats différents. Un litige a été créé automatiquement.'
        });
      }
    } else {
      // En attente de l'autre équipe
      match.chat.push({
        isSystem: true,
        messageType: 'result_reported',
        messageParams: { team: isTeam1Referent ? 1 : 2, winner },
        message: `L'équipe ${isTeam1Referent ? 1 : 2} a déclaré l'équipe ${winner} gagnante. En attente de l'autre équipe.`
      });
    }
    
    await match.save();
    
    // Populate pour le retour
    await match.populate('players.user', 'username avatar discordId discordAvatar platform');
    
    // Notifier via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
      
      // Si match terminé, envoyer le battle report à chaque joueur
      if (match.status === 'completed') {
        for (const player of match.players) {
          const isWinner = player.team === match.result.winner;
          io.to(`user-${player.user._id || player.user}`).emit('rankedBattleReport', {
            matchId: match._id,
            isWinner,
            points: player.rewards?.pointsChange || 0,
            coins: player.rewards?.goldEarned || 0,
            xp: isWinner ? 100 : 25
          });
        }
      }
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Report result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Report dispute (referent only)
router.post('/:matchId/dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (!['in_progress', 'ready'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'Le match n\'est pas en cours' });
    }
    
    // Vérifier que c'est un référent
    const isTeam1Referent = match.team1Referent?.toString() === req.user.id;
    const isTeam2Referent = match.team2Referent?.toString() === req.user.id;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seuls les référents peuvent déclarer un litige' });
    }
    
    match.status = 'disputed';
    match.dispute.isActive = true;
    match.dispute.reportedBy = req.user.id;
    match.dispute.reportedByTeam = isTeam1Referent ? 1 : 2;
    match.dispute.reportedAt = new Date();
    match.dispute.reason = reason;
    
    // Message système
    match.chat.push({
      isSystem: true,
      messageType: 'dispute_created',
      messageParams: { team: isTeam1Referent ? 1 : 2 },
      message: `L'équipe ${isTeam1Referent ? 1 : 2} a signalé un litige: ${reason}`
    });
    
    await match.save();
    
    // Notifier via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Report dispute error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Upload evidence for dispute
router.post('/:matchId/evidence', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { imageUrl, description } = req.body;
    
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status !== 'disputed') {
      return res.status(400).json({ success: false, message: 'Le match n\'est pas en litige' });
    }
    
    // Vérifier que le joueur est dans le match
    const player = match.players.find(p => p.user.toString() === req.user.id);
    if (!player) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas dans ce match' });
    }
    
    match.dispute.evidence.push({
      uploadedBy: req.user.id,
      team: player.team,
      imageUrl,
      description
    });
    
    await match.save();
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Send chat message
router.post('/:matchId/chat', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Vérifier que le joueur est dans le match
    const player = match.players.find(p => p.user.toString() === req.user.id);
    if (!player) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas dans ce match' });
    }
    
    const chatMessage = {
      user: req.user.id,
      message: message.trim(),
      team: player.team,
      createdAt: new Date()
    };
    
    match.chat.push(chatMessage);
    await match.save();
    
    // Populate le message pour l'envoyer
    const populatedMessage = {
      ...chatMessage,
      user: {
        _id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar,
        discordId: req.user.discordId,
        discordAvatar: req.user.discordAvatar
      }
    };
    
    // Notifier via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`ranked-match-${matchId}`).emit('newRankedMessage', populatedMessage);
    }
    
    res.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to distribute rewards
async function distributeRewards(match) {
  try {
    // Récupérer les settings
    const settings = await AppSettings.getSettings();
    const gameModeKey = match.gameMode.replace(/\s+/g, '').replace('&', 'And').toLowerCase();
    const gameModeSettings = settings.rankedSettings?.[
      gameModeKey === 'searchanddestroy' ? 'searchAndDestroy' : gameModeKey
    ];
    
    const rewards = gameModeSettings?.rewards || {
      pointsWin: 25,
      pointsLose: -15,
      goldWin: 50
    };
    
    for (const player of match.players) {
      const isWinner = player.team === match.result.winner;
      const pointsChange = isWinner ? rewards.pointsWin : rewards.pointsLose;
      const goldEarned = isWinner ? rewards.goldWin : 0;
      
      // Mettre à jour le ranking
      const ranking = await Ranking.findOne({ user: player.user, mode: match.mode });
      if (ranking) {
        ranking.points = Math.max(0, ranking.points + pointsChange);
        if (isWinner) {
          ranking.wins += 1;
          ranking.currentStreak = (ranking.currentStreak || 0) + 1;
          ranking.bestStreak = Math.max(ranking.bestStreak || 0, ranking.currentStreak);
        } else {
          ranking.losses += 1;
          ranking.currentStreak = 0;
        }
        await ranking.save();
      }
      
      // Ajouter les gold au joueur
      if (goldEarned > 0) {
        await User.findByIdAndUpdate(player.user, {
          $inc: { coins: goldEarned }
        });
      }
      
      // Sauvegarder les récompenses dans le match
      player.rewards = {
        pointsChange,
        goldEarned
      };
    }
    
    // Recalculer les rangs
    await Ranking.recalculateRanks(match.mode);
    
    await match.save();
  } catch (error) {
    console.error('[Ranked] Error distributing rewards:', error);
  }
}

// ==================== ADMIN ROUTES ====================

// Get all ranked matches (admin)
// Get all ranked matches (admin/staff)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const matches = await RankedMatch.find(query)
      .populate('players.user', 'username')
      .populate('host', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await RankedMatch.countDocuments(query);
    
    res.json({
      success: true,
      matches,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all ranked matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update ranked match status (admin/staff)
router.patch('/admin/:matchId/status', verifyToken, requireStaff, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'ready', 'in_progress', 'completed', 'cancelled', 'disputed'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const match = await RankedMatch.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match classé non trouvé'
      });
    }

    match.status = status;
    
    // If completing or cancelling, remove from dispute if needed
    if (status === 'completed' || status === 'cancelled') {
      match.dispute = null;
    }
    
    await match.save();

    res.json({
      success: true,
      message: 'Statut du match mis à jour',
      match
    });
  } catch (error) {
    console.error('Update ranked match status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Delete ranked match (admin/staff)
router.delete('/admin/:matchId', verifyToken, requireStaff, async (req, res) => {
  try {
    const match = await RankedMatch.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match classé non trouvé'
      });
    }

    await RankedMatch.findByIdAndDelete(req.params.matchId);

    res.json({
      success: true,
      message: 'Match classé supprimé'
    });
  } catch (error) {
    console.error('Delete ranked match error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
