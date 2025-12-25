import express from 'express';
import multer from 'multer';
import Match from '../models/Match.js';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import Ranking from '../models/Ranking.js';
import ItemUsage from '../models/ItemUsage.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { getSquadMatchRewards } from '../utils/configHelper.js';

const router = express.Router();

// Multer configuration for chat image upload
const storage = multer.memoryStorage();
const uploadChatImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for chat images
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed.'));
    }
  }
});

// Helper function to calculate rewards with active boosts
async function calculateRewardsWithBoosts(userId, basePoints, baseCoins, isWinner = true) {
  // Check for active boosts
  const activeBoosts = await ItemUsage.find({
    user: userId,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    effectType: { $in: ['double_xp', 'double_gold'] }
  }).populate('item');

  let finalPoints = basePoints;
  let finalCoins = baseCoins;

  for (const boost of activeBoosts) {
    if (boost.effectType === 'double_xp') {
      finalPoints *= 2;
    } else if (boost.effectType === 'double_gold') {
      finalCoins *= 2;
    }
  }

  // Générer XP aléatoire entre 500 et 600 pour les gagnants
  // Les perdants gagnent 20% de l'XP des gagnants (100-120)
  const baseXP = Math.floor(Math.random() * 101) + 500; // 500-600
  const randomXP = isWinner ? baseXP : Math.floor(baseXP * 0.2);

  return { 
    points: finalPoints, 
    coins: finalCoins, 
    experience: randomXP,
    hasDoubleXP: activeBoosts.some(b => b.effectType === 'double_xp'), 
    hasDoubleGold: activeBoosts.some(b => b.effectType === 'double_gold') 
  };
}

// Obtenir les matchs disponibles pour un ladder
router.get('/available/:ladderId', async (req, res) => {
  try {
    const { ladderId } = req.params;
    const { mode = 'hardcore', page = 1, limit = 20 } = req.query;

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Nettoyer les matchs planifiés expirés
    await Match.updateMany(
      { 
        status: 'pending',
        isReady: false,
        scheduledAt: { $lt: now } 
      },
      { status: 'expired' }
    );

    // Nettoyer les matchs "prêt" qui ont plus de 10 minutes
    await Match.updateMany(
      { 
        status: 'pending',
        isReady: true,
        createdAt: { $lt: tenMinutesAgo } 
      },
      { status: 'expired' }
    );

    // Récupérer les matchs : soit "ready" (créés il y a moins de 10 min), soit planifiés dans le futur
    const matches = await Match.find({
      ladderId,
      mode,
      status: 'pending',
      $or: [
        { isReady: true, createdAt: { $gte: tenMinutesAgo } }, // Matchs "prêt" de moins de 10 min
        { isReady: false, scheduledAt: { $gt: now } } // Matchs planifiés futurs
      ]
    })
      .populate('challenger', 'name tag color logo members')
      .populate('createdBy', 'username')
      .sort({ isReady: -1, scheduledAt: 1 }) // "Ready" en premier, puis par date
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Match.countDocuments({
      ladderId,
      mode,
      status: 'pending',
      $or: [
        { isReady: true },
        { isReady: false, scheduledAt: { $gt: new Date() } }
      ]
    });

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
    console.error('Get available matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir l'historique des matchs d'une squad (pour afficher les 5 derniers résultats)
router.get('/squad-history/:squadId', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { limit = 5 } = req.query;

    const matches = await Match.find({
      $or: [
        { challenger: squadId },
        { opponent: squadId }
      ],
      status: 'completed',
      'result.winner': { $exists: true }
    })
      .populate('result.winner', '_id')
      .sort({ 'result.confirmedAt': -1, updatedAt: -1 })
      .limit(parseInt(limit));

    // Format matches with win/loss info
    const formattedMatches = matches.map(m => ({
      _id: m._id,
      isWin: m.result?.winner?._id?.toString() === squadId || m.result?.winner?.toString() === squadId,
      completedAt: m.result?.confirmedAt || m.updatedAt
    }));

    res.json({ success: true, matches: formattedMatches });
  } catch (error) {
    console.error('Get squad history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir mes matchs en litige (ladder + ranked)
router.get('/my-disputes', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('squad');
    const RankedMatch = (await import('../models/RankedMatch.js')).default;
    
    const disputes = [];
    
    // Matchs ladder en litige (via la squad)
    if (user.squad) {
      const ladderDisputes = await Match.find({
        $or: [
          { challenger: user.squad._id },
          { opponent: user.squad._id }
        ],
        status: 'disputed'
      })
        .populate('challenger', 'name tag color logo')
        .populate('opponent', 'name tag color logo')
        .populate('createdBy', 'username')
        .populate('acceptedBy', 'username')
        .populate('dispute.reportedBy', 'name tag')
        .sort({ 'dispute.reportedAt': -1 });
      
      disputes.push(...ladderDisputes.map(d => ({ ...d.toObject(), disputeType: 'ladder' })));
    }
    
    // Matchs ranked en litige
    const rankedDisputes = await RankedMatch.find({
      'players.user': user._id,
      status: 'disputed'
    })
      .populate('players.user', 'username avatar avatarUrl')
      .populate('host', 'username')
      .populate('dispute.reportedBy', 'username')
      .sort({ 'dispute.reportedAt': -1 });
    
    disputes.push(...rankedDisputes.map(d => ({ ...d.toObject(), disputeType: 'ranked' })));
    
    // Trier par date (plus récent en premier)
    disputes.sort((a, b) => {
      const dateA = new Date(a.dispute?.reportedAt || a.createdAt);
      const dateB = new Date(b.dispute?.reportedAt || b.createdAt);
      return dateB - dateA;
    });

    res.json({ success: true, disputes });
  } catch (error) {
    console.error('Get my disputes error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les matchs de ma squad
router.get('/my-matches', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.json({ success: true, matches: [] });
    }

    const matches = await Match.find({
      $or: [
        { challenger: user.squad._id },
        { opponent: user.squad._id }
      ],
      status: { $in: ['pending', 'accepted', 'in_progress'] }
    })
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Get my matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les matchs actifs (en cours) de ma squad
router.get('/my-active', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.json({ success: true, matches: [] });
    }

    const matches = await Match.find({
      $or: [
        { challenger: user.squad._id },
        { opponent: user.squad._id }
      ],
      status: { $in: ['accepted', 'in_progress'] }
    })
      .populate('challenger', 'name tag color logo members')
      .populate('opponent', 'name tag color logo members')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .sort({ acceptedAt: -1 });

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Get my active matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Historique des matchs d'une squad
router.get('/history/:squadId', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const matches = await Match.find({
      $or: [
        { challenger: squadId },
        { opponent: squadId }
      ],
      status: 'completed'
    })
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('result.winner', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl avatar')
      .populate('opponentRoster.user', 'username avatarUrl avatar')
      .sort({ 'result.confirmedAt': -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Match.countDocuments({
      $or: [
        { challenger: squadId },
        { opponent: squadId }
      ],
      status: 'completed'
    });

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
    console.error('Get match history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Historique des matchs d'un joueur (basé sur les rosters)
router.get('/player-history/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const matches = await Match.find({
      $or: [
        { 'challengerRoster.user': playerId },
        { 'opponentRoster.user': playerId }
      ],
      status: 'completed'
    })
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('result.winner', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl avatar')
      .populate('opponentRoster.user', 'username avatarUrl avatar')
      .sort({ 'result.confirmedAt': -1, updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Match.countDocuments({
      $or: [
        { 'challengerRoster.user': playerId },
        { 'opponentRoster.user': playerId }
      ],
      status: 'completed'
    });

    // Ajouter l'info si le joueur a gagné ou perdu pour chaque match
    const matchesWithResult = matches.map(match => {
      const matchObj = match.toObject();
      const isInChallenger = match.challengerRoster?.some(r => 
        (r.user?._id || r.user).toString() === playerId
      );
      const playerSquadId = isInChallenger ? match.challenger?._id : match.opponent?._id;
      // winner can be populated (object) or just ObjectId
      const winnerId = match.result?.winner?._id || match.result?.winner;
      const didWin = winnerId?.toString() === playerSquadId?.toString();
      
      return {
        ...matchObj,
        playerResult: didWin ? 'win' : 'loss',
        playerSquad: isInChallenger ? match.challenger : match.opponent
      };
    });

    res.json({
      success: true,
      matches: matchesWithResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get player match history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir un match par ID (accessible aux participants et au staff)
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const user = await User.findById(req.user._id).populate('squad');

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('hostTeam', 'name tag color logo')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles')
      .populate('dispute.reportedBy', 'name tag')
      .populate('dispute.resolvedBy', 'username');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier l'accès : participant ou staff
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    const isParticipant = user.squad && (
      match.challenger?._id.toString() === user.squad._id.toString() ||
      match.opponent?._id.toString() === user.squad._id.toString()
    );

    if (!isStaff && !isParticipant) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    res.json({ success: true, match, isStaff });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Envoyer un message dans le chat du match (participants + staff)
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

    const user = await User.findById(req.user._id).populate('squad');
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que l'utilisateur fait partie d'une des équipes OU est staff
    const isParticipant = user.squad && (
      match.challenger.toString() === user.squad._id.toString() ||
      (match.opponent && match.opponent.toString() === user.squad._id.toString())
    );

    if (!isParticipant && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }

    // Ajouter le message
    const newMessage = {
      user: user._id,
      squad: user.squad?._id || null,
      message: message.trim(),
      isStaff: isStaff,
      createdAt: new Date()
    };

    if (!match.chat) {
      match.chat = [];
    }
    match.chat.push(newMessage);
    await match.save();

    // Message avec les infos de l'utilisateur
    const populatedMessage = {
      ...newMessage,
      user: { _id: user._id, username: user.username, roles: user.roles }
    };

    // Émettre le message via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`match:${matchId}`).emit('newMessage', populatedMessage);
    }

    // Retourner le message avec les infos de l'utilisateur
    res.json({ 
      success: true, 
      message: populatedMessage
    });
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Upload image to chat
router.post('/:matchId/chat/image', verifyToken, uploadChatImage.single('image'), async (req, res) => {
  try {
    const { matchId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image requise' });
    }

    const user = await User.findById(req.user._id).populate('squad');
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que l'utilisateur fait partie d'une des équipes OU est staff
    const isParticipant = user.squad && (
      match.challenger.toString() === user.squad._id.toString() ||
      (match.opponent && match.opponent.toString() === user.squad._id.toString())
    );

    if (!isParticipant && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }

    // Convert to base64 data URL
    const base64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;

    // Ajouter le message avec l'image
    const newMessage = {
      user: user._id,
      squad: user.squad?._id || null,
      message: '', // Empty message, image only
      imageUrl: imageUrl,
      isStaff: isStaff,
      createdAt: new Date()
    };

    if (!match.chat) {
      match.chat = [];
    }
    match.chat.push(newMessage);
    await match.save();

    // Message avec les infos de l'utilisateur
    const populatedMessage = {
      ...newMessage,
      user: { _id: user._id, username: user.username, roles: user.roles }
    };

    // Émettre le message via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`match:${matchId}`).emit('newMessage', populatedMessage);
    }

    res.json({ 
      success: true, 
      message: populatedMessage
    });
  } catch (error) {
    console.error('Upload chat image error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Envoyer un message système dans le chat (pour les notifications anti-cheat)
router.post('/:matchId/chat/system', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    const user = await User.findById(req.user._id).populate('squad');
    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que l'utilisateur fait partie d'une des équipes
    const isParticipant = user.squad && (
      match.challenger.toString() === user.squad._id.toString() ||
      (match.opponent && match.opponent.toString() === user.squad._id.toString())
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }

    // Déduplication: vérifier si ce message existe déjà dans les 30 dernières secondes
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const duplicateExists = match.chat?.some(msg => 
      msg.isSystem && 
      msg.message === message.trim() && 
      new Date(msg.createdAt) > thirtySecondsAgo
    );

    if (duplicateExists) {
      // Message déjà envoyé, ignorer silencieusement
      return res.json({ success: true, duplicate: true });
    }

    // Ajouter le message système (sans user ni squad)
    const systemMessage = {
      message: message.trim(),
      isSystem: true,
      createdAt: new Date()
    };

    if (!match.chat) {
      match.chat = [];
    }
    match.chat.push(systemMessage);
    await match.save();

    // Message pour le socket
    const populatedMessage = {
      ...systemMessage,
      user: { _id: 'system', username: 'Système', roles: [] }
    };

    // Émettre le message via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`match:${matchId}`).emit('newMessage', populatedMessage);
    }

    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error('Send system message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Clear chat (admin/staff only)
router.delete('/:matchId/chat/clear', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const user = await User.findById(req.user._id);
    
    // Vérifier que l'utilisateur est admin ou staff
    const isStaff = user.roles?.includes('admin') || user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs' });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vider le chat
    match.chat = [];
    await match.save();

    // Émettre l'événement via Socket.io pour rafraîchir le chat
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`match:${matchId}`).emit('chatCleared');
    }

    res.json({ success: true, message: 'Chat vidé' });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un match
router.post('/', verifyToken, async (req, res) => {
  try {
    const { ladderId, gameMode, teamSize, isReady, scheduledAt, description, mapType } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    // Vérifier que l'escouade est inscrite au ladder
    const squad = await Squad.findById(user.squad._id);
    const isRegistered = squad.registeredLadders?.some(l => l.ladderId === ladderId);
    
    if (!isRegistered) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade n\'est pas inscrite à ce classement' 
      });
    }

    // Vérifier la restriction horaire pour duo-trio (00:00 - 20:00 heure française)
    if (ladderId === 'duo-trio') {
      // Obtenir l'heure actuelle en France (Europe/Paris)
      const now = new Date();
      const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const currentHour = parisTime.getHours();
      
      // Si l'heure est entre 20h et 23h59, refuser
      if (currentHour >= 20) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le classement Duo/Trio est fermé entre 20h00 et 00h00 (heure française). Réessayez après minuit !' 
        });
      }
    }

    // Vérifier que la taille de l'équipe est valide pour le ladder
    if (ladderId === 'duo-trio' && ![2, 3].includes(teamSize)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format invalide pour Duo/Trio (2v2 ou 3v3 uniquement)' 
      });
    }
    if (ladderId === 'squad-team' && ![4, 5].includes(teamSize)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format invalide pour Squad/Team (4v4 ou 5v5 uniquement)' 
      });
    }

    // Vérifier que le mode de jeu est valide pour le ladder
    // Duo/Trio: uniquement Search & Destroy
    // Squad/Team: uniquement Search & Destroy
    const validGameModes = {
      'duo-trio': ['Search & Destroy'],
      'squad-team': ['Search & Destroy']
    };
    
    if (!validGameModes[ladderId]?.includes(gameMode)) {
      return res.status(400).json({ 
        success: false, 
        message: `Mode de jeu invalide pour ce ladder. Modes autorisés: ${validGameModes[ladderId]?.join(', ')}` 
      });
    }

    // Vérifier que l'utilisateur est leader ou officier
    const member = squad.members.find(m => 
      m.user.toString() === user._id.toString()
    );
    
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seuls les leaders et officiers peuvent poster des matchs' 
      });
    }

    // Vérifier qu'il n'y a pas déjà un match en attente pour cette squad
    const existingReadyMatch = await Match.findOne({
      challenger: squad._id,
      status: 'pending',
      isReady: true
    });

    if (existingReadyMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà un match en attente' 
      });
    }

    // Déterminer le mode basé sur le ladder ou l'escouade
    const mode = squad.mode === 'both' ? 'hardcore' : squad.mode;

    // Valider la taille du roster
    const effectiveTeamSize = teamSize || (ladderId === 'duo-trio' ? 2 : 4);
    const roster = req.body.roster || [];
    
    if (roster.length !== effectiveTeamSize) {
      return res.status(400).json({ 
        success: false, 
        message: `Vous devez sélectionner exactement ${effectiveTeamSize} joueurs dans le roster` 
      });
    }

    const match = new Match({
      challenger: squad._id,
      challengerInfo: {
        name: squad.name,
        tag: squad.tag,
        color: squad.color,
        logo: squad.logo
      },
      ladderId,
      mode,
      gameMode,
      teamSize: effectiveTeamSize,
      mapType: mapType || 'random',
      isReady: true, // Always ready immediately, expires after 10 min
      createdBy: user._id,
      challengerRoster: roster
    });

    await match.save();

    const populatedMatch = await Match.findById(match._id)
      .populate('challenger', 'name tag color logo members')
      .populate('createdBy', 'username');

    // Émettre l'événement de nouveau match via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.emit('matchCreated', { 
        ladderId, 
        mode,
        match: populatedMatch 
      });
    }

    res.status(201).json({ success: true, match: populatedMatch });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Accepter un match
router.post('/:matchId/accept', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Ce match n\'est plus disponible' });
    }

    // Pour les matchs planifiés (non "ready"), vérifier l'expiration
    if (!match.isReady && match.scheduledAt && match.scheduledAt <= new Date()) {
      match.status = 'expired';
      await match.save();
      return res.status(400).json({ success: false, message: 'Ce match a expiré' });
    }

    // Vérifier que ce n'est pas sa propre escouade
    if (match.challenger.toString() === user.squad._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas accepter votre propre match' 
      });
    }

    // Vérifier que l'escouade est inscrite au ladder
    const squad = await Squad.findById(user.squad._id);
    const isRegistered = squad.registeredLadders?.some(l => l.ladderId === match.ladderId);
    
    if (!isRegistered) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade n\'est pas inscrite à ce classement' 
      });
    }

    // Vérifier la restriction horaire pour duo-trio (00:00 - 20:00 heure française)
    if (match.ladderId === 'duo-trio') {
      const now = new Date();
      const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const currentHour = parisTime.getHours();
      
      if (currentHour >= 20) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le classement Duo/Trio est fermé entre 20h00 et 00h00 (heure française). Réessayez après minuit !' 
        });
      }
    }

    // Vérifier que l'utilisateur est leader ou officier
    const member = squad.members.find(m => 
      m.user.toString() === user._id.toString()
    );
    
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seuls les leaders et officiers peuvent accepter des matchs' 
      });
    }

    // Restriction de délai entre matchs contre la même équipe (6 heures)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentMatchAgainstSameTeam = await Match.findOne({
      $or: [
        { challenger: squad._id, opponent: match.challenger },
        { challenger: match.challenger, opponent: squad._id }
      ],
      status: 'completed',
      'result.confirmedAt': { $gte: sixHoursAgo }
    });
    
    if (recentMatchAgainstSameTeam) {
      const nextMatchTime = new Date(recentMatchAgainstSameTeam.result.confirmedAt.getTime() + 6 * 60 * 60 * 1000);
      const hoursRemaining = Math.ceil((nextMatchTime - new Date()) / (1000 * 60 * 60));
      return res.status(400).json({ 
        success: false, 
        message: `Vous devez attendre encore ${hoursRemaining}h avant de rejouer contre cette équipe.` 
      });
    }

    // Valider la taille du roster
    const roster = req.body.roster || [];
    if (roster.length !== match.teamSize) {
      return res.status(400).json({ 
        success: false, 
        message: `Vous devez sélectionner exactement ${match.teamSize} joueurs dans le roster` 
      });
    }

    match.opponent = squad._id;
    match.opponentInfo = {
      name: squad.name,
      tag: squad.tag,
      color: squad.color,
      logo: squad.logo
    };
    match.acceptedAt = new Date();
    match.acceptedBy = user._id;
    
    // Désigner une équipe hôte au hasard
    match.hostTeam = Math.random() < 0.5 ? match.challenger : squad._id;
    
    // Ajouter le roster de l'adversaire
    match.opponentRoster = roster;
    
    // Générer 3 maps aléatoires si mapType est 'random'
    if (match.mapType === 'random') {
      const Map = (await import('../models/Map.js')).default;
      const availableMaps = await Map.find({
        isActive: true,
        ladders: match.ladderId,
        gameModes: match.gameMode
      });
      
      if (availableMaps.length >= 3) {
        const shuffled = availableMaps.sort(() => 0.5 - Math.random());
        match.randomMaps = shuffled.slice(0, 3).map((m, idx) => ({
          name: m.name,
          image: m.image,
          order: idx + 1
        }));
      }
    }
    
    // Si c'est un match "ready", il passe directement en cours
    // Si c'est un match planifié, il passe en "accepted" (standby jusqu'à l'heure)
    if (match.isReady) {
      match.status = 'in_progress';
      match.startedAt = new Date();
    } else {
      match.status = 'accepted';
    }
    
    await match.save();

    const populatedMatch = await Match.findById(match._id)
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username');

    // Émettre l'événement de match accepté via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.emit('matchAccepted', { 
        matchId: match._id.toString(),
        ladderId: match.ladderId,
        mode: match.mode,
        match: populatedMatch 
      });
    }

    res.json({ success: true, match: populatedMatch });
  } catch (error) {
    console.error('Accept match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Soumettre le code de partie (par l'équipe hôte)
router.post('/:matchId/code', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { code } = req.body;
    
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Code requis' });
    }

    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('hostTeam', 'name tag');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (!['accepted', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ success: false, message: 'Ce match ne peut pas recevoir de code' });
    }

    // Vérifier que l'utilisateur fait partie de l'équipe hôte
    if (!match.hostTeam || match.hostTeam._id.toString() !== user.squad._id.toString()) {
      return res.status(403).json({ success: false, message: 'Seule l\'équipe hôte peut fournir le code' });
    }

    match.gameCode = code.trim().toUpperCase();
    await match.save();

    res.json({ success: true, match, message: 'Code enregistré' });
  } catch (error) {
    console.error('Submit code error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Annuler un match (par le créateur)
router.delete('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Seul le créateur ou l'admin peut annuler
    if (match.challenger.toString() !== user.squad._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seule l\'escouade qui a créé le match peut l\'annuler' 
      });
    }

    if (match.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible d\'annuler un match terminé' 
      });
    }

    // Pour les matchs planifiés (non "ready"), vérifier les 5 minutes avant le début
    if (!match.isReady && match.scheduledAt) {
      const now = new Date();
      const matchTime = new Date(match.scheduledAt);
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if ((matchTime - now) < fiveMinutesInMs) {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible d\'annuler un match moins de 5 minutes avant le début' 
        });
      }
    }

    match.status = 'cancelled';
    await match.save();

    // Émettre l'événement de match annulé via Socket.io
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.emit('matchCancelled', { 
        matchId: match._id.toString(),
        ladderId: match.ladderId,
        mode: match.mode
      });
    }

    res.json({ success: true, message: 'Match annulé' });
  } catch (error) {
    console.error('Cancel match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Demander l'annulation mutuelle d'un match (les deux équipes doivent accepter)
router.post('/:matchId/request-cancel', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const squad = await Squad.findById(user.squad._id);
    const isLeader = squad.leader.toString() === user._id.toString();
    
    if (!isLeader) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seul le leader peut demander l\'annulation' 
      });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag')
      .populate('opponent', 'name tag');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que le match est en cours (accepted ou in_progress)
    if (!['accepted', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le match doit être en cours pour demander une annulation mutuelle' 
      });
    }

    // Vérifier que l'utilisateur est participant
    const isChallenger = match.challenger._id.toString() === squad._id.toString();
    const isOpponent = match.opponent && match.opponent._id.toString() === squad._id.toString();
    
    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne participez pas à ce match' 
      });
    }

    // Vérifier si l'équipe a déjà demandé l'annulation
    const alreadyRequested = match.cancelRequests?.some(
      cr => cr.squad.toString() === squad._id.toString()
    );

    if (alreadyRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà demandé l\'annulation de ce match' 
      });
    }

    // Ajouter la demande d'annulation
    if (!match.cancelRequests) {
      match.cancelRequests = [];
    }
    match.cancelRequests.push({ squad: squad._id, requestedAt: new Date() });

    // Vérifier si les deux équipes ont demandé l'annulation
    const challengerRequested = match.cancelRequests.some(
      cr => cr.squad.toString() === match.challenger._id.toString()
    );
    const opponentRequested = match.cancelRequests.some(
      cr => cr.squad.toString() === match.opponent._id.toString()
    );

    // Get Socket.io instance
    const { getIO } = await import('../index.js');
    const io = getIO();

    if (challengerRequested && opponentRequested) {
      // Les deux équipes ont accepté, annuler le match
      match.status = 'cancelled';
      await match.save();

      // Ajouter un message système au chat
      const cancelMessage = {
        user: user._id,
        squad: squad._id,
        message: '🤝 Match annulé d\'un commun accord entre les deux équipes.',
        isStaff: true,
        createdAt: new Date()
      };
      match.chat.push(cancelMessage);
      await match.save();

      // Émettre l'événement de match annulé
      if (io) {
        io.to(`match:${matchId}`).emit('matchCancelled', { matchId });
        io.to(`match:${matchId}`).emit('newMessage', {
          ...cancelMessage,
          user: { _id: user._id, username: user.username }
        });
      }

      return res.json({ 
        success: true, 
        cancelled: true,
        message: 'Match annulé d\'un commun accord' 
      });
    }

    await match.save();

    // Ajouter un message au chat pour notifier
    const requestMessage = {
      user: user._id,
      squad: squad._id,
      message: `⏳ ${squad.name} a demandé l'annulation du match. L'autre équipe doit confirmer.`,
      isStaff: false,
      createdAt: new Date()
    };
    match.chat.push(requestMessage);
    await match.save();

    // Émettre l'événement de demande d'annulation + message
    if (io) {
      io.to(`match:${matchId}`).emit('cancelRequested', { 
        matchId, 
        squadId: squad._id.toString(),
        cancelRequests: match.cancelRequests 
      });
      io.to(`match:${matchId}`).emit('newMessage', {
        ...requestMessage,
        user: { _id: user._id, username: user.username }
      });
    }

    res.json({ 
      success: true, 
      cancelled: false,
      message: 'Demande d\'annulation envoyée. En attente de confirmation de l\'adversaire.' 
    });
  } catch (error) {
    console.error('Request cancel match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Valider le résultat d'un match (sélection directe du gagnant - termine le match immédiatement)
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winnerId, isForfeit, forfeitReason } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const squad = await Squad.findById(user.squad._id);
    
    // Vérifier que l'utilisateur est leader de son escouade
    const member = squad.members.find(m => 
      m.user.toString() === user._id.toString()
    );
    
    if (!member || member.role !== 'leader') {
      return res.status(403).json({ 
        success: false, 
        message: 'Seul le leader peut valider le résultat du match' 
      });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('challengerRoster.user', '_id username')
      .populate('opponentRoster.user', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'accepted' && match.status !== 'in_progress') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match ne peut pas être validé' 
      });
    }

    // Vérifier que l'utilisateur fait partie du match
    const isChallenger = match.challenger._id.toString() === user.squad._id.toString();
    const isOpponent = match.opponent._id.toString() === user.squad._id.toString();
    
    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne faites pas partie de ce match' 
      });
    }

    // Vérifier que le gagnant est une des équipes du match
    if (winnerId !== match.challenger._id.toString() && winnerId !== match.opponent._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gagnant invalide' 
      });
    }

    // Terminer le match directement
    match.status = 'completed';
    match.result = {
      winner: winnerId,
      reportedBy: user.squad._id,
      reportedAt: new Date(),
      confirmed: true,
      confirmedAt: new Date(),
      isForfeit: isForfeit || false,
      forfeitReason: isForfeit ? forfeitReason : null
    };
    
    await match.save();

    // Mettre à jour les stats des ladders
    const loserId = winnerId === match.challenger._id.toString() 
      ? match.opponent._id.toString() 
      : match.challenger._id.toString();

    // === NOUVEAU SYSTÈME DE POINTS ===
    // Victoire: +20 pts ladder, +15 pts général escouade, +15 pts par joueur
    // Défaite: -10 pts ladder, -7 pts général escouade, -5 pts par joueur
    // Get rewards from config
    const squadRewards = await getSquadMatchRewards();
    const POINTS_LADDER_WIN = squadRewards.ladderPointsWin;
    const POINTS_LADDER_LOSS = squadRewards.ladderPointsLoss;
    const POINTS_GENERAL_SQUAD_WIN = squadRewards.generalSquadPointsWin;
    const POINTS_GENERAL_SQUAD_LOSS = squadRewards.generalSquadPointsLoss;
    const POINTS_PLAYER_WIN = squadRewards.playerPointsWin;
    const POINTS_PLAYER_LOSS = squadRewards.playerPointsLoss;

    console.log(`[MATCH RESULT] Match ${matchId} - Winner: ${winnerId}, Loser: ${loserId}`);
    console.log(`[MATCH RESULT] Ladder: ${match.ladderId}`);

    // XP awarded only to winner: from config
    const xpWin = match.ladderId === 'duo-trio' ? squadRewards.squadXPWinDuoTrio : squadRewards.squadXPWinSquadTeam;
    
    // 1. Mettre à jour le classement (ladder spécifique + général) du gagnant
    const winnerUpdate = await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': POINTS_LADDER_WIN,  // +20 pts dans le ladder
          'registeredLadders.$.wins': 1,
          'stats.totalWins': 1,                              // Correction: totalWins au lieu de wins
          'stats.totalPoints': POINTS_GENERAL_SQUAD_WIN,    // +15 pts classement général escouade
          'experience': xpWin
        }
      },
      { new: true }
    );
    console.log(`[MATCH RESULT] Winner squad updated: ${winnerUpdate?.name}, +${POINTS_LADDER_WIN} ladder pts, +${POINTS_GENERAL_SQUAD_WIN} general pts, +${xpWin} XP`);

    // 2. Mettre à jour le classement (ladder spécifique + général) du perdant (empêcher les points négatifs)
    // Note: Le perdant ne gagne PAS d'XP d'escouade
    const loserSquad = await Squad.findById(loserId);
    if (loserSquad) {
      const ladderData = loserSquad.registeredLadders?.find(l => l.ladderId === match.ladderId);
      const currentLadderPoints = ladderData?.points || 0;
      const currentTotalPoints = loserSquad.stats?.totalPoints || 0;
      
      // Calculer les pertes réelles (minimum 0)
      const actualLadderLoss = Math.min(POINTS_LADDER_LOSS, currentLadderPoints);
      const actualGeneralLoss = Math.min(POINTS_GENERAL_SQUAD_LOSS, currentTotalPoints);

      const loserUpdate = await Squad.findOneAndUpdate(
        { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': -actualLadderLoss,   // -10 pts dans le ladder
            'registeredLadders.$.losses': 1,
            'stats.totalLosses': 1,                            // Correction: totalLosses au lieu de losses
            'stats.totalPoints': -actualGeneralLoss            // -7 pts classement général escouade
          }
        },
        { new: true }
      );
      console.log(`[MATCH RESULT] Loser squad updated: ${loserUpdate?.name}, -${actualLadderLoss} ladder pts, -${actualGeneralLoss} general pts`);
    }

    // 3. Mettre à jour les stats individuelles des joueurs du roster
    const isWinnerChallenger = winnerId === match.challenger._id.toString();
    const winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
    const loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

    console.log(`[MATCH RESULT] Winner roster: ${winnerRoster?.length || 0} players, Loser roster: ${loserRoster?.length || 0} players`);

    // Générer l'XP une seule fois pour tous les joueurs (cohérent avec l'affichage)
    const xpRange = squadRewards.playerXPWinMax - squadRewards.playerXPWinMin;
    const baseXP = Math.floor(Math.random() * (xpRange + 1)) + squadRewards.playerXPWinMin;
    const winnerXP = baseXP;
    const loserXP = Math.floor(baseXP * (squadRewards.playerXPLossPercent / 100));

    // Mettre à jour les stats des joueurs gagnants (+15 pts chacun)
    if (winnerRoster && winnerRoster.length > 0) {
      for (const rosterEntry of winnerRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Check for active boosts
          const activeBoosts = await ItemUsage.find({
            user: playerId,
            isActive: true,
            $or: [
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } }
            ],
            effectType: { $in: ['double_xp', 'double_gold'] }
          }).populate('item');
          
          let finalCoins = squadRewards.playerCoinsWin;
          let finalXP = winnerXP;
          
          for (const boost of activeBoosts) {
            if (boost.effectType === 'double_xp') {
              finalXP *= 2;
            } else if (boost.effectType === 'double_gold') {
              finalCoins *= 2;
            }
          }
          
          // Update User stats (XP only, no points)
          const updatedPlayer = await User.findByIdAndUpdate(playerId, {
            $inc: { 
              goldCoins: finalCoins,
              'stats.wins': 1,
              experience: finalXP
            }
          }, { new: true });
          
          // Update Ranking collection (classement général joueurs)
          let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
          if (!playerRanking) {
            playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
          }
          playerRanking.wins += 1;
          playerRanking.currentStreak += 1;
          if (playerRanking.currentStreak > playerRanking.bestStreak) {
            playerRanking.bestStreak = playerRanking.currentStreak;
          }
          await playerRanking.save();
          
          const hasDoubleXP = activeBoosts.some(b => b.effectType === 'double_xp');
          const hasDoubleGold = activeBoosts.some(b => b.effectType === 'double_gold');
          if (hasDoubleXP || hasDoubleGold) {
            console.log(`[MATCH RESULT] Player ${updatedPlayer?.username} got boosted rewards: ${hasDoubleXP ? '2x XP' : ''} ${finalCoins} coins (${hasDoubleGold ? '2x Gold' : ''})`);
          }
          
          console.log(`[MATCH RESULT] Winner player ${updatedPlayer?.username}: +${POINTS_PLAYER_WIN} pts, +${finalCoins} coins, +${finalXP} XP`);
        }
      }
    } else {
      console.log(`[MATCH RESULT] WARNING: Winner roster is empty or not found!`);
    }

    // Mettre à jour les stats des joueurs perdants (XP only, no coins)
    if (loserRoster && loserRoster.length > 0) {
      for (const rosterEntry of loserRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Check for active boosts
          const activeBoosts = await ItemUsage.find({
            user: playerId,
            isActive: true,
            $or: [
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } }
            ],
            effectType: { $in: ['double_xp', 'double_gold'] }
          }).populate('item');
          
          let finalXP = loserXP;
          
          for (const boost of activeBoosts) {
            if (boost.effectType === 'double_xp') {
              finalXP *= 2;
            }
            // No double_gold for losers - they don't get coins
          }
          
          // Update User stats (XP only, no points, no coins)
          const updatedPlayer = await User.findByIdAndUpdate(playerId, {
            $inc: { 
              'stats.losses': 1,
              experience: finalXP
            }
          }, { new: true });
          
          // Update Ranking collection (wins/losses only)
          let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
          if (!playerRanking) {
            playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
          }
          playerRanking.losses += 1;
          playerRanking.currentStreak = 0;
          await playerRanking.save();
          
          console.log(`[MATCH RESULT] Loser player ${updatedPlayer?.username}: +${finalXP} XP (no coins)`);
        }
      }
    } else {
      console.log(`[MATCH RESULT] WARNING: Loser roster is empty or not found!`);
    }

    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('chat.user', 'username roles');

    // Émettre l'événement de fin de match avec les récompenses pour l'animation
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      // Préparer les données détaillées du rapport de combat avec les vraies valeurs d'XP
      const battleReport = {
        matchId: matchId,
        winnerId: winnerId,
        loserId: loserId,
        ladderId: match.ladderId,
        winnerRewards: { 
          coins: 50, 
          ladderPoints: POINTS_LADDER_WIN,
          generalSquadPoints: POINTS_GENERAL_SQUAD_WIN,
          experience: winnerXP // XP réel généré pour ce match
        },
        loserRewards: { 
          coins: 0, 
          ladderPoints: -POINTS_LADDER_LOSS,
          generalSquadPoints: -POINTS_GENERAL_SQUAD_LOSS,
          experience: loserXP // 20% de l'XP des gagnants
        },
        isForfeit: isForfeit || false
      };
      
      // Émettre à tous les participants du match
      io.to(`match:${matchId}`).emit('matchCompleted', battleReport);
    }

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Match terminé ! Les points ont été attribués.' 
    });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Reporter le résultat d'un match
router.post('/:matchId/report', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { challengerScore, opponentScore } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId)
      .populate('challenger')
      .populate('opponent');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'accepted' && match.status !== 'in_progress') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match ne peut pas être reporté' 
      });
    }

    // Vérifier que l'utilisateur fait partie du match
    const isChallenger = match.challenger._id.toString() === user.squad._id.toString();
    const isOpponent = match.opponent._id.toString() === user.squad._id.toString();
    
    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne faites pas partie de ce match' 
      });
    }

    // Déterminer le gagnant
    const winner = challengerScore > opponentScore 
      ? match.challenger._id 
      : match.opponent._id;

    match.status = 'in_progress';
    match.result = {
      winner,
      challengerScore,
      opponentScore,
      reportedBy: user._id,
      reportedAt: new Date(),
      confirmed: false
    };
    
    await match.save();

    res.json({ 
      success: true, 
      match,
      message: 'Résultat reporté. En attente de confirmation de l\'adversaire.' 
    });
  } catch (error) {
    console.error('Report match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Confirmer le résultat d'un match
router.post('/:matchId/confirm', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const squad = await Squad.findById(user.squad._id);
    
    // Vérifier que l'utilisateur est leader de son escouade
    const member = squad.members.find(m => 
      m.user.toString() === user._id.toString()
    );
    
    if (!member || member.role !== 'leader') {
      return res.status(403).json({ 
        success: false, 
        message: 'Seul le leader peut confirmer le résultat du match' 
      });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members')
      .populate('opponent', 'name tag color logo members')
      .populate('challengerRoster.user', '_id username')
      .populate('opponentRoster.user', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'in_progress' || !match.result?.reportedBy) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun résultat à confirmer' 
      });
    }

    // Vérifier que c'est l'autre équipe qui confirme
    const isChallenger = match.challenger._id.toString() === user.squad._id.toString();
    const isOpponent = match.opponent._id.toString() === user.squad._id.toString();
    
    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne faites pas partie de ce match' 
      });
    }

    // L'équipe qui a reporté ne peut pas confirmer
    if (match.result.reportedBy.toString() === user.squad._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre équipe a signalé ce résultat, c\'est l\'adversaire qui doit confirmer' 
      });
    }

    match.result.confirmed = true;
    match.result.confirmedBy = user._id;
    match.result.confirmedAt = new Date();
    match.status = 'completed';
    
    await match.save();

    // Mettre à jour les stats des ladders
    const winnerId = match.result.winner.toString();
    const loserId = winnerId === match.challenger._id.toString() 
      ? match.opponent._id.toString() 
      : match.challenger._id.toString();

    // === NOUVEAU SYSTÈME DE POINTS ===
    const POINTS_LADDER_WIN = 20;
    const POINTS_LADDER_LOSS = 10;
    const POINTS_GENERAL_SQUAD_WIN = 15;
    const POINTS_GENERAL_SQUAD_LOSS = 7;
    const POINTS_PLAYER_WIN = 15;
    const POINTS_PLAYER_LOSS = 5;

    // Mettre à jour le gagnant
    await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': POINTS_LADDER_WIN,
          'registeredLadders.$.wins': 1,
          'stats.totalWins': 1,
          'stats.totalPoints': POINTS_GENERAL_SQUAD_WIN
        }
      }
    );

    // Mettre à jour le perdant (empêcher les points négatifs)
    const loserSquadConfirm = await Squad.findById(loserId);
    if (loserSquadConfirm) {
      const ladderDataConfirm = loserSquadConfirm.registeredLadders?.find(l => l.ladderId === match.ladderId);
      const currentLadderPointsConfirm = ladderDataConfirm?.points || 0;
      const currentTotalPointsConfirm = loserSquadConfirm.stats?.totalPoints || 0;
      
      const actualLadderLossConfirm = Math.min(POINTS_LADDER_LOSS, currentLadderPointsConfirm);
      const actualGeneralLossConfirm = Math.min(POINTS_GENERAL_SQUAD_LOSS, currentTotalPointsConfirm);

      await Squad.findOneAndUpdate(
        { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': -actualLadderLossConfirm,
            'registeredLadders.$.losses': 1,
            'stats.totalLosses': 1,
            'stats.totalPoints': -actualGeneralLossConfirm
          }
        }
      );
    }

    // Mettre à jour le Ranking des joueurs (classement général)
    const isWinnerChallengerConfirm = winnerId === match.challenger._id.toString();
    const winnerRosterConfirm = isWinnerChallengerConfirm ? match.challengerRoster : match.opponentRoster;
    const loserRosterConfirm = isWinnerChallengerConfirm ? match.opponentRoster : match.challengerRoster;

    // Joueurs gagnants (+15 pts, + XP)
    if (winnerRosterConfirm && winnerRosterConfirm.length > 0) {
      for (const rosterEntry of winnerRosterConfirm) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Calculate rewards with boosts (winner - XP only)
          const rewards = await calculateRewardsWithBoosts(playerId, 0, 50, true);
          
          await User.findByIdAndUpdate(playerId, {
            $inc: { 
              goldCoins: rewards.coins, 
              'stats.wins': 1,
              experience: rewards.experience
            }
          });
          let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
          if (!playerRanking) playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
          playerRanking.points += rewards.points;
          playerRanking.wins += 1;
          playerRanking.currentStreak += 1;
          if (playerRanking.currentStreak > playerRanking.bestStreak) playerRanking.bestStreak = playerRanking.currentStreak;
          await playerRanking.save();
        }
      }
    }

    // Joueurs perdants (-5 pts, +25 coins, + XP)
    const COINS_LOSER_CONFIRM = 25;
    if (loserRosterConfirm && loserRosterConfirm.length > 0) {
      for (const rosterEntry of loserRosterConfirm) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Calculate rewards (loser gets 20% XP)
          const loserRewards = await calculateRewardsWithBoosts(playerId, 0, COINS_LOSER_CONFIRM, false);
          
          await User.findByIdAndUpdate(playerId, { 
            $inc: { 
              'stats.losses': 1, 
              goldCoins: loserRewards.coins,
              experience: loserRewards.experience
            } 
          });
          
          // Update ranking stats (wins/losses only)
          let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
          if (!playerRanking) playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
          playerRanking.losses += 1;
          playerRanking.currentStreak = 0;
          await playerRanking.save();
        }
      }
    }

    res.json({ 
      success: true, 
      match,
      message: 'Match terminé !' 
    });
  } catch (error) {
    console.error('Confirm match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Signaler un litige sur un match
router.post('/:matchId/dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Check if already disputed
    if (match.status === 'disputed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match est déjà en litige' 
      });
    }

    // Vérifier que l'utilisateur fait partie du match
    const isParticipant = 
      match.challenger._id.toString() === user.squad._id.toString() ||
      match.opponent._id.toString() === user.squad._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne participez pas à ce match' 
      });
    }

    // Vérifier que l'utilisateur est leader ou officier
    const member = user.squad.members?.find(m => 
      (m.user?._id || m.user).toString() === user._id.toString()
    ) || await Squad.findById(user.squad._id).then(s => s.members.find(m => m.user.toString() === user._id.toString()));
    
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seuls les leaders et officiers peuvent signaler un litige' 
      });
    }

    // Mettre le match en litige et retirer le gagnant
    match.status = 'disputed';
    match.winner = null; // Remove winner
    match.dispute = {
      isDisputed: true,
      reportedBy: user.squad._id, // Store squad ID
      disputedBy: user._id, // Store user ID who reported it
      disputedAt: new Date(),
      reason: reason || 'Aucune raison fournie'
    };
    
    await match.save();

    // Repeupler le match avec toutes les données
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('chat.user', 'username roles');

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Litige signalé. Un membre du staff examinera le cas.' 
    });
  } catch (error) {
    console.error('Dispute match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir tous les litiges en attente (admin/staff)
router.get('/disputes/pending', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const disputes = await Match.find({ status: 'disputed' })
      .populate('challenger', 'name tag color logo')
      .populate('opponent', 'name tag color logo')
      .populate('dispute.reportedBy', 'name tag')
      .populate('createdBy', 'username')
      .sort({ 'dispute.reportedAt': -1 });

    res.json({ success: true, disputes });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Résoudre un litige (admin/staff)
router.post('/:matchId/resolve', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winnerId, resolution } = req.body;
    
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('challengerRoster.user', '_id username')
      .populate('opponentRoster.user', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'disputed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match n\'est pas en litige' 
      });
    }

    // Vérifier que le winnerId est valide
    if (winnerId && winnerId !== match.challenger._id.toString() && winnerId !== match.opponent._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gagnant invalide' 
      });
    }

    // Si un gagnant est désigné, attribuer les points
    if (winnerId) {
      const loserId = winnerId === match.challenger._id.toString() 
        ? match.opponent._id.toString() 
        : match.challenger._id.toString();

      // === NOUVEAU SYSTÈME DE POINTS ===
      const POINTS_LADDER_WIN = 20;
      const POINTS_LADDER_LOSS = 10;
      const POINTS_GENERAL_SQUAD_WIN = 15;
      const POINTS_GENERAL_SQUAD_LOSS = 7;
      const POINTS_PLAYER_WIN = 15;
      const POINTS_PLAYER_LOSS = 5;

      // Mettre à jour le gagnant
      await Squad.findOneAndUpdate(
        { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': POINTS_LADDER_WIN,
            'registeredLadders.$.wins': 1,
            'stats.totalWins': 1,
            'stats.totalPoints': POINTS_GENERAL_SQUAD_WIN
          }
        }
      );

      // Mettre à jour le perdant (empêcher points négatifs)
      const loserSquad = await Squad.findById(loserId);
      if (loserSquad) {
        const ladderData = loserSquad.registeredLadders?.find(l => l.ladderId === match.ladderId);
        const currentLadderPoints = ladderData?.points || 0;
        const currentTotalPoints = loserSquad.stats?.totalPoints || 0;
        
        const actualLadderLoss = Math.min(POINTS_LADDER_LOSS, currentLadderPoints);
        const actualGeneralLoss = Math.min(POINTS_GENERAL_SQUAD_LOSS, currentTotalPoints);

        await Squad.findOneAndUpdate(
          { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
          {
            $inc: {
              'registeredLadders.$.points': -actualLadderLoss,
              'registeredLadders.$.losses': 1,
              'stats.totalLosses': 1,
              'stats.totalPoints': -actualGeneralLoss
            }
          }
        );
      }

      // Déterminer les rosters gagnant et perdant
      const isWinnerChallenger = winnerId === match.challenger._id.toString();
      const winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
      const loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

      // Mettre à jour les stats GLOBALES + Ranking des joueurs gagnants (+15 pts, + XP)
      if (winnerRoster && winnerRoster.length > 0) {
        for (const rosterEntry of winnerRoster) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (playerId) {
            // Calculate rewards with boosts (winner)
            const rewards = await calculateRewardsWithBoosts(playerId, 0, 50, true);
            
            await User.findByIdAndUpdate(playerId, {
              $inc: { 
                goldCoins: rewards.coins, 
                'stats.wins': 1,
                experience: rewards.experience
              }
            });
            let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
            if (!playerRanking) playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
            playerRanking.points += rewards.points;
            playerRanking.wins += 1;
            playerRanking.currentStreak += 1;
            if (playerRanking.currentStreak > playerRanking.bestStreak) playerRanking.bestStreak = playerRanking.currentStreak;
            await playerRanking.save();
          }
        }
      }

      // Mettre à jour les stats GLOBALES + Ranking des joueurs perdants (coins, + XP)
      const COINS_LOSER_RESOLVE = 25;
      if (loserRoster && loserRoster.length > 0) {
        for (const rosterEntry of loserRoster) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (playerId) {
            // Calculate rewards (loser gets 20% XP)
            const loserRewards = await calculateRewardsWithBoosts(playerId, 0, COINS_LOSER_RESOLVE, false);
            
            await User.findByIdAndUpdate(playerId, { 
              $inc: { 
                'stats.losses': 1, 
                goldCoins: loserRewards.coins,
                experience: loserRewards.experience
              } 
            });
            
            // Update ranking stats (wins/losses only)
            let playerRanking = await Ranking.findOne({ user: playerId, mode: match.mode, season: 1 });
            if (!playerRanking) playerRanking = new Ranking({ user: playerId, mode: match.mode, season: 1 });
            playerRanking.losses += 1;
            playerRanking.currentStreak = 0;
            await playerRanking.save();
          }
        }
      }

      match.result = {
        winner: winnerId,
        reportedBy: null,
        reportedAt: new Date(),
        confirmed: true,
        confirmedAt: new Date()
      };
    }

    match.status = 'completed';
    match.dispute.resolvedBy = user._id;
    match.dispute.resolvedAt = new Date();
    match.dispute.resolution = resolution || 'Résolu par le staff';
    match.dispute.winner = winnerId || null;
    
    await match.save();

    // Repeupler le match avec toutes les données
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('chat.user', 'username roles');

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Litige résolu avec succès' 
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Annuler un litige et remettre le match en cours (admin/staff)
router.post('/:matchId/cancel-dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status !== 'disputed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match n\'est pas en litige' 
      });
    }

    // Remettre le match en état "in_progress"
    match.status = 'in_progress';
    match.dispute = {
      isDisputed: false,
      disputedBy: null,
      disputedAt: null,
      reason: '',
      resolvedBy: user._id,
      resolvedAt: new Date(),
      resolution: 'Litige annulé par le staff'
    };
    
    await match.save();

    // Repeupler le match avec toutes les données
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('chat.user', 'username roles');

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Litige annulé, le match est remis en cours' 
    });
  } catch (error) {
    console.error('Cancel dispute error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Annuler complètement le match (admin/staff) - match cancelled sans gagnant ni perdant
router.post('/:matchId/admin-cancel', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status === 'completed' || match.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match est déjà terminé ou annulé' 
      });
    }

    // Annuler le match complètement
    match.status = 'cancelled';
    match.cancelledBy = user._id;
    match.cancelledAt = new Date();
    match.cancelReason = reason || 'Annulé par un administrateur';
    
    // Si le match était en litige, marquer comme résolu
    if (match.dispute?.isDisputed) {
      match.dispute.resolvedBy = user._id;
      match.dispute.resolvedAt = new Date();
      match.dispute.resolution = reason || 'Match annulé par un administrateur';
    }
    
    // Ajouter un message dans le chat du match
    match.chat.push({
      user: user._id,
      squad: null,
      message: `⛔ Match annulé par un administrateur. ${reason ? `Raison: ${reason}` : ''}`,
      isStaff: true,
      createdAt: new Date()
    });
    
    await match.save();

    // Repeupler le match avec toutes les données
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordAvatar discordId activisionId platform anticheatConnected')
      .populate('chat.user', 'username roles');

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Match annulé avec succès' 
    });
  } catch (error) {
    console.error('Admin cancel match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
