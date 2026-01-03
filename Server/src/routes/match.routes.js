import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import AppSettings from '../models/AppSettings.js';
import Map from '../models/Map.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';
import { getSquadMatchRewards, getRewardsConfig } from '../utils/configHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for dispute evidence upload
const disputeEvidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/dispute-evidence');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'evidence-' + req.params.matchId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const disputeEvidenceUpload = multer({
  storage: disputeEvidenceStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls les images sont acceptées.'), false);
    }
  }
});

// Helper function to check if user is admin or staff
const isAdminOrStaff = (user) => {
  return user?.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
};

// Obtenir la configuration publique des récompenses (pour RankingsInfo)
router.get('/public-config', async (req, res) => {
  try {
    const config = await getRewardsConfig();
    res.json({
      success: true,
      squadMatchRewards: config.squadMatchRewards,
      rankedMatchRewards: config.rankedMatchRewards
    });
  } catch (error) {
    console.error('Get public config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

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

// Obtenir les matchs actifs (en cours) de ma squad OU en tant qu'aide
router.get('/my-active', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('squad');
    
    // Construire les conditions de recherche
    const orConditions = [];
    
    // Si l'utilisateur a une squad, inclure les matchs de sa squad
    if (user.squad) {
      orConditions.push({ challenger: user.squad._id });
      orConditions.push({ opponent: user.squad._id });
    }
    
    // Inclure aussi les matchs où l'utilisateur est helper (aide)
    // Utiliser $elemMatch pour s'assurer que les deux conditions s'appliquent au MÊME élément du tableau
    orConditions.push({ challengerRoster: { $elemMatch: { user: user._id, isHelper: true } } });
    orConditions.push({ opponentRoster: { $elemMatch: { user: user._id, isHelper: true } } });

    const matches = await Match.find({
      $or: orConditions,
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

// Obtenir le nombre de matchs en cours par ladder
router.get('/in-progress/count', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;

    // Compter les matchs en cours pour chaque ladder
    const squadTeamCount = await Match.countDocuments({
      ladderId: 'squad-team',
      mode,
      status: { $in: ['accepted', 'in_progress'] }
    });

    const duoTrioCount = await Match.countDocuments({
      ladderId: 'duo-trio',
      mode,
      status: { $in: ['accepted', 'in_progress'] }
    });

    res.json({ 
      success: true, 
      counts: {
        'squad-team': squadTeamCount,
        'duo-trio': duoTrioCount,
        total: squadTeamCount + duoTrioCount
      }
    });
  } catch (error) {
    console.error('Get in-progress matches count error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les litiges de l'utilisateur (ladder + ranked)
router.get('/my-disputes', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('squad');
    
    const disputes = [];

    // 1. Récupérer les litiges ladder (si l'utilisateur a une squad)
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
        .populate('dispute.reportedBy', 'username')
        .populate('createdBy', 'username')
        .select('challenger opponent mode selectedMap dispute createdAt status ladderId')
        .sort({ 'dispute.reportedAt': -1 });

      // Ajouter les litiges ladder avec un indicateur de type
      ladderDisputes.forEach(match => {
        disputes.push({
          ...match.toObject(),
          disputeType: 'ladder'
        });
      });
    }

    // 2. Récupérer les litiges ranked (matchs où l'utilisateur est un joueur)
    const rankedDisputes = await RankedMatch.find({
      'players.user': user._id,
      status: 'disputed'
    })
      .populate('players.user', 'username avatar')
      .populate('team1Captain', 'username')
      .populate('team2Captain', 'username')
      .populate('host', 'username')
      .populate('dispute.reportedBy', 'username')
      .select('gameMode mode players dispute createdAt status map team1 team2')
      .sort({ 'dispute.reportedAt': -1 });

    // Ajouter les litiges ranked avec un indicateur de type
    rankedDisputes.forEach(match => {
      disputes.push({
        ...match.toObject(),
        disputeType: 'ranked'
      });
    });

    // Trier tous les litiges par date de signalement
    disputes.sort((a, b) => {
      const dateA = a.dispute?.reportedAt || new Date(0);
      const dateB = b.dispute?.reportedAt || new Date(0);
      return dateB - dateA;
    });

    res.json({ success: true, disputes });
  } catch (error) {
    console.error('Get my disputes error:', error);
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
      .populate('challengerRoster.user', 'username avatar avatarUrl discordId discordAvatar')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordId discordAvatar')
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
      .populate('challengerRoster.user', 'username avatar avatarUrl discordId discordAvatar')
      .populate('opponentRoster.user', 'username avatar avatarUrl discordId discordAvatar')
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
      const didWin = match.result?.winner?.toString() === playerSquadId?.toString();
      
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles')
      .populate('dispute.reportedBy', 'name tag')
      .populate('dispute.resolvedBy', 'username')
      .populate('dispute.evidence.uploadedBy', 'username')
      .populate('dispute.evidence.squad', 'name tag');

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    console.log('[GET MATCH] challengerRoster:', JSON.stringify(match.challengerRoster, null, 2));
    console.log('[GET MATCH] opponentRoster:', JSON.stringify(match.opponentRoster, null, 2));

    // Vérifier l'accès : membre d'une des deux équipes, helper dans le roster, ou staff
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    
    // Vérifier si l'utilisateur est membre d'une des deux équipes
    const userSquadId = user.squad?._id?.toString() || user.squad?.toString();
    const challengerId = match.challenger?._id?.toString();
    const opponentId = match.opponent?._id?.toString();
    
    const isParticipant = userSquadId && (
      challengerId === userSquadId || opponentId === userSquadId
    );
    
    // Vérifier si l'utilisateur est helper (aide) dans un des rosters
    const isHelperInChallenger = match.challengerRoster?.some(r => 
      r.isHelper && (r.user?._id?.toString() || r.user?.toString()) === user._id.toString()
    );
    const isHelperInOpponent = match.opponentRoster?.some(r => 
      r.isHelper && (r.user?._id?.toString() || r.user?.toString()) === user._id.toString()
    );
    const isHelper = isHelperInChallenger || isHelperInOpponent;

    console.log(`[GET MATCH] Access check - User squad: ${userSquadId}, Challenger: ${challengerId}, Opponent: ${opponentId}, isParticipant: ${isParticipant}, isHelper: ${isHelper}, isStaff: ${isStaff}`);

    if (!isStaff && !isParticipant && !isHelper) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé - Vous devez être membre d\'une des équipes ou aide dans le roster' });
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
    const { message, isSystemGGSecure } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    if (message.length > 500) {
      return res.status(400).json({ success: false, message: 'Message trop long (max 500 caractères)' });
    }

    const user = await User.findById(req.user._id).populate('squad');
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));

    const match = await Match.findById(matchId)
      .populate('challengerRoster.user', '_id')
      .populate('opponentRoster.user', '_id');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que l'utilisateur fait partie d'une des équipes, est helper, OU est staff
    const userSquadId = user.squad?._id?.toString() || user.squad?.toString();
    const challengerId = match.challenger?.toString();
    const opponentId = match.opponent?.toString();
    
    const isParticipant = userSquadId && (
      challengerId === userSquadId || opponentId === userSquadId
    );
    
    // Vérifier si l'utilisateur est helper (aide) dans un des rosters
    const isHelperInChallenger = match.challengerRoster?.some(r => 
      r.isHelper && (r.user?._id?.toString() || r.user?.toString()) === user._id.toString()
    );
    const isHelperInOpponent = match.opponentRoster?.some(r => 
      r.isHelper && (r.user?._id?.toString() || r.user?.toString()) === user._id.toString()
    );
    const isHelper = isHelperInChallenger || isHelperInOpponent;

    if (!isParticipant && !isHelper && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }

    // Ajouter le message
    const newMessage = {
      user: isSystemGGSecure ? null : user._id,
      squad: isSystemGGSecure ? null : (user.squad?._id || null),
      message: message.trim(),
      isStaff: isStaff && !isSystemGGSecure,
      isSystem: isSystemGGSecure || false,
      createdAt: new Date()
    };

    if (!match.chat) {
      match.chat = [];
    }
    match.chat.push(newMessage);
    await match.save();

    // Message avec les infos de l'utilisateur
    const messageWithUser = {
      ...newMessage,
      user: isSystemGGSecure ? null : { _id: user._id, username: user.username, roles: user.roles }
    };

    // Émettre le message via Socket.io pour mise à jour en temps réel
    const io = req.app.get('io');
    if (io) {
      io.to(`match-${matchId}`).emit('newChatMessage', {
        matchId,
        message: messageWithUser
      });
    }

    // Retourner le message avec les infos de l'utilisateur
    res.json({ 
      success: true, 
      message: messageWithUser
    });
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un match
router.post('/', verifyToken, async (req, res) => {
  try {
    const { ladderId, gameMode, teamSize, isReady, scheduledAt, description, mapType } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    // Debug logs
    console.log('[MATCH CREATE] User ID:', user._id);
    console.log('[MATCH CREATE] User roles:', user.roles);
    console.log('[MATCH CREATE] Is admin/staff:', isAdminOrStaff(user));
    
    // Vérifier si le ladder posting est désactivé (sauf pour admin/staff)
    if (!isAdminOrStaff(user)) {
      const settings = await AppSettings.getSettings();
      console.log('[MATCH CREATE] Ladder posting enabled:', settings.features?.ladderPosting?.enabled);
      if (!settings.features?.ladderPosting?.enabled) {
        return res.status(403).json({ 
          success: false, 
          message: settings.features?.ladderPosting?.disabledMessage || 'La création de matchs ladder est temporairement désactivée.' 
        });
      }
    } else {
      console.log('[MATCH CREATE] User is admin/staff, bypassing ladder check');
    }
    
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

    let matchDate = null;
    
    // Si c'est un match planifié, vérifier la date
    if (!isReady) {
      if (!scheduledAt) {
        return res.status(400).json({ 
          success: false, 
          message: 'La date du match est requise pour un match planifié' 
        });
      }
      
      matchDate = new Date(scheduledAt);
      const now = new Date();
      const minDate = new Date(now.getTime() + 5 * 60000); // Au moins 5 minutes dans le futur
      
      if (matchDate <= minDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'La date du match doit être au moins 5 minutes dans le futur' 
        });
      }

      // Vérifier qu'il n'y a pas déjà un match pending pour cette squad à cette heure
      const existingMatch = await Match.findOne({
        challenger: squad._id,
        status: 'pending',
        isReady: false,
        scheduledAt: {
          $gte: new Date(matchDate.getTime() - 30 * 60000), // 30 min avant
          $lte: new Date(matchDate.getTime() + 30 * 60000)  // 30 min après
        }
      });

      if (existingMatch) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous avez déjà un match prévu à cette heure' 
        });
      }
    } else {
      // Pour les matchs "prêt", vérifier qu'il n'y a pas déjà un match "prêt" en attente
      const existingReadyMatch = await Match.findOne({
        challenger: squad._id,
        status: 'pending',
        isReady: true
      });

      if (existingReadyMatch) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous avez déjà un match "Prêt" en attente' 
        });
      }
    }

    // Déterminer le mode basé sur le ladder ou l'escouade
    const mode = squad.mode === 'both' ? 'hardcore' : squad.mode;

    console.log('[CREATE MATCH] Received roster:', JSON.stringify(req.body.roster, null, 2));
    
    // Enrichir le roster avec les usernames pour l'historique
    let enrichedRoster = [];
    if (req.body.roster && req.body.roster.length > 0) {
      const userIds = req.body.roster.map(r => r.user);
      const rosterUsers = await User.find({ _id: { $in: userIds } }).select('_id username');
      const userMap = new Map(rosterUsers.map(u => [u._id.toString(), u.username]));
      
      enrichedRoster = req.body.roster.map(r => ({
        user: r.user,
        username: userMap.get(r.user.toString()) || 'Joueur inconnu',
        isHelper: r.isHelper || false
      }));
    }
    
    const match = new Match({
      challenger: squad._id,
      ladderId,
      mode,
      gameMode,
      teamSize: teamSize || (ladderId === 'duo-trio' ? 2 : 4),
      mapType: mapType || 'random',
      isReady: isReady || false,
      scheduledAt: matchDate,
      description: description || '',
      createdBy: user._id,
      challengerRoster: enrichedRoster
    });

    await match.save();
    console.log('[CREATE MATCH] Saved match with challengerRoster:', JSON.stringify(match.challengerRoster, null, 2));

    const populatedMatch = await Match.findById(match._id)
      .populate('challenger', 'name tag color logo members')
      .populate('createdBy', 'username');

    // Émettre via Socket.io pour mise à jour temps réel sur le dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('hardcore-dashboard').emit('matchCreated', {
        match: populatedMatch,
        ladderId,
        mode
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
    
    // Vérifier si le ladder matchmaking est désactivé (sauf pour admin/staff)
    if (!isAdminOrStaff(user)) {
      const settings = await AppSettings.getSettings();
      if (!settings.features?.ladderMatchmaking?.enabled) {
        return res.status(403).json({ 
          success: false, 
          message: settings.features?.ladderMatchmaking?.disabledMessage || 'Les matchs ladder sont temporairement désactivés.' 
        });
      }
    }
    
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

    // Vérifier le cooldown de 3h avant de pouvoir rejouer contre la même équipe
    const REMATCH_COOLDOWN_HOURS = 3;
    const cooldownThreshold = new Date(Date.now() - REMATCH_COOLDOWN_HOURS * 60 * 60 * 1000);
    
    // Chercher un match récent entre ces deux équipes (dans les deux sens)
    const recentMatch = await Match.findOne({
      $or: [
        // Notre équipe était challenger, l'adversaire était opponent
        { challenger: squad._id, opponent: match.challenger },
        // Notre équipe était opponent, l'adversaire était challenger
        { challenger: match.challenger, opponent: squad._id }
      ],
      // Match terminé, en cours, ou en litige (pas pending/cancelled/expired)
      status: { $in: ['in_progress', 'completed', 'disputed', 'accepted'] },
      // Le match a été accepté dans les 3 dernières heures
      acceptedAt: { $gte: cooldownThreshold }
    }).sort({ acceptedAt: -1 });

    if (recentMatch) {
      // Calculer le temps restant avant de pouvoir rejouer
      const timeSinceMatch = Date.now() - new Date(recentMatch.acceptedAt).getTime();
      const cooldownMs = REMATCH_COOLDOWN_HOURS * 60 * 60 * 1000;
      const remainingMs = cooldownMs - timeSinceMatch;
      
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      
      return res.status(400).json({
        success: false,
        message: 'Vous devez attendre avant de rejouer contre cette équipe',
        errorCode: 'REMATCH_COOLDOWN',
        cooldownData: {
          hours: remainingHours,
          minutes: remainingMinutes,
          lastMatchAt: recentMatch.acceptedAt
        }
      });
    }

    match.opponent = squad._id;
    match.acceptedAt = new Date();
    match.acceptedBy = user._id;
    
    // Désigner une équipe hôte au hasard
    match.hostTeam = Math.random() < 0.5 ? match.challenger : squad._id;
    
    // Ajouter le roster de l'adversaire avec les usernames pour l'historique
    console.log('[ACCEPT MATCH] Received roster:', JSON.stringify(req.body.roster, null, 2));
    if (req.body.roster && req.body.roster.length > 0) {
      const userIds = req.body.roster.map(r => r.user);
      const rosterUsers = await User.find({ _id: { $in: userIds } }).select('_id username');
      const userMap = new Map(rosterUsers.map(u => [u._id.toString(), u.username]));
      
      match.opponentRoster = req.body.roster.map(r => ({
        user: r.user,
        username: userMap.get(r.user.toString()) || 'Joueur inconnu',
        isHelper: r.isHelper || false
      }));
    }
    console.log('[ACCEPT MATCH] OpponentRoster assigned:', JSON.stringify(match.opponentRoster, null, 2));

    // Si le match est en mode random, piocher 3 maps aléatoires depuis la DB
    if (match.mapType === 'random') {
      try {
        // Récupérer les maps disponibles pour ce ladder et mode de jeu
        const availableMaps = await Map.find({
          isActive: true,
          ladders: match.ladderId,
          gameModes: match.gameMode
        });

        if (availableMaps.length >= 3) {
          // Mélanger et prendre 3 maps
          const shuffled = availableMaps.sort(() => 0.5 - Math.random());
          match.randomMaps = shuffled.slice(0, 3).map((map, index) => ({
            name: map.name,
            image: map.image,
            order: index + 1
          }));
        } else if (availableMaps.length > 0) {
          // S'il y a moins de 3 maps, prendre toutes celles disponibles
          match.randomMaps = availableMaps.map((map, index) => ({
            name: map.name,
            image: map.image,
            order: index + 1
          }));
        }
      } catch (mapError) {
        console.error('Error fetching random maps:', mapError);
        // Continuer sans maps si erreur
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

    // Émettre via Socket.io pour mise à jour temps réel sur le dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('hardcore-dashboard').emit('matchAccepted', {
        matchId: match._id,
        match: populatedMatch,
        ladderId: match.ladderId,
        mode: match.mode
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

    // Émettre via Socket.io pour mise à jour temps réel sur le dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('hardcore-dashboard').emit('matchCancelled', {
        matchId: match._id,
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

// Valider le résultat d'un match (sélection directe du gagnant - termine le match immédiatement)
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winnerId } = req.body;
    
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
      confirmedAt: new Date()
    };

    // Déterminer le nom du gagnant
    const winnerName = winnerId === match.challenger._id.toString() 
      ? match.challenger.name 
      : match.opponent.name;

    // Ajouter un message système dans le chat
    match.chat.push({
      messageType: 'result_declared',
      messageParams: { playerName: user.username, winnerName },
      isSystem: true,
      createdAt: new Date()
    });
    
    await match.save();

    // Mettre à jour les stats des ladders
    const loserId = winnerId === match.challenger._id.toString() 
      ? match.opponent._id.toString() 
      : match.challenger._id.toString();

    // Récupérer les valeurs configurées dans l'admin panel
    const rewardsConfig = await getSquadMatchRewards();
    
    console.log(`[MATCH RESULT] Full rewardsConfig:`, JSON.stringify(rewardsConfig, null, 2));
    
    // Points à attribuer (depuis la config) - avec valeurs par défaut
    const pointsWin = rewardsConfig.ladderPointsWin ?? 20;
    const pointsLoss = rewardsConfig.ladderPointsLoss ?? 10;
    const generalPointsWin = rewardsConfig.generalSquadPointsWin ?? 15;
    const generalPointsLoss = rewardsConfig.generalSquadPointsLoss ?? 7;

    console.log(`[MATCH RESULT] Match ${matchId} - Winner: ${winnerId}, Loser: ${loserId}`);
    console.log(`[MATCH RESULT] Config - Ladder Points Win: ${pointsWin}, Loss: ${pointsLoss}, General Win: ${generalPointsWin}, Loss: ${generalPointsLoss}`);

    // 1. Mettre à jour le classement (ladder) du gagnant
    const winnerUpdate = await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': pointsWin,
          'registeredLadders.$.wins': 1,
          'stats.totalWins': 1,
          'stats.totalPoints': generalPointsWin
        }
      },
      { new: true }
    );
    console.log(`[MATCH RESULT] Winner squad updated: ${winnerUpdate?.name}, Ladder +${pointsWin}, Total +${generalPointsWin}`);

    // 2. Mettre à jour le classement (ladder) du perdant (empêcher les points négatifs)
    const loserSquad = await Squad.findById(loserId);
    if (loserSquad) {
      const ladderData = loserSquad.registeredLadders?.find(l => l.ladderId === match.ladderId);
      const currentLadderPoints = ladderData?.points || 0;
      const currentTotalPoints = loserSquad.stats?.totalPoints || 0;
      
      // Calculer les nouveaux points (minimum 0)
      const newLadderPoints = Math.max(0, currentLadderPoints - pointsLoss);
      const newTotalPoints = Math.max(0, currentTotalPoints - generalPointsLoss);
      const actualLadderLoss = currentLadderPoints - newLadderPoints;
      const actualTotalLoss = currentTotalPoints - newTotalPoints;

      const loserUpdate = await Squad.findOneAndUpdate(
        { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': -actualLadderLoss,
            'registeredLadders.$.losses': 1,
            'stats.totalLosses': 1,
            'stats.totalPoints': -actualTotalLoss
          }
        },
        { new: true }
      );
      console.log(`[MATCH RESULT] Loser squad updated: ${loserUpdate?.name}, Ladder -${actualLadderLoss}, Total -${actualTotalLoss}`);
    }

    // 3. Mettre à jour les stats individuelles des joueurs du roster
    const challengerIdStr = match.challenger._id.toString();
    const opponentIdStr = match.opponent._id.toString();
    const winnerIdStr = winnerId.toString();
    
    const isWinnerChallenger = winnerIdStr === challengerIdStr;
    let winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
    let loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;
    
    console.log(`[MATCH RESULT] DEBUG - winnerId: ${winnerIdStr}, challengerId: ${challengerIdStr}, opponentId: ${opponentIdStr}`);
    console.log(`[MATCH RESULT] DEBUG - isWinnerChallenger: ${isWinnerChallenger}`);
    console.log(`[MATCH RESULT] DEBUG - Winner team: ${isWinnerChallenger ? match.challenger.name : match.opponent.name}`);
    console.log(`[MATCH RESULT] DEBUG - Loser team: ${isWinnerChallenger ? match.opponent.name : match.challenger.name}`);

    // Fallback: si les rosters sont vides, utiliser les membres des escouades
    if ((!winnerRoster || winnerRoster.length === 0) || (!loserRoster || loserRoster.length === 0)) {
      console.log(`[MATCH RESULT] ⚠️ Roster(s) vide(s), récupération depuis les escouades...`);
      
      const winnerSquad = await Squad.findById(winnerId).populate('members.user', '_id username');
      const loserSquad = await Squad.findById(loserId).populate('members.user', '_id username');
      
      if (!winnerRoster || winnerRoster.length === 0) {
        if (winnerSquad?.members) {
          winnerRoster = winnerSquad.members.slice(0, match.teamSize).map(m => ({
            user: m.user,
            username: m.user?.username || 'Unknown',
            isHelper: false
          }));
          console.log(`[MATCH RESULT] ✅ Winner roster récupéré depuis l'escouade: ${winnerRoster.length} joueurs`);
        }
      }
      
      if (!loserRoster || loserRoster.length === 0) {
        if (loserSquad?.members) {
          loserRoster = loserSquad.members.slice(0, match.teamSize).map(m => ({
            user: m.user,
            username: m.user?.username || 'Unknown',
            isHelper: false
          }));
          console.log(`[MATCH RESULT] ✅ Loser roster récupéré depuis l'escouade: ${loserRoster.length} joueurs`);
        }
      }
    }

    // Récompenses individuelles (depuis la config) - Plus de points joueur, seulement Gold et XP
    const playerCoinsWin = rewardsConfig.playerCoinsWin ?? 50;
    const playerCoinsLoss = rewardsConfig.playerCoinsLoss ?? 25;
    const playerXPWinMin = rewardsConfig.playerXPWinMin ?? 450;
    const playerXPWinMax = rewardsConfig.playerXPWinMax ?? 550;

    console.log(`[MATCH RESULT] Player config - Coins Win: ${playerCoinsWin}, Coins Loss: ${playerCoinsLoss}, XP: ${playerXPWinMin}-${playerXPWinMax}`);
    console.log(`[MATCH RESULT] Winner roster: ${winnerRoster?.length || 0} players, Loser roster: ${loserRoster?.length || 0} players`);

    // Stocker les récompenses attribuées pour le rapport de combat
    const rewardsGiven = {
      winners: {
        coins: playerCoinsWin,
        xpGained: []
      },
      losers: {
        coins: playerCoinsLoss
      },
      squad: {
        ladderPointsWin: pointsWin,
        ladderPointsLoss: pointsLoss,
        generalPointsWin: generalPointsWin,
        generalPointsLoss: generalPointsLoss
      }
    };

    // Mettre à jour les stats GLOBALES des joueurs gagnants (depuis le roster)
    if (winnerRoster && winnerRoster.length > 0) {
      console.log(`[MATCH RESULT] Processing ${winnerRoster.length} winner players...`);
      for (const rosterEntry of winnerRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        console.log(`[MATCH RESULT] Winner roster entry:`, JSON.stringify(rosterEntry));
        console.log(`[MATCH RESULT] Extracted playerId: ${playerId}`);
        
        if (playerId) {
          // XP aléatoire entre min et max
          const xpGained = Math.floor(Math.random() * (playerXPWinMax - playerXPWinMin + 1)) + playerXPWinMin;
          rewardsGiven.winners.xpGained.push({ oderId: playerId.toString(), xp: xpGained });
          
          console.log(`[MATCH RESULT] Updating player ${playerId} with: goldCoins +${playerCoinsWin}, xp +${xpGained}, wins +1`);
          
          const updatedPlayer = await User.findByIdAndUpdate(playerId, {
            $inc: { 
              goldCoins: playerCoinsWin,
              'stats.xp': xpGained,
              'stats.wins': 1
            }
          }, { new: true });
          
          if (updatedPlayer) {
            console.log(`[MATCH RESULT] ✅ Winner player ${updatedPlayer.username}: goldCoins=${updatedPlayer.goldCoins}, xp=${updatedPlayer.stats?.xp}, wins=${updatedPlayer.stats?.wins}`);
          } else {
            console.log(`[MATCH RESULT] ❌ FAILED to update player ${playerId} - player not found!`);
          }
        } else {
          console.log(`[MATCH RESULT] ⚠️ No playerId found in roster entry`);
        }
      }
    } else {
      console.log(`[MATCH RESULT] ⚠️ WARNING: Winner roster is empty or not found!`);
      console.log(`[MATCH RESULT] winnerRoster value:`, winnerRoster);
    }

    // Mettre à jour les stats GLOBALES des joueurs perdants (depuis le roster)
    if (loserRoster && loserRoster.length > 0) {
      for (const rosterEntry of loserRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Les perdants gagnent quand même des coins de consolation
          const updatedPlayer = await User.findByIdAndUpdate(playerId, {
            $inc: { 
              goldCoins: playerCoinsLoss,
              'stats.losses': 1
            }
          }, { new: true });
          console.log(`[MATCH RESULT] Loser player ${updatedPlayer?.username}: +${playerCoinsLoss} coins consolation`);
        }
      }
    } else {
      console.log(`[MATCH RESULT] WARNING: Loser roster is empty or not found!`);
    }

    // Sauvegarder les récompenses dans le match pour le rapport de combat
    match.result.rewardsGiven = rewardsGiven;
    await match.save();

    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Émettre via Socket.io pour mise à jour en temps réel
    const io = req.app.get('io');
    if (io) {
      io.to(`match-${matchId}`).emit('matchUpdate', { 
        type: 'completed',
        match: populatedMatch
      });
      // Envoyer aussi le message système dans le chat
      const systemMessage = populatedMatch.chat[populatedMatch.chat.length - 1];
      io.to(`match-${matchId}`).emit('newChatMessage', {
        matchId,
        message: systemMessage
      });
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
      .populate('opponent', 'name tag color logo members');
    
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

    // Récupérer les valeurs configurées dans l'admin panel
    const rewardsConfigConfirm = await getSquadMatchRewards();
    
    // Points à attribuer (depuis la config)
    const pointsWin = rewardsConfigConfirm.ladderPointsWin;
    const pointsLoss = rewardsConfigConfirm.ladderPointsLoss;
    const generalPointsWin = rewardsConfigConfirm.generalSquadPointsWin;
    const generalPointsLoss = rewardsConfigConfirm.generalSquadPointsLoss;

    // Mettre à jour le gagnant
    await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': pointsWin,
          'registeredLadders.$.wins': 1,
          'stats.totalWins': 1,
          'stats.totalPoints': generalPointsWin
        }
      }
    );

    // Mettre à jour le perdant (empêcher les points négatifs)
    const loserSquadConfirm = await Squad.findById(loserId);
    if (loserSquadConfirm) {
      const ladderDataConfirm = loserSquadConfirm.registeredLadders?.find(l => l.ladderId === match.ladderId);
      const currentLadderPointsConfirm = ladderDataConfirm?.points || 0;
      const currentTotalPointsConfirm = loserSquadConfirm.stats?.totalPoints || 0;
      
      // Calculer les nouveaux points (minimum 0)
      const newLadderPointsConfirm = Math.max(0, currentLadderPointsConfirm - pointsLoss);
      const newTotalPointsConfirm = Math.max(0, currentTotalPointsConfirm - generalPointsLoss);
      const actualLadderLossConfirm = currentLadderPointsConfirm - newLadderPointsConfirm;
      const actualTotalLossConfirm = currentTotalPointsConfirm - newTotalPointsConfirm;

      await Squad.findOneAndUpdate(
        { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': -actualLadderLossConfirm,
            'registeredLadders.$.losses': 1,
            'stats.totalLosses': 1,
            'stats.totalPoints': -actualTotalLossConfirm
          }
        }
      );
    }

    res.json({ 
      success: true, 
      match,
      message: 'Match terminé ! Les points ont été attribués.' 
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

    // Vérifier que le match est en cours ou accepté
    if (!['accepted', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match ne peut pas être mis en litige' 
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

    // Mettre le match en litige
    match.status = 'disputed';
    match.dispute = {
      isDisputed: true,
      disputedBy: user._id,
      disputedAt: new Date(),
      reason: reason || 'Aucune raison fournie',
      reportedBy: user.squad._id
    };

    // Ajouter un message système dans le chat
    match.chat.push({
      messageType: 'dispute_reported',
      messageParams: { playerName: user.username, reason: reason || '' },
      isSystem: true,
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
      .populate('dispute.reportedBy', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Émettre via Socket.io pour mise à jour en temps réel
    const io = req.app.get('io');
    if (io) {
      io.to(`match-${matchId}`).emit('matchUpdate', { 
        type: 'disputed',
        match: populatedMatch
      });
      // Envoyer aussi le message système dans le chat
      const systemMessage = populatedMatch.chat[populatedMatch.chat.length - 1];
      io.to(`match-${matchId}`).emit('newChatMessage', {
        matchId,
        message: systemMessage
      });
    }

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

// Upload preuve pour un litige
router.post('/:matchId/dispute-evidence', verifyToken, disputeEvidenceUpload.single('evidence'), async (req, res) => {
  try {
    const { matchId } = req.params;
    const { description } = req.body;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      // Supprimer le fichier uploadé
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que le match est en litige
    if (match.status !== 'disputed') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match n\'est pas en litige' 
      });
    }

    // Vérifier que l'utilisateur fait partie du match ou est staff
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    const userSquadId = user.squad?._id?.toString() || user.squad?.toString();
    const challengerId = match.challenger?.toString();
    const opponentId = match.opponent?.toString();
    
    const isParticipant = userSquadId && (
      challengerId === userSquadId || opponentId === userSquadId
    );

    if (!isParticipant && !isStaff) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ 
        success: false, 
        message: 'Vous ne participez pas à ce match' 
      });
    }

    // Limiter le nombre de preuves par équipe (max 5)
    const mySquadId = user.squad?._id?.toString();
    const existingEvidence = match.dispute?.evidence?.filter(e => 
      e.squad?.toString() === mySquadId
    ) || [];
    
    if (existingEvidence.length >= 5 && !isStaff) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez atteint la limite de 5 preuves par équipe' 
      });
    }

    // Ajouter la preuve
    const evidenceUrl = `/uploads/dispute-evidence/${req.file.filename}`;
    
    if (!match.dispute.evidence) {
      match.dispute.evidence = [];
    }
    
    match.dispute.evidence.push({
      uploadedBy: user._id,
      squad: user.squad?._id || null,
      imageUrl: evidenceUrl,
      description: description?.substring(0, 200) || '',
      uploadedAt: new Date()
    });

    // Ajouter un message système dans le chat
    match.chat.push({
      messageType: 'evidence_added',
      messageParams: { username: user.username },
      isSystem: true,
      createdAt: new Date()
    });

    await match.save();

    // Repeupler le match
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('dispute.reportedBy', 'name tag')
      .populate('dispute.evidence.uploadedBy', 'username')
      .populate('dispute.evidence.squad', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Émettre via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`match-${matchId}`).emit('matchUpdate', { match: populatedMatch });
    }

    res.json({ 
      success: true, 
      match: populatedMatch,
      message: 'Preuve ajoutée avec succès' 
    });
  } catch (error) {
    console.error('Upload dispute evidence error:', error);
    // Nettoyer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer une preuve de litige (staff uniquement)
router.delete('/:matchId/dispute-evidence/:evidenceId', verifyToken, async (req, res) => {
  try {
    const { matchId, evidenceId } = req.params;
    
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Trouver et supprimer la preuve
    const evidenceIndex = match.dispute?.evidence?.findIndex(e => e._id.toString() === evidenceId);
    
    if (evidenceIndex === -1 || evidenceIndex === undefined) {
      return res.status(404).json({ success: false, message: 'Preuve non trouvée' });
    }

    const evidence = match.dispute.evidence[evidenceIndex];
    
    // Supprimer le fichier
    const filePath = path.join(__dirname, '../..', evidence.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Retirer de la liste
    match.dispute.evidence.splice(evidenceIndex, 1);
    await match.save();

    res.json({ success: true, message: 'Preuve supprimée' });
  } catch (error) {
    console.error('Delete dispute evidence error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Demander l'annulation d'un match (nécessite confirmation des deux équipes)
router.post('/:matchId/cancel-request', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const user = await User.findById(req.user._id).populate('squad');
    
    if (!user.squad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }

    const match = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members')
      .populate('opponent', 'name tag color logo members');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    // Vérifier que le match est en cours ou accepté
    if (!['accepted', 'in_progress'].includes(match.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match ne peut pas être annulé' 
      });
    }

    // Vérifier que l'utilisateur fait partie du match
    const isChallenger = match.challenger._id.toString() === user.squad._id.toString();
    const isOpponent = match.opponent._id.toString() === user.squad._id.toString();

    if (!isChallenger && !isOpponent) {
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
        message: 'Seuls les leaders et officiers peuvent demander l\'annulation' 
      });
    }

    // Initialiser cancelRequests si non existant
    if (!match.cancelRequests) {
      match.cancelRequests = [];
    }

    // Vérifier si l'équipe a déjà demandé l'annulation
    const alreadyRequested = match.cancelRequests.some(
      r => r.squad.toString() === user.squad._id.toString()
    );

    if (alreadyRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà demandé l\'annulation de ce match' 
      });
    }

    // Ajouter la demande d'annulation
    match.cancelRequests.push({
      squad: user.squad._id,
      requestedAt: new Date()
    });

    // Vérifier si les deux équipes ont demandé l'annulation
    const challengerRequested = match.cancelRequests.some(
      r => r.squad.toString() === match.challenger._id.toString()
    );
    const opponentRequested = match.cancelRequests.some(
      r => r.squad.toString() === match.opponent._id.toString()
    );

    let message = '';
    if (challengerRequested && opponentRequested) {
      // Les deux équipes ont accepté, annuler le match
      match.status = 'cancelled';
      message = 'Les deux équipes ont accepté l\'annulation. Le match est annulé.';
      
      // Ajouter un message système au chat
      match.chat.push({
        messageType: 'match_cancelled_mutual',
        isSystem: true,
        createdAt: new Date()
      });
    } else {
      message = 'Demande d\'annulation envoyée. En attente de la confirmation de l\'adversaire.';
      
      // Ajouter un message dans le chat
      match.chat.push({
        user: user._id,
        squad: user.squad._id,
        messageType: 'cancel_requested',
        messageParams: { playerName: user.username },
        isSystem: true,
        createdAt: new Date()
      });
    }
    
    await match.save();

    // Repeupler le match avec toutes les données
    const populatedMatch = await Match.findById(matchId)
      .populate('challenger', 'name tag color logo members registeredLadders')
      .populate('opponent', 'name tag color logo members registeredLadders')
      .populate('createdBy', 'username')
      .populate('acceptedBy', 'username')
      .populate('hostTeam', 'name tag')
      .populate('cancelRequests.squad', 'name tag')
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Émettre via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`match-${matchId}`).emit('matchUpdate', { 
        type: 'cancelRequest',
        match: populatedMatch,
        requestedBy: user.squad._id
      });
      // Envoyer aussi le message système dans le chat
      const systemMessage = populatedMatch.chat[populatedMatch.chat.length - 1];
      io.to(`match-${matchId}`).emit('newChatMessage', {
        matchId,
        message: systemMessage
      });
    }

    res.json({ 
      success: true, 
      match: populatedMatch,
      cancelled: match.status === 'cancelled',
      message
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir tous les litiges en attente (admin/staff)
router.get('/disputes/pending', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    
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
    const { winnerId, resolution, cancel } = req.body;
    
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    
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

      // Récupérer les valeurs configurées dans l'admin panel
      const rewardsConfigResolve = await getSquadMatchRewards();
      
      // Points à attribuer (depuis la config) - avec valeurs par défaut
      const pointsWin = rewardsConfigResolve.ladderPointsWin ?? 20;
      const pointsLoss = rewardsConfigResolve.ladderPointsLoss ?? 10;
      const generalPointsWin = rewardsConfigResolve.generalSquadPointsWin ?? 15;
      const generalPointsLoss = rewardsConfigResolve.generalSquadPointsLoss ?? 7;
      const playerCoinsWin = rewardsConfigResolve.playerCoinsWin ?? 50;

      // Mettre à jour le gagnant
      await Squad.findOneAndUpdate(
        { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': pointsWin,
            'registeredLadders.$.wins': 1,
            'stats.totalWins': 1,
            'stats.totalPoints': generalPointsWin
          }
        }
      );

      // Mettre à jour le perdant (empêcher points négatifs)
      const loserSquad = await Squad.findById(loserId);
      if (loserSquad) {
        const ladderData = loserSquad.registeredLadders?.find(l => l.ladderId === match.ladderId);
        const currentLadderPoints = ladderData?.points || 0;
        const currentTotalPoints = loserSquad.stats?.totalPoints || 0;
        
        const newLadderPoints = Math.max(0, currentLadderPoints - pointsLoss);
        const newTotalPoints = Math.max(0, currentTotalPoints - generalPointsLoss);
        const actualLadderLoss = currentLadderPoints - newLadderPoints;
        const actualTotalLoss = currentTotalPoints - newTotalPoints;

        await Squad.findOneAndUpdate(
          { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
          {
            $inc: {
              'registeredLadders.$.points': -actualLadderLoss,
              'registeredLadders.$.losses': 1,
              'stats.totalLosses': 1,
              'stats.totalPoints': -actualTotalLoss
            }
          }
        );
      }

      // Déterminer les rosters gagnant et perdant
      const isWinnerChallenger = winnerId === match.challenger._id.toString();
      let winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
      let loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

      // Fallback: si les rosters sont vides, utiliser les membres des escouades
      if ((!winnerRoster || winnerRoster.length === 0) || (!loserRoster || loserRoster.length === 0)) {
        console.log(`[RESOLVE MATCH] ⚠️ Roster(s) vide(s), récupération depuis les escouades...`);
        
        const winnerSquadFallback = await Squad.findById(winnerId).populate('members.user', '_id username');
        const loserSquadFallback = await Squad.findById(loserId).populate('members.user', '_id username');
        
        if (!winnerRoster || winnerRoster.length === 0) {
          if (winnerSquadFallback?.members) {
            winnerRoster = winnerSquadFallback.members.slice(0, match.teamSize).map(m => ({
              user: m.user,
              username: m.user?.username || 'Unknown',
              isHelper: false
            }));
            console.log(`[RESOLVE MATCH] ✅ Winner roster récupéré: ${winnerRoster.length} joueurs`);
          }
        }
        
        if (!loserRoster || loserRoster.length === 0) {
          if (loserSquadFallback?.members) {
            loserRoster = loserSquadFallback.members.slice(0, match.teamSize).map(m => ({
              user: m.user,
              username: m.user?.username || 'Unknown',
              isHelper: false
            }));
            console.log(`[RESOLVE MATCH] ✅ Loser roster récupéré: ${loserRoster.length} joueurs`);
          }
        }
      }

      // Récupérer les valeurs complètes de la config - avec valeurs par défaut
      const playerCoinsLoss = rewardsConfigResolve.playerCoinsLoss ?? 25;
      const playerXPWinMin = rewardsConfigResolve.playerXPWinMin ?? 450;
      const playerXPWinMax = rewardsConfigResolve.playerXPWinMax ?? 550;

      // Stocker les récompenses pour le rapport de combat
      const rewardsGiven = {
        winners: { coins: playerCoinsWin, xpGained: [] },
        losers: { coins: playerCoinsLoss },
        squad: { ladderPointsWin: pointsWin, ladderPointsLoss: pointsLoss, generalPointsWin, generalPointsLoss }
      };

      // Mettre à jour les stats GLOBALES des joueurs gagnants (depuis le roster)
      if (winnerRoster && winnerRoster.length > 0) {
        for (const rosterEntry of winnerRoster) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (playerId) {
            const xpGained = Math.floor(Math.random() * (playerXPWinMax - playerXPWinMin + 1)) + playerXPWinMin;
            rewardsGiven.winners.xpGained.push({ oderId: playerId.toString(), xp: xpGained });
            
            await User.findByIdAndUpdate(playerId, {
              $inc: { 
                goldCoins: playerCoinsWin,
                'stats.xp': xpGained,
                'stats.wins': 1
              }
            });
          }
        }
      }

      // Mettre à jour les stats GLOBALES des joueurs perdants (depuis le roster)
      if (loserRoster && loserRoster.length > 0) {
        for (const rosterEntry of loserRoster) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (playerId) {
            // Les perdants gagnent quand même des coins de consolation
            await User.findByIdAndUpdate(playerId, {
              $inc: { 
                goldCoins: playerCoinsLoss,
                'stats.losses': 1
              }
            });
          }
        }
      }

      match.result = {
        winner: winnerId,
        reportedBy: null,
        reportedAt: new Date(),
        confirmed: true,
        confirmedAt: new Date(),
        rewardsGiven
      };
    }

    // Si cancel est true, annuler le match au lieu de le terminer
    if (cancel) {
      match.status = 'cancelled';
      // Ajouter un message système
      match.chat.push({
        messageType: 'match_cancelled_staff',
        messageParams: { reason: resolution || '' },
        isSystem: true,
        createdAt: new Date()
      });
    } else {
      match.status = 'completed';
      // Ajouter un message système pour la victoire attribuée
      if (winnerId) {
        const winnerName = winnerId === match.challenger._id.toString() 
          ? match.challenger.name 
          : match.opponent.name;
        match.chat.push({
          messageType: 'victory_assigned_staff',
          messageParams: { winnerName },
          isSystem: true,
          createdAt: new Date()
        });
      }
    }

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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Emit via Socket.io
    const io = req.app.get('io');
    io.to(`match-${matchId}`).emit('matchUpdate', { match: populatedMatch });

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
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
    
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

    // Ajouter un message système dans le chat
    match.chat.push({
      messageType: 'dispute_removed_staff',
      isSystem: true,
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

    // Emit via Socket.io
    const io = req.app.get('io');
    io.to(`match-${matchId}`).emit('matchUpdate', { match: populatedMatch });

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

// ==================== ADMIN ROUTES ====================

// Get all matches (admin)
// Get all matches (admin/staff)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const matches = await Match.find(query)
      .populate('challenger', 'name tag')
      .populate('opponent', 'name tag')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Match.countDocuments(query);
    
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
    console.error('Get all matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete match (admin/staff)
router.delete('/admin/:matchId', verifyToken, requireStaff, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match non trouvé'
      });
    }

    await Match.findByIdAndDelete(req.params.matchId);

    res.json({
      success: true,
      message: 'Match supprimé'
    });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Update match status (admin/staff)
router.patch('/admin/:matchId/status', verifyToken, requireStaff, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'disputed', 'cancelled', 'expired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const match = await Match.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match non trouvé'
      });
    }

    match.status = status;
    await match.save();

    res.json({
      success: true,
      message: 'Statut du match mis à jour',
      match
    });
  } catch (error) {
    console.error('Update match status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
