import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Squad from '../models/Squad.js';
import User from '../models/User.js';
import Match from '../models/Match.js';
import { verifyToken, requireAdmin, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import { logAdminAction } from '../services/discordBot.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for squad banner upload
const squadBannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/squad-banners');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'squad-banner-' + req.params.squadId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const squadBannerUpload = multer({
  storage: squadBannerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, JPG and GIF files are allowed'));
    }
  }
});

// Regex for validating squad names and tags (no special characters)
// Allows letters (including accented), numbers, spaces, hyphens, underscores
const VALID_NAME_REGEX = /^[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s\-_]+$/;
const VALID_TAG_REGEX = /^[a-zA-Z0-9]+$/;

// Function to validate squad name/tag
const isValidSquadName = (name) => {
  if (!name) return false;
  return VALID_NAME_REGEX.test(name);
};

const isValidSquadTag = (tag) => {
  if (!tag) return false;
  return VALID_TAG_REGEX.test(tag);
};

// Get all squads (public, with pagination and search)
router.get('/all', async (req, res) => {
  try {
    const { page = 1, limit = 30, search = '', mode = '' } = req.query;
    
    const query = { isDeleted: { $ne: true } };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Determine sort field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : (mode === 'hardcore' ? 'statsHardcore' : 'stats');
    
    const squads = await Squad.find(query)
      .select('name tag color logo description members mode stats statsHardcore statsCdl createdAt isPublic')
      .sort({ [`${statsField}.totalPoints`]: -1, [`${statsField}.totalWins`]: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Squad.countDocuments(query);
    
    res.json({
      success: true,
      squads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all squads error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to get the squad field name for a mode
const getSquadFieldForMode = (mode) => {
  if (mode === 'hardcore') return 'squadHardcore';
  if (mode === 'cdl') return 'squadCdl';
  return 'squad'; // fallback to legacy field
};

// Get user's current squad for a specific mode
router.get('/my-squad', verifyToken, async (req, res) => {
  try {
    const { mode } = req.query; // 'hardcore', 'cdl', or 'stricker'
    const user = await User.findById(req.user._id);
    
    // Determine which squad field to use based on mode
    let squadId = null;
    if (mode === 'hardcore') {
      // First check mode-specific field, then legacy field for squads with mode 'both' or 'hardcore'
      squadId = user.squadHardcore;
      
      // If no hardcore-specific squad, check legacy field
      if (!squadId && user.squad) {
        // Verify the legacy squad is compatible with hardcore mode
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'hardcore')) {
          squadId = user.squad;
        }
      }
    } else if (mode === 'cdl') {
      // First check mode-specific field, then legacy field for squads with mode 'both' or 'cdl'
      squadId = user.squadCdl;
      
      // If no cdl-specific squad, check legacy field
      if (!squadId && user.squad) {
        // Verify the legacy squad is compatible with cdl mode
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'cdl')) {
          squadId = user.squad;
        }
      }
    } else if (mode === 'stricker') {
      // Stricker mode uses squadStricker field, with fallback to other squad fields
      squadId = user.squadStricker || user.squadHardcore || user.squadCdl || user.squad;
    } else {
      // Fallback: try legacy field first, then check all mode-specific fields
      squadId = user.squad || user.squadHardcore || user.squadCdl || user.squadStricker;
    }
    
    if (!squadId) {
      return res.json({ success: true, squad: null });
    }
    
    const squad = await Squad.findById(squadId)
      .populate('members.user', 'username avatar avatarUrl discordAvatar discordId platform')
      .populate('leader', 'username avatar avatarUrl discordAvatar discordId platform')
      .populate('joinRequests.user', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad });
  } catch (error) {
    console.error('Get my squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get join requests count for leaders/officers
router.get('/my-squad/requests-count', verifyToken, async (req, res) => {
  try {
    const { mode } = req.query; // 'hardcore' or 'cdl'
    const user = await User.findById(req.user._id);
    
    // Determine which squad field to use based on mode
    let squadId = null;
    if (mode === 'hardcore') {
      // First check mode-specific field, then legacy field for squads with mode 'both' or 'hardcore'
      squadId = user.squadHardcore;
      
      // If no hardcore-specific squad, check legacy field
      if (!squadId && user.squad) {
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'hardcore')) {
          squadId = user.squad;
        }
      }
    } else if (mode === 'cdl') {
      // First check mode-specific field, then legacy field for squads with mode 'both' or 'cdl'
      squadId = user.squadCdl;
      
      // If no cdl-specific squad, check legacy field
      if (!squadId && user.squad) {
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'cdl')) {
          squadId = user.squad;
        }
      }
    } else {
      squadId = user.squad || user.squadHardcore || user.squadCdl;
    }
    
    if (!squadId) {
      return res.json({ success: true, count: 0 });
    }
    
    const squad = await Squad.findById(squadId);
    
    // Only leader and officers can see requests count
    const isLeader = squad.leader.toString() === user._id.toString();
    const isOfficer = squad.members.some(
      m => m.user.toString() === user._id.toString() && m.role === 'officer'
    );
    
    if (!isLeader && !isOfficer) {
      return res.json({ success: true, count: 0 });
    }
    
    res.json({ success: true, count: squad.joinRequests?.length || 0 });
  } catch (error) {
    console.error('Get requests count error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create a new squad
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { name, tag, description, mode, isPublic, color } = req.body;
    const userId = req.user._id;
    
    // Validate mode
    if (!mode || !['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mode invalide. Choisissez "hardcore" ou "cdl".' 
      });
    }
    
    // Check if user already has a squad FOR THIS MODE
    const user = await User.findById(userId);
    const squadField = mode === 'hardcore' ? 'squadHardcore' : 'squadCdl';
    
    if (user[squadField]) {
      return res.status(400).json({ 
        success: false, 
        message: `Vous êtes déjà dans une escouade en mode ${mode === 'hardcore' ? 'Hardcore' : 'CDL'}. Quittez-la d'abord.` 
      });
    }
    
    // Validate squad name (no special characters)
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'escouade doit faire au moins 3 caractères.' 
      });
    }
    
    if (!isValidSquadName(name.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'escouade ne peut contenir que des lettres, chiffres, espaces, tirets et underscores.' 
      });
    }
    
    // Validate squad tag (no special characters)
    if (!tag || tag.trim().length < 2 || tag.trim().length > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le tag doit faire entre 2 et 5 caractères.' 
      });
    }
    
    if (!isValidSquadTag(tag.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le tag ne peut contenir que des lettres et chiffres (pas de caractères spéciaux).' 
      });
    }
    
    // Check if name or tag already exists
    const existingSquad = await Squad.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, 'i') } },
        { tag: { $regex: new RegExp(`^${tag}$`, 'i') } }
      ]
    });
    
    if (existingSquad) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce nom ou tag d\'escouade existe déjà.' 
      });
    }
    
    // Create squad with the specified mode
    const squad = new Squad({
      name,
      tag: tag.trim(),
      description: description || '',
      leader: userId,
      members: [{
        user: userId,
        role: 'leader',
        joinedAt: new Date()
      }],
      mode: mode, // Set the mode explicitly (hardcore or cdl)
      isPublic: isPublic !== false,
      color: color || '#ef4444'
    });
    
    await squad.save();
    
    // Update user's mode-specific squad reference
    user[squadField] = squad._id;
    await user.save();
    
    // Populate and return
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad });
  } catch (error) {
    console.error('Create squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get squad by ID
// Get squad by name (for public profile)
router.get('/by-name/:name', async (req, res) => {
  try {
    const squadName = decodeURIComponent(req.params.name);
    const squad = await Squad.findOne({ name: { $regex: new RegExp(`^${squadName}$`, 'i') } })
      .populate('members.user', 'username avatar avatarUrl discordAvatar discordId')
      .populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    // Allow viewing deleted squads (for historical purposes)
    res.json({ success: true, squad });
  } catch (error) {
    console.error('Get squad by name error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/:squadId', async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.squadId)
      .populate('members.user', 'username avatar avatarUrl discordAvatar discordId')
      .populate('leader', 'username avatar avatarUrl discordAvatar discordId')
      .populate('trophies.trophy');
    
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    // Allow viewing deleted squads (for historical purposes)
    res.json({ success: true, squad });
  } catch (error) {
    console.error('Get squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Search squads
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const squads = await Squad.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { tag: { $regex: query, $options: 'i' } }
      ],
      isPublic: true
    })
    .populate('leader', 'username')
    .limit(20)
    .select('name tag description memberCount color logo mode');
    
    res.json({ success: true, squads });
  } catch (error) {
    console.error('Search squads error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Request to join a squad
router.post('/:squadId/join-request', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user._id;
    const squadId = req.params.squadId;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    // Check if user already has a squad FOR THIS SQUAD'S MODE
    const user = await User.findById(userId);
    const squadMode = squad.mode; // 'hardcore', 'cdl', or 'both'
    
    // Determine which field to check based on squad's mode
    if (squadMode === 'hardcore' && user.squadHardcore) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous êtes déjà dans une escouade en mode Hardcore.' 
      });
    } else if (squadMode === 'cdl' && user.squadCdl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous êtes déjà dans une escouade en mode CDL.' 
      });
    } else if (squadMode === 'both' && (user.squadHardcore || user.squadCdl || user.squad)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous êtes déjà dans une escouade.' 
      });
    }
    
    if (!squad.isPublic) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette escouade est sur invitation uniquement.' 
      });
    }
    
    if (squad.members.length >= squad.maxMembers) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette escouade est pleine.' 
      });
    }
    
    // Check if already requested
    const alreadyRequested = squad.joinRequests.some(
      r => r.user.toString() === userId.toString()
    );
    if (alreadyRequested) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà envoyé une demande.' 
      });
    }
    
    // Add join request
    squad.joinRequests.push({
      user: userId,
      message: message || '',
      requestedAt: new Date()
    });
    
    await squad.save();
    
    res.json({ success: true, message: 'Demande envoyée avec succès' });
  } catch (error) {
    console.error('Join request error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Accept join request (leader/officer only)
router.post('/:squadId/accept/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const managerId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.canManage(managerId)) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Find and remove the request
    const requestIndex = squad.joinRequests.findIndex(
      r => r.user.toString() === userId
    );
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Demande non trouvée' });
    }
    
    squad.joinRequests.splice(requestIndex, 1);
    
    // Add member
    squad.members.push({
      user: userId,
      role: 'member',
      joinedAt: new Date()
    });
    
    await squad.save();
    
    // Update user's mode-specific squad field based on squad's mode
    const squadMode = squad.mode;
    const updateFields = {};
    
    if (squadMode === 'hardcore') {
      updateFields.squadHardcore = squadId;
    } else if (squadMode === 'cdl') {
      updateFields.squadCdl = squadId;
    } else {
      // For 'both' mode, update the legacy field
      updateFields.squad = squadId;
    }
    
    await User.findByIdAndUpdate(userId, updateFields);
    
    res.json({ success: true, message: 'Membre accepté' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Reject join request (leader/officer only)
router.post('/:squadId/reject/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const managerId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.canManage(managerId)) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Remove request
    squad.joinRequests = squad.joinRequests.filter(
      r => r.user.toString() !== userId
    );
    
    await squad.save();
    
    res.json({ success: true, message: 'Demande rejetée' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave squad
router.post('/leave', verifyToken, async (req, res) => {
  try {
    const { mode } = req.body; // 'hardcore' or 'cdl'
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    
    // Determine which squad field to use based on mode
    let squadId = null;
    let squadField = null;
    
    if (mode === 'hardcore') {
      // First check mode-specific field
      squadId = user.squadHardcore;
      squadField = 'squadHardcore';
      
      // If no hardcore-specific squad, check legacy field for squads with mode 'both' or 'hardcore'
      if (!squadId && user.squad) {
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'hardcore')) {
          squadId = user.squad;
          squadField = 'squad';
        }
      }
    } else if (mode === 'cdl') {
      // First check mode-specific field
      squadId = user.squadCdl;
      squadField = 'squadCdl';
      
      // If no cdl-specific squad, check legacy field for squads with mode 'both' or 'cdl'
      if (!squadId && user.squad) {
        const legacySquad = await Squad.findById(user.squad).select('mode');
        if (legacySquad && (legacySquad.mode === 'both' || legacySquad.mode === 'cdl')) {
          squadId = user.squad;
          squadField = 'squad';
        }
      }
    } else {
      // Fallback: check legacy field or find any squad
      squadId = user.squad || user.squadHardcore || user.squadCdl;
      squadField = user.squad ? 'squad' : (user.squadHardcore ? 'squadHardcore' : 'squadCdl');
    }
    
    if (!squadId) {
      return res.status(400).json({ success: false, message: 'Vous n\'êtes dans aucune escouade' });
    }
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      // Squad doesn't exist, clear the field
      user[squadField] = null;
      await user.save();
      return res.json({ success: true, message: 'Escouade quittée' });
    }
    
    // If user is leader - they cannot leave, must transfer or disband
    if (squad.isLeader(userId)) {
      if (squad.members.length > 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'En tant que leader, vous devez transférer le leadership ou dissoudre l\'escouade.' 
        });
      } else {
        // Mark squad as deleted if last member (leader alone)
        squad.isDeleted = true;
        squad.deletedAt = new Date();
        await squad.save();
        user[squadField] = null;
        await user.save();
        return res.json({ success: true, message: 'Escouade dissoute' });
      }
    }
    
    // Remove member
    squad.members = squad.members.filter(
      m => m.user.toString() !== userId.toString()
    );
    
    await squad.save();
    
    user[squadField] = null;
    await user.save();
    
    res.json({ success: true, message: 'Escouade quittée' });
  } catch (error) {
    console.error('Leave squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Promote member to officer (leader only)
router.post('/:squadId/promote/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const leaderId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.isLeader(leaderId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut promouvoir' });
    }
    
    const member = squad.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Membre non trouvé' });
    }
    
    if (member.role === 'leader') {
      return res.status(400).json({ success: false, message: 'Impossible de promouvoir le leader' });
    }
    
    if (member.role === 'officer') {
      return res.status(400).json({ success: false, message: 'Ce membre est déjà officier' });
    }
    
    member.role = 'officer';
    await squad.save();
    
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad, message: 'Membre promu officier' });
  } catch (error) {
    console.error('Promote member error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Demote officer to member (leader only)
router.post('/:squadId/demote/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const leaderId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.isLeader(leaderId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut rétrograder' });
    }
    
    const member = squad.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Membre non trouvé' });
    }
    
    if (member.role !== 'officer') {
      return res.status(400).json({ success: false, message: 'Ce membre n\'est pas officier' });
    }
    
    member.role = 'member';
    await squad.save();
    
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad, message: 'Officier rétrogradé membre' });
  } catch (error) {
    console.error('Demote member error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DEV: Add fake player to squad (squad leaders/officers only)
router.post('/:squadId/dev/add-fake-player', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    // Verify user is a leader or officer of this squad
    const member = squad.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      return res.status(403).json({ success: false, message: 'Seuls les leaders et officiers peuvent ajouter des membres' });
    }
    
    // Generate random fake player data
    const fakeNames = ['Shadow', 'Phoenix', 'Viper', 'Ghost', 'Blaze', 'Storm', 'Raven', 'Wolf', 'Hawk', 'Thunder', 'Nova', 'Frost', 'Ace', 'Demon', 'Sniper', 'Reaper', 'Titan', 'Fury', 'Legend', 'Ninja'];
    const fakeSuffixes = ['_X', '_Pro', '123', '_TTV', '_YT', 'Gaming', '_Elite', '_GG', '2K', '_Sniper', '_COD', '_MW', '_WZ', '_BO6', ''];
    const randomName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const randomSuffix = fakeSuffixes[Math.floor(Math.random() * fakeSuffixes.length)];
    const randomNumber = Math.floor(Math.random() * 999);
    const fakeUsername = `${randomName}${randomSuffix}${randomNumber}`;
    
    // Generate random profile data
    const platforms = ['PC', 'PlayStation', 'Xbox'];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    const fakeActivisionId = `${randomName}#${Math.floor(1000000 + Math.random() * 9000000)}`;
    
    const bios = [
      '🎮 Joueur compétitif | Toujours prêt pour la ranked',
      'Ex-semi-pro | Main AR | 🏆',
      'Grind 24/7 💪 | Objectif : Top 100',
      'Casual player devenu tryhard | GG only',
      'SMG enjoyer | Sniper en second',
      '⚡ Fast & Furious gameplay | No camping',
      'Veteran COD depuis MW2 OG',
      '🔥 Clutch master | 1v4 specialist',
      'Team player | Callouts on point',
      'Ranked grinder | Diamond lobbies'
    ];
    const randomBio = bios[Math.floor(Math.random() * bios.length)];
    
    // Generate avatar URL using ui-avatars
    const avatarColors = ['7c3aed', 'ec4899', '3b82f6', '10b981', 'f59e0b', 'ef4444', '8b5cf6', '06b6d4'];
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fakeUsername)}&background=${randomColor}&color=fff&size=256&bold=true`;
    
    // Create fake user with full profile
    const fakeUser = new User({
      discordId: `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discordUsername: fakeUsername,
      username: fakeUsername,
      discordEmail: `${fakeUsername.toLowerCase()}@fake.nomercy.gg`,
      avatar: avatarUrl,
      bio: randomBio,
      platform: randomPlatform,
      activisionId: fakeActivisionId,
      isProfileComplete: true,
      isFakeUser: true,
      squad: squadId,
      goldCoins: Math.floor(100 + Math.random() * 900), // 100-999 coins
      stats: {
        points: 0,
        wins: 0,
        losses: 0,
        rank: 0
      }
    });
    
    await fakeUser.save();
    
    // Add to squad
    squad.members.push({
      user: fakeUser._id,
      role: 'member',
      joinedAt: new Date()
    });
    
    await squad.save();
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ 
      success: true, 
      squad, 
      fakePlayer: { 
        _id: fakeUser._id,
        username: fakeUsername, 
        platform: randomPlatform,
        activisionId: fakeActivisionId,
        avatar: avatarUrl,
        bio: randomBio
      },
      message: `Joueur fictif "${fakeUsername}" ajouté avec profil complet` 
    });
  } catch (error) {
    console.error('Add fake player error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Transfer leadership (leader only)
router.post('/:squadId/transfer/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const leaderId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.isLeader(leaderId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut transférer le leadership' });
    }
    
    const newLeader = squad.members.find(m => m.user.toString() === userId);
    if (!newLeader) {
      return res.status(404).json({ success: false, message: 'Membre non trouvé' });
    }
    
    if (newLeader.user.toString() === leaderId.toString()) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà le leader' });
    }
    
    // Update old leader to officer
    const oldLeader = squad.members.find(m => m.user.toString() === leaderId.toString());
    if (oldLeader) oldLeader.role = 'officer';
    
    // Update new leader
    newLeader.role = 'leader';
    squad.leader = userId;
    
    await squad.save();
    
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad, message: 'Leadership transféré' });
  } catch (error) {
    console.error('Transfer leadership error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Disband squad (leader only) - HARD DELETE
router.delete('/:squadId/disband', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const leaderId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.isLeader(leaderId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut dissoudre l\'escouade' });
    }
    
    // Check if there are other members besides the leader
    const otherMembers = squad.members.filter(m => m.user?.toString() !== leaderId.toString());
    if (otherMembers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous devez d\'abord retirer tous les membres ou transférer le lead avant de dissoudre l\'escouade.' 
      });
    }
    
    // Check if squad has any pending disputes
    const pendingDisputes = await Match.countDocuments({
      $or: [
        { challenger: squadId },
        { opponent: squadId }
      ],
      status: 'disputed'
    });
    
    if (pendingDisputes > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Vous ne pouvez pas dissoudre votre escouade car vous avez ${pendingDisputes} litige(s) en cours. Veuillez attendre leur résolution.` 
      });
    }
    
    // Clear leader's mode-specific squad field based on squad's mode
    const squadMode = squad.mode;
    const unsetFields = {};
    
    if (squadMode === 'hardcore') {
      unsetFields.squadHardcore = 1;
    } else if (squadMode === 'cdl') {
      unsetFields.squadCdl = 1;
    } else {
      unsetFields.squad = 1;
    }
    
    await User.findByIdAndUpdate(leaderId, { $unset: unsetFields });
    
    // HARD DELETE - Delete all squad data from DB (EXCEPT match history)
    // Delete squad from database completely
    await Squad.findByIdAndDelete(squadId);
    
    res.json({ success: true, message: 'Escouade dissoute et supprimée définitivement' });
  } catch (error) {
    console.error('Disband squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Kick member (leader/officer only)
router.post('/:squadId/kick/:userId', verifyToken, async (req, res) => {
  try {
    const { squadId, userId } = req.params;
    const managerId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.canManage(managerId)) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Can't kick the leader
    if (squad.isLeader(userId)) {
      return res.status(400).json({ success: false, message: 'Impossible d\'expulser le leader' });
    }
    
    // Remove member
    squad.members = squad.members.filter(
      m => m.user.toString() !== userId
    );
    
    await squad.save();
    
    // Clear user's mode-specific squad field based on squad's mode
    const squadMode = squad.mode;
    const unsetFields = {};
    
    if (squadMode === 'hardcore') {
      unsetFields.squadHardcore = 1;
    } else if (squadMode === 'cdl') {
      unsetFields.squadCdl = 1;
    } else {
      unsetFields.squad = 1;
    }
    
    await User.findByIdAndUpdate(userId, { $unset: unsetFields });
    
    res.json({ success: true, message: 'Membre expulsé' });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Upload squad banner (leader only)
router.post('/:squadId/upload-banner', verifyToken, squadBannerUpload.single('banner'), async (req, res) => {
  try {
    const { squadId } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    if (!squad.isLeader(userId)) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: 'Seul le leader peut modifier la bannière' });
    }

    // Delete old banner if exists
    if (squad.banner) {
      const oldBannerPath = path.join(__dirname, '../../uploads/squad-banners', path.basename(squad.banner));
      if (fs.existsSync(oldBannerPath)) {
        fs.unlinkSync(oldBannerPath);
      }
    }

    // Save banner URL
    const bannerUrl = `/uploads/squad-banners/${req.file.filename}`;
    squad.banner = bannerUrl;
    await squad.save();

    res.json({
      success: true,
      message: 'Bannière téléchargée avec succès',
      bannerUrl
    });
  } catch (error) {
    console.error('Squad banner upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors du téléchargement de la bannière'
    });
  }
});

// Delete squad banner (leader only)
router.delete('/:squadId/delete-banner', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const userId = req.user._id;

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    if (!squad.isLeader(userId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut supprimer la bannière' });
    }

    if (!squad.banner) {
      return res.status(400).json({
        success: false,
        message: 'Aucune bannière à supprimer'
      });
    }

    // Delete banner file
    const bannerPath = path.join(__dirname, '../../uploads/squad-banners', path.basename(squad.banner));
    if (fs.existsSync(bannerPath)) {
      fs.unlinkSync(bannerPath);
    }

    squad.banner = null;
    await squad.save();

    res.json({
      success: true,
      message: 'Bannière supprimée avec succès'
    });
  } catch (error) {
    console.error('Squad banner delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la bannière'
    });
  }
});

// Update squad settings (leader only)
router.put('/:squadId', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const userId = req.user._id;
    const { name, tag, description, isPublic, color, logo } = req.body;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.isLeader(userId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut modifier l\'escouade' });
    }
    
    // Validate and update name if provided
    if (name !== undefined && name !== squad.name) {
      if (!name || name.trim().length < 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le nom d\'escouade doit faire au moins 3 caractères.' 
        });
      }
      
      if (!isValidSquadName(name.trim())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le nom d\'escouade ne peut contenir que des lettres, chiffres, espaces, tirets et underscores.' 
        });
      }
      
      // Check if name already exists (excluding current squad)
      const existingSquadWithName = await Squad.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: squadId }
      });
      
      if (existingSquadWithName) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ce nom d\'escouade existe déjà.' 
        });
      }
      
      squad.name = name.trim();
    }
    
    // Validate and update tag if provided
    if (tag !== undefined && tag !== squad.tag) {
      if (!tag || tag.trim().length < 2 || tag.trim().length > 5) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le tag doit faire entre 2 et 5 caractères.' 
        });
      }
      
      if (!isValidSquadTag(tag.trim())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le tag ne peut contenir que des lettres et chiffres (pas de caractères spéciaux).' 
        });
      }
      
      // Check if tag already exists (excluding current squad)
      const existingSquadWithTag = await Squad.findOne({
        tag: { $regex: new RegExp(`^${tag.trim()}$`, 'i') },
        _id: { $ne: squadId }
      });
      
      if (existingSquadWithTag) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ce tag d\'escouade existe déjà.' 
        });
      }
      
      squad.tag = tag.trim();
    }
    
    if (description !== undefined) squad.description = description;
    if (isPublic !== undefined) squad.isPublic = isPublic;
    if (color) squad.color = color;
    if (logo !== undefined) squad.logo = logo;
    
    await squad.save();
    
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ success: true, squad });
  } catch (error) {
    console.error('Update squad error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Generate invite code (leader/officer only)
router.post('/:squadId/generate-invite', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const userId = req.user._id;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    if (!squad.canManage(userId)) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Generate a unique invite code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    
    let inviteCode;
    let isUnique = false;
    
    // Make sure the code is unique
    while (!isUnique) {
      inviteCode = generateCode();
      const existing = await Squad.findOne({ inviteCode });
      if (!existing) isUnique = true;
    }
    
    // Set expiration to 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 15 * 60 * 1000);
    
    squad.inviteCode = inviteCode;
    squad.inviteCodeExpiresAt = expiresAt;
    await squad.save();
    
    res.json({ 
      success: true, 
      inviteCode,
      expiresAt,
      message: 'Code d\'invitation généré'
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join squad via invite code
router.post('/join/:inviteCode', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user._id;
    
    // Check if user already has a squad
    const user = await User.findById(userId);
    if (user.squad) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous êtes déjà dans une escouade.' 
      });
    }
    
    // Find squad by invite code
    const squad = await Squad.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!squad) {
      return res.status(404).json({ 
        success: false, 
        message: 'Code d\'invitation invalide.' 
      });
    }
    
    // Check if code has expired
    if (squad.inviteCodeExpiresAt && new Date() > squad.inviteCodeExpiresAt) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce code d\'invitation a expiré.' 
      });
    }
    
    // Check if squad is full
    if (squad.members.length >= squad.maxMembers) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette escouade est pleine.' 
      });
    }
    
    // Add member
    squad.members.push({
      user: userId,
      role: 'member',
      joinedAt: new Date()
    });
    
    await squad.save();
    
    // Update user's squad reference
    user.squad = squad._id;
    await user.save();
    
    await squad.populate('members.user', 'username avatar avatarUrl discordAvatar discordId');
    await squad.populate('leader', 'username avatar avatarUrl discordAvatar discordId');
    
    res.json({ 
      success: true, 
      squad,
      message: 'Vous avez rejoint l\'escouade !'
    });
  } catch (error) {
    console.error('Join by invite error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Revoke invite code (leader/officer only)
router.delete('/:squadId/revoke-invite', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const userId = req.user._id;
    
    // Validate squadId format
    if (!squadId || !squadId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID d\'escouade invalide' });
    }
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }
    
    // Check if user can manage - with additional null check
    const userIdStr = userId?.toString?.() || userId;
    const isLeader = squad.leader?.toString?.() === userIdStr;
    const isOfficer = squad.members?.some(m => {
      const memberUserId = m.user?.toString?.() || m.user?._id?.toString?.();
      return memberUserId === userIdStr && m.role === 'officer';
    });
    
    if (!isLeader && !isOfficer) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Use $unset to remove the fields instead of setting to null
    // This avoids unique index conflicts with other null values
    await Squad.findByIdAndUpdate(squadId, {
      $unset: { inviteCode: 1, inviteCodeExpiresAt: 1 }
    });
    
    res.json({ success: true, message: 'Code d\'invitation révoqué' });
  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', details: error.message });
  }
});

// Check if name/tag is available
router.get('/check/:type/:value', async (req, res) => {
  try {
    const { type, value } = req.params;
    
    let query;
    if (type === 'name') {
      query = { name: { $regex: new RegExp(`^${value}$`, 'i') } };
    } else if (type === 'tag') {
      query = { tag: { $regex: new RegExp(`^${value}$`, 'i') } };
    } else {
      return res.status(400).json({ success: false, message: 'Type invalide' });
    }
    
    const exists = await Squad.findOne(query);
    
    res.json({ success: true, available: !exists });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get public squads list
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, mode } = req.query;
    
    const query = { isPublic: true, isDeleted: false }; // Exclude deleted squads
    if (mode && mode !== 'all') {
      query.$or = [{ mode }, { mode: 'both' }];
    }
    
    const squads = await Squad.find(query)
      .populate('leader', 'username')
      .sort({ 'stats.totalPoints': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('name tag description color logo mode members stats');
    
    const total = await Squad.countDocuments(query);
    
    res.json({
      success: true,
      squads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get squads error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get squad rank for a specific mode
router.get('/:squadId/rank', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { mode = 'hardcore' } = req.query;
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Get the specific squad
    const targetSquad = await Squad.findById(squadId);
    if (!targetSquad) {
      return res.status(404).json({ success: false, message: 'Squad not found' });
    }
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';
    
    // Get all squads sorted by points for this mode
    const query = {
      $or: [{ mode }, { mode: 'both' }],
      isDeleted: false
    };
    
    const allSquads = await Squad.find(query)
      .populate({
        path: 'leader',
        select: 'isBanned isDeleted',
        match: { isBanned: false, isDeleted: { $ne: true } }
      })
      .sort({ [`${statsField}.totalPoints`]: -1 })
      .select(`${statsField} stats`);
    
    // Filter valid squads and find rank
    const validSquads = allSquads.filter(s => s.leader !== null);
    const rank = validSquads.findIndex(s => s._id.toString() === squadId) + 1;
    
    if (rank === 0) {
      return res.json({ success: false, message: 'Squad not ranked' });
    }
    
    // Use ONLY mode-specific stats, no fallback to general stats
    const modeStats = targetSquad[statsField] || {};
    
    res.json({
      success: true,
      rank,
      points: modeStats.totalPoints || 0,
      totalSquads: validSquads.length
    });
  } catch (error) {
    console.error('Get squad rank error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get squads leaderboard for a specific mode
router.get('/leaderboard/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';
    
    const query = {
      $or: [{ mode }, { mode: 'both' }],
      isDeleted: false // Exclude deleted squads
    };
    
    const squads = await Squad.find(query)
      .populate({
        path: 'leader',
        select: 'username avatar discordAvatar discordId isBanned isDeleted',
        match: { isBanned: false, isDeleted: { $ne: true } } // Exclude squads with banned/deleted leaders
      })
      .populate({
        path: 'members.user',
        select: 'username avatar discordAvatar discordId isDeleted',
        match: { isDeleted: { $ne: true } } // Exclude deleted members
      })
      .sort({ [`${statsField}.totalPoints`]: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select(`name tag description color logo mode members ${statsField} stats`);
    
    // Filter out squads with banned/deleted leaders
    const validSquads = squads.filter(s => s.leader !== null);
    
    // Count total valid squads
    const allSquads = await Squad.find(query)
      .populate({
        path: 'leader',
        select: 'isBanned isDeleted',
        match: { isBanned: false, isDeleted: { $ne: true } }
      });
    const total = allSquads.filter(s => s.leader !== null).length;
    
    // Add rank numbers and calculate total matches using mode-specific stats
    const startRank = (parseInt(page) - 1) * parseInt(limit);
    const rankedSquads = validSquads.map((squad, index) => {
      const squadData = squad.toJSON();
      // Use ONLY mode-specific stats, no fallback to general stats
      const modeStats = squadData[statsField] || {};
      const totalWins = modeStats.totalWins || 0;
      const totalLosses = modeStats.totalLosses || 0;
      const totalPoints = modeStats.totalPoints || 0;
      return {
        ...squadData,
        stats: { totalWins, totalLosses, totalPoints }, // Normalize to stats for frontend compatibility
        rank: startRank + index + 1,
        totalMatches: totalWins + totalLosses,
        totalWins,
        totalLosses
      };
    });
    
    res.json({
      success: true,
      squads: rankedSquads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get squads leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== LADDER REGISTRATION ====================

// Register squad to a ladder
router.post('/:squadId/register-ladder', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const { ladderId, ladderName } = req.body;
    const userId = req.user._id;

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    // Check if user is leader or officer
    if (!squad.canManage(userId)) {
      return res.status(403).json({ success: false, message: 'Seuls le leader et les officiers peuvent gérer les inscriptions' });
    }

    // Check if already registered
    const alreadyRegistered = squad.registeredLadders.some(l => l.ladderId === ladderId);
    if (alreadyRegistered) {
      return res.status(400).json({ success: false, message: 'Escouade déjà inscrite à ce classement' });
    }

    // Add to registered ladders
    squad.registeredLadders.push({
      ladderId,
      ladderName,
      registeredAt: new Date(),
      points: 0,
      wins: 0,
      losses: 0
    });

    await squad.save();

    res.json({ success: true, message: 'Inscription réussie', squad });
  } catch (error) {
    console.error('Register ladder error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Unregister squad from a ladder
router.post('/:squadId/unregister-ladder', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const { ladderId } = req.body;
    const userId = req.user._id;

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    // Check if user is leader
    if (!squad.isLeader(userId)) {
      return res.status(403).json({ success: false, message: 'Seul le leader peut désinscrire l\'escouade' });
    }

    // Remove from registered ladders
    squad.registeredLadders = squad.registeredLadders.filter(l => l.ladderId !== ladderId);

    await squad.save();

    res.json({ success: true, message: 'Désinscription réussie', squad });
  } catch (error) {
    console.error('Unregister ladder error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get ladder leaderboard (top 100 squads for a specific ladder)
router.get('/ladder/:ladderId/leaderboard', async (req, res) => {
  try {
    const { ladderId } = req.params;
    const { limit = 100, page = 1, mode } = req.query;

    // Build query with mode filtering
    const query = {
      'registeredLadders.ladderId': ladderId,
      isDeleted: false // Exclude deleted squads
    };
    
    // Filter by mode if provided - only show squads that match the mode or are 'both'
    if (mode && ['hardcore', 'cdl'].includes(mode)) {
      query.$or = [
        { mode: mode },
        { mode: 'both' }
      ];
    }

    const squads = await Squad.find(query)
      .populate({
        path: 'leader',
        select: 'username avatar discordAvatar discordId isBanned isDeleted',
        match: { isBanned: false, isDeleted: { $ne: true } } // Exclude squads with banned/deleted leaders
      })
      .populate({
        path: 'members.user',
        select: 'username avatar discordAvatar discordId isDeleted',
        match: { isDeleted: { $ne: true } } // Exclude deleted members
      })
      .select('name tag color logo members registeredLadders mode');

    // Filter out squads with banned/deleted leaders
    const validSquads = squads.filter(s => s.leader !== null);

    // Sort by ladder points
    const sortedSquads = validSquads
      .map(squad => {
        const ladderData = squad.registeredLadders.find(l => l.ladderId === ladderId);
        return {
          ...squad.toJSON(),
          ladderPoints: ladderData?.points || 0,
          ladderWins: ladderData?.wins || 0,
          ladderLosses: ladderData?.losses || 0,
          registeredAt: ladderData?.registeredAt
        };
      })
      .sort((a, b) => b.ladderPoints - a.ladderPoints)
      .slice(0, parseInt(limit));

    // Add ranks
    const rankedSquads = sortedSquads.map((squad, index) => ({
      ...squad,
      rank: index + 1
    }));

    res.json({ success: true, squads: rankedSquads, total: squads.length });
  } catch (error) {
    console.error('Get ladder leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== TROPHY ASSIGNMENT (ADMIN) ====================

// Assign trophy to squad (admin only)
router.post('/:squadId/assign-trophy', verifyToken, async (req, res) => {
  try {
    const { squadId } = req.params;
    const { trophyId, reason } = req.body;

    // Check if admin
    if (!req.user.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
    }

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    // Check if trophy already assigned
    const alreadyHas = squad.trophies.some(t => t.trophy?.toString() === trophyId);
    if (alreadyHas) {
      return res.status(400).json({ success: false, message: 'Cette escouade possède déjà ce trophée' });
    }

    // Add trophy
    squad.trophies.push({
      trophy: trophyId,
      earnedAt: new Date(),
      reason: reason || 'Attribué par un administrateur'
    });

    await squad.save();

    // Populate and return
    await squad.populate('trophies.trophy');

    // Log to Discord
    await logAdminAction(req.user, 'Assign Trophy', squad.name, {
      fields: [
        { name: 'Trophée ID', value: trophyId },
        { name: 'Raison', value: reason || 'Non spécifiée' }
      ]
    });

    res.json({ success: true, message: 'Trophée attribué', squad });
  } catch (error) {
    console.error('Assign trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Remove trophy from squad (admin only)
router.delete('/:squadId/remove-trophy/:trophyId', verifyToken, async (req, res) => {
  try {
    const { squadId, trophyId } = req.params;

    // Check if admin
    if (!req.user.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
    }

    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escouade non trouvée' });
    }

    // Remove trophy
    squad.trophies = squad.trophies.filter(t => t.trophy?.toString() !== trophyId);

    await squad.save();

    // Log to Discord
    await logAdminAction(req.user, 'Remove Trophy', squad.name, {
      fields: [
        { name: 'Trophée ID', value: trophyId }
      ]
    });

    res.json({ success: true, message: 'Trophée retiré', squad });
  } catch (error) {
    console.error('Remove trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get all squads (for admin trophy assignment)
router.get('/admin/all-trophies', verifyToken, async (req, res) => {
  try {
    if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('staff')) {
      return res.status(403).json({ success: false, message: 'Accès réservé' });
    }

    const squads = await Squad.find()
      .populate('leader', 'username')
      .populate('trophies.trophy')
      .select('name tag color logo trophies members')
      .sort({ name: 1 });

    res.json({ success: true, squads });
  } catch (error) {
    console.error('Get all squads error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all squads (admin/staff/arbitre)
router.get('/admin/all', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } }
      ];
    }
    
    const squads = await Squad.find(query)
      .populate('leader', 'username discordUsername avatarUrl')
      .populate('members.user', 'username discordUsername avatarUrl')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Squad.countDocuments(query);
    
    res.json({
      success: true,
      squads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all squads error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Reset squad progression (admin)
router.post('/admin/:squadId/reset-progression', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { squadId } = req.params;
    const { ladderId } = req.body; // Optional: specific ladder, or all if not provided
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Squad not found.'
      });
    }
    
    if (ladderId) {
      // Reset specific ladder
      const ladderIndex = squad.registeredLadders.findIndex(l => l.ladderId === ladderId);
      if (ladderIndex !== -1) {
        squad.registeredLadders[ladderIndex].points = 0;
        squad.registeredLadders[ladderIndex].wins = 0;
        squad.registeredLadders[ladderIndex].losses = 0;
      }
    } else {
      // Reset all ladders
      squad.registeredLadders.forEach(ladder => {
        ladder.points = 0;
        ladder.wins = 0;
        ladder.losses = 0;
      });
      // Reset general stats
      squad.stats.totalPoints = 0;
      squad.stats.totalWins = 0;
      squad.stats.totalLosses = 0;
    }
    
    await squad.save();

    // Log to Discord
    await logAdminAction(req.user, 'Reset Progression', squad.name, {
      description: ladderId ? `Ladder ${ladderId} réinitialisé` : 'Progression complète réinitialisée'
    });
    
    res.json({
      success: true,
      message: ladderId ? `Progression du ladder ${ladderId} réinitialisée.` : 'Progression complète réinitialisée.'
    });
  } catch (error) {
    console.error('Reset squad progression error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting progression.'
    });
  }
});

// Update squad (admin/staff)
router.put('/admin/:squadId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { name, tag, description, mode, color, maxMembers, experience, logo, stats } = req.body;
    
    const squad = await Squad.findById(req.params.squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Update fields if provided
    if (name !== undefined) squad.name = name;
    if (tag !== undefined) squad.tag = tag;
    if (description !== undefined) squad.description = description;
    if (mode !== undefined) squad.mode = mode;
    if (color !== undefined) squad.color = color;
    if (maxMembers !== undefined) squad.maxMembers = maxMembers;
    if (experience !== undefined) squad.experience = experience;
    if (logo !== undefined) squad.logo = logo;
    
    // Update stats if provided (admin only for totalPoints)
    if (stats !== undefined) {
      if (stats.totalPoints !== undefined) squad.stats.totalPoints = parseInt(stats.totalPoints) || 0;
      if (stats.totalWins !== undefined) squad.stats.totalWins = parseInt(stats.totalWins) || 0;
      if (stats.totalLosses !== undefined) squad.stats.totalLosses = parseInt(stats.totalLosses) || 0;
    }

    await squad.save();

    // Log to Discord
    await logAdminAction(req.user, 'Update Squad', squad.name, {
      fields: [
        { name: 'Modifications', value: Object.keys(req.body).join(', ') || 'Aucune' }
      ]
    });

    res.json({
      success: true,
      message: 'Escouade mise à jour',
      squad
    });
  } catch (error) {
    console.error('Update squad error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Update squad ladder points (admin only)
router.put('/admin/:squadId/ladder-points', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ladderPoints } = req.body;
    
    const squad = await Squad.findById(req.params.squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Update ladder points
    if (ladderPoints && typeof ladderPoints === 'object') {
      for (const ladderId in ladderPoints) {
        const ladderIndex = squad.registeredLadders.findIndex(l => l.ladderId === ladderId);
        if (ladderIndex !== -1) {
          squad.registeredLadders[ladderIndex].points = parseInt(ladderPoints[ladderId]) || 0;
        }
      }
    }

    await squad.save();


    // Log to Discord
    await logAdminAction(req.user, 'Update Ladder Points', squad.name, {
      fields: [
        { name: 'Points', value: JSON.stringify(ladderPoints) }
      ]
    });

    res.json({
      success: true,
      message: 'Points ladder mis à jour',
      squad
    });
  } catch (error) {
    console.error('Update squad ladder points error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Update squad Stricker stats (admin only)
router.put('/admin/:squadId/stricker-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { statsStricker, cranes } = req.body;
    
    const squad = await Squad.findById(req.params.squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Update Stricker stats
    if (statsStricker && typeof statsStricker === 'object') {
      squad.statsStricker = {
        points: parseInt(statsStricker.points) || 0,
        wins: parseInt(statsStricker.wins) || 0,
        losses: parseInt(statsStricker.losses) || 0
      };
    }

    // Update Munitions (cranes)
    if (cranes !== undefined) {
      squad.cranes = parseInt(cranes) || 0;
    }

    await squad.save();

    // Log to Discord
    await logAdminAction(req.user, 'Update Stricker Stats', squad.name, {
      fields: [
        { name: 'Points', value: `${squad.statsStricker.points} pts` },
        { name: 'Victoires', value: squad.statsStricker.wins.toString() },
        { name: 'Défaites', value: squad.statsStricker.losses.toString() },
        { name: 'Munitions', value: squad.cranes.toString() }
      ]
    });

    res.json({
      success: true,
      message: 'Stats Stricker mises à jour',
      squad
    });
  } catch (error) {
    console.error('Update squad stricker stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Reset squad Stricker stats (admin only)
router.post('/admin/:squadId/reset-stricker', verifyToken, requireAdmin, async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Reset Stricker stats
    squad.statsStricker = {
      points: 0,
      wins: 0,
      losses: 0,
      rank: 'Recrues'
    };
    
    // Reset Munitions (cranes)
    squad.cranes = 0;

    await squad.save();

    // Log to Discord
    await logAdminAction(req.user, 'Reset Squad Stricker Stats', squad.name, {
      fields: [
        { name: 'Tag', value: squad.tag },
        { name: 'Action', value: 'RAZ complète des stats Stricker et munitions' }
      ]
    });

    res.json({
      success: true,
      message: `Stats Stricker de [${squad.tag}] ${squad.name} réinitialisées avec succès`,
      squad
    });
  } catch (error) {
    console.error('Reset squad stricker stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Delete squad (admin/staff)
router.delete('/admin/:squadId', verifyToken, requireStaff, async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Remove squad reference from all members
    await User.updateMany(
      { squad: squad._id },
      { $unset: { squad: 1 } }
    );

    await Squad.findByIdAndDelete(req.params.squadId);

    // Log to Discord
    await logAdminAction(req.user, 'Delete Squad', squad.name, {
      fields: [
        { name: 'Tag', value: squad.tag },
        { name: 'Membres', value: squad.members.length.toString() }
      ]
    });

    res.json({
      success: true,
      message: 'Escouade supprimée'
    });
  } catch (error) {
    console.error('Delete squad error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Reset all squads stats (admin only)
router.post('/admin/reset-all-squads-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Reset all squads stats
    const squadResult = await Squad.updateMany(
      {},
      {
        $set: {
          'stats.totalWins': 0,
          'stats.totalLosses': 0,
          'stats.totalPoints': 0,
          'statsHardcore.totalWins': 0,
          'statsHardcore.totalLosses': 0,
          'statsHardcore.totalPoints': 0,
          'statsCDL.totalWins': 0,
          'statsCDL.totalLosses': 0,
          'statsCDL.totalPoints': 0
        }
      }
    );

    // Reset all ladder registrations stats
    await Squad.updateMany(
      { 'registeredLadders.0': { $exists: true } },
      {
        $set: {
          'registeredLadders.$[].points': 0,
          'registeredLadders.$[].wins': 0,
          'registeredLadders.$[].losses': 0
        }
      }
    );

    // Delete all completed matches (ladder matches)
    const matchResult = await Match.deleteMany({ status: 'completed' });


    // Log to Discord
    await logAdminAction(req.user, 'Reset All Squads Stats', 'GLOBAL', {
      description: `${squadResult.modifiedCount} escouades réinitialisées, ${matchResult.deletedCount} matchs supprimés`
    });

    res.json({
      success: true,
      message: `Stats réinitialisées pour ${squadResult.modifiedCount} escouades, ${matchResult.deletedCount} matchs supprimés`,
      squadsUpdated: squadResult.modifiedCount,
      matchesDeleted: matchResult.deletedCount
    });
  } catch (error) {
    console.error('Reset all squads stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation des stats'
    });
  }
});

// Kick member from squad (admin/staff)
router.post('/admin/:squadId/kick/:memberId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { squadId, memberId } = req.params;
    
    const squad = await Squad.findById(squadId);
    if (!squad) {
      return res.status(404).json({
        success: false,
        message: 'Escouade non trouvée'
      });
    }

    // Can't kick the leader
    if (squad.leader.toString() === memberId) {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'expulser le leader de l\'escouade'
      });
    }

    // Check if member exists in squad (compare with user._id or user reference)
    const memberIndex = squad.members.findIndex(m => {
      const memberUserId = m.user?._id?.toString() || m.user?.toString();
      return memberUserId === memberId;
    });
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Membre non trouvé dans l\'escouade'
      });
    }

    // Get the user reference before removing
    const memberToKick = squad.members[memberIndex];
    const userIdToUpdate = memberToKick.user?._id || memberToKick.user;

    // Remove member from squad
    squad.members.splice(memberIndex, 1);
    await squad.save();

    // Update user's squad reference
    await User.findByIdAndUpdate(
      userIdToUpdate,
      { $unset: { squad: 1 } }
    );

    // Get kicked user info for logging
    const kickedUser = await User.findById(userIdToUpdate).select('username');

    // Log to Discord
    await logAdminAction(req.user, 'Kick Member', squad.name, {
      fields: [
        { name: 'Membre expulsé', value: kickedUser?.username || 'Inconnu' }
      ]
    });

    res.json({
      success: true,
      message: 'Membre expulsé avec succès'
    });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;



