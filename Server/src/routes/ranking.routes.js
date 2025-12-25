import express from 'express';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get leaderboard
router.get('/leaderboard/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const { season = 1, limit = 100, page = 1, all = 'false' } = req.query;

    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    }

    // Build query - if all=true, show all players including 0 points
    // Otherwise only show players who have played at least one match
    const showAll = all === 'true';
    const query = { mode, season: parseInt(season) };
    
    if (!showAll) {
      // Only players who have played at least one match
      query.$or = [{ wins: { $gt: 0 } }, { losses: { $gt: 0 } }];
    }

    // Sort by points (desc), then wins (desc), then _id (asc) for consistent tiebreaking
    const rankings = await Ranking.find(query)
      .populate({
        path: 'user',
        select: 'username avatar discordAvatar discordId isBanned isDeleted',
        match: { 
          isBanned: { $ne: true }, 
          isDeleted: { $ne: true },
          username: { $ne: null, $exists: true } // Exclude users with null username
        }
      })
      .sort({ points: -1, wins: -1, _id: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Filter out rankings with null users (banned, deleted, or no username)
    const validRankings = rankings.filter(r => r.user !== null && r.user.username);

    // Add rank numbers and detect ties
    const startRank = (parseInt(page) - 1) * parseInt(limit);
    const rankedData = validRankings.map((r, index, arr) => {
      const currentPoints = r.points;
      
      // Check if tied with adjacent players
      const prevPoints = index > 0 ? arr[index - 1].points : null;
      const nextPoints = index < arr.length - 1 ? arr[index + 1].points : null;
      
      const isTiedWithPrev = prevPoints !== null && prevPoints === currentPoints;
      const isTiedWithNext = nextPoints !== null && nextPoints === currentPoints;
      const hasTie = isTiedWithPrev || isTiedWithNext;
      
      return {
        ...r.toJSON(),
        rank: startRank + index + 1,
        hasTie // true if this player is tied with an adjacent player
      };
    });

    // Count only non-banned users (with same filter as main query)
    const allRankings = await Ranking.find(query)
      .populate({
        path: 'user',
        select: 'isBanned',
        match: { isBanned: { $ne: true } }
      });
    const total = allRankings.filter(r => r.user !== null).length;

    res.json({
      success: true,
      rankings: rankedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
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

    // Fetch users with stats, sorted by EXPERIENCE (include fake users for testing)
    const users = await User.find({
      isBanned: { $ne: true },
      isDeleted: { $ne: true },
      username: { $ne: null, $exists: true } // Exclude users with null username
    })
      .select('username avatar discordAvatar discordId stats experience')
      .sort({ 'experience': -1 }) // Tri par expérience au lieu des points
      .limit(parseInt(limit));

    const rankings = users.map((u, index) => ({
      rank: index + 1,
      user: {
        _id: u._id,
        username: u.username,
        avatar: u.avatar,
        discordAvatar: u.discordAvatar,
        discordId: u.discordId
      },
      points: u.experience || 0, // On retourne l'XP dans le champ "points" pour compatibilité
      experience: u.experience || 0, // Ajout explicite de l'XP
      wins: u.stats?.wins || 0,
      losses: u.stats?.losses || 0
    }));

    res.json({ success: true, rankings });
  } catch (error) {
    console.error('Error fetching top players:', error);
    res.status(500).json({ success: false, message: 'Error fetching top players' });
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
    }).populate('user', 'username avatar discordAvatar discordId isBanned');

    if (!ranking || !ranking.user) {
      return res.status(404).json({ success: false, message: 'Ranking not found' });
    }

    // Check if user is banned
    if (ranking.user.isBanned) {
      return res.status(403).json({ success: false, message: 'User is banned' });
    }

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

    // Check if player has played any matches
    const hasPlayed = ranking.wins > 0 || ranking.losses > 0;

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

export default router;

