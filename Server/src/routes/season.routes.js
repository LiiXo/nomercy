import express from 'express';
import Season from '../models/Season.js';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get current active season
router.get('/current', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;
    
    // Update season statuses first
    await Season.updateSeasonStatuses();
    
    const season = await Season.getCurrentSeason(mode);
    
    if (!season) {
      return res.json({ success: true, season: null, message: 'Aucune saison active' });
    }
    
    res.json({ success: true, season });
  } catch (error) {
    console.error('Get current season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get all seasons (public - for history)
router.get('/', async (req, res) => {
  try {
    const { mode = 'hardcore', status } = req.query;
    
    const query = { mode };
    if (status) query.status = status;
    
    const seasons = await Season.find(query)
      .sort({ number: -1 })
      .populate('createdBy', 'username');
    
    res.json({ success: true, seasons });
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get season by ID
router.get('/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const season = await Season.findById(seasonId)
      .populate('createdBy', 'username')
      .populate('rewards.trophyId', 'name icon color')
      .populate('finalLeaderboard.user', 'username avatar avatarUrl discordAvatar');
    
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    res.json({ success: true, season });
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get season leaderboard
router.get('/:seasonId/leaderboard', async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { limit = 100, page = 1 } = req.query;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    // If season ended, return final leaderboard
    if (season.status === 'ended' && season.finalLeaderboard.length > 0) {
      const start = (parseInt(page) - 1) * parseInt(limit);
      const end = start + parseInt(limit);
      const leaderboard = season.finalLeaderboard.slice(start, end);
      
      await Season.populate(leaderboard, {
        path: 'user',
        select: 'username avatarUrl discordAvatar isDeleted',
        match: { isDeleted: { $ne: true } } // Exclude deleted users
      });
      
      // Filter out entries with deleted users
      const filteredLeaderboard = leaderboard.filter(entry => entry.user !== null);
      
      return res.json({
        success: true,
        leaderboard: filteredLeaderboard,
        total: season.finalLeaderboard.length,
        page: parseInt(page),
        pages: Math.ceil(season.finalLeaderboard.length / parseInt(limit))
      });
    }
    
    // For active season, get from rankings
    const rankings = await Ranking.find({ mode: season.mode })
      .populate({
        path: 'user',
        select: 'username avatarUrl discordAvatar isDeleted',
        match: { isDeleted: { $ne: true } } // Exclude deleted users
      })
      .sort({ points: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    // Filter out rankings with deleted users
    const validRankings = rankings.filter(r => r.user !== null);
    
    const total = await Ranking.countDocuments({ mode: season.mode });
    
    const leaderboard = validRankings.map((r, idx) => ({
      user: r.user,
      rank: (parseInt(page) - 1) * parseInt(limit) + idx + 1,
      points: r.points,
      tier: r.rank,
      wins: r.wins,
      losses: r.losses
    }));
    
    res.json({
      success: true,
      leaderboard,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get season leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all seasons for admin/staff
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (mode) query.mode = mode;
    if (status) query.status = status;
    
    const seasons = await Season.find(query)
      .populate('createdBy', 'username')
      .sort({ number: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await Season.countDocuments(query);
    
    // Get stats for each season
    const seasonsWithStats = await Promise.all(seasons.map(async (season) => {
      const playerCount = await Ranking.countDocuments({ mode: season.mode });
      return {
        ...season.toObject(),
        currentPlayers: playerCount
      };
    }));
    
    res.json({
      success: true,
      seasons: seasonsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get seasons error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create new season
router.post('/admin/create', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      number,
      name,
      startDate,
      endDate,
      mode,
      description,
      rankThresholds,
      pointsConfig,
      rewards,
      features
    } = req.body;
    
    // Check if season number already exists for this mode
    const existing = await Season.findOne({ number, mode: mode || 'hardcore' });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Une saison avec ce numéro existe déjà pour ce mode'
      });
    }
    
    const season = new Season({
      number,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      mode: mode || 'hardcore',
      description,
      rankThresholds,
      pointsConfig,
      rewards,
      features,
      createdBy: req.user._id,
      status: new Date(startDate) <= new Date() ? 'active' : 'upcoming'
    });
    
    await season.save();
    
    res.json({ success: true, season, message: 'Saison créée avec succès' });
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update season
router.put('/admin/:seasonId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { seasonId } = req.params;
    const updates = req.body;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    // Update allowed fields
    const allowedUpdates = [
      'name', 'startDate', 'endDate', 'description',
      'rankThresholds', 'pointsConfig', 'rewards', 'features', 'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          season[field] = new Date(updates[field]);
        } else {
          season[field] = updates[field];
        }
      }
    });
    
    await season.save();
    
    res.json({ success: true, season, message: 'Saison mise à jour' });
  } catch (error) {
    console.error('Update season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete season
router.delete('/admin/:seasonId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    if (season.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une saison active'
      });
    }
    
    await Season.findByIdAndDelete(seasonId);
    
    res.json({ success: true, message: 'Saison supprimée' });
  } catch (error) {
    console.error('Delete season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Start season manually
router.post('/admin/:seasonId/start', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    if (season.status === 'active') {
      return res.status(400).json({ success: false, message: 'La saison est déjà active' });
    }
    
    if (season.status === 'ended') {
      return res.status(400).json({ success: false, message: 'La saison est déjà terminée' });
    }
    
    // Check if another season is active
    const activeSeason = await Season.findOne({ mode: season.mode, status: 'active' });
    if (activeSeason) {
      return res.status(400).json({
        success: false,
        message: 'Une autre saison est déjà active pour ce mode'
      });
    }
    
    season.status = 'active';
    season.startDate = new Date();
    await season.save();
    
    res.json({ success: true, season, message: 'Saison démarrée' });
  } catch (error) {
    console.error('Start season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// End season manually
router.post('/admin/:seasonId/end', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { distributeRewards = true } = req.body;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    if (season.status !== 'active') {
      return res.status(400).json({ success: false, message: 'La saison n\'est pas active' });
    }
    
    // Get final leaderboard
    const rankings = await Ranking.find({ mode: season.mode })
      .populate('user', 'username avatar avatarUrl')
      .sort({ points: -1 });
    
    // Save final leaderboard
    season.finalLeaderboard = rankings.map((r, idx) => ({
      user: r.user._id,
      rank: idx + 1,
      points: r.points,
      tier: r.rank,
      wins: r.wins,
      losses: r.losses
    }));
    
    // Update stats
    season.stats.totalPlayers = rankings.length;
    season.stats.totalMatches = rankings.reduce((sum, r) => sum + r.wins + r.losses, 0) / 2;
    season.stats.averageRank = rankings.length > 0 
      ? rankings.reduce((sum, r) => sum + r.points, 0) / rankings.length 
      : 0;
    
    season.status = 'ended';
    season.endDate = new Date();
    
    // Distribute rewards if enabled
    if (distributeRewards && season.rewards.length > 0) {
      for (const reward of season.rewards) {
        const eligiblePlayers = season.finalLeaderboard.filter(p => {
          if (reward.rank) {
            return p.tier === reward.rank;
          }
          if (reward.minPosition && reward.maxPosition) {
            return p.rank >= reward.minPosition && p.rank <= reward.maxPosition;
          }
          return false;
        });
        
        for (const player of eligiblePlayers) {
          const user = await User.findById(player.user);
          if (user) {
            // Give NM Coins
            if (reward.nmCoins) {
              user.nmCoins = (user.nmCoins || 0) + reward.nmCoins;
            }
            // Add trophy
            if (reward.trophyId) {
              user.trophies = user.trophies || [];
              user.trophies.push({
                trophy: reward.trophyId,
                earnedAt: new Date(),
                season: season._id
              });
            }
            await user.save();
            
            // Mark reward as given
            const idx = season.finalLeaderboard.findIndex(
              p => p.user.toString() === player.user.toString()
            );
            if (idx !== -1) {
              season.finalLeaderboard[idx].rewardsGiven = true;
            }
          }
        }
      }
    }
    
    await season.save();
    
    // Reset rankings for new season
    await Ranking.updateMany(
      { mode: season.mode },
      { 
        $set: { 
          points: 0, 
          rank: 'Unranked', 
          wins: 0, 
          losses: 0,
          winStreak: 0,
          bestWinStreak: 0
        } 
      }
    );
    
    res.json({ 
      success: true, 
      season, 
      message: `Saison terminée. ${season.finalLeaderboard.length} joueurs classés.` 
    });
  } catch (error) {
    console.error('End season error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get season statistics (admin/staff)
router.get('/admin/:seasonId/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ success: false, message: 'Saison non trouvée' });
    }
    
    // Get current stats from rankings
    const rankings = await Ranking.find({ mode: season.mode });
    
    const tierDistribution = {};
    const tiers = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Legend'];
    tiers.forEach(t => tierDistribution[t] = 0);
    
    rankings.forEach(r => {
      tierDistribution[r.rank] = (tierDistribution[r.rank] || 0) + 1;
    });
    
    const totalGames = rankings.reduce((sum, r) => sum + r.wins + r.losses, 0);
    const avgPoints = rankings.length > 0 
      ? Math.round(rankings.reduce((sum, r) => sum + r.points, 0) / rankings.length)
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalPlayers: rankings.length,
        totalGames,
        avgPoints,
        tierDistribution,
        topPlayers: rankings
          .sort((a, b) => b.points - a.points)
          .slice(0, 10)
          .map((r, idx) => ({
            rank: idx + 1,
            username: r.user?.username || 'Unknown',
            points: r.points,
            tier: r.rank
          }))
      }
    });
  } catch (error) {
    console.error('Get season stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;





