import express from 'express';
import mongoose from 'mongoose';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import RankedMatch from '../models/RankedMatch.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Cache for leaderboard with 15-minute expiration
const leaderboardCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Helper to get cache key
function getLeaderboardCacheKey(mode, season, limit, page, all) {
  return `${mode}_${season}_${limit}_${page}_${all}`;
}

// Helper to check if cache is valid
function isCacheValid(cachedData) {
  return cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION;
}

// ==================== PUBLIC ROUTES ====================

// Helper function to calculate wins/losses from RankedMatch history
async function calculateWinsLossesFromHistory(userId, mode, statsResetAt = null) {
  try {
    const query = {
      'players.user': userId,
      status: 'completed',
      'result.winner': { $exists: true, $ne: null },
      mode: mode
    };
    
    // If user has reset their stats, only count matches after the reset
    if (statsResetAt) {
      query.completedAt = { $gt: statsResetAt };
    }
    
    const matches = await RankedMatch.find(query).select('players result');
    
    let wins = 0;
    let losses = 0;
    
    for (const match of matches) {
      const player = match.players.find(p => {
        const pUserId = p.user?._id?.toString() || p.user?.toString();
        return pUserId === userId.toString();
      });
      
      if (!player || player.isFake) continue;
      
      const winningTeam = Number(match.result.winner);
      const playerTeam = Number(player.team);
      
      if (playerTeam === winningTeam) {
        wins++;
      } else {
        losses++;
      }
    }
    
    return { wins, losses };
  } catch (error) {
    console.error(`Error calculating wins/losses for user ${userId}:`, error);
    return { wins: 0, losses: 0 };
  }
}

// Get leaderboard
router.get('/leaderboard/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { season = 1, limit = 100, page = 1, all = 'false', force = 'false' } = req.query;


    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }

    // Check cache first (unless force refresh is requested)
    const cacheKey = getLeaderboardCacheKey(mode, season, limit, page, all);
    const cachedData = leaderboardCache.get(cacheKey);
    
    if (force !== 'true' && isCacheValid(cachedData)) {
      return res.json(cachedData.data);
    }

    // Build query - if all=true, show all players including 0 points
    // Otherwise only show players who have played at least one match
    const showAll = all === 'true';
    const query = { mode, season: parseInt(season) };
    
    if (!showAll) {
      // Only players who have played at least one match
      query.$or = [{ wins: { $gt: 0 } }, { losses: { $gt: 0 } }];
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    // First, let's check how many rankings exist for this mode (without filters)
    const totalInDb = await Ranking.countDocuments({ mode, season: parseInt(season) });
    const withMatchesInDb = await Ranking.countDocuments({ mode, season: parseInt(season), $or: [{ wins: { $gt: 0 } }, { losses: { $gt: 0 } }] });

    // Fetch more than needed to account for filtered users, then slice
    const overFetchMultiplier = 2;
    const rankings = await Ranking.find(query)
      .populate({
        path: 'user',
        select: 'username avatar discordAvatar discordId isBanned isDeleted statsResetAt'
      })
      .sort({ points: -1, wins: -1, _id: 1 })
      .limit(parsedLimit * overFetchMultiplier + skip)
      .skip(0); // Skip will be handled after filtering


    // Filter out rankings with null users, banned, deleted, or no username
    const validRankings = rankings.filter(r => {
      if (!r.user) {
        return false;
      }
      if (!r.user.username) {
        return false;
      }
      if (r.user.isBanned === true) {
        return false;
      }
      if (r.user.isDeleted === true) {
        return false;
      }
      return true;
    });
    
    // Apply pagination on filtered results
    const paginatedRankings = validRankings.slice(skip, skip + parsedLimit);

    // Calculate accurate wins/losses from match history for each player
    const rankedDataPromises = paginatedRankings.map(async (r, index, arr) => {
      const currentPoints = r.points;
      
      // Check if tied with adjacent players
      const prevPoints = index > 0 ? arr[index - 1].points : null;
      const nextPoints = index < arr.length - 1 ? arr[index + 1].points : null;
      
      const isTiedWithPrev = prevPoints !== null && prevPoints === currentPoints;
      const isTiedWithNext = nextPoints !== null && nextPoints === currentPoints;
      const hasTie = isTiedWithPrev || isTiedWithNext;
      
      // Calculate actual wins/losses from RankedMatch history
      const statsResetAt = r.user?.statsResetAt || null;
      const { wins, losses } = await calculateWinsLossesFromHistory(r.user._id, mode, statsResetAt);
      
      const jsonData = r.toJSON();
      return {
        ...jsonData,
        wins,  // Override with calculated wins from match history
        losses,  // Override with calculated losses from match history
        rank: skip + index + 1,
        hasTie
      };
    });
    
    const rankedData = await Promise.all(rankedDataPromises);

    // Count all valid (non-banned) users
    const total = validRankings.length;


    const responseData = {
      success: true,
      rankings: rankedData,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      },
      cached: false,
      cacheTimestamp: Date.now()
    };

    // Store in cache
    leaderboardCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
  }
});

// Get single top player (most XP/experience) for homepage highlight
router.get('/top-player', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';

    // Find user with most XP for this mode
    const topUser = await User.findOne({
      isBanned: { $ne: true },
      isDeleted: { $ne: true },
      username: { $ne: null, $exists: true },
      [`${statsField}.xp`]: { $gt: 0 }
    })
      .select(`username avatar discordAvatar discordId ${statsField}`)
      .sort({ [`${statsField}.xp`]: -1 });

    if (!topUser) {
      return res.json({ success: true, player: null });
    }
    
    // Use ONLY mode-specific stats, no fallback to general stats
    const modeStats = topUser[statsField] || {};

    res.json({
      success: true,
      player: {
        _id: topUser._id,
        username: topUser.username,
        avatar: topUser.avatar,
        avatarUrl: topUser.avatarUrl,
        discordAvatar: topUser.discordAvatar,
        discordId: topUser.discordId,
        xp: modeStats.xp || 0,
        wins: modeStats.wins || 0,
        losses: modeStats.losses || 0,
        points: modeStats.points || 0
      }
    });
  } catch (error) {
    console.error('Error fetching top player:', error);
    res.status(500).json({ success: false, message: 'Error fetching top player' });
  }
});

// Get MVP leader (player with most MVP awards) for homepage highlight
router.get('/mvp-leader', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Use the appropriate MVP count field based on mode
    const mvpCountField = mode === 'cdl' ? 'mvpCountCdl' : 'mvpCountHardcore';

    // Find user with most MVP awards for this mode
    const mvpLeader = await User.findOne({
      isBanned: { $ne: true },
      isDeleted: { $ne: true },
      username: { $ne: null, $exists: true },
      [mvpCountField]: { $gt: 0 }
    })
      .select(`username avatar avatarUrl discordAvatar discordId ${mvpCountField}`)
      .sort({ [mvpCountField]: -1 });

    if (!mvpLeader) {
      return res.json({ success: true, player: null });
    }

    res.json({
      success: true,
      player: {
        _id: mvpLeader._id,
        username: mvpLeader.username,
        avatar: mvpLeader.avatar,
        avatarUrl: mvpLeader.avatarUrl,
        discordAvatar: mvpLeader.discordAvatar,
        discordId: mvpLeader.discordId,
        mvpCount: mvpLeader[mvpCountField] || 0
      }
    });
  } catch (error) {
    console.error('Error fetching MVP leader:', error);
    res.status(500).json({ success: false, message: 'Error fetching MVP leader' });
  }
});

// Get single top squad (most totalPoints from stats) for homepage highlight
router.get('/top-squad', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';

    // Find squad with most points for this mode
    const topSquad = await Squad.findOne({
      isDeleted: { $ne: true },
      $or: [{ mode }, { mode: 'both' }],
      [`${statsField}.totalPoints`]: { $gt: 0 }
    })
      .select(`name tag logo color ${statsField} registeredLadders`)
      .sort({ [`${statsField}.totalPoints`]: -1 })
      .lean();

    if (!topSquad) {
      return res.json({ success: true, squad: null });
    }
    
    // Use ONLY mode-specific stats, no fallback to general stats
    const modeStats = topSquad[statsField] || {};

    res.json({
      success: true,
      squad: {
        _id: topSquad._id,
        name: topSquad.name,
        tag: topSquad.tag,
        logo: topSquad.logo,
        color: topSquad.color,
        stats: modeStats,
        totalPoints: modeStats.totalPoints || 0,
        totalWins: modeStats.totalWins || 0,
        totalLosses: modeStats.totalLosses || 0
      }
    });
  } catch (error) {
    console.error('Error fetching top squad:', error);
    res.status(500).json({ success: false, message: 'Error fetching top squad' });
  }
});

// Get top players from User stats (for homepage dashboard) - Sorted by EXPERIENCE
router.get('/top-players/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { limit = 10 } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';

    // Fetch users with stats, sorted by XP for this mode
    // Only include users who have XP > 0 in this specific mode (no fallback to general stats)
    const users = await User.find({
      isBanned: { $ne: true },
      isDeleted: { $ne: true },
      username: { $ne: null, $exists: true }, // Exclude users with null username
      [`${statsField}.xp`]: { $gt: 0 } // Only users with XP in this specific mode
    })
      .select(`username avatar discordAvatar discordId ${statsField}`)
      .sort({ [`${statsField}.xp`]: -1 }) // Tri par XP du mode
      .limit(parseInt(limit));

    const rankings = users.map((u, index) => {
      // Use ONLY mode-specific stats, no fallback to general stats
      const modeStats = u[statsField] || {};
      return {
        rank: index + 1,
        user: {
          _id: u._id,
          username: u.username,
          avatar: u.avatar,
          discordAvatar: u.discordAvatar,
          discordId: u.discordId
        },
        points: modeStats.xp || 0, // On retourne l'XP dans le champ "points" pour compatibilité
        xp: modeStats.xp || 0, // XP explicite
        wins: modeStats.wins || 0,
        losses: modeStats.losses || 0
      };
    });

    res.json({ success: true, rankings });
  } catch (error) {
    console.error('Error fetching top players:', error);
    res.status(500).json({ success: false, message: 'Error fetching top players' });
  }
});

// Get a specific player's rank (by XP)
router.get('/player-rank/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { mode = 'hardcore' } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }
    
    // Use the appropriate stats field based on mode
    const statsField = mode === 'cdl' ? 'statsCdl' : 'statsHardcore';

    // Get the user
    const user = await User.findById(userId).select(`username avatar discordAvatar discordId ${statsField} isBanned isDeleted`);
    
    if (!user || user.isBanned || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Use ONLY mode-specific stats, no fallback to general stats
    const modeStats = user[statsField] || {};
    const userXp = modeStats.xp || 0;

    // Count users with higher XP for this mode
    const higherRankedCount = await User.countDocuments({
      isBanned: { $ne: true },
      isDeleted: { $ne: true },
      username: { $ne: null, $exists: true },
      [`${statsField}.xp`]: { $gt: userXp }
    });

    // User's rank is higherRankedCount + 1
    const rank = higherRankedCount + 1;

    res.json({
      success: true,
      rank,
      points: userXp,
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        discordAvatar: user.discordAvatar,
        discordId: user.discordId
      }
    });
  } catch (error) {
    console.error('Error fetching player rank:', error);
    res.status(500).json({ success: false, message: 'Error fetching player rank' });
  }
});

// Get user's ranking
router.get('/user/:userId/:mode', async (req, res) => {
  try {
    const { userId, mode } = req.params;
    const { season = 1 } = req.query;

    const ranking = await Ranking.findOne({ 
      user: userId, 
      mode, 
      season: parseInt(season) 
    }).populate('user', 'username avatar discordAvatar discordId isBanned statsResetAt');

    if (!ranking || !ranking.user) {
      return res.status(404).json({ success: false, message: 'Ranking not found' });
    }

    // Check if user is banned
    if (ranking.user.isBanned) {
      return res.status(403).json({ success: false, message: 'User is banned' });
    }

    // Calculate accurate wins/losses from RankedMatch history
    const statsResetAt = ranking.user.statsResetAt || null;
    const { wins, losses } = await calculateWinsLossesFromHistory(userId, mode, statsResetAt);

    // Get user's position - count only non-banned users with better stats
    const allHigherRankings = await Ranking.find({
      mode,
      season: parseInt(season),
      $or: [
        { points: { $gt: ranking.points } },
        { 
          points: ranking.points, 
          wins: { $gt: ranking.wins } 
        },
        { 
          points: ranking.points, 
          wins: ranking.wins,
          _id: { $lt: ranking._id } // Tiebreaker final: oldest entry wins
        }
      ]
    }).populate({
      path: 'user',
      select: 'isBanned',
      match: { isBanned: { $ne: true } }
    });

    // Count only those with valid (non-banned) users
    const higherRanked = allHigherRankings.filter(r => r.user !== null).length;
    
    // Check for ties - find if any other player has the exact same points
    const playersWithSamePoints = await Ranking.find({
      mode,
      season: parseInt(season),
      points: ranking.points,
      _id: { $ne: ranking._id }
    }).populate({
      path: 'user',
      select: 'isBanned',
      match: { isBanned: { $ne: true } }
    });
    
    const hasTie = playersWithSamePoints.some(r => r.user !== null);
    
    res.json({
      success: true,
      ranking: {
        ...ranking.toJSON(),
        wins,  // Override with calculated wins from match history
        losses,  // Override with calculated losses from match history
        rank: higherRanked + 1,
        hasTie // true if another player has the same points
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching ranking' });
  }
});

// Get my ranking
router.get('/me/:mode', verifyToken, async (req, res) => {
  try {
    const { mode } = req.params;
    const { season = 1 } = req.query;

    let ranking = await Ranking.findOne({ 
      user: req.user._id, 
      mode, 
      season: parseInt(season) 
    });

    if (!ranking) {
      // Create ranking if doesn't exist
      ranking = new Ranking({
        user: req.user._id,
        mode,
        season: parseInt(season)
      });
      await ranking.save();
    }

    // Calculate accurate wins/losses from RankedMatch history
    const statsResetAt = req.user.statsResetAt || null;
    const { wins, losses } = await calculateWinsLossesFromHistory(req.user._id, mode, statsResetAt);

    // Get position - with tiebreakers, excluding banned users
    const allHigherRankings = await Ranking.find({
      mode,
      season: parseInt(season),
      $or: [
        { points: { $gt: ranking.points } },
        { 
          points: ranking.points, 
          wins: { $gt: ranking.wins } 
        },
        { 
          points: ranking.points, 
          wins: ranking.wins,
          _id: { $lt: ranking._id }
        }
      ]
    }).populate({
      path: 'user',
      select: 'isBanned',
      match: { isBanned: { $ne: true } }
    });

    // Count only those with valid (non-banned) users
    const higherRanked = allHigherRankings.filter(r => r.user !== null).length;

    // Check if player has played any matches (from actual history)
    const hasPlayed = wins > 0 || losses > 0;

    // Check if tied with adjacent players
    let hasTie = false;
    if (hasPlayed) {
      const playerRank = higherRanked + 1;
      
      // Check for tie with player above (same points)
      const playerAbove = await Ranking.findOne({
        mode,
        season: parseInt(season),
        points: ranking.points,
        _id: { $ne: ranking._id }
      }).populate({
        path: 'user',
        select: 'isBanned',
        match: { isBanned: { $ne: true } }
      });
      
      hasTie = playerAbove && playerAbove.user !== null;
    }

    res.json({
      success: true,
      ranking: {
        ...ranking.toJSON(),
        wins,  // Override with calculated wins from match history
        losses,  // Override with calculated losses from match history
        rank: hasPlayed ? higherRanked + 1 : null,  // null rank if not played yet
        hasPlayed,
        hasTie // true if tied with another player at same points
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching ranking' });
  }
});

// Get divisions stats
router.get('/divisions/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { season = 1 } = req.query;

    const divisions = await Ranking.aggregate([
      { $match: { mode, season: parseInt(season) } },
      { $group: { _id: '$division', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      divisions: divisions.map(d => ({ name: d._id, count: d.count }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching divisions' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all rankings (admin)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, season = 1, page = 1, limit = 50, search = '' } = req.query;

    const query = { season: parseInt(season) };
    if (mode) query.mode = mode;

    // Build aggregation for search
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' }
    ];

    if (search) {
      pipeline.push({
        $match: {
          'userInfo.username': { $regex: search, $options: 'i' }
        }
      });
    }

    pipeline.push(
      { $sort: { points: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    const rankings = await Ranking.aggregate(pipeline);

    // Get total count
    const countPipeline = [{ $match: query }];
    if (search) {
      countPipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        { $match: { 'userInfo.username': { $regex: search, $options: 'i' } } }
      );
    }
    countPipeline.push({ $count: 'total' });
    
    const countResult = await Ranking.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      rankings: rankings.map((r, i) => ({
        ...r,
        user: r.userInfo,
        rank: (parseInt(page) - 1) * parseInt(limit) + i + 1
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin rankings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching rankings' });
  }
});

// Create/Update ranking (admin)
router.put('/admin/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { mode, season = 1, points, wins, losses, kills, deaths, team, division } = req.body;

    if (!mode || !['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Valid mode required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let ranking = await Ranking.findOne({ user: userId, mode, season: parseInt(season) });

    if (!ranking) {
      ranking = new Ranking({ user: userId, mode, season: parseInt(season) });
    }

    // Update fields if provided
    if (points !== undefined) ranking.points = points;
    if (wins !== undefined) ranking.wins = wins;
    if (losses !== undefined) ranking.losses = losses;
    if (kills !== undefined) ranking.kills = kills;
    if (deaths !== undefined) ranking.deaths = deaths;
    if (team !== undefined) ranking.team = team;
    if (division !== undefined) ranking.division = division;

    await ranking.save();

    // Also update user's stats - initialize stats[mode] if it doesn't exist
    if (!user.stats) {
      user.stats = {};
    }
    if (!user.stats[mode]) {
      user.stats[mode] = { points: 0, wins: 0, losses: 0 };
    }
    user.stats[mode].points = ranking.points;
    user.stats[mode].wins = ranking.wins;
    user.stats[mode].losses = ranking.losses;
    await user.save();

    res.json({
      success: true,
      message: 'Ranking updated',
      ranking
    });
  } catch (error) {
    console.error('Update ranking error:', error);
    res.status(500).json({ success: false, message: 'Error updating ranking' });
  }
});

// Add points to user (admin)
router.post('/admin/:userId/add-points', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { mode, points, reason } = req.body;

    if (!mode || !points) {
      return res.status(400).json({ success: false, message: 'Mode and points required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let ranking = await Ranking.findOne({ user: userId, mode, season: 1 });
    
    if (!ranking) {
      ranking = new Ranking({ user: userId, mode, season: 1 });
    }

    ranking.points += parseInt(points);
    if (ranking.points < 0) ranking.points = 0;
    await ranking.save();

    // Update user stats - initialize stats[mode] if it doesn't exist
    if (!user.stats) {
      user.stats = {};
    }
    if (!user.stats[mode]) {
      user.stats[mode] = { points: 0, wins: 0, losses: 0 };
    }
    user.stats[mode].points = ranking.points;
    await user.save();

    res.json({
      success: true,
      message: `${points > 0 ? 'Added' : 'Removed'} ${Math.abs(points)} points`,
      newPoints: ranking.points
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating points' });
  }
});

// Record match result (admin)
router.post('/admin/record-match', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { mode, winnerId, loserId, winnerKills = 0, loserKills = 0, pointsGain = 25, pointsLoss = 15 } = req.body;

    if (!mode || !winnerId || !loserId) {
      return res.status(400).json({ success: false, message: 'Mode, winnerId, and loserId required' });
    }

    // Update winner
    let winnerRanking = await Ranking.findOne({ user: winnerId, mode, season: 1 });
    if (!winnerRanking) {
      winnerRanking = new Ranking({ user: winnerId, mode, season: 1 });
    }
    winnerRanking.wins += 1;
    winnerRanking.points += pointsGain;
    winnerRanking.kills += winnerKills;
    winnerRanking.currentStreak += 1;
    if (winnerRanking.currentStreak > winnerRanking.bestStreak) {
      winnerRanking.bestStreak = winnerRanking.currentStreak;
    }
    await winnerRanking.save();

    // Update loser
    let loserRanking = await Ranking.findOne({ user: loserId, mode, season: 1 });
    if (!loserRanking) {
      loserRanking = new Ranking({ user: loserId, mode, season: 1 });
    }
    loserRanking.losses += 1;
    loserRanking.points = Math.max(0, loserRanking.points - pointsLoss);
    loserRanking.kills += loserKills;
    loserRanking.currentStreak = 0;
    await loserRanking.save();

    // Update user stats
    const winner = await User.findById(winnerId);
    const loser = await User.findById(loserId);
    
    if (winner) {
      // Initialize stats[mode] if it doesn't exist
      if (!winner.stats) {
        winner.stats = {};
      }
      if (!winner.stats[mode]) {
        winner.stats[mode] = { points: 0, wins: 0, losses: 0 };
      }
      winner.stats[mode].wins = winnerRanking.wins;
      winner.stats[mode].points = winnerRanking.points;
      await winner.save();
    }
    
    if (loser) {
      // Initialize stats[mode] if it doesn't exist
      if (!loser.stats) {
        loser.stats = {};
      }
      if (!loser.stats[mode]) {
        loser.stats[mode] = { points: 0, wins: 0, losses: 0 };
      }
      loser.stats[mode].losses = loserRanking.losses;
      loser.stats[mode].points = loserRanking.points;
      await loser.save();
    }

    res.json({
      success: true,
      message: 'Match recorded',
      winner: { points: winnerRanking.points, wins: winnerRanking.wins },
      loser: { points: loserRanking.points, losses: loserRanking.losses }
    });
  } catch (error) {
    console.error('Record match error:', error);
    res.status(500).json({ success: false, message: 'Error recording match' });
  }
});

// Delete ranking (admin)
router.delete('/admin/:rankingId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const ranking = await Ranking.findByIdAndDelete(req.params.rankingId);
    
    if (!ranking) {
      return res.status(404).json({ success: false, message: 'Ranking not found' });
    }

    res.json({ success: true, message: 'Ranking deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting ranking' });
  }
});

// Reset all rankings for a season (admin)
router.post('/admin/reset-season', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { mode, season } = req.body;

    if (!mode || !season) {
      return res.status(400).json({ success: false, message: 'Mode and season required' });
    }

    await Ranking.deleteMany({ mode, season: parseInt(season) });

    res.json({ success: true, message: `Season ${season} rankings reset for ${mode}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resetting season' });
  }
});

// Get ranking stats (admin)
router.get('/admin/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const hardcoreCount = await Ranking.countDocuments({ mode: 'hardcore' });
    const cdlCount = await Ranking.countDocuments({ mode: 'cdl' });

    const topHardcore = await Ranking.find({ mode: 'hardcore' })
      .populate('user', 'username')
      .sort({ points: -1 })
      .limit(5);

    const topCDL = await Ranking.find({ mode: 'cdl' })
      .populate('user', 'username')
      .sort({ points: -1 })
      .limit(5);

    const divisionStats = await Ranking.aggregate([
      { $group: { _id: { mode: '$mode', division: '$division' }, count: { $sum: 1 } } },
      { $sort: { '_id.mode': 1, '_id.division': 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        hardcoreCount,
        cdlCount,
        topHardcore,
        topCDL,
        divisionStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// ==================== DUPLICATE ADMIN ROUTE - REMOVED ====================
// (The correct /admin/all route is at line 316)

// ==================== DEBUG ENDPOINT ====================
// Get all rankings for current user (for debugging)
router.get('/debug/my-rankings', verifyToken, async (req, res) => {
  try {
    const rankings = await Ranking.find({ user: req.user._id });
    
    // Also get user flags
    const userFlags = {
      isBanned: req.user.isBanned,
      isDeleted: req.user.isDeleted,
      username: req.user.username
    };
    
    rankings.forEach(r => {
    });
    
    res.json({
      success: true,
      userId: req.user._id,
      username: req.user.username,
      userFlags,
      rankings: rankings.map(r => ({
        mode: r.mode,
        season: r.season,
        points: r.points,
        wins: r.wins,
        losses: r.losses,
        division: r.division
      }))
    });
  } catch (error) {
    console.error('Error fetching debug rankings:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
});

export default router;

