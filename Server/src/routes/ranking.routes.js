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

// Helper function to calculate wins/losses/points from RankedMatch history
async function calculateStatsFromHistory(userId, mode, statsResetAt = null, season = null) {
  try {
    const query = {
      'players.user': userId,
      status: 'completed',
      'result.winner': { $exists: true, $ne: null },
      mode: mode,
      isTestMatch: { $ne: true }
    };
    
    // If season is provided, filter by season date range
    if (season) {
      const currentYear = new Date().getFullYear();
      const seasonMonth = parseInt(season); // Season 1 = January, Season 2 = February, etc.
      let startDate = new Date(Date.UTC(currentYear, seasonMonth - 1, 1, 9, 0, 0));
      const endDate = new Date(Date.UTC(currentYear, seasonMonth, 1, 9, 0, 0));
      
      // If user has reset their stats, use the later of: season start OR statsResetAt
      if (statsResetAt && new Date(statsResetAt) > startDate) {
        startDate = new Date(statsResetAt);
      }
      
      query.completedAt = { $gte: startDate, $lt: endDate };
    } else if (statsResetAt) {
      // No season filter, just use statsResetAt
      query.completedAt = { $gt: statsResetAt };
    }
    
    const matches = await RankedMatch.find(query)
      .sort({ completedAt: 1 })  // Sort chronologically for proper running total
      .select('players result completedAt');
    
    let wins = 0;
    let losses = 0;
    let runningPoints = 0;
    
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
      
      // Running total that never goes below 0
      const pointsChange = player.rewards?.pointsChange || 0;
      runningPoints = Math.max(0, runningPoints + pointsChange);
    }
    
    return { wins, losses, points: runningPoints };
  } catch (error) {
    console.error(`Error calculating stats for user ${userId}:`, error);
    return { wins: 0, losses: 0, points: 0 };
  }
}

// Alias for backward compatibility
async function calculateWinsLossesFromHistory(userId, mode, statsResetAt = null, season = null) {
  return calculateStatsFromHistory(userId, mode, statsResetAt, season);
}

// Get leaderboard (shows all players with ranked matches for the current season)
// This queries RankedMatch directly to get all players who have played
router.get('/leaderboard/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { season = 1, limit = 100, page = 1, force = 'false' } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }

    // Check cache first (unless force refresh is requested)
    const cacheKey = getLeaderboardCacheKey(mode, season, limit, page, 'matches');
    const cachedData = leaderboardCache.get(cacheKey);
    
    if (force !== 'true' && isCacheValid(cachedData)) {
      return res.json(cachedData.data);
    }

    const parsedSeason = parseInt(season);
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    // Calculate season date range
    const currentYear = new Date().getFullYear();
    const seasonMonth = parsedSeason; // Season 1 = January, Season 2 = February, etc.
    const seasonStartDate = new Date(Date.UTC(currentYear, seasonMonth - 1, 1, 9, 0, 0));
    const seasonEndDate = new Date(Date.UTC(currentYear, seasonMonth, 1, 9, 0, 0));

    // Get all matches for the season, sorted chronologically for proper running total
    const matches = await RankedMatch.find({
      mode: mode,
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
    const playerStatsArray = [];
    const userIds = Array.from(playerStatsMap.keys());
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id username avatar discordAvatar discordId isBanned isDeleted')
      .lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    for (const [odiserId, stats] of playerStatsMap) {
      const user = userMap.get(odiserId);
      if (!user || user.isBanned || user.isDeleted || !user.username) continue;

      playerStatsArray.push({
        _id: odiserId,
        wins: stats.wins,
        losses: stats.losses,
        totalMatches: stats.totalMatches,
        points: stats.runningPoints,
        userInfo: user
      });
    }

    // Sort by points DESC, wins DESC
    playerStatsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a._id.localeCompare(b._id);
    });

    // Get total count
    const total = playerStatsArray.length;

    // Apply pagination
    const paginatedResults = playerStatsArray.slice(skip, skip + parsedLimit);

    // Format results
    const rankings = paginatedResults.map((player, index) => {
      const currentPoints = player.points;
      const prevPoints = index > 0 ? paginatedResults[index - 1].points : null;
      const nextPoints = index < paginatedResults.length - 1 ? paginatedResults[index + 1].points : null;
      
      const isTiedWithPrev = prevPoints !== null && prevPoints === currentPoints;
      const isTiedWithNext = nextPoints !== null && nextPoints === currentPoints;
      const hasTie = isTiedWithPrev || isTiedWithNext;

      return {
        _id: player._id,
        user: {
          _id: player.userInfo._id,
          username: player.userInfo.username,
          avatar: player.userInfo.avatar,
          discordAvatar: player.userInfo.discordAvatar,
          discordId: player.userInfo.discordId
        },
        points: player.points, // Calculated from match history
        wins: player.wins,
        losses: player.losses,
        totalMatches: player.totalMatches,
        rank: skip + index + 1,
        hasTie,
        mode: mode,
        season: parsedSeason
      };
    });

    const responseData = {
      success: true,
      rankings,
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

    // Calculate accurate wins/losses from RankedMatch history (filtered by season)
    const statsResetAt = ranking.user.statsResetAt || null;
    const { wins, losses } = await calculateWinsLossesFromHistory(userId, mode, statsResetAt, parseInt(season));

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
    const parsedSeason = parseInt(season);

    // Calculate stats from match history (wins, losses, points)
    const statsResetAt = req.user.statsResetAt || null;
    const { wins, losses, points } = await calculateStatsFromHistory(req.user._id, mode, statsResetAt, parsedSeason);

    // Check if player has played any matches
    const hasPlayed = wins > 0 || losses > 0;

    // Calculate position by counting players with more points in this season
    // We need to aggregate from match history for all players
    const currentYear = new Date().getFullYear();
    const seasonMonth = parsedSeason;
    const seasonStartDate = new Date(Date.UTC(currentYear, seasonMonth - 1, 1, 9, 0, 0));
    const seasonEndDate = new Date(Date.UTC(currentYear, seasonMonth, 1, 9, 0, 0));

    // Get all players' points from match history for ranking
    const allPlayersStats = await RankedMatch.aggregate([
      {
        $match: {
          mode: mode,
          status: 'completed',
          'result.winner': { $exists: true, $ne: null },
          completedAt: { $gte: seasonStartDate, $lt: seasonEndDate },
          isTestMatch: { $ne: true }
        }
      },
      { $unwind: '$players' },
      {
        $match: {
          'players.user': { $exists: true, $ne: null },
          'players.isFake': { $ne: true }
        }
      },
      {
        $group: {
          _id: '$players.user',
          totalPoints: { $sum: { $ifNull: ['$players.rewards.pointsChange', 0] } }
        }
      },
      {
        $addFields: {
          totalPoints: { $max: ['$totalPoints', 0] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.isBanned': { $ne: true }
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    // Find current player's position
    let rank = null;
    let hasTie = false;
    if (hasPlayed) {
      const playerIndex = allPlayersStats.findIndex(p => p._id.toString() === req.user._id.toString());
      if (playerIndex !== -1) {
        rank = playerIndex + 1;
        // Check for tie (same points as adjacent players)
        const myPoints = allPlayersStats[playerIndex].totalPoints;
        if (playerIndex > 0 && allPlayersStats[playerIndex - 1].totalPoints === myPoints) {
          hasTie = true;
        }
        if (playerIndex < allPlayersStats.length - 1 && allPlayersStats[playerIndex + 1].totalPoints === myPoints) {
          hasTie = true;
        }
      }
    }

    res.json({
      success: true,
      ranking: {
        user: req.user._id,
        mode,
        season: parsedSeason,
        points,  // Calculated from match history
        wins,    // Calculated from match history
        losses,  // Calculated from match history
        rank: hasPlayed ? rank : null,
        hasPlayed,
        hasTie
      }
    });
  } catch (error) {
    console.error('Error fetching my ranking:', error);
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

    // Use current season if not specified
    const currentSeason = new Date().getMonth() + 1;
    let ranking = await Ranking.findOne({ user: userId, mode, season: currentSeason });
    
    if (!ranking) {
      ranking = new Ranking({ user: userId, mode, season: currentSeason });
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

    // Use current season for admin match recording
    const currentSeason = new Date().getMonth() + 1;
    
    // Update winner
    let winnerRanking = await Ranking.findOne({ user: winnerId, mode, season: currentSeason });
    if (!winnerRanking) {
      winnerRanking = new Ranking({ user: winnerId, mode, season: currentSeason });
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
    let loserRanking = await Ranking.findOne({ user: loserId, mode, season: currentSeason });
    if (!loserRanking) {
      loserRanking = new Ranking({ user: loserId, mode, season: currentSeason });
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

