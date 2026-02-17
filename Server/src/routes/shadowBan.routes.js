import express from 'express';
import ShadowBanTracking from '../models/ShadowBanTracking.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Middleware to check if user is admin or staff
 */
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user.roles || (!req.user.roles.includes('admin') && !req.user.roles.includes('staff'))) {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux admins et staff'
    });
  }
  next();
};

/**
 * Get all pending shadow ban trackings
 * GET /api/shadow-bans/pending
 */
router.get('/pending', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const pendingTrackings = await ShadowBanTracking.find({
      status: 'pending'
    })
    .populate('user', 'username discordUsername discordId avatar avatarUrl platform irisLastSeen')
    .sort({ detectedAt: -1 })
    .lean();
    
    // Add time remaining calculation
    const now = new Date();
    const trackingsWithTimeRemaining = pendingTrackings.map(tracking => {
      const checkAt = new Date(tracking.checkAt);
      const timeRemainingMs = checkAt - now;
      const timeRemainingMinutes = Math.max(0, Math.ceil(timeRemainingMs / (60 * 1000)));
      
      return {
        ...tracking,
        timeRemainingMinutes,
        timeRemainingMs: Math.max(0, timeRemainingMs)
      };
    });
    
    res.json({
      success: true,
      trackings: trackingsWithTimeRemaining,
      count: trackingsWithTimeRemaining.length
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error fetching pending trackings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Get shadow ban history (cleared, banned, expired)
 * GET /api/shadow-bans/history
 */
router.get('/history', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {
      status: { $in: ['cleared', 'banned', 'expired'] }
    };
    
    // Filter by specific status if provided
    if (status && ['cleared', 'banned', 'expired'].includes(status)) {
      query.status = status;
    }
    
    const [trackings, total] = await Promise.all([
      ShadowBanTracking.find(query)
        .populate('user', 'username discordUsername discordId avatar avatarUrl platform')
        .sort({ resolvedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ShadowBanTracking.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      trackings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Get shadow ban statistics
 * GET /api/shadow-bans/stats
 */
router.get('/stats', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const [pending, banned, cleared, expired] = await Promise.all([
      ShadowBanTracking.countDocuments({ status: 'pending' }),
      ShadowBanTracking.countDocuments({ status: 'banned' }),
      ShadowBanTracking.countDocuments({ status: 'cleared' }),
      ShadowBanTracking.countDocuments({ status: 'expired' })
    ]);
    
    // Get recent bans (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBans = await ShadowBanTracking.countDocuments({
      status: 'banned',
      resolvedAt: { $gte: oneDayAgo }
    });
    
    res.json({
      success: true,
      stats: {
        pending,
        banned,
        cleared,
        expired,
        total: pending + banned + cleared + expired,
        recentBans
      }
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Manually clear a pending shadow ban tracking
 * POST /api/shadow-bans/:trackingId/clear
 */
router.post('/:trackingId/clear', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { reason } = req.body;
    
    const tracking = await ShadowBanTracking.findById(trackingId);
    
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking non trouvé'
      });
    }
    
    if (tracking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Ce tracking n\'est plus en attente'
      });
    }
    
    tracking.status = 'cleared';
    tracking.resolvedAt = new Date();
    tracking.resolutionReason = reason || 'manual_clear';
    await tracking.save();
    
    console.log(`[Shadow Ban Routes] Tracking ${trackingId} manually cleared by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Tracking annulé avec succès',
      tracking
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error clearing tracking:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Get shadow ban details for a specific user
 * GET /api/shadow-bans/user/:userId
 */
router.get('/user/:userId', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const trackings = await ShadowBanTracking.find({
      user: userId
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
    
    const user = await User.findById(userId)
      .select('username discordUsername isBanned banReason bannedAt banExpiresAt')
      .lean();
    
    res.json({
      success: true,
      user,
      trackings,
      totalBans: trackings.filter(t => t.status === 'banned').length
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error fetching user shadow ban details:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Manually unban a user who was shadow banned
 * POST /api/shadow-bans/unban/:userId
 */
router.post('/unban/:userId', verifyToken, requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    if (!user.isBanned) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur n\'est pas banni'
      });
    }
    
    // Check if ban reason indicates shadow ban
    const isShadowBan = user.banReason && 
      (user.banReason.includes('Iris') || user.banReason.includes('Non connecté'));
    
    if (!isShadowBan) {
      return res.status(400).json({
        success: false,
        message: 'Ce ban n\'est pas un shadow ban Iris. Utilisez le système de ban normal.'
      });
    }
    
    // Remove ban
    user.isBanned = false;
    user.banReason = null;
    user.bannedAt = null;
    user.banExpiresAt = null;
    await user.save();
    
    console.log(`[Shadow Ban Routes] User ${user.username} unbanned by ${req.user.username}`);
    
    res.json({
      success: true,
      message: `${user.username} a été débanni avec succès`
    });
  } catch (error) {
    console.error('[Shadow Ban Routes] Error unbanning user:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
