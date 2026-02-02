import express from 'express';
import Season from '../models/Season.js';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import LadderSeasonHistory from '../models/LadderSeasonHistory.js';
import AppSettings from '../models/AppSettings.js';
import RankedMatch from '../models/RankedMatch.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';
import { resetLadderSeason, resetAllLadderSeasons, getPreviousSeasonWinners, REWARD_POINTS } from '../services/ladderSeasonReset.service.js';
import { resetRankedSeason, createAndAssignTrophyToUser, RANKED_REWARD_GOLD, ELIGIBLE_DIVISIONS } from '../services/rankedSeasonReset.service.js';

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
        select: 'username avatar discordAvatar discordId isDeleted',
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
        select: 'username avatar discordAvatar discordId isDeleted',
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

// ==================== LADDER SEASON ROUTES ====================

// Get previous season winners for rankings page (public)
router.get('/ladder/previous-winners', async (req, res) => {
  try {
    const winners = await getPreviousSeasonWinners();
    
    res.json({
      success: true,
      duoTrio: winners.duoTrio,
      squadTeam: winners.squadTeam,
      rewardPoints: REWARD_POINTS
    });
  } catch (error) {
    console.error('Get previous season winners error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get ladder season history (public)
router.get('/ladder/history/:ladderId', async (req, res) => {
  try {
    const { ladderId } = req.params;
    const { limit = 12 } = req.query;
    
    if (!['duo-trio', 'squad-team'].includes(ladderId)) {
      return res.status(400).json({ success: false, message: 'Ladder ID invalide' });
    }
    
    const history = await LadderSeasonHistory.find({ ladderId })
      .sort({ resetAt: -1 })
      .limit(parseInt(limit))
      .populate('winners.squad', 'name tag color logo')
      .populate('winners.trophy', 'name icon color translations');
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Get ladder history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Reset a specific ladder season (admin only)
router.post('/admin/ladder/:ladderId/reset', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ladderId } = req.params;
    
    if (!['duo-trio', 'squad-team'].includes(ladderId)) {
      return res.status(400).json({ success: false, message: 'Ladder ID invalide' });
    }
    
    const result = await resetLadderSeason(ladderId, req.user._id);
    
    res.json({
      success: true,
      message: `Saison ${result.seasonName} terminée et réinitialisée pour ${result.ladderName}`,
      result
    });
  } catch (error) {
    console.error('Reset ladder season error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Reset all ladder seasons (admin only)
router.post('/admin/ladder/reset-all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await resetAllLadderSeasons(req.user._id);
    
    res.json({
      success: true,
      message: 'Toutes les saisons de ladder ont été réinitialisées',
      duoTrio: {
        seasonName: result.duoTrio.seasonName,
        winners: result.duoTrio.winners,
        totalSquadsReset: result.duoTrio.totalSquadsReset
      },
      squadTeam: {
        seasonName: result.squadTeam.seasonName,
        winners: result.squadTeam.winners,
        totalSquadsReset: result.squadTeam.totalSquadsReset
      }
    });
  } catch (error) {
    console.error('Reset all ladder seasons error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Get ladder season statistics (admin/staff)
router.get('/admin/ladder/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const duoTrioHistory = await LadderSeasonHistory.find({ ladderId: 'duo-trio' })
      .sort({ resetAt: -1 })
      .limit(6);
    
    const squadTeamHistory = await LadderSeasonHistory.find({ ladderId: 'squad-team' })
      .sort({ resetAt: -1 })
      .limit(6);
    
    res.json({
      success: true,
      duoTrio: {
        totalSeasons: await LadderSeasonHistory.countDocuments({ ladderId: 'duo-trio' }),
        recentSeasons: duoTrioHistory
      },
      squadTeam: {
        totalSeasons: await LadderSeasonHistory.countDocuments({ ladderId: 'squad-team' }),
        recentSeasons: squadTeamHistory
      },
      rewardPoints: REWARD_POINTS
    });
  } catch (error) {
    console.error('Get ladder stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete ladder season history (admin only)
router.delete('/admin/ladder/history/:historyId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { historyId } = req.params;
    
    const history = await LadderSeasonHistory.findById(historyId);
    if (!history) {
      return res.status(404).json({ success: false, message: 'Historique non trouvé' });
    }
    
    await LadderSeasonHistory.findByIdAndDelete(historyId);
    
    res.json({ 
      success: true, 
      message: `Historique de saison "${history.seasonName}" supprimé` 
    });
  } catch (error) {
    console.error('Delete ladder history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== RANKED SEASON ROUTES ====================

// Get public ranked season rewards info (no auth required)
router.get('/ranked/rewards-info', async (req, res) => {
  try {
    // Get current season from month (February = 2, etc.)
    const now = new Date();
    const currentSeason = now.getMonth() + 1;
    
    // Calculate next season reset date (1st of next month)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    
    res.json({
      success: true,
      currentSeason,
      nextResetDate: nextMonth.toISOString(),
      rewards: {
        gold: RANKED_REWARD_GOLD,
        trophyDivisions: ELIGIBLE_DIVISIONS
      }
    });
  } catch (error) {
    console.error('Get ranked rewards info error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Reset ranked season - distribute trophies and gold, reset all rankings (admin only)
router.post('/admin/ranked/reset', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await resetRankedSeason(req.user._id);
    
    res.json({
      success: true,
      message: `Saison ${result.seasonNumber} du mode classé terminée`,
      result
    });
  } catch (error) {
    console.error('Reset ranked season error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Get ranked season info (for admin display) - calculated from match history
router.get('/admin/ranked/info', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Get current season from month (February = 2, etc.)
    const currentSeason = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const seasonStartDate = new Date(Date.UTC(currentYear, currentSeason - 1, 1, 9, 0, 0));
    const seasonEndDate = new Date(Date.UTC(currentYear, currentSeason, 1, 9, 0, 0));
    
    // Get rank thresholds from AppSettings
    const settings = await AppSettings.getSettings();
    const rankThresholds = settings?.rankedSettings?.rankPointsThresholds || {
      bronze: { min: 0 }, silver: { min: 500 }, gold: { min: 1000 },
      platinum: { min: 1500 }, diamond: { min: 2000 }, master: { min: 2500 },
      grandmaster: { min: 3000 }, champion: { min: 3500 }
    };
    
    // Get all matches for the season, sorted chronologically for proper running total
    const matches = await RankedMatch.find({
      status: 'completed',
      'result.winner': { $exists: true, $ne: null },
      completedAt: { $gte: seasonStartDate, $lt: seasonEndDate },
      isTestMatch: { $ne: true }
    })
    .sort({ completedAt: 1 })
    .select('players result completedAt')
    .lean();

    // Build player stats with proper running total (never goes below 0)
    const playerStatsMap = new Map();

    for (const match of matches) {
      const winningTeam = Number(match.result.winner);

      for (const player of match.players) {
        if (!player.user || player.isFake) continue;

        const odiserId = player.user.toString();
        const playerTeam = Number(player.team);
        const isWin = playerTeam === winningTeam;
        const pointsChange = player.rewards?.pointsChange || 0;

        if (!playerStatsMap.has(odiserId)) {
          playerStatsMap.set(odiserId, {
            odiserId,
            wins: 0,
            losses: 0,
            totalMatches: 0,
            runningPoints: 0
          });
        }

        const stats = playerStatsMap.get(odiserId);
        stats.totalMatches++;

        if (isWin) {
          stats.wins++;
        } else {
          stats.losses++;
        }

        // Running total that never goes below 0
        stats.runningPoints = Math.max(0, stats.runningPoints + pointsChange);
      }
    }

    // Convert to array and lookup user info
    const User = (await import('../models/User.js')).default;
    const userIds = Array.from(playerStatsMap.keys());
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id username avatar isBanned isDeleted')
      .lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const playerStats = [];
    for (const [odiserId, stats] of playerStatsMap) {
      const user = userMap.get(odiserId);
      if (!user || user.isBanned || user.isDeleted) continue;

      playerStats.push({
        _id: odiserId,
        wins: stats.wins,
        losses: stats.losses,
        totalMatches: stats.totalMatches,
        totalPoints: stats.runningPoints,
        userInfo: user
      });
    }

    // Sort by points DESC, wins DESC
    playerStats.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.wins - a.wins;
    });
    
    // Helper function to get division from points
    const getDivision = (points) => {
      const t = rankThresholds;
      if (points >= (t.champion?.min ?? 3500)) return 'champion';
      if (points >= (t.grandmaster?.min ?? 3000)) return 'grandmaster';
      if (points >= (t.master?.min ?? 2500)) return 'master';
      if (points >= (t.diamond?.min ?? 2000)) return 'diamond';
      if (points >= (t.platinum?.min ?? 1500)) return 'platinum';
      if (points >= (t.gold?.min ?? 1000)) return 'gold';
      if (points >= (t.silver?.min ?? 500)) return 'silver';
      return 'bronze';
    };
    
    // Count divisions
    const divisionCounts = {};
    ELIGIBLE_DIVISIONS.forEach(d => divisionCounts[d] = 0);
    
    playerStats.forEach(p => {
      const division = getDivision(p.totalPoints);
      if (ELIGIBLE_DIVISIONS.includes(division)) {
        divisionCounts[division]++;
      }
    });
    
    // Get top 5
    const top5 = playerStats.slice(0, 5).map((p, i) => ({
      position: i + 1,
      username: p.userInfo?.username || 'Unknown',
      points: p.totalPoints,
      wins: p.wins,
      losses: p.losses,
      division: getDivision(p.totalPoints),
      potentialGold: RANKED_REWARD_GOLD[i + 1]
    }));
    
    res.json({
      success: true,
      currentSeason,
      totalPlayers: playerStats.length,
      activePlayers: playerStats.length,
      divisionCounts,
      top5,
      rewardGold: RANKED_REWARD_GOLD,
      eligibleDivisions: ELIGIBLE_DIVISIONS
    });
  } catch (error) {
    console.error('Get ranked info error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Test trophy distribution to a specific user (admin only)
router.post('/admin/ranked/test-trophy/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { division = 'diamond' } = req.body;
    
    
    const result = await createAndAssignTrophyToUser(userId, division);
    
    
    if (result.alreadyHad) {
      return res.json({
        success: true,
        message: 'L\'utilisateur possède déjà ce trophée',
        trophy: result.trophy,
        alreadyHad: true
      });
    }
    
    res.json({
      success: true,
      message: `Trophée "${result.trophy.name}" attribué à ${result.user.username}`,
      trophy: result.trophy,
      user: {
        id: result.user._id,
        username: result.user.username
      }
    });
  } catch (error) {
    console.error('Test trophy distribution error:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// Update ranked season number (admin only)
router.put('/admin/ranked/season-number', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { seasonNumber } = req.body;
    
    if (!seasonNumber || seasonNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Le numéro de saison doit être supérieur à 0'
      });
    }
    
    // Update AppSettings
    await AppSettings.updateOne(
      {},
      { $set: { 'rankedSettings.currentSeason': seasonNumber } },
      { upsert: true }
    );
    
    res.json({
      success: true,
      message: `Numéro de saison mis à jour: ${seasonNumber}`,
      seasonNumber
    });
  } catch (error) {
    console.error('Update season number error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;





