import express from 'express';
import User from '../models/User.js';
import { verifyToken, requireCompleteProfile, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

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

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;

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

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatar: user.avatarUrl,
        platform: user.platform,
        activisionId: user.activisionId,
        stats: user.stats,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
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

// Admin: Ban/Unban user
router.put('/admin/:userId/ban', verifyToken, requireAdmin, async (req, res) => {
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

// Admin: Get user stats
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

export default router;

