import express from 'express';
import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

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
      .populate('challengerRoster.user', 'username')
      .populate('opponentRoster.user', 'username')
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

    // Retourner le message avec les infos de l'utilisateur
    res.json({ 
      success: true, 
      message: {
        ...newMessage,
        user: { _id: user._id, username: user.username, roles: user.roles }
      }
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
      challengerRoster: req.body.roster ? { players: req.body.roster } : { players: [] }
    });

    await match.save();

    const populatedMatch = await Match.findById(match._id)
      .populate('challenger', 'name tag color logo members')
      .populate('createdBy', 'username');

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

    match.opponent = squad._id;
    match.acceptedAt = new Date();
    match.acceptedBy = user._id;
    
    // Désigner une équipe hôte au hasard
    match.hostTeam = Math.random() < 0.5 ? match.challenger : squad._id;
    
    // Ajouter le roster de l'adversaire
    if (req.body.roster) {
      match.opponentRoster = { players: req.body.roster };
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
    
    await match.save();

    // Mettre à jour les stats des ladders
    const loserId = winnerId === match.challenger._id.toString() 
      ? match.opponent._id.toString() 
      : match.challenger._id.toString();

    // Points à attribuer selon le ladder
    const pointsWin = match.ladderId === 'duo-trio' ? 25 : 30;
    const pointsLoss = match.ladderId === 'duo-trio' ? 15 : 20;

    console.log(`[MATCH RESULT] Match ${matchId} - Winner: ${winnerId}, Loser: ${loserId}`);
    console.log(`[MATCH RESULT] Ladder: ${match.ladderId}, Points Win: ${pointsWin}, Points Loss: ${pointsLoss}`);

    // 1. Mettre à jour le classement (ladder) du gagnant
    const winnerUpdate = await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': pointsWin,
          'registeredLadders.$.wins': 1,
          'stats.wins': 1,
          'stats.totalPoints': pointsWin
        }
      },
      { new: true }
    );
    console.log(`[MATCH RESULT] Winner squad updated: ${winnerUpdate?.name}, New ladder points: ${winnerUpdate?.registeredLadders?.find(l => l.ladderId === match.ladderId)?.points}`);

    // 2. Mettre à jour le classement (ladder) du perdant (empêcher les points négatifs)
    const loserSquad = await Squad.findById(loserId);
    if (loserSquad) {
      const ladderData = loserSquad.registeredLadders?.find(l => l.ladderId === match.ladderId);
      const currentLadderPoints = ladderData?.points || 0;
      const currentTotalPoints = loserSquad.stats?.totalPoints || 0;
      
      // Calculer les nouveaux points (minimum 0)
      const newLadderPoints = Math.max(0, currentLadderPoints - pointsLoss);
      const newTotalPoints = Math.max(0, currentTotalPoints - pointsLoss);
      const actualLadderLoss = currentLadderPoints - newLadderPoints;
      const actualTotalLoss = currentTotalPoints - newTotalPoints;

      const loserUpdate = await Squad.findOneAndUpdate(
        { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': -actualLadderLoss,
            'registeredLadders.$.losses': 1,
            'stats.losses': 1,
            'stats.totalPoints': -actualTotalLoss
          }
        },
        { new: true }
      );
      console.log(`[MATCH RESULT] Loser squad updated: ${loserUpdate?.name}, New ladder points: ${loserUpdate?.registeredLadders?.find(l => l.ladderId === match.ladderId)?.points}`);
    }

    // 3. Mettre à jour les stats individuelles des joueurs du roster
    const isWinnerChallenger = winnerId === match.challenger._id.toString();
    const winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
    const loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

    // Points individuels à attribuer selon le ladder
    const playerPointsWin = match.ladderId === 'duo-trio' ? 15 : 20;
    const playerPointsLoss = match.ladderId === 'duo-trio' ? 10 : 12;

    console.log(`[MATCH RESULT] Winner roster: ${winnerRoster?.length || 0} players, Loser roster: ${loserRoster?.length || 0} players`);

    // Mettre à jour les stats GLOBALES des joueurs gagnants (depuis le roster)
    if (winnerRoster && winnerRoster.length > 0) {
      for (const rosterEntry of winnerRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          const updatedPlayer = await User.findByIdAndUpdate(playerId, {
            $inc: { 
              goldCoins: 50,
              'stats.points': playerPointsWin,
              'stats.wins': 1
            }
          }, { new: true });
          console.log(`[MATCH RESULT] Winner player ${updatedPlayer?.username}: +${playerPointsWin} pts, +50 coins, new total: ${updatedPlayer?.stats?.points} pts`);
        }
      }
    } else {
      console.log(`[MATCH RESULT] WARNING: Winner roster is empty or not found!`);
    }

    // Mettre à jour les stats GLOBALES des joueurs perdants (depuis le roster)
    if (loserRoster && loserRoster.length > 0) {
      for (const rosterEntry of loserRoster) {
        const playerId = rosterEntry.user?._id || rosterEntry.user;
        if (playerId) {
          // Récupérer le joueur pour éviter les points négatifs
          const player = await User.findById(playerId);
          if (player) {
            const currentPoints = player.stats?.points || 0;
            const actualLoss = Math.min(playerPointsLoss, currentPoints);
            const updatedPlayer = await User.findByIdAndUpdate(playerId, {
              $inc: { 
                'stats.points': -actualLoss,
                'stats.losses': 1
              }
            }, { new: true });
            console.log(`[MATCH RESULT] Loser player ${updatedPlayer?.username}: -${actualLoss} pts, new total: ${updatedPlayer?.stats?.points} pts`);
          }
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('chat.user', 'username roles');

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

    // Points à attribuer selon le ladder
    const pointsWin = match.ladderId === 'duo-trio' ? 25 : 30;
    const pointsLoss = match.ladderId === 'duo-trio' ? 15 : 20;

    // Mettre à jour le gagnant
    await Squad.findOneAndUpdate(
      { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
      {
        $inc: {
          'registeredLadders.$.points': pointsWin,
          'registeredLadders.$.wins': 1,
          'stats.totalWins': 1,
          'stats.totalPoints': pointsWin
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
      const newTotalPointsConfirm = Math.max(0, currentTotalPointsConfirm - pointsLoss);
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
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

      const pointsWin = match.ladderId === 'duo-trio' ? 25 : 30;
      const pointsLoss = match.ladderId === 'duo-trio' ? 15 : 20;

      // Mettre à jour le gagnant
      await Squad.findOneAndUpdate(
        { _id: winnerId, 'registeredLadders.ladderId': match.ladderId },
        {
          $inc: {
            'registeredLadders.$.points': pointsWin,
            'registeredLadders.$.wins': 1,
            'stats.wins': 1,
            'stats.totalPoints': pointsWin
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
        const newTotalPoints = Math.max(0, currentTotalPoints - pointsLoss);
        const actualLadderLoss = currentLadderPoints - newLadderPoints;
        const actualTotalLoss = currentTotalPoints - newTotalPoints;

        await Squad.findOneAndUpdate(
          { _id: loserId, 'registeredLadders.ladderId': match.ladderId },
          {
            $inc: {
              'registeredLadders.$.points': -actualLadderLoss,
              'registeredLadders.$.losses': 1,
              'stats.losses': 1,
              'stats.totalPoints': -actualTotalLoss
            }
          }
        );
      }

      // Déterminer les rosters gagnant et perdant
      const isWinnerChallenger = winnerId === match.challenger._id.toString();
      const winnerRoster = isWinnerChallenger ? match.challengerRoster : match.opponentRoster;
      const loserRoster = isWinnerChallenger ? match.opponentRoster : match.challengerRoster;

      // Points individuels à attribuer selon le ladder
      const playerPointsWin = match.ladderId === 'duo-trio' ? 15 : 20;
      const playerPointsLoss = match.ladderId === 'duo-trio' ? 10 : 12;

      // Mettre à jour les stats GLOBALES des joueurs gagnants (depuis le roster)
      if (winnerRoster && winnerRoster.length > 0) {
        for (const rosterEntry of winnerRoster) {
          const playerId = rosterEntry.user?._id || rosterEntry.user;
          if (playerId) {
            await User.findByIdAndUpdate(playerId, {
              $inc: { 
                goldCoins: 50,
                'stats.points': playerPointsWin,
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
            // Récupérer le joueur pour éviter les points négatifs
            const player = await User.findById(playerId);
            if (player) {
              const currentPoints = player.stats?.points || 0;
              const actualLoss = Math.min(playerPointsLoss, currentPoints);
              await User.findByIdAndUpdate(playerId, {
                $inc: { 
                  'stats.points': -actualLoss,
                  'stats.losses': 1
                }
              });
            }
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
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
      .populate('challengerRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('opponentRoster.user', 'username avatarUrl discordAvatar discordId activisionId platform')
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

export default router;
