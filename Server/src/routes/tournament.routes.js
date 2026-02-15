import express from 'express';
import Tournament from '../models/Tournament.js';
import TournamentMatch from '../models/TournamentMatch.js';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import Map from '../models/Map.js';
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
      .select('name type format mode maxParticipants teamSize scheduledAt status streaming prizes participants logo banner game customGame entryFee')
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
      .populate('participants.user', 'username discordId avatar discordAvatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('winner.squad', 'name tag color logo')
      .populate('formedTeams.members.user', 'username discordId avatar discordAvatar avatarUrl platform irisConnected ggSecureConnected');
    
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
      
      const squad = await Squad.findById(squadId)
        .populate('owner', '_id')
        .populate('members.user', 'username discordId avatar discordAvatar avatarUrl platform irisConnected ggSecureConnected');
      
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
      
      // Build roster with platform info
      const roster = squad.members?.map(m => ({
        odUserId: m.user?._id,
        username: m.user?.username || 'Unknown',
        discordId: m.user?.discordId,
        avatarUrl: m.user?.avatarUrl || m.user?.discordAvatar || m.user?.avatar,
        platform: m.user?.platform || null,
        irisConnected: m.user?.irisConnected || false,
        ggSecureConnected: m.user?.ggSecureConnected || false,
        role: m.role
      })) || [];
      
      // Add squad to participants with roster
      tournament.participants.push({
        squad: squadId,
        squadInfo: {
          name: squad.name,
          tag: squad.tag,
          color: squad.color,
          logo: squad.logo,
          members: roster
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
          avatarUrl: user.avatarUrl,
          platform: user.platform || null,
          irisConnected: user.irisConnected || false,
          ggSecureConnected: user.ggSecureConnected || false
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
      game,
      customGame,
      logo,
      banner,
      format,
      mapSelection,
      maxParticipants,
      teamSize,
      groupSize,
      scheduledAt,
      registrationDeadline,
      streaming,
      prizes,
      entryFee
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
      game: game || 'cod_bo7',
      customGame: customGame || '',
      logo: logo || '',
      banner: banner || '',
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
      entryFee: {
        enabled: entryFee?.enabled || false,
        type: entryFee?.type || 'gold',
        amount: entryFee?.amount || 0,
        currency: entryFee?.currency || 'EUR'
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
      'name', 'description', 'type', 'mode', 'game', 'customGame', 'logo', 'banner', 'format', 'mapSelection',
      'maxParticipants', 'teamSize', 'groupSize', 'scheduledAt', 'registrationDeadline',
      'status', 'streaming', 'prizes', 'entryFee'
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
    
    // Realistic bot profiles for team tournaments
    const botTeamProfiles = [
      { name: 'Phoenix Rising', tag: 'PHX', color: '#FF4500' },
      { name: 'Shadow Wolves', tag: 'SWLF', color: '#1E1E1E' },
      { name: 'Arctic Storm', tag: 'ARCT', color: '#00CED1' },
      { name: 'Crimson Elite', tag: 'CRMS', color: '#DC143C' },
      { name: 'Thunder Strike', tag: 'THDR', color: '#FFD700' },
      { name: 'Midnight Ravens', tag: 'RAVN', color: '#191970' },
      { name: 'Solar Flare', tag: 'SOLR', color: '#FF8C00' },
      { name: 'Frost Giants', tag: 'FRST', color: '#87CEEB' },
      { name: 'Venom Squad', tag: 'VENM', color: '#32CD32' },
      { name: 'Inferno Legion', tag: 'INFN', color: '#FF6347' },
      { name: 'Night Stalkers', tag: 'NGHT', color: '#2F4F4F' },
      { name: 'Dragon Force', tag: 'DRGN', color: '#8B0000' },
      { name: 'Steel Titans', tag: 'STTL', color: '#708090' },
      { name: 'Golden Eagles', tag: 'GLDE', color: '#DAA520' },
      { name: 'Cyber Ninjas', tag: 'CYBR', color: '#00FF7F' },
      { name: 'Blood Hawks', tag: 'BLHK', color: '#8B0000' },
      { name: 'Ice Breakers', tag: 'ICEB', color: '#ADD8E6' },
      { name: 'Dark Knights', tag: 'DKNT', color: '#36454F' },
      { name: 'Royal Guards', tag: 'ROYL', color: '#4169E1' },
      { name: 'Savage Beasts', tag: 'SVGE', color: '#8B4513' },
      { name: 'Neon Vipers', tag: 'NEON', color: '#FF1493' },
      { name: 'Ghost Protocol', tag: 'GHST', color: '#778899' },
      { name: 'Apex Predators', tag: 'APEX', color: '#FF4500' },
      { name: 'Omega Force', tag: 'OMGA', color: '#9400D3' },
      { name: 'War Machine', tag: 'WRMN', color: '#696969' },
      { name: 'Lethal Injection', tag: 'LTHL', color: '#00FF00' },
      { name: 'Death Dealers', tag: 'DETH', color: '#000000' },
      { name: 'Chaos Theory', tag: 'CAOS', color: '#FF00FF' },
      { name: 'Silent Assassins', tag: 'SLNT', color: '#2F2F2F' },
      { name: 'Rogue Squadron', tag: 'ROGUE', color: '#B22222' },
      { name: 'Zero Gravity', tag: 'ZERO', color: '#7B68EE' },
      { name: 'Velocity Kings', tag: 'VLCT', color: '#1E90FF' }
    ];
    
    // Realistic bot profiles for solo tournaments (gamer tags style)
    const botSoloProfiles = [
      { username: 'xX_DarkLord_Xx', avatar: 1 },
      { username: 'ShadowHunter99', avatar: 2 },
      { username: 'NoScope_King', avatar: 3 },
      { username: 'EliteSniper_FR', avatar: 4 },
      { username: 'CrypticWolf', avatar: 5 },
      { username: 'BlazeMaster420', avatar: 6 },
      { username: 'NightmareFuel', avatar: 7 },
      { username: 'QuickSilver_', avatar: 8 },
      { username: 'ToxicRage', avatar: 1 },
      { username: 'VenomStrike', avatar: 2 },
      { username: 'GhostRider_X', avatar: 3 },
      { username: 'DeathWish666', avatar: 4 },
      { username: 'StormBringer_', avatar: 5 },
      { username: 'FrostByte', avatar: 6 },
      { username: 'ChaosMaker', avatar: 7 },
      { username: 'SilentKiller_', avatar: 8 },
      { username: 'HellRaiser_FR', avatar: 1 },
      { username: 'ThunderGod_', avatar: 2 },
      { username: 'PhantomX', avatar: 3 },
      { username: 'BloodRaven', avatar: 4 },
      { username: 'IceKing_22', avatar: 5 },
      { username: 'FireStorm_', avatar: 6 },
      { username: 'DarkKnight_X', avatar: 7 },
      { username: 'ViperAce', avatar: 8 },
      { username: 'WraithHunter', avatar: 1 },
      { username: 'CyberPunk_', avatar: 2 },
      { username: 'NeonSamurai', avatar: 3 },
      { username: 'ZeroHero', avatar: 4 },
      { username: 'ApexLegend', avatar: 5 },
      { username: 'RogueAgent_', avatar: 6 },
      { username: 'SavageMode', avatar: 7 },
      { username: 'EliteForce_FR', avatar: 8 },
      { username: 'xX_Sniper_Xx', avatar: 1 },
      { username: 'ProGamer_99', avatar: 2 },
      { username: 'HeadshotKing', avatar: 3 },
      { username: 'QuickDraw_', avatar: 4 },
      { username: 'BulletProof', avatar: 5 },
      { username: 'TriggerHappy_', avatar: 6 },
      { username: 'AimBot_Pro', avatar: 7 },
      { username: 'ClutchMaster', avatar: 8 },
      { username: 'FragHunter', avatar: 1 },
      { username: 'SprayNPray', avatar: 2 },
      { username: 'OneShot_', avatar: 3 },
      { username: 'PredatorX', avatar: 4 },
      { username: 'WildCard_FR', avatar: 5 },
      { username: 'NinjaStyle_', avatar: 6 },
      { username: 'FlashBang_', avatar: 7 },
      { username: 'SmokeScreen', avatar: 8 }
    ];
    
    // Generate random avatar color for team logos
    const generateTeamLogoUrl = (color) => {
      // Use a simple SVG data URL for team logo placeholder
      const cleanColor = color.replace('#', '');
      return `https://ui-avatars.com/api/?name=T&background=${cleanColor}&color=fff&size=128&bold=true`;
    };
    
    // Generate avatar URL for solo players (using numbered avatars from public folder)
    const generatePlayerAvatarUrl = (avatarNum) => {
      return `/${avatarNum}.png`; // Uses the numbered images in public folder
    };
    
    for (let i = 0; i < botsNeeded; i++) {
      if (tournament.type === 'team') {
        const profile = botTeamProfiles[i % botTeamProfiles.length];
        const suffix = i >= botTeamProfiles.length ? ` ${Math.floor(i / botTeamProfiles.length) + 1}` : '';
        const botName = profile.name + suffix;
        const botTag = profile.tag + (suffix ? Math.floor(i / botTeamProfiles.length) + 1 : '');
        
        tournament.participants.push({
          squad: null,
          squadInfo: {
            name: botName,
            tag: botTag,
            color: profile.color,
            logo: generateTeamLogoUrl(profile.color)
          },
          isBot: true,
          botName: botName,
          registeredAt: new Date()
        });
      } else {
        const profile = botSoloProfiles[i % botSoloProfiles.length];
        const suffix = i >= botSoloProfiles.length ? `_${Math.floor(i / botSoloProfiles.length) + 1}` : '';
        const botUsername = profile.username + suffix;
        
        tournament.participants.push({
          user: null,
          userInfo: {
            username: botUsername,
            discordId: null,
            avatar: null,
            avatarUrl: generatePlayerAvatarUrl(profile.avatar)
          },
          isBot: true,
          botName: botUsername,
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
    
    console.log(`[Tournament Start] Type: ${tournament.type}, Participants: ${tournament.participants.length}, TeamSize: ${tournament.teamSize}`);
    
    // For solo tournaments, form teams first
    if (tournament.type === 'solo') {
      const participants = [...tournament.participants];
      // Shuffle participants
      for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
      }
      
      // Random team name generator - unique names for each team
      const teamNamePrefixes = [
        'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Ghost', 'Havoc',
        'Iron', 'Jade', 'Kilo', 'Lima', 'Maverick', 'Nova', 'Omega', 'Phoenix',
        'Quantum', 'Raven', 'Shadow', 'Titan', 'Ultra', 'Venom', 'Wolf', 'X-Ray',
        'Yankee', 'Zulu', 'Apex', 'Blitz', 'Cobra', 'Dragon', 'Elite', 'Fury',
        'Gamma', 'Hunter', 'Inferno', 'Joker', 'Kraken', 'Legion', 'Mystic', 'Nexus',
        'Onyx', 'Phantom', 'Quicksilver', 'Reaper', 'Storm', 'Thunder', 'Viper', 'Warlock',
        'Zenith', 'Bolt', 'Cyber', 'Doom', 'Ember', 'Frost', 'Grizzly', 'Hawk',
        'Ice', 'Jaguar', 'Knight', 'Lynx', 'Meteor', 'Night', 'Oracle', 'Panther'
      ];
      
      const teamNameSuffixes = [
        'Squad', 'Force', 'Team', 'Crew', 'Pack', 'Unit', 'Gang', 'Clan',
        'Brigade', 'Legion', 'Corps', 'Division', 'Alliance', 'Order', 'Guild', 'Syndicate'
      ];
      
      // Shuffle prefixes to ensure uniqueness
      const shuffledPrefixes = [...teamNamePrefixes];
      for (let i = shuffledPrefixes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPrefixes[i], shuffledPrefixes[j]] = [shuffledPrefixes[j], shuffledPrefixes[i]];
      }
      
      // Form teams with unique random names
      tournament.formedTeams = [];
      const teamSize = tournament.teamSize || 4;
      const numTeams = Math.ceil(participants.length / teamSize);
      
      for (let i = 0; i < participants.length; i += teamSize) {
        const teamMembers = participants.slice(i, i + teamSize);
        const teamIndex = Math.floor(i / teamSize);
        
        // Generate unique team name
        const prefix = shuffledPrefixes[teamIndex % shuffledPrefixes.length];
        const suffix = teamNameSuffixes[Math.floor(Math.random() * teamNameSuffixes.length)];
        const teamName = `${prefix} ${suffix}`;
        
        tournament.formedTeams.push({
          name: teamName,
          members: teamMembers.map(p => ({
            user: p.user,
            userInfo: p.userInfo,
            isBot: p.isBot,
            botName: p.botName
          }))
        });
      }
      
      console.log(`[Tournament Start] Formed ${tournament.formedTeams.length} teams for solo tournament`);
    }
    
    // Generate bracket
    console.log(`[Tournament Start] Generating bracket...`);
    const bracketResult = tournament.generateBracket();
    console.log(`[Tournament Start] Bracket generated: ${tournament.bracket?.length} rounds, hasGroupStage: ${tournament.hasGroupStage}`);
    
    // Update status
    tournament.status = 'in_progress';
    
    await tournament.save();
    
    // Create TournamentMatch documents for Round 1
    const round1 = tournament.bracket.find(r => r.round === 1);
    const createdMatches = [];
    
    // Fetch available maps for this tournament
    const formatString = `${tournament.teamSize}v${tournament.teamSize}`;
    const availableMaps = await Map.findForTournament(
      tournament.mode,
      null, // gameMode - any
      formatString,
      tournament.type
    );
    console.log(`[Tournament Start] Found ${availableMaps.length} available maps for mode=${tournament.mode}, format=${formatString}, type=${tournament.type}`);
    
    // Generate seeded random maps for all rounds (same algorithm as client)
    // This ensures the maps shown below rounds match the maps assigned to matches
    const mapCount = tournament.format === 'bo1' ? 1 : 3;
    const totalRounds = tournament.bracket.length;
    const totalMapsNeeded = mapCount * totalRounds;
    
    // Use seed based on tournament ID for consistency (same as client)
    const seedString = `${tournament._id}-maps`;
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
      seed = seed & seed;
    }
    seed = Math.abs(seed);
    
    // Seeded random function
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    // Shuffle all maps with seed
    const shuffledMaps = [...availableMaps].sort(() => seededRandom() - 0.5);
    
    // If we don't have enough maps, duplicate the pool
    let mapsPool = [...shuffledMaps];
    if (mapsPool.length < totalMapsNeeded) {
      while (mapsPool.length < totalMapsNeeded) {
        mapsPool = [...mapsPool, ...shuffledMaps];
      }
    }
    
    // Assign maps to each round
    const roundMapsMap = {};
    let mapIndex = 0;
    for (let round = 1; round <= totalRounds; round++) {
      roundMapsMap[round] = mapsPool.slice(mapIndex, mapIndex + mapCount);
      mapIndex += mapCount;
    }
    console.log(`[Tournament Start] Generated maps for ${totalRounds} rounds (${mapCount} map(s) per round)`);
    
    if (round1 && round1.matches) {
      for (const match of round1.matches) {
        const p1Index = match.participant1?.index;
        const p2Index = match.participant2?.index;
        
        // Get participant/team data based on tournament type
        let p1Data, p2Data;
        
        if (tournament.type === 'solo') {
          // For solo tournaments, get from formedTeams
          p1Data = p1Index !== null && p1Index !== undefined ? tournament.formedTeams[p1Index] : null;
          p2Data = p2Index !== null && p2Index !== undefined ? tournament.formedTeams[p2Index] : null;
        } else {
          // For team tournaments, get from participants
          p1Data = p1Index !== null && p1Index !== undefined ? tournament.participants[p1Index] : null;
          p2Data = p2Index !== null && p2Index !== undefined ? tournament.participants[p2Index] : null;
        }
        
        // Skip if both are null (shouldn't happen)
        if (!p1Data && !p2Data) continue;
        
        // Check if it's a bye (only one participant)
        const isBye = !p1Data || !p2Data;
        
        // For solo tournaments, check if all members are bots
        // IMPORTANT: every() on empty array returns true, so we must check length > 0
        let isBotMatch = false;
        let hasBot = false;
        
        if (tournament.type === 'solo') {
          const p1AllBots = (p1Data?.members?.length > 0 && p1Data.members.every(m => m.isBot === true)) || false;
          const p2AllBots = (p2Data?.members?.length > 0 && p2Data.members.every(m => m.isBot === true)) || false;
          isBotMatch = p1AllBots && p2AllBots;
          hasBot = p1AllBots || p2AllBots;
        } else {
          isBotMatch = (p1Data?.isBot === true && p2Data?.isBot === true);
          hasBot = p1Data?.isBot === true || p2Data?.isBot === true;
        }
        
        // Build participant data for the match
        let participant1Data, participant2Data;
        
        if (tournament.type === 'solo') {
          // For solo tournaments, use squadInfo to store formed team info
          participant1Data = p1Data ? {
            squad: null,
            squadInfo: {
              name: p1Data.name,
              tag: null,
              color: '#6366f1', // Indigo color for solo teams
              logo: null
            },
            user: null,
            userInfo: null,
            formedTeamIndex: p1Index,
            formedTeamMembers: p1Data.members,
            isBot: (p1Data.members?.length > 0 && p1Data.members.every(m => m.isBot === true)) || false,
            botName: null,
            participantIndex: p1Index
          } : { isBot: false, participantIndex: null };
          
          participant2Data = p2Data ? {
            squad: null,
            squadInfo: {
              name: p2Data.name,
              tag: null,
              color: '#f43f5e', // Rose color for opponent solo teams
              logo: null
            },
            user: null,
            userInfo: null,
            formedTeamIndex: p2Index,
            formedTeamMembers: p2Data.members,
            isBot: (p2Data.members?.length > 0 && p2Data.members.every(m => m.isBot === true)) || false,
            botName: null,
            participantIndex: p2Index
          } : { isBot: false, participantIndex: null };
        } else {
          // For team tournaments, use existing logic
          participant1Data = p1Data ? {
            squad: p1Data.squad,
            squadInfo: p1Data.squadInfo,
            user: null,
            userInfo: null,
            isBot: p1Data.isBot || false,
            botName: p1Data.botName || null,
            participantIndex: p1Index
          } : { isBot: false, participantIndex: null };
          
          participant2Data = p2Data ? {
            squad: p2Data.squad,
            squadInfo: p2Data.squadInfo,
            user: null,
            userInfo: null,
            isBot: p2Data.isBot || false,
            botName: p2Data.botName || null,
            participantIndex: p2Index
          } : { isBot: false, participantIndex: null };
        }
        
        const tournamentMatch = new TournamentMatch({
          tournament: tournament._id,
          round: 1,
          roundName: round1.roundName,
          matchNumber: match.matchNumber,
          format: tournament.format,
          mode: tournament.mode,
          teamSize: tournament.teamSize,
          participant1: participant1Data,
          participant2: participant2Data,
          // All matches start as in_progress (except byes) - even bot matches need manual validation
          status: isBye ? 'completed' : 'in_progress',
          scheduledAt: tournament.scheduledAt,
          startedAt: isBye ? null : new Date()
        });
        
        // Assign the round's map to this match (using seeded maps for consistency with UI)
        if (!isBye && roundMapsMap[1] && roundMapsMap[1].length > 0) {
          // For round 1, use the first map from round 1's assigned maps
          const roundMap = roundMapsMap[1][0];
          tournamentMatch.selectedMap = {
            name: roundMap.name,
            image: roundMap.image
          };
        }
        
        // For solo tournaments, assign random referent from each team (for all matches, not just non-bot)
        if (tournament.type === 'solo' && !isBye) {
          // Get real (non-bot) members from each team, or use bot members if no real members
          const realMembers1 = p1Data?.members?.filter(m => !m.isBot && m.user) || [];
          const realMembers2 = p2Data?.members?.filter(m => !m.isBot && m.user) || [];
          
          // Assign random referent from real members, or first member if all bots
          if (realMembers1.length > 0) {
            const randomIndex = Math.floor(Math.random() * realMembers1.length);
            tournamentMatch.referent1 = realMembers1[randomIndex].user;
          }
          if (realMembers2.length > 0) {
            const randomIndex = Math.floor(Math.random() * realMembers2.length);
            tournamentMatch.referent2 = realMembers2[randomIndex].user;
          }
        }
        
        // Auto-complete ONLY bye matches (one participant missing)
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
        
        // NOTE: Bot matches are NO LONGER auto-completed
        // All matches (including bot vs bot or bot vs real) require manual validation
        
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

// Reset tournament to a specific status (draft or registration)
router.post('/admin/:id/reset', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetStatus } = req.body;
    
    // Validate target status
    if (!['draft', 'registration'].includes(targetStatus)) {
      return res.status(400).json({ success: false, message: 'Statut cible invalide' });
    }
    
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    // Delete all tournament matches
    await TournamentMatch.deleteMany({ tournament: id });
    
    // Reset bracket
    tournament.bracket = [];
    tournament.hasGroupStage = false;
    tournament.groups = [];
    tournament.winner = null;
    
    // For solo tournaments, clear formed teams
    if (tournament.type === 'solo') {
      tournament.formedTeams = [];
    }
    
    // Set the new status
    tournament.status = targetStatus;
    
    await tournament.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournamentReset', { 
        tournamentId: id, 
        status: targetStatus 
      });
    }
    
    const statusLabel = targetStatus === 'draft' ? 'brouillon' : 'inscriptions ouvertes';
    res.json({ success: true, message: `Tournoi réinitialisé au statut "${statusLabel}"`, tournament });
  } catch (error) {
    console.error('Reset tournament error:', error);
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
      .populate('participant1.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant2.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant1.formedTeamMembers.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant2.formedTeamMembers.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('referent1', 'username')
      .populate('referent2', 'username')
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
    
    const tournament = await Tournament.findById(id).select('name type teamSize format mode');
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: id })
      .populate('participant1.squad', 'name tag color logo logoData members')
      .populate('participant2.squad', 'name tag color logo logoData members')
      .populate('participant1.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant2.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant1.formedTeamMembers.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('participant2.formedTeamMembers.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected')
      .populate('referent1', 'username')
      .populate('referent2', 'username')
      .populate('chat.sender', 'username avatar');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Build p1Info and p2Info with roster members for client
    const matchObj = match.toObject();
    
    // Helper to build participant info with members
    const buildParticipantInfo = async (participant, participantKey) => {
      const info = {
        name: null,
        logo: null,
        logoData: null,
        members: []
      };
      
      if (tournament.type === 'team' && participant.squad) {
        // Team tournament - use squad info
        info.name = participant.squad.name;
        info.logo = participant.squad.logo;
        info.logoData = participant.squad.logoData;
        
        // Get squad members with user info populated
        const squad = await Squad.findById(participant.squad._id)
          .populate('members.user', 'username discordId avatar avatarUrl platform irisConnected ggSecureConnected');
        
        if (squad && squad.members) {
          info.members = squad.members.map(m => ({
            user: m.user,
            userInfo: m.user,
            role: m.role,
            isBot: false
          }));
        }
      } else if (tournament.type === 'solo') {
        // Solo tournament - use squadInfo (which contains formed team name) or formedTeams
        if (participant.squadInfo?.name) {
          info.name = participant.squadInfo.name;
        } else if (participant.formedTeamIndex !== null && participant.formedTeamIndex !== undefined) {
          // Get name from tournament's formedTeams
          const fullTournament = await Tournament.findById(id).select('formedTeams');
          if (fullTournament?.formedTeams?.[participant.formedTeamIndex]) {
            const formedTeam = fullTournament.formedTeams[participant.formedTeamIndex];
            info.name = formedTeam.name;
            info.logoData = formedTeam.logo;
          }
        } else if (participant.user) {
          info.name = participant.user.username;
        }
        
        // Get logoData from tournament's formedTeams if not already set
        if (!info.logoData && participant.formedTeamIndex !== null && participant.formedTeamIndex !== undefined) {
          const fullTournament = await Tournament.findById(id).select('formedTeams');
          if (fullTournament?.formedTeams?.[participant.formedTeamIndex]?.logo) {
            info.logoData = fullTournament.formedTeams[participant.formedTeamIndex].logo;
          }
        }
        
        // Use formedTeamMembers for roster
        if (participant.formedTeamMembers && participant.formedTeamMembers.length > 0) {
          info.members = participant.formedTeamMembers.map(m => ({
            user: m.user,
            userInfo: m.user || m.userInfo,
            isBot: m.isBot || false,
            botName: m.botName
          }));
        } else if (participant.user) {
          info.members = [{
            user: participant.user,
            userInfo: participant.user,
            isBot: false
          }];
        }
      }
      
      return info;
    };
    
    matchObj.p1Info = await buildParticipantInfo(match.participant1, 'participant1');
    matchObj.p2Info = await buildParticipantInfo(match.participant2, 'participant2');
    
    res.json({ success: true, match: matchObj, tournament });
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
      // Calculate the round's map ONCE before the loop (same for all matches in the round)
      let roundMapForAllMatches = null;
      try {
        const formatString = `${tournament.teamSize}v${tournament.teamSize}`;
        const availableMaps = await Map.findForTournament(
          tournament.mode,
          null,
          formatString,
          tournament.type
        );
        
        if (availableMaps.length > 0) {
          // Generate seeded maps (same algorithm as client)
          const mapCount = tournament.format === 'bo1' ? 1 : 3;
          const totalRounds = tournament.bracket.length;
          
          // Use seed based on tournament ID (same as client)
          const seedString = `${tournament._id}-maps`;
          let seed = 0;
          for (let i = 0; i < seedString.length; i++) {
            seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
            seed = seed & seed;
          }
          seed = Math.abs(seed);
          
          const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
          };
          
          const shuffledMaps = [...availableMaps].sort(() => seededRandom() - 0.5);
          let mapsPool = [...shuffledMaps];
          const totalMapsNeeded = mapCount * totalRounds;
          if (mapsPool.length < totalMapsNeeded) {
            while (mapsPool.length < totalMapsNeeded) {
              mapsPool = [...mapsPool, ...shuffledMaps];
            }
          }
          
          // Get the map for this specific round
          const mapIndex = (nextRound - 1) * mapCount;
          roundMapForAllMatches = mapsPool[mapIndex];
        }
      } catch (mapError) {
        console.error('Error fetching maps for next round:', mapError);
      }

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
        
        // For solo tournaments, get data from formedTeams, for team tournaments from participants
        let p1Data, p2Data;
        if (tournament.type === 'solo') {
          p1Data = p1Index !== null && p1Index !== undefined ? tournament.formedTeams[p1Index] : null;
          p2Data = p2Index !== null && p2Index !== undefined ? tournament.formedTeams[p2Index] : null;
        } else {
          p1Data = p1Index !== null && p1Index !== undefined ? tournament.participants[p1Index] : null;
          p2Data = p2Index !== null && p2Index !== undefined ? tournament.participants[p2Index] : null;
        }
        
        // For solo tournaments, check if all members are bots
        // IMPORTANT: every() on empty array returns true, so we must check length > 0
        let isBotMatch = false;
        let hasBot = false;
        if (tournament.type === 'solo') {
          const p1AllBots = (p1Data?.members?.length > 0 && p1Data.members.every(m => m.isBot === true)) || false;
          const p2AllBots = (p2Data?.members?.length > 0 && p2Data.members.every(m => m.isBot === true)) || false;
          isBotMatch = p1AllBots && p2AllBots;
          hasBot = p1AllBots || p2AllBots;
        } else {
          isBotMatch = (p1Data?.isBot === true && p2Data?.isBot === true);
          hasBot = p1Data?.isBot === true || p2Data?.isBot === true;
        }
        
        // Build participant data based on tournament type
        let participant1Data, participant2Data;
        if (tournament.type === 'solo') {
          participant1Data = p1Data ? {
            squad: null,
            squadInfo: { name: p1Data.name, tag: null, color: '#6366f1', logo: null },
            user: null,
            userInfo: null,
            formedTeamIndex: p1Index,
            formedTeamMembers: p1Data.members,
            isBot: (p1Data.members?.length > 0 && p1Data.members.every(m => m.isBot === true)) || false,
            botName: null,
            participantIndex: p1Index
          } : { isBot: false, participantIndex: null };
          
          participant2Data = p2Data ? {
            squad: null,
            squadInfo: { name: p2Data.name, tag: null, color: '#f43f5e', logo: null },
            user: null,
            userInfo: null,
            formedTeamIndex: p2Index,
            formedTeamMembers: p2Data.members,
            isBot: (p2Data.members?.length > 0 && p2Data.members.every(m => m.isBot === true)) || false,
            botName: null,
            participantIndex: p2Index
          } : { isBot: false, participantIndex: null };
        } else {
          participant1Data = p1Data ? {
            squad: p1Data.squad,
            squadInfo: p1Data.squadInfo,
            user: null,
            userInfo: null,
            isBot: p1Data.isBot || false,
            botName: p1Data.botName || null,
            participantIndex: p1Index
          } : { isBot: false, participantIndex: null };
          
          participant2Data = p2Data ? {
            squad: p2Data.squad,
            squadInfo: p2Data.squadInfo,
            user: null,
            userInfo: null,
            isBot: p2Data.isBot || false,
            botName: p2Data.botName || null,
            participantIndex: p2Index
          } : { isBot: false, participantIndex: null };
        }
        
        const newMatch = new TournamentMatch({
          tournament: tournamentId,
          round: nextRound,
          roundName: nextRoundData.roundName,
          matchNumber: bracketMatch.matchNumber,
          format: tournament.format,
          mode: tournament.mode,
          teamSize: tournament.teamSize,
          participant1: participant1Data,
          participant2: participant2Data,
          // All matches start as in_progress - even bot matches need manual validation
          status: 'in_progress',
          scheduledAt: tournament.scheduledAt,
          startedAt: new Date()
        });
        
        // For solo tournaments, assign referents for all matches
        if (tournament.type === 'solo') {
          const realMembers1 = p1Data?.members?.filter(m => !m.isBot && m.user) || [];
          const realMembers2 = p2Data?.members?.filter(m => !m.isBot && m.user) || [];
          
          if (realMembers1.length > 0) {
            const randomIndex = Math.floor(Math.random() * realMembers1.length);
            newMatch.referent1 = realMembers1[randomIndex].user;
          }
          if (realMembers2.length > 0) {
            const randomIndex = Math.floor(Math.random() * realMembers2.length);
            newMatch.referent2 = realMembers2[randomIndex].user;
          }
        }
        
        // Assign the round's map to this match (same map for ALL matches in the round)
        if (roundMapForAllMatches) {
          newMatch.selectedMap = { name: roundMapForAllMatches.name, image: roundMapForAllMatches.image };
        }
        
        // NOTE: No auto-completion for bot matches - all matches require manual validation
        
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

// ==================== REFERENT VALIDATION ROUTES ====================

// Validate match result (referent only - solo tournaments)
router.post('/:tournamentId/matches/:matchId/validate', verifyToken, async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winner } = req.body;
    const userId = req.user._id;
    
    const match = await TournamentMatch.findOne({ _id: matchId, tournament: tournamentId });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournoi non trouvé' });
    }
    
    // Only for solo tournaments
    if (tournament.type !== 'solo') {
      return res.status(400).json({ success: false, message: 'Cette validation n\'est disponible que pour les tournois solo' });
    }
    
    // Check if user is a referent
    const isReferent1 = match.referent1 && String(match.referent1) === String(userId);
    const isReferent2 = match.referent2 && String(match.referent2) === String(userId);
    
    if (!isReferent1 && !isReferent2) {
      return res.status(403).json({ success: false, message: 'Seul le référent peut valider le résultat' });
    }
    
    // Validate winner value
    if (!['participant1', 'participant2'].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Winner invalide' });
    }
    
    // Check match status
    if (match.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Le match est déjà terminé' });
    }
    
    // Set result
    match.winner = winner;
    match.winnerIndex = match[winner].participantIndex;
    match.participant1.score = winner === 'participant1' ? 2 : 0;
    match.participant2.score = winner === 'participant2' ? 2 : 0;
    match.status = 'completed';
    match.completedAt = new Date();
    
    await match.save();
    
    // Advance winner to next round
    await advanceWinnerToNextRound(tournamentId, match, tournament);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-match-${matchId}`).emit('matchCompleted', { match });
      io.to(`tournament-${tournamentId}`).emit('bracketUpdated', { tournamentId });
    }
    
    res.json({ 
      success: true, 
      message: 'Résultat validé',
      match
    });
  } catch (error) {
    console.error('Validate match result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== MATCH CHAT ROUTES ====================

// Get chat messages for a tournament match
router.get('/:tournamentId/matches/:matchId/chat', verifyToken, async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const userId = req.user._id;
    
    const match = await TournamentMatch.findOne({
      _id: matchId,
      tournament: tournamentId
    });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Check access: staff can see all chats, players only their own match
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('arbitre') || req.user.roles?.includes('staff');
    const isParticipant = await isUserParticipantInMatch(match, userId);
    
    if (!isStaff && !isParticipant) {
      return res.status(403).json({ success: false, message: 'Vous n\'avez pas accès à ce chat' });
    }
    
    // Format messages for frontend
    const messages = (match.chat || []).map(msg => ({
      _id: msg._id,
      userId: msg.sender,
      username: msg.senderUsername,
      message: msg.message,
      isSystem: msg.isSystem,
      isStaff: msg.isStaff,
      isAdmin: msg.isAdmin,
      avatarUrl: msg.avatarUrl,
      createdAt: msg.timestamp
    }));
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get match chat error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Post chat message to tournament match
router.post('/:tournamentId/matches/:matchId/chat', verifyToken, async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    
    const match = await TournamentMatch.findOne({
      _id: matchId,
      tournament: tournamentId
    });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Check if user is participant in the match
    const isParticipant = await isUserParticipantInMatch(match, userId);
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('arbitre') || req.user.roles?.includes('staff');
    
    if (!isParticipant && !isStaff) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas participant de ce match' });
    }
    
    // Add message to chat
    const newMessage = {
      sender: userId,
      senderUsername: req.user.username,
      message: message.trim(),
      isSystem: false,
      isStaff: isStaff,
      isAdmin: req.user.roles?.includes('admin'),
      avatarUrl: req.user.avatarUrl || req.user.avatar,
      timestamp: new Date()
    };
    
    match.chat.push(newMessage);
    await match.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      const messageToEmit = {
        _id: match.chat[match.chat.length - 1]._id,
        matchId: matchId,
        userId: userId,
        username: req.user.username,
        message: message.trim(),
        isSystem: false,
        isStaff: isStaff,
        isAdmin: req.user.roles?.includes('admin'),
        avatarUrl: req.user.avatarUrl || req.user.avatar,
        createdAt: new Date()
      };
      io.to(`tournament-match-chat-${matchId}`).emit('tournamentMatchChatMessage', messageToEmit);
    }
    
    res.json({ success: true, message: 'Message envoyé' });
  } catch (error) {
    console.error('Post match chat error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to check if user is participant in match
async function isUserParticipantInMatch(match, userId) {
  const userIdStr = userId.toString();
  
  // Check if user is directly a participant
  if (match.participant1?.user?.toString() === userIdStr) return true;
  if (match.participant2?.user?.toString() === userIdStr) return true;
  
  // Check in formed team members
  const checkMembers = (members) => {
    if (!members) return false;
    return members.some(m => m.user?.toString() === userIdStr);
  };
  
  if (checkMembers(match.participant1?.formedTeamMembers)) return true;
  if (checkMembers(match.participant2?.formedTeamMembers)) return true;
  
  // Check in squad members if team tournament
  if (match.participant1?.squad) {
    const squad1 = await Squad.findById(match.participant1.squad);
    if (squad1 && squad1.members?.some(m => m.user?.toString() === userIdStr || m.toString() === userIdStr)) {
      return true;
    }
  }
  
  if (match.participant2?.squad) {
    const squad2 = await Squad.findById(match.participant2.squad);
    if (squad2 && squad2.members?.some(m => m.user?.toString() === userIdStr || m.toString() === userIdStr)) {
      return true;
    }
  }
  
  return false;
}

export default router;
