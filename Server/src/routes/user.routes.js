import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Match from '../models/Match.js';
import ShopItem from '../models/ShopItem.js';
import Trophy from '../models/Trophy.js';
import Announcement from '../models/Announcement.js';
import AccountDeletion from '../models/AccountDeletion.js';
import Ranking from '../models/Ranking.js';
import { verifyToken, requireCompleteProfile, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

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
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      isProfileComplete: true,
      isBanned: false,
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { activisionId: { $regex: q, $options: 'i' } }
      ]
    })
    .select('_id username avatarUrl discordAvatar discordId activisionId platform')
    .limit(parseInt(limit));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
    const { username, bio, avatar, activisionId } = req.body;

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
    let totalWins = 0;
    let totalLosses = 0;

    // Count wins/losses from squad matches
    const squadMatches = await Match.find({
      status: 'completed',
      $or: [
        { 'challengerRoster.user': user._id },
        { 'opponentRoster.user': user._id }
      ],
      'result.winner': { $exists: true }
    }).populate('result.winner challenger opponent');

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

    // Count wins/losses from ranked matches
    const RankedMatch = (await import('../models/RankedMatch.js')).default;
    const rankedMatches = await RankedMatch.find({
      status: 'completed',
      'players.user': user._id,
      'result.winner': { $exists: true }
    });

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
        createdAt: user.createdAt
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
    const user = await User.findOne({ 
      _id: req.params.id,
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
    let totalWins = 0;
    let totalLosses = 0;

    // Count wins/losses from squad matches
    const squadMatches = await Match.find({
      status: 'completed',
      $or: [
        { 'challengerRoster.user': user._id },
        { 'opponentRoster.user': user._id }
      ],
      'result.winner': { $exists: true }
    }).populate('result.winner challenger opponent');

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

    // Count wins/losses from ranked matches
    const RankedMatch = (await import('../models/RankedMatch.js')).default;
    const rankedMatches = await RankedMatch.find({
      status: 'completed',
      'players.user': user._id,
      'result.winner': { $exists: true }
    });

    for (const match of rankedMatches) {
      const player = match.players.find(p => p.user.toString() === user._id.toString());
      if (!player) continue;

      if (match.gameMode === 'Duel') {
        if (match.result.winnerUser && match.result.winnerUser.toString() === user._id.toString()) {
          totalWins++;
        } else {
          totalLosses++;
        }
      } else if (match.gameMode === 'Team Deathmatch') {
        if (match.result.winnerUser && match.result.winnerUser.toString() === user._id.toString()) {
          totalWins++;
        } else {
          totalLosses++;
        }
      } else {
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
        createdAt: user.createdAt
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

// Get user's squad by ID (public)
router.get('/by-id/:id/squad', async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.id,
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

    res.json({
      success: true,
      squad: {
        _id: user.squad._id,
        id: user.squad._id,
        name: user.squad.name,
        tag: user.squad.tag,
        logo: user.squad.logo,
        color: user.squad.color
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
      deletedAt: new Date(),
      deletedBy: 'self',
      status: 'completed'
    });

    // If user has a squad, remove them from it
    if (req.user.squad) {
      const squad = await Squad.findById(req.user.squad);
      if (squad) {
        // Remove user from squad members
        squad.members = squad.members.filter(
          m => m.user.toString() !== userId.toString()
        );
        
        // If user was the leader and squad is now empty, delete the squad
        if (squad.isLeader(userId) && squad.members.length === 0) {
          await Squad.findByIdAndDelete(squad._id);
        } else if (squad.isLeader(userId) && squad.members.length > 0) {
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

// Admin: Get all users
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
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
    const totalMatches = await Match.countDocuments();
    const totalShopItems = await ShopItem.countDocuments();
    const totalTrophies = await Trophy.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({ isActive: true });

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

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSquads,
        totalMatches,
        totalShopItems,
        totalTrophies,
        activeAnnouncements,
        registrationsLast30Days,
        visitorsLast30Days
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

    user.roles = roles;
    await user.save();

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

// Admin: Ban/Unban user (staff can do this)
router.put('/admin/:userId/ban', verifyToken, requireStaff, async (req, res) => {
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

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred.'
    });
  }
});

// Admin: Update user
router.put('/admin/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { username, goldCoins, roles, platform, activisionId, bio } = req.body;
    
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

    await user.save();

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

// Admin: Get deleted accounts
router.get('/admin/deleted-accounts', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = { status: 'completed' };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { discordUsername: { $regex: search, $options: 'i' } }
      ];
    }

    const deletedAccounts = await AccountDeletion.find(query)
      .sort({ deletedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AccountDeletion.countDocuments(query);

    res.json({
      success: true,
      deletedAccounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get deleted accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;

