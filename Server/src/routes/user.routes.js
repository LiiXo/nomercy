import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import ShopItem from '../models/ShopItem.js';
import Trophy from '../models/Trophy.js';
import Announcement from '../models/Announcement.js';
import AccountDeletion from '../models/AccountDeletion.js';
import Ranking from '../models/Ranking.js';
import { verifyToken, requireCompleteProfile, requireAdmin, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import { logPlayerBan, logPlayerUnban, logAdminAction, logPlayerWarn, logRankedBan, logRankedUnban, logReferentBan, sendPlayerSummon } from '../services/discordBot.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for banner upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/banners');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const bannerUpload = multer({
  storage: storage,
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

// Configure multer for avatar upload
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
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

// Search users (for finding helpers, etc.)
// Admin/staff/arbitre can also see banned players via includeBanned=true
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5, includeBanned } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    // Check if user wants to include banned players and has permission
    let canIncludeBanned = false;
    if (includeBanned === 'true') {
      // Try to get user from token (optional auth)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
          const requestingUser = await User.findById(decoded.id).select('roles');
          if (requestingUser && (
            requestingUser.roles.includes('admin') ||
            requestingUser.roles.includes('staff') ||
            requestingUser.roles.includes('arbitre')
          )) {
            canIncludeBanned = true;
          }
        } catch (e) {
          // Invalid token, just ignore
        }
      }
      // Also check for cookie-based auth
      if (!canIncludeBanned && req.cookies && req.cookies.jwt) {
        try {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(req.cookies.jwt, process.env.JWT_SECRET);
          const requestingUser = await User.findById(decoded.id).select('roles');
          if (requestingUser && (
            requestingUser.roles.includes('admin') ||
            requestingUser.roles.includes('staff') ||
            requestingUser.roles.includes('arbitre')
          )) {
            canIncludeBanned = true;
          }
        } catch (e) {
          // Invalid token, just ignore
        }
      }
    }

    const query = {
      isProfileComplete: true,
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { activisionId: { $regex: q, $options: 'i' } }
      ]
    };

    // Only filter out banned users if not explicitly including them
    if (!canIncludeBanned) {
      query.isBanned = false;
    }

    const users = await User.find(query)
      .select('_id username avatar discordAvatar discordId activisionId platform isBanned')
      .limit(parseInt(limit));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Check anticheat status for a player (GGSecure integration)
// L'ID GGSecure est l'_id du joueur NoMercy
// ID du projet NoMercy sur GGSecure
const GGSECURE_PROJECT_ID = '693cef61be96745c4607e233';
// Clé API GGSecure (à configurer dans .env : GGSECURE_API_KEY=votre_cle)
const GGSECURE_API_KEY = process.env.GGSECURE_API_KEY;

// Get username by user ID (returns plain text)
router.get('/username/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('username');
    if (!user) {
      return res.status(404).type('text/plain').send('User not found');
    }
    res.type('text/plain').send(user.username);
  } catch (error) {
    console.error('Error fetching username:', error);
    res.status(500).type('text/plain').send('Error');
  }
});

router.get('/anticheat-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('platform username');
    
    if (!user) {
      return res.status(404).json({ success: false, isOnline: false, message: 'User not found' });
    }
    
    // Si le joueur n'est pas sur PC, pas besoin de GGSecure
    if (user.platform !== 'PC') {
      return res.json({ success: true, isOnline: true, reason: 'not_pc' });
    }
    
    // Vérifier si la clé API est configurée
    if (!GGSECURE_API_KEY) {
      console.warn('[GGSecure] API key not configured! Add GGSECURE_API_KEY to .env file');
      // Si pas de clé API, on laisse passer pour ne pas bloquer
      return res.json({ 
        success: true, 
        isOnline: true, 
        reason: 'api_key_missing',
        message: 'GGSecure API key not configured'
      });
    }
    
    // Appeler l'API GGSecure en temps réel
    try {
      // L'endpoint qui a renvoyé 401 (donc qui existe et nécessite auth)
      const ggsecureUrl = `https://api.ggsecure.io/api/v1/fingerprints/player/${userId}`;
      
      
      const response = await fetch(ggsecureUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GGSECURE_API_KEY}`,
          'X-API-Key': GGSECURE_API_KEY
        }
      });
      
      
      if (response.ok) {
        const ggsecureData = await response.json();
        
        // Vérifier isOnline dans différentes structures de réponse possibles
        const isOnline = ggsecureData.data?.isOnline === true || 
                         ggsecureData.isOnline === true ||
                         ggsecureData.data?.online === true ||
                         ggsecureData.online === true ||
                         ggsecureData.data?.status === 'online' ||
                         ggsecureData.status === 'online' ||
                         ggsecureData.connected === true ||
                         ggsecureData.data?.connected === true;
        
        const isBanned = ggsecureData.data?.banned === true || 
                         ggsecureData.banned === true ||
                         ggsecureData.data?.isBanned === true ||
                         ggsecureData.isBanned === true;
        
        // Si le joueur est banni sur GGSecure, il ne peut pas jouer
        if (isBanned) {
          return res.json({ 
            success: true, 
            isOnline: false, 
            reason: 'banned',
            message: 'Player is banned on GGSecure'
          });
        }
        
        return res.json({ 
          success: true, 
          isOnline: isOnline
        });
      } else if (response.status === 404) {
        // Joueur non trouvé dans GGSecure
        return res.json({ 
          success: true, 
          isOnline: false, 
          reason: 'not_registered',
          message: 'Player not registered in GGSecure'
        });
      } else if (response.status === 401) {
        console.error('[GGSecure] Authentication failed - check API key');
        return res.json({ 
          success: true, 
          isOnline: true, 
          reason: 'auth_failed',
          message: 'GGSecure authentication failed'
        });
      } else {
        return res.json({ 
          success: true, 
          isOnline: true, 
          reason: 'api_error',
          message: `GGSecure returned HTTP ${response.status}`
        });
      }
    } catch (ggsecureError) {
      console.error('[GGSecure] API error:', ggsecureError.message);
      // En cas d'erreur avec l'API GGSecure, on laisse passer pour ne pas bloquer
      return res.json({ 
        success: true, 
        isOnline: true, 
        reason: 'ggsecure_api_error',
        message: 'Could not verify GGSecure status'
      });
    }
  } catch (error) {
    console.error('Anticheat status error:', error);
    res.status(500).json({ success: false, isOnline: false, message: 'Server error' });
  }
});

// Setup/complete profile (first time after Discord login)
router.put('/setup-profile', verifyToken, async (req, res) => {
  try {
    const { username, bio, platform, activisionId } = req.body;

    // Validate username
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long.'
      });
    }

    if (username.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username cannot exceed 20 characters.'
      });
    }

    // Validate platform
    const validPlatforms = ['PC', 'PlayStation', 'Xbox'];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid platform.'
      });
    }

    // Validate Activision ID
    if (!activisionId || activisionId.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Activision ID is required.'
      });
    }

    // Check if username is already taken (by another user)
    const existingUser = await User.findOne({ 
      username: username.trim(),
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'This username is already taken.'
      });
    }

    // Update user profile
    req.user.username = username.trim();
    req.user.bio = bio ? bio.trim() : '';
    req.user.platform = platform;
    req.user.activisionId = activisionId.trim();
    req.user.isProfileComplete = true;
    await req.user.save();

    res.json({
      success: true,
      message: 'Profile setup complete!',
      user: {
        id: req.user._id,
        discordId: req.user.discordId,
        discordUsername: req.user.discordUsername,
        username: req.user.username,
        bio: req.user.bio,
        avatar: req.user.avatarUrl,
        roles: req.user.roles,
        isProfileComplete: req.user.isProfileComplete,
        goldCoins: req.user.goldCoins,
        platform: req.user.platform,
        activisionId: req.user.activisionId,
        stats: req.user.stats
      }
    });
  } catch (error) {
    console.error('Profile setup error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while setting up your profile.'
    });
  }
});

// Upload banner
router.post('/upload-banner', verifyToken, bannerUpload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old banner if exists
    if (req.user.banner) {
      const oldBannerPath = path.join(__dirname, '../../uploads/banners', path.basename(req.user.banner));
      if (fs.existsSync(oldBannerPath)) {
        fs.unlinkSync(oldBannerPath);
      }
    }

    // Save banner URL
    const bannerUrl = `/uploads/banners/${req.file.filename}`;
    req.user.banner = bannerUrl;
    await req.user.save();

    res.json({
      success: true,
      message: 'Banner uploaded successfully',
      bannerUrl
    });
  } catch (error) {
    console.error('Banner upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading banner'
    });
  }
});

// Delete banner
router.delete('/delete-banner', verifyToken, async (req, res) => {
  try {
    if (!req.user.banner) {
      return res.status(400).json({
        success: false,
        message: 'No banner to delete'
      });
    }

    // Delete banner file
    const bannerPath = path.join(__dirname, '../../uploads/banners', path.basename(req.user.banner));
    if (fs.existsSync(bannerPath)) {
      fs.unlinkSync(bannerPath);
    }

    req.user.banner = null;
    await req.user.save();

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Banner delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting banner'
    });
  }
});

// Upload avatar
router.post('/upload-avatar', verifyToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old custom avatar if exists (not Discord avatar)
    if (req.user.avatar && req.user.avatar.startsWith('/uploads/avatars/')) {
      const oldAvatarPath = path.join(__dirname, '../../uploads/avatars', path.basename(req.user.avatar));
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Save avatar URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    req.user.avatar = avatarUrl;
    await req.user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading avatar'
    });
  }
});

// Delete avatar (revert to Discord avatar)
router.delete('/delete-avatar', verifyToken, async (req, res) => {
  try {
    if (!req.user.avatar || !req.user.avatar.startsWith('/uploads/avatars/')) {
      return res.status(400).json({
        success: false,
        message: 'No custom avatar to delete'
      });
    }

    // Delete avatar file
    const avatarPath = path.join(__dirname, '../../uploads/avatars', path.basename(req.user.avatar));
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    req.user.avatar = null; // Will fallback to Discord avatar via avatarUrl virtual
    await req.user.save();

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting avatar'
    });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { username, bio, avatar, activisionId, platform } = req.body;

    // Validate platform if provided
    if (platform !== undefined) {
      const validPlatforms = ['PC', 'PlayStation', 'Xbox'];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          message: 'Please select a valid platform (PC, PlayStation, or Xbox).'
        });
      }
      
      // Check if platform is actually changing
      if (platform !== req.user.platform) {
        // Check 24-hour cooldown (only if platform was previously set)
        if (req.user.platform && req.user.platformChangedAt) {
          const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          const timeSinceLastChange = Date.now() - new Date(req.user.platformChangedAt).getTime();
          
          if (timeSinceLastChange < cooldownMs) {
            const remainingMs = cooldownMs - timeSinceLastChange;
            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            return res.status(400).json({
              success: false,
              message: `You must wait ${remainingHours} hour(s) before changing your platform again.`,
              platformCooldownRemaining: remainingMs
            });
          }
        }
        
        req.user.platform = platform;
        req.user.platformChangedAt = new Date();
      }
    }

    // Validate username if provided
    if (username) {
      if (username.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long.'
        });
      }

      if (username.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Username cannot exceed 20 characters.'
        });
      }

      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username: username.trim(),
        _id: { $ne: req.user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken.'
        });
      }

      req.user.username = username.trim();
    }

    if (bio !== undefined) {
      req.user.bio = bio.trim().substring(0, 500);
    }

    if (avatar !== undefined) {
      req.user.avatar = avatar;
    }

    if (activisionId !== undefined) {
      req.user.activisionId = activisionId.trim();
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: req.user._id,
        discordId: req.user.discordId,
        discordUsername: req.user.discordUsername,
        username: req.user.username,
        bio: req.user.bio,
        avatar: req.user.avatarUrl,
        banner: req.user.banner,
        activisionId: req.user.activisionId,
        platform: req.user.platform,
        platformChangedAt: req.user.platformChangedAt,
        roles: req.user.roles,
        isProfileComplete: req.user.isProfileComplete,
        goldCoins: req.user.goldCoins,
        stats: req.user.stats
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating your profile.'
    });
  }
});

// Get user by username (public profile)
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ 
      username: req.params.username,
      isProfileComplete: true,
      isBanned: false
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Calculate total wins and losses (including ranked matches)
    // Filter out matches before statsResetAt if the user has reset their stats
    let totalWins = 0;
    let totalLosses = 0;
    const statsResetAt = user.statsResetAt || null;

    // Count wins/losses from squad matches (only after stats reset if applicable)
    const squadMatchQuery = {
      status: 'completed',
      $or: [
        { 'challengerRoster.user': user._id },
        { 'opponentRoster.user': user._id }
      ],
      'result.winner': { $exists: true }
    };
    
    // Filter by statsResetAt if the user has reset their stats
    if (statsResetAt) {
      squadMatchQuery['result.confirmedAt'] = { $gt: statsResetAt };
    }
    
    const squadMatches = await Match.find(squadMatchQuery)
      .populate('result.winner challenger opponent');

    for (const match of squadMatches) {
      // Determine which squad the user was in
      const isInChallenger = match.challengerRoster.some(r => r.user.toString() === user._id.toString());
      const userSquad = isInChallenger ? match.challenger : match.opponent;
      
      if (!userSquad) continue;

      // Check if user's squad won
      if (match.result.winner && match.result.winner.toString() === userSquad._id.toString()) {
        totalWins++;
      } else {
        totalLosses++;
      }
    }

    // Count wins/losses from ranked matches (only after stats reset if applicable)
    const RankedMatch = (await import('../models/RankedMatch.js')).default;
    const rankedMatchQuery = {
      status: 'completed',
      'players.user': user._id,
      'result.winner': { $exists: true }
    };
    
    // Filter by statsResetAt if the user has reset their stats
    if (statsResetAt) {
      rankedMatchQuery.completedAt = { $gt: statsResetAt };
    }
    
    const rankedMatches = await RankedMatch.find(rankedMatchQuery);

    for (const match of rankedMatches) {
      const player = match.players.find(p => p.user.toString() === user._id.toString());
      if (!player) continue;

      // Check if user won
      if (match.gameMode === 'Duel') {
        // For Duel, check if user is the winner
        if (match.result.winnerUser && match.result.winnerUser.toString() === user._id.toString()) {
          totalWins++;
        } else {
          totalLosses++;
        }
      } else if (match.gameMode === 'Team Deathmatch') {
        // For Team Deathmatch, check if user has highest score
        // This is a free-for-all mode, so we check winnerUser
        if (match.result.winnerUser && match.result.winnerUser.toString() === user._id.toString()) {
          totalWins++;
        } else {
          totalLosses++;
        }
      } else {
        // For team modes (Domination, Search & Destroy)
        if (player.team && match.result.winner === `team${player.team}`) {
          totalWins++;
        } else {
          totalLosses++;
        }
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatar: user.avatarUrl,
        banner: user.banner,
        platform: user.platform,
        activisionId: user.activisionId,
        stats: user.stats,
        totalStats: {
          wins: totalWins,
          losses: totalLosses
        },
        createdAt: user.createdAt,
        // MVP counts per mode
        mvpCountHardcore: user.mvpCountHardcore || 0,
        mvpCountCdl: user.mvpCountCdl || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Get user by ID (public profile)
router.get('/by-id/:id', async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    const mongoose = await import('mongoose');
    if (!mongoose.default.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.'
      });
    }
    
    const user = await User.findOne({ 
      _id: req.params.id,
      isProfileComplete: true,
      isBanned: false
    }).populate('equippedTitle', 'name nameTranslations icon color rarity')
      .populate('equippedProfileAnimation', 'name nameTranslations icon color rarity profileAnimationData')
      .populate({
        path: 'trophies.trophy',
        model: 'Trophy',
        select: 'name translations icon color rarity rarityName'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Calculate total wins and losses (including ranked matches)
    // Filter out matches before statsResetAt if the user has reset their stats
    let totalWins = 0;
    let totalLosses = 0;
    const statsResetAt = user.statsResetAt || null;

    // Count wins/losses from squad matches (only after stats reset if applicable)
    const squadMatchQuery = {
      status: 'completed',
      $or: [
        { 'challengerRoster.user': user._id },
        { 'opponentRoster.user': user._id }
      ],
      'result.winner': { $exists: true }
    };
    
    // Filter by statsResetAt if the user has reset their stats
    if (statsResetAt) {
      squadMatchQuery['result.confirmedAt'] = { $gt: statsResetAt };
    }
    
    const squadMatches = await Match.find(squadMatchQuery)
      .populate('result.winner challenger opponent');

    for (const match of squadMatches) {
      const isInChallenger = match.challengerRoster.some(r => r.user.toString() === user._id.toString());
      const userSquad = isInChallenger ? match.challenger : match.opponent;
      
      if (!userSquad) continue;

      if (match.result.winner && match.result.winner.toString() === userSquad._id.toString()) {
        totalWins++;
      } else {
        totalLosses++;
      }
    }

    // Count wins/losses from ranked matches (only after stats reset if applicable)
    const RankedMatch = (await import('../models/RankedMatch.js')).default;
    const rankedMatchQuery = {
      status: 'completed',
      'players.user': user._id,
      'result.winner': { $exists: true }
    };
    
    // Filter by statsResetAt if the user has reset their stats
    if (statsResetAt) {
      rankedMatchQuery.completedAt = { $gt: statsResetAt };
    }
    
    const rankedMatches = await RankedMatch.find(rankedMatchQuery);

    for (const match of rankedMatches) {
      const player = match.players.find(p => {
        const pUserId = p.user?._id?.toString() || p.user?.toString();
        return pUserId === user._id.toString();
      });
      if (!player) continue;

      // match.result.winner est un nombre (1 ou 2) représentant l'équipe gagnante
      const winningTeam = match.result.winner;
      if (player.team === winningTeam) {
        totalWins++;
      } else {
        totalLosses++;
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatar: user.avatarUrl,
        banner: user.banner,
        platform: user.platform,
        activisionId: user.activisionId,
        stats: user.stats,
        statsHardcore: user.statsHardcore,
        statsCdl: user.statsCdl,
        totalStats: {
          wins: totalWins,
          losses: totalLosses
        },
        equippedTitle: user.equippedTitle,
        equippedProfileAnimation: user.equippedProfileAnimation,
        trophies: (user.trophies || []).filter(t => t.trophy != null),
        createdAt: user.createdAt,
        // MVP counts per mode
        mvpCountHardcore: user.mvpCountHardcore || 0,
        mvpCountCdl: user.mvpCountCdl || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user profile by ID:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Get user's squad by ID (public) - supports mode parameter for mode-specific squads
router.get('/by-id/:id/squad', async (req, res) => {
  try {
    const { mode } = req.query;
    
    // Import Squad model for checking legacy squad mode
    const Squad = (await import('../models/Squad.js')).default;
    
    const user = await User.findOne({ 
      _id: req.params.id,
      isProfileComplete: true,
      isBanned: false
    }).populate('squad').populate('squadHardcore').populate('squadCdl');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Determine which squad to return based on mode
    let squad = null;
    
    if (mode === 'hardcore') {
      // First check mode-specific field
      squad = user.squadHardcore;
      
      // If no hardcore-specific squad, check legacy field for compatible squads
      if (!squad && user.squad && (user.squad.mode === 'both' || user.squad.mode === 'hardcore')) {
        squad = user.squad;
      }
    } else if (mode === 'cdl') {
      // First check mode-specific field
      squad = user.squadCdl;
      
      // If no cdl-specific squad, check legacy field for compatible squads
      if (!squad && user.squad && (user.squad.mode === 'both' || user.squad.mode === 'cdl')) {
        squad = user.squad;
      }
    } else {
      // Fallback: try legacy field first, then mode-specific fields
      squad = user.squad || user.squadHardcore || user.squadCdl;
    }
    
    if (!squad) {
      return res.json({
        success: true,
        squad: null
      });
    }

    res.json({
      success: true,
      squad: {
        _id: squad._id,
        id: squad._id,
        name: squad.name,
        tag: squad.tag,
        logo: squad.logo,
        color: squad.color,
        mode: squad.mode
      }
    });
  } catch (error) {
    console.error('Error fetching user squad by ID:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Get user's squad by username (public)
router.get('/profile/:username/squad', async (req, res) => {
  try {
    const user = await User.findOne({ 
      username: req.params.username,
      isProfileComplete: true,
      isBanned: false
    }).populate('squad');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.squad) {
      return res.json({
        success: true,
        squad: null
      });
    }

    // Import Squad model for population
    const Squad = (await import('../models/Squad.js')).default;
    const squad = await Squad.findById(user.squad)
      .populate('leader', 'username avatarUrl discordAvatar discordId')
      .populate('members.user', 'username avatarUrl discordAvatar discordId');

    res.json({
      success: true,
      squad: squad ? {
        _id: squad._id,
        name: squad.name,
        tag: squad.tag,
        description: squad.description,
        color: squad.color,
        logo: squad.logo,
        mode: squad.mode,
        leader: squad.leader,
        members: squad.members,
        stats: squad.stats,
        memberCount: squad.members?.length || 0
      } : null
    });
  } catch (error) {
    console.error('Error fetching user squad:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const username = req.params.username.trim();

    if (username.length < 3) {
      return res.json({ available: false, message: 'Username too short' });
    }

    const existingUser = await User.findOne({ username });
    res.json({ 
      available: !existingUser,
      message: existingUser ? 'Username already taken' : 'Username available'
    });
  } catch (error) {
    res.status(500).json({ available: false, message: 'Error checking username' });
  }
});

// Delete account immediately (user can delete their own account)
router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is banned
    if (req.user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre compte car vous êtes banni.'
      });
    }

    // Get user's rankings
    const rankings = await Ranking.find({ user: userId });
    
    // Create deletion record (snapshot)
    await AccountDeletion.create({
      deletedUserId: req.user._id,
      username: req.user.username,
      discordId: req.user.discordId,
      discordUsername: req.user.discordUsername,
      email: req.user.discordEmail || null,
      stats: req.user.stats,
      goldCoins: req.user.goldCoins,
      squadId: req.user.squad || null,
      rankings: rankings.map(r => ({
        mode: r.mode,
        points: r.points,
        wins: r.wins,
        losses: r.losses,
        rank: r.rank
      })),
      scheduledFor: new Date(), // Required field - set to now for immediate deletion
      deletedAt: new Date(),
      deletedBy: 'self',
      status: 'completed'
    });

    // If user has a squad, remove them from it
    if (req.user.squad) {
      try {
        const squad = await Squad.findById(req.user.squad);
        if (squad) {
          // Check if user is the leader (with null safety)
          const isUserLeader = squad.leader && squad.leader.toString() === userId.toString();
          
          // Remove user from squad members
          squad.members = squad.members.filter(
            m => m.user && m.user.toString() !== userId.toString()
          );
          
          // If user was the leader and squad is now empty, delete the squad
          if (isUserLeader && squad.members.length === 0) {
            await Squad.findByIdAndDelete(squad._id);
          } else if (isUserLeader && squad.members.length > 0) {
            // Transfer leadership to the first officer or first member
            const newLeader = squad.members.find(m => m.role === 'officer') || squad.members[0];
            if (newLeader && newLeader.user) {
              squad.leader = newLeader.user;
              newLeader.role = 'leader';
              await squad.save();
            }
          } else {
            // Just save the squad without the deleted member
            await squad.save();
          }
        }
      } catch (squadError) {
        console.error('Error removing user from squad:', squadError);
        // Continue with account deletion even if squad update fails
      }
    }

    // Delete user's rankings
    await Ranking.deleteMany({ user: userId });
    
    // Delete the user
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Votre compte a été supprimé avec succès.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue.'
    });
  }
});

// Reset own stats - first one is FREE, then costs 2000 gold each
router.post('/reset-my-stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const RESET_COST = 5000;
    const resetCount = req.user.statsResetCount || 0;
    const isFirstReset = resetCount === 0;
    const actualCost = isFirstReset ? 0 : RESET_COST;

    // Check if user has enough gold (only if not first reset)
    if (!isFirstReset && req.user.goldCoins < RESET_COST) {
      return res.status(400).json({
        success: false,
        message: `Vous avez besoin de ${RESET_COST} gold pour réinitialiser vos stats. Vous avez ${req.user.goldCoins} gold.`
      });
    }

    // Check if user is in an active match
    const activeRankedMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    });

    if (activeRankedMatch) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas réinitialiser vos stats pendant un match classé actif.'
      });
    }

    const activeMatch = await Match.findOne({
      $or: [
        { 'challengerRoster.user': userId },
        { 'opponentRoster.user': userId }
      ],
      status: { $in: ['pending', 'accepted', 'in_progress'] }
    });

    if (activeMatch) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas réinitialiser vos stats pendant un match actif.'
      });
    }

    // Deduct gold (only if not first reset)
    if (!isFirstReset) {
      req.user.goldCoins -= RESET_COST;
    }

    // Reset stats (preserve XP - it represents overall player experience/ranking)
    const currentXp = req.user.stats?.xp || 0;
    const currentHardcoreXp = req.user.statsHardcore?.xp || 0;
    const currentCdlXp = req.user.statsCdl?.xp || 0;
    
    req.user.stats = {
      wins: 0,
      losses: 0,
      points: 0,
      xp: currentXp, // Preserve XP
      rank: null
    };
    
    // Reset hardcore stats if they exist (preserve XP)
    if (req.user.statsHardcore) {
      req.user.statsHardcore = {
        wins: 0,
        losses: 0,
        points: 0,
        xp: currentHardcoreXp, // Preserve XP
        rank: null
      };
    }
    
    // Reset CDL stats if they exist (preserve XP)
    if (req.user.statsCdl) {
      req.user.statsCdl = {
        wins: 0,
        losses: 0,
        points: 0,
        xp: currentCdlXp, // Preserve XP
        rank: null
      };
    }

    // Increment stats reset count and set reset timestamp
    req.user.statsResetCount = (req.user.statsResetCount || 0) + 1;
    req.user.statsResetAt = new Date(); // Track when stats were reset for filtering match history

    await req.user.save();

    // Reset rankings in Ranking collection (for ranked mode) - reset ALL fields
    await Ranking.updateMany(
      { user: userId },
      { 
        $set: { 
          points: 0, 
          wins: 0, 
          losses: 0,
          kills: 0,
          deaths: 0,
          currentStreak: 0,
          bestStreak: 0,
          rank: 0,
          division: 'bronze'
        } 
      }
    );

    // Count matches that will be affected (for logging)
    const ladderMatchCount = req.user.matchHistory?.length || 0;

    const rankedMatchCount = await RankedMatch.countDocuments({
      'players.user': userId,
      status: 'completed'
    });

    // Clear user's personal match history (this only affects what THEY see)
    // We do NOT remove them from match rosters - other players should still see them in their history
    await User.updateOne(
      { _id: userId },
      { $set: { matchHistory: [] } }
    );


    res.json({
      success: true,
      message: isFirstReset 
        ? 'Vos statistiques ont été réinitialisées gratuitement !' 
        : 'Vos statistiques ont été réinitialisées avec succès.',
      goldSpent: actualCost,
      newGoldBalance: req.user.goldCoins,
      resetCount: req.user.statsResetCount,
      matchesCleared: {
        ladder: ladderMatchCount,
        ranked: rankedMatchCount
      }
    });
  } catch (error) {
    console.error('Reset my stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la réinitialisation.'
    });
  }
});

// Admin: Get all users (admin, staff, arbitre)
router.get('/admin/all', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = search ? {
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { discordUsername: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await User.find(query)
      .populate('bannedBy', 'username discordUsername')
      .populate('squad', 'name tag')
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Get overall stats for dashboard (MUST be before :userId routes)
router.get('/admin/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSquads = await Squad.countDocuments();
    
    // Compter uniquement les matchs "completed" par ladder
    const completedMatchesDuoTrio = await Match.countDocuments({ 
      status: 'completed', 
      ladderId: 'duo-trio' 
    });
    const completedMatchesSquadTeam = await Match.countDocuments({ 
      status: 'completed', 
      ladderId: 'squad-team' 
    });
    
    // Compter les matchs classés "completed"
    const completedRankedMatches = await RankedMatch.countDocuments({ 
      status: 'completed' 
    });
    
    // Total des matchs completed
    const totalMatches = completedMatchesDuoTrio + completedMatchesSquadTeam + completedRankedMatches;
    
    const totalShopItems = await ShopItem.countDocuments();
    const totalTrophies = await Trophy.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({ isActive: true });

    // Gold statistics
    const topGoldUser = await User.findOne({ isProfileComplete: true })
      .sort({ goldCoins: -1 })
      .select('username goldCoins avatar');
    
    const goldAggregation = await User.aggregate([
      { $match: { isProfileComplete: true } },
      { $group: { 
        _id: null, 
        totalGold: { $sum: '$goldCoins' },
        avgGold: { $avg: '$goldCoins' },
        count: { $sum: 1 }
      }}
    ]);
    
    const goldStats = goldAggregation[0] || { totalGold: 0, avgGold: 0, count: 0 };

    // Get registrations for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const registrationsLast30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const count = await User.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
      
      registrationsLast30Days.push({
        date: startOfDay.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        value: count
      });
    }

    // Note: For visitors data, you would need to implement actual tracking
    // For now, we'll return empty array and let frontend handle it
    const visitorsLast30Days = [];

    // Get ranked matches per day for the last 10 days
    const rankedMatchesLast10Days = [];
    for (let i = 9; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const count = await RankedMatch.countDocuments({
        status: 'completed',
        completedAt: { $gte: startOfDay, $lte: endOfDay }
      });
      
      rankedMatchesLast10Days.push({
        date: startOfDay.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        fullDate: startOfDay.toISOString().split('T')[0],
        value: count
      });
    }

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSquads,
        totalMatches,
        matchesByLadder: {
          duoTrio: completedMatchesDuoTrio,
          squadTeam: completedMatchesSquadTeam,
          ranked: completedRankedMatches
        },
        totalShopItems,
        totalTrophies,
        activeAnnouncements,
        registrationsLast30Days,
        visitorsLast30Days,
        rankedMatchesLast10Days,
        goldStats: {
          topUser: topGoldUser ? {
            username: topGoldUser.username,
            goldCoins: topGoldUser.goldCoins,
            avatar: topGoldUser.avatar
          } : null,
          totalGold: goldStats.totalGold,
          averageGold: Math.round(goldStats.avgGold || 0),
          usersWithGold: goldStats.count
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Admin: Get user stats overview (MUST be before :userId routes)
router.get('/admin/stats/overview', verifyToken, requireStaff, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isProfileComplete: true, isBanned: false });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const roleStats = await User.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } }
    ]);

    const topGoldUsers = await User.find({ isProfileComplete: true })
      .sort({ goldCoins: -1 })
      .limit(5)
      .select('username goldCoins');

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        newUsersToday,
        newUsersThisWeek,
        roleStats,
        topGoldUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Update user roles
router.put('/admin/:userId/roles', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { roles } = req.body;
    const validRoles = ['user', 'admin', 'staff', 'gerant_cdl', 'gerant_hardcore'];

    if (!Array.isArray(roles) || !roles.every(r => validRoles.includes(r))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid roles provided.'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const previousRoles = [...user.roles];
    user.roles = roles;
    await user.save();

    // Log to Discord
    await logAdminAction(req.user, 'Update Roles', user.username, {
      fields: [
        { name: 'Anciens rôles', value: previousRoles.join(', ') || 'Aucun' },
        { name: 'Nouveaux rôles', value: roles.join(', ') || 'Aucun' }
      ]
    });

    res.json({
      success: true,
      message: 'User roles updated.',
      user: {
        id: user._id,
        username: user.username,
        roles: user.roles
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Ban/Unban user (staff and arbitre can do this)
router.put('/admin/:userId/ban', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { ban, reason, startDate, endDate } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Can't ban admins
    if (user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Cannot ban an admin.'
      });
    }

    user.isBanned = ban;
    user.banReason = ban ? reason : null;
    
    // Set ban dates
    if (ban) {
      user.bannedAt = startDate ? new Date(startDate) : new Date();
      user.banExpiresAt = endDate ? new Date(endDate) : null; // null = permanent
      user.bannedBy = req.user._id;
    } else {
      // Unban
      user.bannedAt = null;
      user.banExpiresAt = null;
      user.bannedBy = null;
    }
    
    await user.save();

    // Populate bannedBy for response
    await user.populate('bannedBy', 'username');

    // Log to Discord
    if (ban) {
      await logPlayerBan(user, req.user, reason, user.bannedAt, user.banExpiresAt);
    } else {
      await logPlayerUnban(user, req.user);
    }

    res.json({
      success: true,
      message: ban ? 'User banned.' : 'User unbanned.',
      user: {
        id: user._id,
        username: user.username,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        banExpiresAt: user.banExpiresAt,
        bannedBy: user.bannedBy,
        banReason: user.banReason
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Toggle referent ban (prevents user from being selected as referent in ranked matches) - staff and arbitre can do this
router.put('/admin/:userId/referent-ban', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { ban } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Can't ban admins
    if (user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Cannot ban an admin from being referent.'
      });
    }

    user.isReferentBanned = ban;
    
    if (ban) {
      user.referentBannedAt = new Date();
      user.referentBannedBy = req.user._id;
    } else {
      user.referentBannedAt = null;
      user.referentBannedBy = null;
    }
    
    await user.save();

    // Populate referentBannedBy for response
    await user.populate('referentBannedBy', 'username');

    // Log to Discord (BAN_LOG_CHANNEL with role mentions)
    await logReferentBan(user, req.user, ban);

    res.json({
      success: true,
      message: ban ? 'User banned from being referent.' : 'User can now be referent.',
      user: {
        id: user._id,
        username: user.username,
        isReferentBanned: user.isReferentBanned,
        referentBannedAt: user.referentBannedAt,
        referentBannedBy: user.referentBannedBy
      }
    });
  } catch (error) {
    console.error('Toggle referent ban error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Reset user stats and delete match history
router.post('/admin/:userId/reset-stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, keepLosses, reduction, newPoints } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouv\u00e9.'
      });
    }

    let message = '';
    let logDescription = '';

    switch (type) {
      case 'general': {
        // Reset general stats and delete match history
        const Match = (await import('../models/Match.js')).default;
        
        const deleteResult = await Match.deleteMany({
          $or: [
            { 'challengerRoster.user': userId },
            { 'opponentRoster.user': userId }
          ]
        });

        // Reset user stats
        const previousLosses = user.stats?.losses || 0;
        user.stats = {
          wins: 0,
          losses: keepLosses ? previousLosses : 0,
          points: 0,
          rank: null
        };
        user.matchHistory = [];
        await user.save();

        message = `Stats g\u00e9n\u00e9rales r\u00e9initialis\u00e9es. ${deleteResult.deletedCount} match(s) supprim\u00e9(s).${keepLosses ? ' D\u00e9faites conserv\u00e9es.' : ''}`;
        logDescription = `Reset stats g\u00e9n\u00e9ral${keepLosses ? ' (d\u00e9faites conserv\u00e9es)' : ''}`;
        break;
      }

      case 'ranked': {
        // Reset ranked stats in Ranking model
        const Ranking = (await import('../models/Ranking.js')).default;
        const RankedMatch = (await import('../models/RankedMatch.js')).default;
        
        // Get current season
        const currentSeasonReset = new Date().getMonth() + 1;
        
        // Get current losses if keeping them
        const hardcoreRanking = await Ranking.findOne({ user: userId, mode: 'hardcore', season: currentSeasonReset });
        const cdlRanking = await Ranking.findOne({ user: userId, mode: 'cdl', season: currentSeasonReset });
        
        const hardcoreLosses = hardcoreRanking?.losses || 0;
        const cdlLosses = cdlRanking?.losses || 0;

        // Reset rankings
        await Ranking.updateMany(
          { user: userId },
          { 
            $set: { 
              wins: 0, 
              losses: keepLosses ? undefined : 0,
              points: 0 
            } 
          }
        );

        if (keepLosses) {
          // Keep losses by not resetting them
          if (hardcoreRanking) {
            await Ranking.updateOne({ _id: hardcoreRanking._id }, { $set: { losses: hardcoreLosses } });
          }
          if (cdlRanking) {
            await Ranking.updateOne({ _id: cdlRanking._id }, { $set: { losses: cdlLosses } });
          }
        }

        // Delete ranked matches
        const deleteResult = await RankedMatch.deleteMany({
          $or: [
            { 'team1.players.odId': user.discordId },
            { 'team2.players.odId': user.discordId }
          ]
        });

        // Reset mode-specific stats
        user.statsHardcore = { ...user.statsHardcore, wins: 0, losses: keepLosses ? user.statsHardcore?.losses : 0, points: 0 };
        user.statsCdl = { ...user.statsCdl, wins: 0, losses: keepLosses ? user.statsCdl?.losses : 0, points: 0 };
        await user.save();

        message = `Stats class\u00e9es r\u00e9initialis\u00e9es. ${deleteResult.deletedCount} match(s) supprim\u00e9(s).${keepLosses ? ' D\u00e9faites conserv\u00e9es.' : ''}`;
        logDescription = `Reset mode class\u00e9${keepLosses ? ' (d\u00e9faites conserv\u00e9es)' : ''}`;
        break;
      }

      case 'xp': {
        // Reset or reduce XP
        const previousHardcoreXP = user.statsHardcore?.xp || 0;
        const previousCdlXP = user.statsCdl?.xp || 0;
        
        let newHardcoreXP, newCdlXP;
        
        if (reduction === 100) {
          // Full reset to 0
          newHardcoreXP = 0;
          newCdlXP = 0;
        } else {
          // Reduce by percentage
          newHardcoreXP = Math.round(previousHardcoreXP * (1 - reduction / 100));
          newCdlXP = Math.round(previousCdlXP * (1 - reduction / 100));
        }

        user.statsHardcore = { ...user.statsHardcore, xp: newHardcoreXP };
        user.statsCdl = { ...user.statsCdl, xp: newCdlXP };
        await user.save();

        message = reduction === 100 
          ? 'XP r\u00e9initialis\u00e9 \u00e0 0 pour tous les modes.'
          : `XP r\u00e9duit de ${reduction}%. Hardcore: ${previousHardcoreXP} \u2192 ${newHardcoreXP}, CDL: ${previousCdlXP} \u2192 ${newCdlXP}`;
        logDescription = reduction === 100 ? 'Reset XP \u00e0 0' : `Retrait ${reduction}% XP`;
        break;
      }

      case 'ranked-points': {
        // Deduct ranked points
        const Ranking = (await import('../models/Ranking.js')).default;
        
        // Get current season
        const currentSeasonPoints = new Date().getMonth() + 1;
        
        // Get current rankings
        const hardcoreRanking = await Ranking.findOne({ user: userId, mode: 'hardcore', season: currentSeasonPoints });
        const cdlRanking = await Ranking.findOne({ user: userId, mode: 'cdl', season: currentSeasonPoints });
        
        const currentTotal = (hardcoreRanking?.points || 0) + (cdlRanking?.points || 0);
        const pointsToRemove = currentTotal - newPoints;
        
        if (pointsToRemove <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Les nouveaux points doivent \u00eatre inf\u00e9rieurs aux points actuels.'
          });
        }

        // Distribute the reduction proportionally
        const hardcorePoints = hardcoreRanking?.points || 0;
        const cdlPoints = cdlRanking?.points || 0;
        
        let newHardcorePoints, newCdlPoints;
        
        if (currentTotal > 0) {
          // Proportional reduction
          const hardcoreRatio = hardcorePoints / currentTotal;
          newHardcorePoints = Math.round(newPoints * hardcoreRatio);
          newCdlPoints = newPoints - newHardcorePoints;
        } else {
          newHardcorePoints = 0;
          newCdlPoints = 0;
        }

        // Update rankings
        if (hardcoreRanking) {
          await Ranking.updateOne({ _id: hardcoreRanking._id }, { $set: { points: newHardcorePoints } });
        }
        if (cdlRanking) {
          await Ranking.updateOne({ _id: cdlRanking._id }, { $set: { points: newCdlPoints } });
        }

        message = `Points class\u00e9s modifi\u00e9s: ${currentTotal} \u2192 ${newPoints} (-${pointsToRemove} pts)`;
        logDescription = `Retrait ${pointsToRemove} points class\u00e9s`;
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: 'Type de reset invalide.'
        });
    }


    // Log to Discord
    await logAdminAction(req.user, 'Reset Stats', user.username, {
      description: logDescription
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Reset user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la r\u00e9initialisation.'
    });
  }
});

// Admin: Summon a user (send Discord notification and create voice channel)
router.post('/admin/:userId/summon', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, timeStart, timeEnd, reason, summonedBy } = req.body;

    // Validate required fields
    if (!date || !timeStart || !timeEnd || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Date, horaires et raison sont requis.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé.'
      });
    }

    // Get the admin/arbitre who is summoning
    const summoner = summonedBy ? {
      username: summonedBy.username,
      discordUsername: summonedBy.username
    } : req.user;

    // Send Discord notification and create voice channel
    const result = await sendPlayerSummon(user, summoner, {
      date,
      timeStart,
      timeEnd,
      reason
    });

    if (result.success) {
      
      res.json({
        success: true,
        message: 'Convocation envoyée avec succès.',
        voiceChannel: result.voiceChannel
      });
    } else {
      // Partial success - voice channel created but DM failed
      if (result.voiceChannel) {
        res.json({
          success: true,
          message: 'Salon vocal créé mais le DM n\'a pas pu être envoyé (DMs fermés).',
          voiceChannel: result.voiceChannel,
          dmFailed: true
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Erreur lors de l\'envoi de la convocation.'
        });
      }
    }
  } catch (error) {
    console.error('Summon user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de la convocation.'
    });
  }
});

// Admin: Add/Remove gold coins
router.put('/admin/:userId/gold', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (amount === undefined || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and cannot be 0.'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const previousGold = user.goldCoins;
    user.goldCoins = Math.max(0, user.goldCoins + parseInt(amount));
    await user.save();

    // Log to Discord
    await logAdminAction(req.user, amount > 0 ? 'Give Gold' : 'Remove Gold', user.username, {
      fields: [
        { name: 'Montant', value: `${amount > 0 ? '+' : ''}${amount} 🪙` },
        { name: 'Avant', value: previousGold.toString() },
        { name: 'Après', value: user.goldCoins.toString() },
        { name: 'Raison', value: reason || 'Non spécifiée', inline: false }
      ]
    });

    res.json({
      success: true,
      message: `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} gold coins.`,
      user: {
        id: user._id,
        username: user.username,
        previousGold,
        goldCoins: user.goldCoins,
        change: parseInt(amount)
      }
    });
  } catch (error) {
    console.error('Gold update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Set gold coins (absolute value)
router.put('/admin/:userId/gold/set', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount === undefined || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be positive.'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const previousGold = user.goldCoins;
    user.goldCoins = parseInt(amount);
    await user.save();

    // Log to Discord
    await logAdminAction(req.user, 'Set Gold', user.username, {
      fields: [
        { name: 'Avant', value: previousGold.toString() },
        { name: 'Après', value: user.goldCoins.toString() }
      ]
    });

    res.json({
      success: true,
      message: `Gold coins set to ${amount}.`,
      user: {
        id: user._id,
        username: user.username,
        previousGold,
        goldCoins: user.goldCoins
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Get deleted accounts (admin, staff, arbitre) - MUST be before /admin/:userId routes
router.get('/admin/deleted-accounts', verifyToken, requireArbitre, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = { status: 'completed' };
    if (search && search.trim()) {
      query.$or = [
        { username: { $regex: search.trim(), $options: 'i' } },
        { discordUsername: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const deletedAccounts = await AccountDeletion.find(query)
      .sort({ deletedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await AccountDeletion.countDocuments(query);

    res.json({
      success: true,
      deletedAccounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get deleted accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      details: error.message
    });
  }
});

// Admin: Get single user details
router.get('/admin/:userId', verifyToken, requireStaff, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('bannedBy', 'username discordUsername')
      .select('-__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }
    
    // Get ranked ladder points and stats
    const Ranking = (await import('../models/Ranking.js')).default;
    const currentSeasonAdmin = new Date().getMonth() + 1;
    const hardcoreRanking = await Ranking.findOne({ user: req.params.userId, mode: 'hardcore', season: currentSeasonAdmin });
    const cdlRanking = await Ranking.findOne({ user: req.params.userId, mode: 'cdl', season: currentSeasonAdmin });
    
    const userObj = user.toObject();
    userObj.rankedPoints = {
      hardcore: hardcoreRanking?.points || 0,
      cdl: cdlRanking?.points || 0
    };
    userObj.rankedStats = {
      hardcore: {
        wins: hardcoreRanking?.wins || 0,
        losses: hardcoreRanking?.losses || 0
      },
      cdl: {
        wins: cdlRanking?.wins || 0,
        losses: cdlRanking?.losses || 0
      }
    };

    res.json({
      success: true,
      user: userObj
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Update user
router.put('/admin/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, goldCoins, roles, platform, activisionId, bio, stats, rankedPoints, rankedStats, ladderStats } = req.body;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Update fields if provided
    if (username !== undefined) user.username = username;
    if (goldCoins !== undefined) user.goldCoins = goldCoins;
    if (roles !== undefined) user.roles = roles;
    if (platform !== undefined) user.platform = platform;
    if (activisionId !== undefined) user.activisionId = activisionId;
    if (bio !== undefined) user.bio = bio;
    
    // Update legacy stats field only (do NOT copy to mode-specific fields - use ladderStats for that)
    // The legacy stats field is deprecated but kept for backward compatibility
    if (stats !== undefined) {
      // Update legacy stats field only
      if (stats.xp !== undefined) user.stats.xp = stats.xp;
      if (stats.points !== undefined) user.stats.points = stats.points;
      if (stats.wins !== undefined) user.stats.wins = stats.wins;
      if (stats.losses !== undefined) user.stats.losses = stats.losses;
      if (stats.rank !== undefined) user.stats.rank = stats.rank;
      
      // NOTE: Do NOT copy to statsHardcore/statsCdl here!
      // Mode-specific stats should be updated via the ladderStats parameter
      // to keep Hardcore and CDL stats properly separated.
      
      // Mark nested objects as modified for Mongoose
      user.markModified('stats');
    }
    
    // Update ladder stats (wins/losses/xp per mode) - this is separate from ranked stats
    if (ladderStats !== undefined) {
      // Update Hardcore ladder stats
      if (ladderStats.hardcore !== undefined) {
        if (ladderStats.hardcore.xp !== undefined) {
          user.statsHardcore.xp = ladderStats.hardcore.xp;
        }
        if (ladderStats.hardcore.wins !== undefined) {
          user.statsHardcore.wins = ladderStats.hardcore.wins;
        }
        if (ladderStats.hardcore.losses !== undefined) {
          user.statsHardcore.losses = ladderStats.hardcore.losses;
        }
        if (ladderStats.hardcore.points !== undefined) {
          user.statsHardcore.points = ladderStats.hardcore.points;
        }
      }
      
      // Update CDL ladder stats
      if (ladderStats.cdl !== undefined) {
        if (ladderStats.cdl.xp !== undefined) {
          user.statsCdl.xp = ladderStats.cdl.xp;
        }
        if (ladderStats.cdl.wins !== undefined) {
          user.statsCdl.wins = ladderStats.cdl.wins;
        }
        if (ladderStats.cdl.losses !== undefined) {
          user.statsCdl.losses = ladderStats.cdl.losses;
        }
        if (ladderStats.cdl.points !== undefined) {
          user.statsCdl.points = ladderStats.cdl.points;
        }
      }
      
      user.markModified('statsHardcore');
      user.markModified('statsCdl');
    }

    await user.save();
    
    // Update ranked ladder points and stats if provided
    if (rankedPoints !== undefined || rankedStats !== undefined) {
      const Ranking = (await import('../models/Ranking.js')).default;
      const currentSeason = new Date().getMonth() + 1;
      
      // Update hardcore ranking
      if (rankedPoints?.hardcore !== undefined || rankedStats?.hardcore !== undefined) {
        let hardcoreRanking = await Ranking.findOne({ user: req.params.userId, mode: 'hardcore', season: currentSeason });
        if (!hardcoreRanking) {
          hardcoreRanking = new Ranking({ user: req.params.userId, mode: 'hardcore', season: currentSeason, points: 0 });
        }
        if (rankedPoints?.hardcore !== undefined) {
          hardcoreRanking.points = rankedPoints.hardcore;
        }
        if (rankedStats?.hardcore?.wins !== undefined) {
          hardcoreRanking.wins = rankedStats.hardcore.wins;
        }
        if (rankedStats?.hardcore?.losses !== undefined) {
          hardcoreRanking.losses = rankedStats.hardcore.losses;
        }
        await hardcoreRanking.save();
      }
      
      // Update CDL ranking
      if (rankedPoints?.cdl !== undefined || rankedStats?.cdl !== undefined) {
        let cdlRanking = await Ranking.findOne({ user: req.params.userId, mode: 'cdl', season: currentSeason });
        if (!cdlRanking) {
          cdlRanking = new Ranking({ user: req.params.userId, mode: 'cdl', season: currentSeason, points: 0 });
        }
        if (rankedPoints?.cdl !== undefined) {
          cdlRanking.points = rankedPoints.cdl;
        }
        if (rankedStats?.cdl?.wins !== undefined) {
          cdlRanking.wins = rankedStats.cdl.wins;
        }
        if (rankedStats?.cdl?.losses !== undefined) {
          cdlRanking.losses = rankedStats.cdl.losses;
        }
        await cdlRanking.save();
      }
    }

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Admin/Staff: Delete user
router.delete('/admin/:userId', verifyToken, requireStaff, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Can't delete admins
    if (user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Impossible de supprimer un administrateur'
      });
    }
    
    // Get user's rankings
    const rankings = await Ranking.find({ user: user._id });
    
    // Create deletion record (snapshot)
    await AccountDeletion.create({
      deletedUserId: user._id,
      username: user.username,
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      email: user.discordEmail || null,
      stats: user.stats,
      goldCoins: user.goldCoins,
      squadId: user.squad || null,
      rankings: rankings.map(r => ({
        mode: r.mode,
        points: r.points,
        wins: r.wins,
        losses: r.losses,
        rank: r.rank
      })),
      scheduledFor: new Date(), // Required field - set to now for immediate deletion
      deletedAt: new Date(),
      deletedBy: 'admin',
      deletionReason: req.body.reason || null,
      status: 'completed'
    });

    // If user has a squad, remove them from it
    if (user.squad) {
      const squad = await Squad.findById(user.squad);
      if (squad) {
        // Remove user from squad members
        squad.members = squad.members.filter(
          m => m.user.toString() !== user._id.toString()
        );
        
        // If user was the leader and squad is now empty, delete the squad
        if (squad.isLeader(user._id) && squad.members.length === 0) {
          await Squad.findByIdAndDelete(squad._id);
        } else if (squad.isLeader(user._id) && squad.members.length > 0) {
          // Transfer leadership to the first officer or first member
          const newLeader = squad.members.find(m => m.role === 'officer') || squad.members[0];
          squad.leader = newLeader.user;
          newLeader.role = 'leader';
          await squad.save();
        } else {
          // Just save the squad without the deleted member
          await squad.save();
        }
      }
    }

    // Delete user's rankings
    await Ranking.deleteMany({ user: user._id });
    
    // Delete the user
    await User.findByIdAndDelete(req.params.userId);

    res.json({
      success: true,
      message: 'Utilisateur supprimé'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Admin: Get user match history (both ladder and ranked)
router.get('/admin/:userId/matches', verifyToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'all' } = req.query; // 'all', 'ladder', 'ranked'
    
    const mongoose = (await import('mongoose')).default;
    const playerObjectId = new mongoose.Types.ObjectId(userId);
    
    const result = {
      ladder: [],
      ranked: []
    };
    
    // Get ladder matches
    if (type === 'all' || type === 'ladder') {
      const ladderMatches = await Match.find({
        $or: [
          { 'challengerRoster.user': playerObjectId },
          { 'opponentRoster.user': playerObjectId }
        ]
      })
        .populate('challenger', 'name tag color')
        .populate('opponent', 'name tag color')
        .populate('result.winner', 'name tag')
        .populate('challengerRoster.user', 'username')
        .populate('opponentRoster.user', 'username')
        .sort({ createdAt: -1 })
        .limit(100);
      
      result.ladder = ladderMatches.map(match => {
        // Determine if player was in challenger or opponent
        const isInChallenger = match.challengerRoster.some(r => r.user?._id?.toString() === userId);
        const playerSquad = isInChallenger ? match.challenger : match.opponent;
        const isWinner = match.result?.winner?._id?.toString() === playerSquad?._id?.toString();
        
        return {
          _id: match._id,
          type: 'ladder',
          status: match.status,
          mode: match.mode,
          ladderId: match.ladderId,
          playerSquad: playerSquad?.name || 'Équipe supprimée',
          opponent: isInChallenger ? match.opponent?.name : match.challenger?.name,
          isWinner: match.status === 'completed' ? isWinner : null,
          createdAt: match.createdAt,
          completedAt: match.result?.confirmedAt
        };
      });
    }
    
    // Get ranked matches
    if (type === 'all' || type === 'ranked') {
      const RankedMatch = (await import('../models/RankedMatch.js')).default;
      const rankedMatches = await RankedMatch.find({
        'players.user': playerObjectId
      })
        .populate('players.user', 'username')
        .sort({ createdAt: -1 })
        .limit(100);
      
      result.ranked = rankedMatches.map(match => {
        const player = match.players.find(p => p.user?._id?.toString() === userId);
        const winningTeam = match.result?.winner;
        const isWinner = match.status === 'completed' && player?.team === winningTeam;
        
        return {
          _id: match._id,
          type: 'ranked',
          status: match.status,
          mode: match.mode,
          gameMode: match.gameMode,
          teamSize: match.teamSize,
          team: player?.team,
          isWinner: match.status === 'completed' ? isWinner : null,
          createdAt: match.createdAt,
          completedAt: match.completedAt
        };
      });
    }
    
    res.json({
      success: true,
      matches: result,
      counts: {
        ladder: result.ladder.length,
        ranked: result.ranked.length,
        total: result.ladder.length + result.ranked.length
      }
    });
  } catch (error) {
    console.error('Get user matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Admin: Add warning to user (admin, staff, arbitre can do this)
router.post('/admin/:userId/warn', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { reason, isAbandonWarn, abandonedMatchId } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Une raison est requise pour l\'avertissement.'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé.'
      });
    }

    // Can't warn admins
    if (user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Impossible d\'avertir un administrateur.'
      });
    }

    let abandonmentProcessed = false;
    let teammatesRefunded = 0;

    // Process abandonment if applicable
    if (isAbandonWarn && abandonedMatchId) {
      
      const match = await RankedMatch.findById(abandonedMatchId).populate('players.user', 'username');
      
      if (match && match.status === 'completed' && match.result?.winner) {
        // Find the abandoning player's team
        const abandoningPlayer = match.players.find(p => {
          const pUserId = p.user?._id?.toString() || p.user?.toString();
          return pUserId === user._id.toString();
        });
        
        if (abandoningPlayer) {
          const abandoningTeam = Number(abandoningPlayer.team);
          const winningTeam = Number(match.result.winner);
          
          
          // Only process if the abandoning player's team lost
          if (abandoningTeam !== winningTeam) {
            
            // Find teammates (same team, excluding the abandoning player)
            const teammates = match.players.filter(p => {
              if (p.isFake || !p.user) return false;
              const pUserId = p.user?._id?.toString() || p.user?.toString();
              return Number(p.team) === abandoningTeam && pUserId !== user._id.toString();
            });
            
            
            for (const teammate of teammates) {
              const teammateUserId = teammate.user?._id || teammate.user;
              const rewards = teammate.rewards || {};
              const pointsLost = rewards.pointsChange || 0; // This is negative for losses
              const goldEarned = rewards.goldEarned || 0;
              const xpEarned = rewards.xpEarned || 0;
              
              
              // Refund ranking points (pointsLost is negative, so we subtract it to add back)
              const currentSeasonAbandon = new Date().getMonth() + 1;
              const ranking = await Ranking.findOne({ user: teammateUserId, mode: match.mode, season: currentSeasonAbandon });
              if (ranking) {
                const oldPoints = ranking.points;
                // Points change was negative (loss), so subtracting adds them back
                ranking.points = Math.max(0, ranking.points - pointsLost);
                // Remove the loss from their record
                ranking.losses = Math.max(0, (ranking.losses || 0) - 1);
                await ranking.save();
              }
              
              // Update the player's rewards in the match to reflect the refund
              const playerIndex = match.players.findIndex(p => {
                const pUserId = p.user?._id?.toString() || p.user?.toString();
                return pUserId === teammateUserId.toString();
              });
              
              if (playerIndex !== -1) {
                // Mark that this player was refunded due to abandonment
                match.players[playerIndex].rewards = {
                  ...match.players[playerIndex].rewards,
                  abandonRefunded: true,
                  originalPointsChange: pointsLost,
                  refundedPointsChange: 0 // Effectively 0 change after refund
                };
              }
              
              teammatesRefunded++;
            }
            
            // Mark the match as having abandonment processed
            match.abandonment = {
              processedAt: new Date(),
              abandonedBy: user._id,
              abandonedByUsername: user.username,
              teammatesRefunded: teammatesRefunded,
              processedBy: req.user._id
            };
            
            await match.save();
            abandonmentProcessed = true;
            
            // Apply 60 points penalty to the abandoning player
            const currentSeasonPenalty = new Date().getMonth() + 1;
            const abandonerRanking = await Ranking.findOne({ user: user._id, mode: match.mode, season: currentSeasonPenalty });
            if (abandonerRanking) {
              const oldAbandonerPoints = abandonerRanking.points;
              abandonerRanking.points = Math.max(0, abandonerRanking.points - 60);
              await abandonerRanking.save();
            }
            
          } else {
            // Even if the team won, apply the 60 points penalty to the abandoning player
            const currentSeasonPenalty2 = new Date().getMonth() + 1;
            const abandonerRanking = await Ranking.findOne({ user: user._id, mode: match.mode, season: currentSeasonPenalty2 });
            if (abandonerRanking) {
              const oldAbandonerPoints = abandonerRanking.points;
              abandonerRanking.points = Math.max(0, abandonerRanking.points - 60);
              await abandonerRanking.save();
            }
          }
        } else {
        }
      } else {
      }
    }

    // Add the warning with abandonment details if applicable
    const warning = {
      reason: reason.trim(),
      warnedAt: new Date(),
      warnedBy: req.user._id
    };
    
    if (isAbandonWarn && abandonedMatchId) {
      warning.isAbandonWarn = true;
      warning.abandonedMatchId = abandonedMatchId;
      warning.abandonmentProcessed = abandonmentProcessed;
      warning.teammatesRefunded = teammatesRefunded;
    }
    
    user.warns.push(warning);
    await user.save();

    // Log to Discord (both channels)
    let discordReason = reason.trim();
    if (isAbandonWarn && abandonmentProcessed) {
      discordReason += ` [ABANDON - ${teammatesRefunded} coéquipiers remboursés]`;
    }
    await logPlayerWarn(user, req.user, discordReason, user.warns.length);

    res.json({
      success: true,
      message: 'Avertissement ajouté.',
      warnCount: user.warns.length,
      abandonmentProcessed,
      teammatesRefunded,
      user: {
        id: user._id,
        username: user.username,
        warnCount: user.warns.length
      }
    });
  } catch (error) {
    console.error('Warn user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur.'
    });
  }
});

// Admin: Ban/Unban user from ranked mode (admin, staff, arbitre can do this)
router.put('/admin/:userId/ranked-ban', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { ban, reason, expiresAt } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé.'
      });
    }

    // Can't ban admins
    if (user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Impossible de bannir un administrateur du mode classé.'
      });
    }

    user.isRankedBanned = ban;
    user.rankedBanReason = ban ? reason : null;
    
    // Set ban dates
    if (ban) {
      user.rankedBannedAt = new Date();
      user.rankedBanExpiresAt = expiresAt ? new Date(expiresAt) : null; // null = permanent
      user.rankedBannedBy = req.user._id;
    } else {
      // Unban
      user.rankedBannedAt = null;
      user.rankedBanExpiresAt = null;
      user.rankedBannedBy = null;
    }
    
    await user.save();

    // Populate rankedBannedBy for response
    await user.populate('rankedBannedBy', 'username');

    // Log to Discord (BAN_LOG_CHANNEL only)
    if (ban) {
      await logRankedBan(user, req.user, reason, user.rankedBannedAt, user.rankedBanExpiresAt);
    } else {
      await logRankedUnban(user, req.user);
    }

    res.json({
      success: true,
      message: ban ? 'Utilisateur banni du mode classé.' : 'Utilisateur débanni du mode classé.',
      user: {
        id: user._id,
        username: user.username,
        isRankedBanned: user.isRankedBanned,
        rankedBannedAt: user.rankedBannedAt,
        rankedBanExpiresAt: user.rankedBanExpiresAt,
        rankedBannedBy: user.rankedBannedBy,
        rankedBanReason: user.rankedBanReason
      }
    });
  } catch (error) {
    console.error('Toggle ranked ban error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur.'
    });
  }
});

// ==================== USER TROPHY MANAGEMENT ====================

// Add trophy to user (admin only)
router.post('/admin/:userId/trophies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { trophyId, season } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    }

    // Check if trophy exists
    const Trophy = (await import('../models/Trophy.js')).default;
    const trophy = await Trophy.findById(trophyId);
    if (!trophy) {
      return res.status(404).json({ success: false, message: 'Trophée non trouvé.' });
    }

    // Check if user already has this trophy for this season
    const alreadyHas = user.trophies?.some(t => 
      t.trophy?.toString() === trophyId && t.season === season
    );
    if (alreadyHas) {
      return res.status(400).json({ success: false, message: 'L\'utilisateur possède déjà ce trophée pour cette saison.' });
    }

    // Add trophy
    if (!user.trophies) user.trophies = [];
    user.trophies.push({
      trophy: trophyId,
      earnedAt: new Date(),
      season: season || 1
    });

    await user.save();

    // Populate trophies for response
    await user.populate({
      path: 'trophies.trophy',
      model: 'Trophy',
      select: 'name translations icon color rarity rarityName'
    });

    res.json({
      success: true,
      message: 'Trophée ajouté.',
      trophies: user.trophies
    });
  } catch (error) {
    console.error('Add trophy to user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Remove trophy from user (admin only)
router.delete('/admin/:userId/trophies/:trophyEntryId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId, trophyEntryId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    }

    // Find and remove the trophy entry
    const trophyIndex = user.trophies?.findIndex(t => t._id?.toString() === trophyEntryId);
    if (trophyIndex === -1 || trophyIndex === undefined) {
      return res.status(404).json({ success: false, message: 'Trophée non trouvé chez cet utilisateur.' });
    }

    user.trophies.splice(trophyIndex, 1);
    await user.save();

    // Populate trophies for response
    await user.populate({
      path: 'trophies.trophy',
      model: 'Trophy',
      select: 'name translations icon color rarity rarityName'
    });

    res.json({
      success: true,
      message: 'Trophée retiré.',
      trophies: user.trophies
    });
  } catch (error) {
    console.error('Remove trophy from user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

export default router;

