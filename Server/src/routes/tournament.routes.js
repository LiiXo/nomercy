import express from 'express';
import Tournament from '../models/Tournament.js';
import TournamentMatch from '../models/TournamentMatch.js';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import { verifyToken, requireAdmin, requireArbitre } from '../middleware/auth.middleware.js';
import { sendTournamentLaunchNotification } from '../services/discordBot.service.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all tournaments (public - with filters)
router.get('/', async (req, res) => {
  try {
    const { mode, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (mode) query.mode = mode;
    if (status) {
      query.status = status;
    } else {
      // By default, show only registration and in_progress tournaments
      query.status = { $in: ['registration', 'in_progress'] };
    }
    
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username')
      .populate('participants.squad', 'name tag color logo')
      .populate('participants.user', 'username discordId avatar discordAvatar')
      .sort({ scheduledAt: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await Tournament.countDocuments(query);
    
    res.json({
      success: true,
      tournaments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get upcoming tournaments for dashboard display
router.get('/upcoming', async (req, res) => {
  try {
    const { mode, limit = 5 } = req.query;
    
    const query = {
      status: { $in: ['draft', 'registration', 'pending', 'in_progress'] }
    };
    if (mode) query.mode = mode;
    
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username')
      .select('name type format mode maxParticipants teamSize scheduledAt status streaming prizes participants')
      .sort({ scheduledAt: 1 })
      .limit(parseInt(limit));
    
    // Add participant count without full populate
    const tournamentsWithCount = tournaments.map(t => ({
      ...t.toObject(),
      participantCount: t.participants.length
    }));
    
    res.json({ success: true, tournaments: tournamentsWithCount });
  } catch (error) {
    console.error('Get upcoming tournaments error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get tournament by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id)
      .populate('createdBy', 'username')
      .populate('participants.squad', 'name tag color logo members')
      .populate('participants.user', 'username discordId avatar discordAvatar avatarUrl')
      .populate('winner.squad', 'name tag color logo')
      .populate('formedTeams.members.user', 'username discordId avatar discordAvatar avatarUrl');
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    res.json({ success: true, tournament });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== AUTHENTICATED ROUTES ====================

// Register to tournament (squad or user)
router.post('/:id/register', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { squadId } = req.body;
    const userId = req.user._id;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status !== 'registration') {
      return res.status(400).json({ success: false, message: 'Les inscriptions ne sont pas ouvertes' });
    }
    
    if (tournament.participants.length >= tournament.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Le tournoi est complet' });
    }
    
    // Check registration deadline
    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      return res.status(400).json({ success: false, message: 'La date limite d\'inscription est dépassée' });
    }
    
    if (tournament.type === 'team') {
      // Team tournament - register squad
      if (!squadId) {
        return res.status(400).json({ success: false, message: 'ID de l\'escouade requis' });
      }
      
      const squad = await Squad.findById(squadId).populate('owner', '_id');
      
      if (!squad) {
        return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
      }
      
      // Check if user is owner or officer of the squad
      const isOwner = squad.owner._id.toString() === userId.toString();
      const isOfficer = squad.officers?.some(o => o.toString() === userId.toString());
      
      if (!isOwner && !isOfficer) {
        return res.status(403).json({ success: false, message: 'Seul le propriétaire ou un officier peut inscrire l\'escouade' });
      }
      
      // Check if squad is already registered
      if (tournament.isSquadRegistered(squadId)) {
        return res.status(400).json({ success: false, message: 'L\'escouade est déjà inscrite' });
      }
      
      // Add squad to participants
      tournament.participants.push({
        squad: squadId,
        squadInfo: {
          name: squad.name,
          tag: squad.tag,
          color: squad.color,
          logo: squad.logo
        },
        isBot: false,
        registeredAt: new Date()
      });
    } else {
      // Solo tournament - register user
      if (tournament.isUserRegistered(userId)) {
        return res.status(400).json({ success: false, message: 'Vous êtes déjà inscrit' });
      }
      
      const user = req.user;
      
      tournament.participants.push({
        user: userId,
        userInfo: {
          username: user.username,
          discordId: user.discordId,
          avatar: user.avatar || user.discordAvatar,
          avatarUrl: user.avatarUrl
        },
        isBot: false,
        registeredAt: new Date()
      });
    }
    
    await tournament.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentUpdated', {
        tournamentId: id,
        participantCount: tournament.participants.length
      });
    }
    
    res.json({ success: true, message: 'Inscription réussie', tournament });
  } catch (error) {
    console.error('Register to tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Unregister from tournament
router.delete('/:id/unregister', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { squadId } = req.body;
    const userId = req.user._id;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status !== 'registration') {
      return res.status(400).json({ success: false, message: 'Impossible de se désinscrire après la fin des inscriptions' });
    }
    
    if (tournament.type === 'team') {
      if (!squadId) {
        return res.status(400).json({ success: false, message: 'ID de l\'escouade requis' });
      }
      
      const squad = await Squad.findById(squadId).populate('owner', '_id');
      
      if (!squad) {
        return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
      }
      
      // Check if user is owner or officer of the squad
      const isOwner = squad.owner._id.toString() === userId.toString();
      const isOfficer = squad.officers?.some(o => o.toString() === userId.toString());
      
      if (!isOwner && !isOfficer) {
        return res.status(403).json({ success: false, message: 'Seul le propriétaire ou un officier peut désinscrire l\'escouade' });
      }
      
      tournament.participants = tournament.participants.filter(
        p => !p.squad || p.squad.toString() !== squadId.toString()
      );
    } else {
      tournament.participants = tournament.participants.filter(
        p => !p.user || p.user.toString() !== userId.toString()
      );
    }
    
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentUpdated', {
        tournamentId: id,
        participantCount: tournament.participants.length
      });
    }
    
    res.json({ success: true, message: 'Désinscription réussie' });
  } catch (error) {
    console.error('Unregister from tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all tournaments for admin (includes drafts)
router.get('/admin/all', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { mode, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (mode) query.mode = mode;
    if (status) query.status = status;
    
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await Tournament.countDocuments(query);
    
    res.json({
      success: true,
      tournaments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get tournaments error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create tournament
router.post('/admin/create', verifyToken, requireArbitre, async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      mode,
      format,
      mapSelection,
      maxParticipants,
      teamSize,
      groupSize,
      scheduledAt,
      registrationDeadline,
      streaming,
      prizes
    } = req.body;
    
    // Validation
    if (!name || !type || !mode || !maxParticipants || !scheduledAt) {
      return res.status(400).json({ 
        success: false, 
        message: 'Champs requis manquants' 
      });
    }
    
    const tournament = new Tournament({
      name,
      description: description || '',
      type,
      mode,
      format: format || 'bo1',
      mapSelection: mapSelection || 'random',
      maxParticipants: parseInt(maxParticipants),
      teamSize: teamSize || 4,
      groupSize: groupSize || 4,
      scheduledAt: new Date(scheduledAt),
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      status: 'draft',
      streaming: {
        enabled: streaming?.enabled || false,
        twitchUrl: streaming?.twitchUrl || '',
        streamerName: streaming?.streamerName || '',
        streamerAvatar: streaming?.streamerAvatar || ''
      },
      prizes: {
        gold: {
          enabled: prizes?.gold?.enabled || false,
          first: prizes?.gold?.first || 0,
          second: prizes?.gold?.second || 0,
          third: prizes?.gold?.third || 0
        },
        cashprize: {
          enabled: prizes?.cashprize?.enabled || false,
          total: prizes?.cashprize?.total || 0,
          currency: prizes?.cashprize?.currency || 'EUR',
          first: prizes?.cashprize?.first || 0,
          second: prizes?.cashprize?.second || 0,
          third: prizes?.cashprize?.third || 0
        }
      },
      createdBy: req.user._id
    });
    
    await tournament.save();
    
    res.json({ success: true, tournament, message: 'Tournoi créé avec succès' });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update tournament
router.put('/admin/:id', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    // Don't allow editing completed/cancelled tournaments
    if (['completed', 'cancelled'].includes(tournament.status)) {
      return res.status(400).json({ success: false, message: 'Impossible de modifier un tournoi terminé' });
    }
    
    // Update allowed fields
    const allowedFields = [
      'name', 'description', 'type', 'mode', 'format', 'mapSelection',
      'maxParticipants', 'teamSize', 'groupSize', 'scheduledAt', 'registrationDeadline',
      'status', 'streaming', 'prizes'
    ];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'scheduledAt' || field === 'registrationDeadline') {
          tournament[field] = updateData[field] ? new Date(updateData[field]) : null;
        } else {
          tournament[field] = updateData[field];
        }
      }
    }
    
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentUpdated', { 
        tournamentId: id,
        tournament
      });
    }
    
    res.json({ success: true, tournament, message: 'Tournoi mis à jour' });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete tournament
router.delete('/admin/:id', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    // Don't allow deleting in_progress tournaments
    if (tournament.status === 'in_progress') {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer un tournoi en cours' });
    }
    
    await Tournament.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Tournoi supprimé' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Fill tournament with bots (ADMIN ONLY)
router.post('/admin/:id/fill-bots', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status !== 'draft' && tournament.status !== 'registration') {
      return res.status(400).json({ success: false, message: 'Impossible de remplir un tournoi déjà commencé' });
    }
    
    const currentCount = tournament.participants.length;
    const botsNeeded = tournament.maxParticipants - currentCount;
    
    if (botsNeeded <= 0) {
      return res.status(400).json({ success: false, message: 'Le tournoi est déjà complet' });
    }
    
    // Generate bot names
    const botNames = [
      'Alpha Team', 'Beta Squad', 'Gamma Force', 'Delta Unit', 'Epsilon Corps',
      'Zeta Brigade', 'Eta Division', 'Theta Legion', 'Iota Battalion', 'Kappa Regiment',
      'Lambda Crew', 'Mu Warriors', 'Nu Fighters', 'Xi Champions', 'Omicron Elite',
      'Pi Masters', 'Rho Legends', 'Sigma Heroes', 'Tau Titans', 'Upsilon Victors',
      'Phi Guardians', 'Chi Strikers', 'Psi Hunters', 'Omega Destroyers', 'Prime Force',
      'Storm Raiders', 'Night Hawks', 'Thunder Wolves', 'Iron Eagles', 'Steel Panthers',
      'Fire Dragons', 'Ice Bears', 'Shadow Foxes', 'Golden Lions', 'Silver Sharks'
    ];
    
    const soloNames = [
      'Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta', 'Bot_Epsilon',
      'Bot_Zeta', 'Bot_Eta', 'Bot_Theta', 'Bot_Iota', 'Bot_Kappa',
      'Bot_Lambda', 'Bot_Mu', 'Bot_Nu', 'Bot_Xi', 'Bot_Omicron',
      'Bot_Pi', 'Bot_Rho', 'Bot_Sigma', 'Bot_Tau', 'Bot_Upsilon',
      'TestPlayer_1', 'TestPlayer_2', 'TestPlayer_3', 'TestPlayer_4', 'TestPlayer_5',
      'DemoUser_1', 'DemoUser_2', 'DemoUser_3', 'DemoUser_4', 'DemoUser_5'
    ];
    
    for (let i = 0; i < botsNeeded; i++) {
      if (tournament.type === 'team') {
        const botName = botNames[i % botNames.length] + (i >= botNames.length ? ` ${Math.floor(i / botNames.length) + 1}` : '');
        tournament.participants.push({
          squad: null,
          squadInfo: {
            name: botName,
            tag: `BOT${i + 1}`,
            color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
            logo: null
          },
          isBot: true,
          botName: botName,
          registeredAt: new Date()
        });
      } else {
        const botName = soloNames[i % soloNames.length] + (i >= soloNames.length ? `_${Math.floor(i / soloNames.length) + 1}` : '');
        tournament.participants.push({
          user: null,
          userInfo: {
            username: botName,
            discordId: null,
            avatar: null
          },
          isBot: true,
          botName: botName,
          registeredAt: new Date()
        });
      }
    }
    
    await tournament.save();
    
    res.json({ 
      success: true, 
      message: `${botsNeeded} bots ajoutés au tournoi`,
      tournament
    });
  } catch (error) {
    console.error('Fill bots error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Remove all bots from tournament (ADMIN ONLY)
router.post('/admin/:id/clear-bots', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status === 'in_progress' || tournament.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Impossible de modifier un tournoi en cours ou terminé' });
    }
    
    const botCount = tournament.participants.filter(p => p.isBot).length;
    tournament.participants = tournament.participants.filter(p => !p.isBot);
    
    await tournament.save();
    
    res.json({ 
      success: true, 
      message: `${botCount} bots supprimés du tournoi`,
      tournament
    });
  } catch (error) {
    console.error('Clear bots error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Generate bracket and start tournament
router.post('/admin/:id/start', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id)
      .populate('participants.squad', 'name tag color logo')
      .populate('participants.user', 'username discordId avatar discordAvatar avatarUrl');
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status === 'in_progress' || tournament.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Le tournoi est déjà commencé ou terminé' });
    }
    
    if (tournament.participants.length < 2) {
      return res.status(400).json({ success: false, message: 'Il faut au moins 2 participants' });
    }
    
    // For solo tournaments, form teams first
    if (tournament.type === 'solo') {
      const participants = [...tournament.participants];
      // Shuffle participants
      for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
      }
      
      // Form teams
      tournament.formedTeams = [];
      const teamSize = tournament.teamSize || 4;
      let teamNumber = 1;
      
      for (let i = 0; i < participants.length; i += teamSize) {
        const teamMembers = participants.slice(i, i + teamSize);
        tournament.formedTeams.push({
          name: `Équipe ${teamNumber}`,
          members: teamMembers.map(p => ({
            user: p.user,
            userInfo: p.userInfo,
            isBot: p.isBot,
            botName: p.botName
          }))
        });
        teamNumber++;
      }
    }
    
    // Generate bracket
    tournament.generateBracket();
    
    // Update status
    tournament.status = 'in_progress';
    
    await tournament.save();
    
    // Create TournamentMatch documents for Round 1
    const round1 = tournament.bracket.find(r => r.round === 1);
    const createdMatches = [];
    
    if (round1 && round1.matches) {
      for (const match of round1.matches) {
        const p1Index = match.participant1?.index;
        const p2Index = match.participant2?.index;
        
        // Get participant data
        const p1Data = p1Index !== null ? tournament.participants[p1Index] : null;
        const p2Data = p2Index !== null ? tournament.participants[p2Index] : null;
        
        // Skip if both are null (shouldn't happen)
        if (!p1Data && !p2Data) continue;
        
        // Check if it's a bye (only one participant)
        const isBye = !p1Data || !p2Data;
        const isBotMatch = (p1Data?.isBot && p2Data?.isBot);
        const hasBot = p1Data?.isBot || p2Data?.isBot;
        
        const tournamentMatch = new TournamentMatch({
          tournament: tournament._id,
          round: 1,
          roundName: round1.roundName,
          matchNumber: match.matchNumber,
          format: tournament.format,
          mode: tournament.mode,
          teamSize: tournament.teamSize,
          participant1: p1Data ? {
            squad: tournament.type === 'team' ? p1Data.squad : null,
            squadInfo: tournament.type === 'team' ? p1Data.squadInfo : null,
            user: tournament.type === 'solo' ? p1Data.user : null,
            userInfo: tournament.type === 'solo' ? p1Data.userInfo : null,
            isBot: p1Data.isBot || false,
            botName: p1Data.botName || null,
            participantIndex: p1Index
          } : {
            isBot: false,
            participantIndex: null
          },
          participant2: p2Data ? {
            squad: tournament.type === 'team' ? p2Data.squad : null,
            squadInfo: tournament.type === 'team' ? p2Data.squadInfo : null,
            user: tournament.type === 'solo' ? p2Data.user : null,
            userInfo: tournament.type === 'solo' ? p2Data.userInfo : null,
            isBot: p2Data.isBot || false,
            botName: p2Data.botName || null,
            participantIndex: p2Index
          } : {
            isBot: false,
            participantIndex: null
          },
          status: isBye ? 'completed' : (isBotMatch ? 'completed' : 'ready'),
          scheduledAt: tournament.scheduledAt
        });
        
        // Auto-complete bye matches
        if (isBye) {
          if (p1Data && !p2Data) {
            tournamentMatch.winner = 'participant1';
            tournamentMatch.winnerIndex = p1Index;
            tournamentMatch.participant1.score = 1;
            tournamentMatch.completedAt = new Date();
          } else if (p2Data && !p1Data) {
            tournamentMatch.winner = 'participant2';
            tournamentMatch.winnerIndex = p2Index;
            tournamentMatch.participant2.score = 1;
            tournamentMatch.completedAt = new Date();
          }
        }
        
        // Auto-complete bot vs bot matches (random winner)
        if (isBotMatch) {
          const randomWinner = Math.random() < 0.5 ? 'participant1' : 'participant2';
          tournamentMatch.winner = randomWinner;
          tournamentMatch.winnerIndex = randomWinner === 'participant1' ? p1Index : p2Index;
          tournamentMatch[randomWinner].score = 2;
          tournamentMatch[randomWinner === 'participant1' ? 'participant2' : 'participant1'].score = Math.floor(Math.random() * 2);
          tournamentMatch.completedAt = new Date();
        }
        
        // Auto-complete matches with one bot (bot loses)
        if (hasBot && !isBotMatch && !isBye) {
          const botIsP1 = p1Data?.isBot;
          const realWinner = botIsP1 ? 'participant2' : 'participant1';
          tournamentMatch.winner = realWinner;
          tournamentMatch.winnerIndex = realWinner === 'participant1' ? p1Index : p2Index;
          tournamentMatch[realWinner].score = 2;
          tournamentMatch[realWinner === 'participant1' ? 'participant2' : 'participant1'].score = 0;
          tournamentMatch.status = 'completed';
          tournamentMatch.completedAt = new Date();
        }
        
        await tournamentMatch.save();
        createdMatches.push(tournamentMatch);
      }
    }
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentStarted', { 
        tournamentId: id,
        tournament,
        matches: createdMatches
      });
    }
    
    // Send Discord notification with @everyone mention
    await sendTournamentLaunchNotification(tournament);
    
    res.json({ 
      success: true, 
      message: `Tournoi démarré avec ${createdMatches.length} matchs créés`, 
      tournament,
      matches: createdMatches
    });
  } catch (error) {
    console.error('Start tournament error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Open registration
router.post('/admin/:id/open-registration', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Le tournoi doit être en brouillon' });
    }
    
    tournament.status = 'registration';
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('tournamentCreated', { tournament });
    }
    
    res.json({ success: true, message: 'Inscriptions ouvertes', tournament });
  } catch (error) {
    console.error('Open registration error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Cancel tournament
router.post('/admin/:id/cancel', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status === 'completed' || tournament.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Le tournoi est déjà terminé ou annulé' });
    }
    
    tournament.status = 'cancelled';
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentCancelled', { tournamentId: id });
    }
    
    res.json({ success: true, message: 'Tournoi annulé', tournament });
  } catch (error) {
    console.error('Cancel tournament error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update match result
router.post('/admin/:id/match-result', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    const { round, matchNumber, score1, score2, winnerId } = req.body;
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Le tournoi n\'est pas en cours' });
    }
    
    // Find the round and match
    const roundData = tournament.bracket.find(r => r.round === round);
    if (!roundData) {
      return res.status(404).json({ success: false, message: 'Round non trouvé' });
    }
    
    const match = roundData.matches.find(m => m.matchNumber === matchNumber);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Update scores
    match.participant1.score = score1;
    match.participant2.score = score2;
    match.winner = winnerId;
    match.status = 'completed';
    match.completedAt = new Date();
    
    // Advance winner to next round
    const nextRoundIndex = tournament.bracket.findIndex(r => r.round === round + 1);
    if (nextRoundIndex !== -1) {
      const nextRound = tournament.bracket[nextRoundIndex];
      const nextMatchIndex = Math.floor((matchNumber - 1) / 2);
      const nextMatch = nextRound.matches[nextMatchIndex];
      
      if (nextMatch) {
        if ((matchNumber - 1) % 2 === 0) {
          nextMatch.participant1.index = winnerId;
        } else {
          nextMatch.participant2.index = winnerId;
        }
      }
    } else {
      // This was the finals - set tournament winner
      if (tournament.type === 'team') {
        const winnerParticipant = tournament.participants[winnerId];
        if (winnerParticipant) {
          tournament.winner = {
            squad: winnerParticipant.squad,
            squadInfo: winnerParticipant.squadInfo
          };
        }
      } else {
        tournament.winner = {
          formedTeamIndex: winnerId
        };
      }
      tournament.status = 'completed';
    }
    
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('bracketUpdated', { 
        tournamentId: id,
        bracket: tournament.bracket,
        status: tournament.status,
        winner: tournament.winner
      });
    }
    
    res.json({ success: true, message: 'Résultat enregistré', tournament });
  } catch (error) {
    console.error('Update match result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== TOURNAMENT MATCH ROUTES ====================

// Get all matches for a tournament
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const { round, status } = req.query;
    
    const query = { tournament: id };
    if (round) query.round = parseInt(round);
    if (status) query.status = status;
    
    const matches = await TournamentMatch.find(query)
      .populate('participant1.squad', 'name tag color logo')
      .populate('participant2.squad', 'name tag color logo')
      .populate('participant1.user', 'username discordId avatar avatarUrl')
      .populate('participant2.user', 'username discordId avatar avatarUrl')
      .sort({ round: 1, matchNumber: 1 });
    
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Get tournament matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get a specific match
router.get('/:id/matches/:matchId', async (req, res) => {
  try {
    const { id, matchId } = req.params;
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: id })
      .populate('participant1.squad', 'name tag color logo members')
      .populate('participant2.squad', 'name tag color logo members')
      .populate('participant1.user', 'username discordId avatar avatarUrl')
      .populate('participant2.user', 'username discordId avatar avatarUrl')
      .populate('chat.sender', 'username avatar');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Get tournament match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Claim victory (by participant)
router.post('/:id/matches/:matchId/claim-victory', verifyToken, async (req, res) => {
  try {
    const { id, matchId } = req.params;
    const userId = req.user._id;
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: id });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Le match est déjà terminé' });
    }
    
    // Determine which participant the user belongs to
    let userParticipant = null;
    
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.type === 'team') {
      // Check if user is in squad 1 or squad 2
      const squad1 = await Squad.findById(match.participant1.squad);
      const squad2 = await Squad.findById(match.participant2.squad);
      
      if (squad1 && (squad1.owner.toString() === userId.toString() || squad1.officers?.includes(userId))) {
        userParticipant = 'participant1';
      } else if (squad2 && (squad2.owner.toString() === userId.toString() || squad2.officers?.includes(userId))) {
        userParticipant = 'participant2';
      }
    } else {
      // Solo - check if user is participant
      if (match.participant1.user?.toString() === userId.toString()) {
        userParticipant = 'participant1';
      } else if (match.participant2.user?.toString() === userId.toString()) {
        userParticipant = 'participant2';
      }
    }
    
    if (!userParticipant) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas participant de ce match' });
    }
    
    // Set victory claim
    match[userParticipant].claimedVictory = true;
    match[userParticipant].claimedAt = new Date();
    match.status = 'awaiting_confirmation';
    
    // Check if both claimed victory for themselves (conflict)
    const otherParticipant = userParticipant === 'participant1' ? 'participant2' : 'participant1';
    
    if (match[otherParticipant].claimedVictory) {
      // Both claim victory - dispute
      match.status = 'disputed';
      match.dispute = {
        reportedAt: new Date(),
        reason: 'Les deux équipes revendiquent la victoire'
      };
      
      await match.save();
      
      return res.json({ 
        success: true, 
        message: 'Conflit détecté - les deux équipes revendiquent la victoire. Un arbitre doit trancher.',
        match,
        conflict: true
      });
    }
    
    await match.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-match-${matchId}`).emit('victoryClaimed', {
        matchId,
        claimedBy: userParticipant,
        waitingFor: otherParticipant
      });
    }
    
    res.json({ 
      success: true, 
      message: `Victoire revendiquée. En attente de confirmation de l'adversaire.`,
      match,
      waitingFor: otherParticipant
    });
  } catch (error) {
    console.error('Claim victory error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Confirm opponent's victory (accept defeat)
router.post('/:id/matches/:matchId/confirm-defeat', verifyToken, async (req, res) => {
  try {
    const { id, matchId } = req.params;
    const userId = req.user._id;
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: id });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Le match est déjà terminé' });
    }
    
    // Determine which participant the user belongs to
    let userParticipant = null;
    
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    if (tournament.type === 'team') {
      const squad1 = await Squad.findById(match.participant1.squad);
      const squad2 = await Squad.findById(match.participant2.squad);
      
      if (squad1 && (squad1.owner.toString() === userId.toString() || squad1.officers?.includes(userId))) {
        userParticipant = 'participant1';
      } else if (squad2 && (squad2.owner.toString() === userId.toString() || squad2.officers?.includes(userId))) {
        userParticipant = 'participant2';
      }
    } else {
      if (match.participant1.user?.toString() === userId.toString()) {
        userParticipant = 'participant1';
      } else if (match.participant2.user?.toString() === userId.toString()) {
        userParticipant = 'participant2';
      }
    }
    
    if (!userParticipant) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas participant de ce match' });
    }
    
    const otherParticipant = userParticipant === 'participant1' ? 'participant2' : 'participant1';
    
    // Check if opponent claimed victory
    if (!match[otherParticipant].claimedVictory) {
      return res.status(400).json({ success: false, message: 'L\'adversaire n\'a pas encore revendiqué la victoire' });
    }
    
    // Complete the match
    match.winner = otherParticipant;
    match.winnerIndex = match[otherParticipant].participantIndex;
    match[otherParticipant].score = 2;
    match[userParticipant].score = 0;
    match.status = 'completed';
    match.completedAt = new Date();
    
    await match.save();
    
    // Advance winner to next round
    await advanceWinnerToNextRound(id, match, tournament);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-match-${matchId}`).emit('matchCompleted', { match });
      io.to(`tournament-${id}`).emit('bracketUpdated', { tournamentId: id });
    }
    
    res.json({ 
      success: true, 
      message: 'Match terminé',
      match
    });
  } catch (error) {
    console.error('Confirm defeat error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin: Force match result
router.post('/admin/:id/matches/:matchId/force-result', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id, matchId } = req.params;
    const { winner, score1, score2 } = req.body;
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: id });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    // Set result
    match.winner = winner; // 'participant1' or 'participant2'
    match.winnerIndex = match[winner].participantIndex;
    match.participant1.score = score1 || (winner === 'participant1' ? 2 : 0);
    match.participant2.score = score2 || (winner === 'participant2' ? 2 : 0);
    match.status = 'completed';
    match.completedAt = new Date();
    
    await match.save();
    
    // Advance winner to next round
    await advanceWinnerToNextRound(id, match, tournament);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-match-${matchId}`).emit('matchCompleted', { match });
      io.to(`tournament-${id}`).emit('bracketUpdated', { tournamentId: id });
    }
    
    res.json({ 
      success: true, 
      message: 'Résultat forcé',
      match
    });
  } catch (error) {
    console.error('Force match result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to advance winner to next round and create next round matches
async function advanceWinnerToNextRound(tournamentId, completedMatch, tournament) {
  const currentRound = completedMatch.round;
  const nextRound = currentRound + 1;
  
  // Update tournament bracket
  const roundData = tournament.bracket.find(r => r.round === currentRound);
  if (roundData) {
    const bracketMatch = roundData.matches.find(m => m.matchNumber === completedMatch.matchNumber);
    if (bracketMatch) {
      bracketMatch.participant1.score = completedMatch.participant1.score;
      bracketMatch.participant2.score = completedMatch.participant2.score;
      bracketMatch.winner = completedMatch.winnerIndex;
      bracketMatch.status = 'completed';
    }
  }
  
  // Check if all matches in current round are completed
  const currentRoundMatches = await TournamentMatch.find({ 
    tournament: tournamentId, 
    round: currentRound 
  });
  
  const allCompleted = currentRoundMatches.every(m => m.status === 'completed');
  
  if (allCompleted) {
    // Check if there's a next round in the bracket
    const nextRoundData = tournament.bracket.find(r => r.round === nextRound);
    
    if (nextRoundData) {
      // Create next round matches
      for (const bracketMatch of nextRoundData.matches) {
        // Find the two matches from previous round that feed into this match
        const prevMatchNum1 = (bracketMatch.matchNumber - 1) * 2 + 1;
        const prevMatchNum2 = (bracketMatch.matchNumber - 1) * 2 + 2;
        
        const prevMatch1 = currentRoundMatches.find(m => m.matchNumber === prevMatchNum1);
        const prevMatch2 = currentRoundMatches.find(m => m.matchNumber === prevMatchNum2);
        
        const winner1 = prevMatch1?.winner;
        const winner2 = prevMatch2?.winner;
        
        const p1Index = prevMatch1?.winnerIndex;
        const p2Index = prevMatch2?.winnerIndex;
        
        const p1Data = p1Index !== null && p1Index !== undefined ? tournament.participants[p1Index] : null;
        const p2Data = p2Index !== null && p2Index !== undefined ? tournament.participants[p2Index] : null;
        
        const isBotMatch = (p1Data?.isBot && p2Data?.isBot);
        const hasBot = p1Data?.isBot || p2Data?.isBot;
        
        const newMatch = new TournamentMatch({
          tournament: tournamentId,
          round: nextRound,
          roundName: nextRoundData.roundName,
          matchNumber: bracketMatch.matchNumber,
          format: tournament.format,
          mode: tournament.mode,
          teamSize: tournament.teamSize,
          participant1: p1Data ? {
            squad: tournament.type === 'team' ? p1Data.squad : null,
            squadInfo: tournament.type === 'team' ? p1Data.squadInfo : null,
            user: tournament.type === 'solo' ? p1Data.user : null,
            userInfo: tournament.type === 'solo' ? p1Data.userInfo : null,
            isBot: p1Data.isBot || false,
            botName: p1Data.botName || null,
            participantIndex: p1Index
          } : { isBot: false, participantIndex: null },
          participant2: p2Data ? {
            squad: tournament.type === 'team' ? p2Data.squad : null,
            squadInfo: tournament.type === 'team' ? p2Data.squadInfo : null,
            user: tournament.type === 'solo' ? p2Data.user : null,
            userInfo: tournament.type === 'solo' ? p2Data.userInfo : null,
            isBot: p2Data.isBot || false,
            botName: p2Data.botName || null,
            participantIndex: p2Index
          } : { isBot: false, participantIndex: null },
          status: isBotMatch ? 'completed' : 'ready',
          scheduledAt: tournament.scheduledAt
        });
        
        // Auto-complete bot vs bot matches
        if (isBotMatch) {
          const randomWinner = Math.random() < 0.5 ? 'participant1' : 'participant2';
          newMatch.winner = randomWinner;
          newMatch.winnerIndex = randomWinner === 'participant1' ? p1Index : p2Index;
          newMatch[randomWinner].score = 2;
          newMatch.completedAt = new Date();
        }
        
        // Auto-complete matches with one bot (bot loses)
        if (hasBot && !isBotMatch) {
          const botIsP1 = p1Data?.isBot;
          const realWinner = botIsP1 ? 'participant2' : 'participant1';
          newMatch.winner = realWinner;
          newMatch.winnerIndex = realWinner === 'participant1' ? p1Index : p2Index;
          newMatch[realWinner].score = 2;
          newMatch.status = 'completed';
          newMatch.completedAt = new Date();
        }
        
        // Update bracket
        bracketMatch.participant1.index = p1Index;
        bracketMatch.participant2.index = p2Index;
        
        await newMatch.save();
      }
    } else {
      // No next round - this was the finals, tournament is complete
      const finalMatch = currentRoundMatches.find(m => m.status === 'completed');
      if (finalMatch && finalMatch.winnerIndex !== null) {
        const winnerParticipant = tournament.participants[finalMatch.winnerIndex];
        if (tournament.type === 'team' && winnerParticipant) {
          tournament.winner = {
            squad: winnerParticipant.squad,
            squadInfo: winnerParticipant.squadInfo
          };
        } else {
          tournament.winner = {
            formedTeamIndex: finalMatch.winnerIndex
          };
        }
        tournament.status = 'completed';
      }
    }
  }
  
  await tournament.save();
}

export default router;
