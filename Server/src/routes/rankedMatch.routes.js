import express from 'express';
import RankedMatch from '../models/RankedMatch.js';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { getRankedMatchRewards } from '../utils/configHelper.js';

const router = express.Router();

// Helper to get rewards for a game mode and ranked mode (now uses config from database)
const getRewards = async (gameMode, mode = 'hardcore') => {
  return await getRankedMatchRewards(gameMode, mode);
};

// ============================================
// MATCHMAKING QUEUE SYSTEM - Helper functions
// ============================================

// In-memory matchmaking queues (per gameMode and mode)
const matchmakingQueues = {
  hardcore: {
    'Duel': [],
    'Team Deathmatch': [],
    'Domination': [],
    'Search & Destroy': []
  },
  cdl: {
    'Duel': [],
    'Team Deathmatch': [],
    'Domination': [],
    'Search & Destroy': []
  }
};

// Get required players per game mode
const getRequiredPlayers = (gameMode) => {
  switch (gameMode) {
    case 'Duel': return 2; // 1v1
    case 'Team Deathmatch': return 8; // 4v4
    case 'Domination': return 8; // 4v4
    case 'Search & Destroy': return 8; // 4v4
    default: return 8;
  }
};

// Get rank bracket from points
const getRankBracketFromPoints = (points) => {
  if (points >= 3500) return 'champion';
  if (points >= 3000) return 'grandmaster';
  if (points >= 2500) return 'master';
  if (points >= 2000) return 'diamond';
  if (points >= 1500) return 'platinum';
  if (points >= 1000) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
};

// Check if two players can be matched (rank difference check)
const canMatch = (player1Points, player2Points) => {
  const bracket1 = getRankBracketFromPoints(player1Points);
  const bracket2 = getRankBracketFromPoints(player2Points);
  
  // Allow matching within 1 rank bracket
  const brackets = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
  const idx1 = brackets.indexOf(bracket1);
  const idx2 = brackets.indexOf(bracket2);
  
  return Math.abs(idx1 - idx2) <= 1;
};

// Check for active match for current user
router.get('/active/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { mode } = req.query;
    
    const query = {
      'players.user': userId,
      status: { $in: ['pending', 'in_progress'] }
    };
    
    if (mode) {
      query.mode = mode;
    }
    
    const activeMatch = await RankedMatch.findOne(query)
      .sort({ createdAt: -1 })
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('team1Captain', 'username')
      .populate('team2Captain', 'username')
      .populate('host', 'username avatar avatarUrl');
    
    res.json({ 
      success: true, 
      hasActiveMatch: !!activeMatch,
      match: activeMatch 
    });
  } catch (error) {
    console.error('Error checking active match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// MATCHMAKING ROUTES (must be before /:matchId)
// ============================================

// Get all queues status (for display) - PUBLIC
router.get('/matchmaking/queues', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;
    
    const queues = matchmakingQueues[mode] || {};
    const status = {};
    
    for (const [gameMode, queue] of Object.entries(queues)) {
      status[gameMode] = {
        playersInQueue: queue.length,
        requiredPlayers: getRequiredPlayers(gameMode),
        estimatedWait: queue.length > 0 
          ? Math.ceil(queue.length / getRequiredPlayers(gameMode)) * 60 
          : 0
      };
    }
    
    res.json({ success: true, queues: status });
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get queue status for current user
router.get('/matchmaking/status', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode = 'hardcore' } = req.query;
    const userId = req.user._id.toString();
    
    const queue = matchmakingQueues[mode]?.[gameMode] || [];
    const userIdx = queue.findIndex(p => p.odId === userId);
    
    res.json({
      success: true,
      inQueue: userIdx !== -1,
      queuePosition: userIdx !== -1 ? userIdx + 1 : 0,
      queueSize: queue.length,
      estimatedWait: userIdx !== -1 
        ? Math.ceil((userIdx + 1) / getRequiredPlayers(gameMode)) * 60 
        : 0
    });
  } catch (error) {
    console.error('Matchmaking status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode = 'hardcore' } = req.body;
    const userId = req.user._id.toString();
    
    // Validate game mode
    const validModes = ['Duel', 'Team Deathmatch', 'Domination', 'Search & Destroy'];
    if (!validModes.includes(gameMode)) {
      return res.status(400).json({ success: false, message: 'Mode de jeu invalide' });
    }
    
    // Check if user already has an active ranked match
    const activeMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'in_progress'] }
    });
    
    if (activeMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà un match en cours',
        matchId: activeMatch._id
      });
    }
    
    // Get user's ranking
    const ranking = await Ranking.findOne({ user: userId, mode }) || { points: 0 };
    const rankBracket = getRankBracketFromPoints(ranking.points || 0);
    
    // Check if already in queue
    const queue = matchmakingQueues[mode][gameMode];
    const existingIdx = queue.findIndex(p => p.odId === userId);
    if (existingIdx !== -1) {
      return res.json({ 
        success: true, 
        message: 'Déjà en file d\'attente',
        queuePosition: existingIdx + 1,
        queueSize: queue.length
      });
    }
    
    // Add to queue
    const user = await User.findById(userId).select('username avatar avatarUrl');
    const queueEntry = {
      odId: userId,
      odUsername: user?.username || 'Unknown',
      avatar: user?.avatarUrl || user?.avatar,
      points: ranking.points || 0,
      rankBracket,
      joinedAt: new Date()
    };
    
    queue.push(queueEntry);
    
    // Try to create a match
    const requiredPlayers = getRequiredPlayers(gameMode);
    
    // Sort by rank to match similar players
    queue.sort((a, b) => a.points - b.points);
    
    // Try to find enough compatible players
    if (queue.length >= requiredPlayers) {
      // Find a group of compatible players
      let matchedPlayers = [];
      
      // For Duel, just take first 2
      if (gameMode === 'Duel') {
        for (let i = 0; i < queue.length - 1; i++) {
          if (canMatch(queue[i].points, queue[i + 1].points)) {
            matchedPlayers = [queue[i], queue[i + 1]];
            break;
          }
        }
      } else {
        // For team modes, find 8 compatible players
        for (let i = 0; i <= queue.length - requiredPlayers; i++) {
          const group = queue.slice(i, i + requiredPlayers);
          const allCompatible = group.every((p, idx) => {
            if (idx === 0) return true;
            return canMatch(group[0].points, p.points);
          });
          
          if (allCompatible) {
            matchedPlayers = group;
            break;
          }
        }
      }
      
      if (matchedPlayers.length >= requiredPlayers) {
        // Remove matched players from queue
        matchedPlayers.forEach(mp => {
          const idx = queue.findIndex(q => q.odId === mp.odId);
          if (idx !== -1) queue.splice(idx, 1);
        });
        
        // Create the ranked match
        const avgPoints = Math.round(matchedPlayers.reduce((sum, p) => sum + p.points, 0) / matchedPlayers.length);
        const matchRankBracket = getRankBracketFromPoints(avgPoints);
        
        // Build players array
        const players = matchedPlayers.map(p => ({
          user: p.odId,
          rank: getRankBracketFromPoints(p.points),
          points: p.points
        }));
        
        // For team modes, split players into teams
        let team1Players = [];
        let team2Players = [];
        
        if (gameMode !== 'Duel' && gameMode !== 'Team Deathmatch') {
          // Shuffle and split for fair teams
          const shuffled = [...matchedPlayers].sort(() => Math.random() - 0.5);
          team1Players = shuffled.slice(0, requiredPlayers / 2).map(p => p.odId);
          team2Players = shuffled.slice(requiredPlayers / 2).map(p => p.odId);
          
          // Update player teams
          players.forEach(p => {
            if (team1Players.includes(p.user)) p.team = 1;
            else p.team = 2;
          });
        }
        
        const newMatch = new RankedMatch({
          gameMode,
          mode,
          players,
          team1: { players: team1Players },
          team2: { players: team2Players },
          team1Captain: team1Players[0] || null,
          team2Captain: team2Players[0] || null,
          host: matchedPlayers[0].odId,
          hostTeam: 1,
          status: 'pending',
          rankBracket: matchRankBracket
        });
        
        await newMatch.save();
        
        // Populate for response
        const populatedMatch = await RankedMatch.findById(newMatch._id)
          .populate('players.user', 'username avatar avatarUrl platform')
          .populate('host', 'username avatar avatarUrl');
        
        // Emit socket event to all matched players
        const { getIO } = await import('../index.js');
        const io = getIO();
        if (io) {
          matchedPlayers.forEach(mp => {
            io.to(`user:${mp.odId}`).emit('rankedMatchFound', {
              matchId: newMatch._id,
              gameMode,
              mode,
              players: populatedMatch.players
            });
          });
        }
        
        return res.json({ 
          success: true, 
          matchFound: true,
          match: populatedMatch
        });
      }
    }
    
    // No match found, user is in queue
    const queuePosition = queue.findIndex(p => p.odId === userId) + 1;
    
    // Emit queue update via socket
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('queueUpdate', {
        gameMode,
        mode,
        position: queuePosition,
        queueSize: queue.length,
        estimatedWait: Math.ceil(queue.length / getRequiredPlayers(gameMode)) * 60 // rough estimate in seconds
      });
    }
    
    res.json({ 
      success: true, 
      matchFound: false,
      queuePosition,
      queueSize: queue.length,
      estimatedWait: Math.ceil(queue.length / getRequiredPlayers(gameMode)) * 60
    });
  } catch (error) {
    console.error('Matchmaking join error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, async (req, res) => {
  try {
    const { gameMode, mode = 'hardcore' } = req.body;
    const userId = req.user._id.toString();
    
    // Remove from queue
    const queue = matchmakingQueues[mode]?.[gameMode];
    if (queue) {
      const idx = queue.findIndex(p => p.odId === userId);
      if (idx !== -1) {
        queue.splice(idx, 1);
      }
    }
    
    res.json({ success: true, message: 'Retiré de la file d\'attente' });
  } catch (error) {
    console.error('Matchmaking leave error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// END MATCHMAKING ROUTES
// ============================================

// Get a ranked match by ID
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await RankedMatch.findById(matchId)
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('team1.players', 'username avatar avatarUrl platform')
      .populate('team2.players', 'username avatar avatarUrl platform')
      .populate('team1Captain', 'username avatar avatarUrl')
      .populate('team2Captain', 'username avatar avatarUrl')
      .populate('host', 'username avatar avatarUrl')
      .populate('chat.user', 'username avatar avatarUrl')
      .populate('result.reportedBy', 'username')
      .populate('result.confirmedBy', 'username')
      .populate('dispute.reportedBy', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error fetching ranked match:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Send chat message
router.post('/:matchId/chat', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Check if user is in the match
    const isInMatch = match.players.some(p => p.user.toString() === userId.toString());
    if (!isInMatch) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }
    
    // Get user team
    const userPlayer = match.players.find(p => p.user.toString() === userId.toString());
    
    // Create message
    const chatMessage = {
      user: userId,
      message: message.trim(),
      team: userPlayer?.team,
      createdAt: new Date()
    };
    
    match.chat.push(chatMessage);
    await match.save();
    
    // Populate user for socket emission
    const user = await User.findById(userId).select('username avatar avatarUrl');
    const populatedMessage = {
      ...chatMessage,
      user
    };
    
    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('newRankedMessage', populatedMessage);
    }
    
    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Send system message to ranked match chat
router.post('/:matchId/chat/system', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Create system message
    const systemMessage = {
      user: null,
      message: message.trim(),
      isSystem: true,
      createdAt: new Date()
    };
    
    match.chat.push(systemMessage);
    await match.save();
    
    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('newRankedMessage', systemMessage);
    }
    
    res.json({ success: true, message: systemMessage });
  } catch (error) {
    console.error('Error sending system message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Report match result
router.post('/:matchId/result', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner, winnerUserId, isFakeWinner } = req.body; // 'team1', 'team2' for team modes, or winnerUserId for FFA
    const userId = req.user._id;
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Match déjà terminé' });
    }
    
    // Check if user is in the match
    const isInMatch = match.players.some(p => p.user.toString() === userId.toString());
    if (!isInMatch) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }
    
    // Check if game has teams (Duel and Team Deathmatch are FFA modes)
    const isFFA = match.gameMode === 'Team Deathmatch' || match.gameMode === 'Duel';
    const hasTeams = !isFFA;
    
    let winnerPlayers = [];
    let loserPlayers = [];
    let winnerIsFake = isFakeWinner || false;
    let fakeWinnerName = null;
    
    if (isFFA) {
      // Free-for-all: winner is a single player
      if (!winnerUserId) {
        return res.status(400).json({ success: false, message: 'Vous devez sélectionner le gagnant' });
      }
      
      // Convert winnerUserId to string for comparison
      const winnerUserIdStr = winnerUserId.toString();
      
      // Check if winner is a fake player
      const fakeWinner = match.fakePlayers?.find(fp => fp.odId === winnerUserIdStr);
      if (fakeWinner) {
        winnerIsFake = true;
        fakeWinnerName = fakeWinner.username;
        // All real players are losers when a bot wins
        loserPlayers = match.players.map(p => p.user.toString());
        winnerPlayers = []; // Bot doesn't get rewards
        console.log(`[RANKED MATCH] Bot "${fakeWinnerName}" won - all real players lose points`);
      } else {
        // Winner gets points and coins
        winnerPlayers = [winnerUserIdStr];
        // All other players are losers
        loserPlayers = match.players
          .map(p => p.user.toString())
          .filter(id => id !== winnerUserIdStr);
      }
      
      match.result = {
        winnerUser: winnerIsFake ? null : winnerUserId,
        fakeWinner: winnerIsFake ? { odId: winnerUserIdStr, username: fakeWinnerName } : null,
        reportedBy: userId,
        reportedAt: new Date(),
        confirmed: true,
        confirmedAt: new Date()
      };
    } else {
      // Team mode: winner is team1 or team2
      if (!winner || !['team1', 'team2'].includes(winner)) {
        return res.status(400).json({ success: false, message: 'Vous devez sélectionner l\'équipe gagnante' });
      }
      
      winnerPlayers = winner === 'team1' 
        ? match.team1.players.map(p => p.toString())
        : match.team2.players.map(p => p.toString());
      
      loserPlayers = winner === 'team1'
        ? match.team2.players.map(p => p.toString())
        : match.team1.players.map(p => p.toString());
      
      match.result = {
        winner,
        reportedBy: userId,
        reportedAt: new Date(),
        confirmed: true,
        confirmedAt: new Date()
      };
    }
    
    match.status = 'completed';
    match.completedAt = new Date();
    
    await match.save();
    
    // Get rewards for this game mode and ranked mode (hardcore/cdl)
    const rewards = await getRewards(match.gameMode, match.mode);
    
    console.log(`[RANKED MATCH] Match ${matchId} completed - Mode: ${match.mode}, GameMode: ${match.gameMode}`);
    console.log(`[RANKED MATCH] Rewards config:`, JSON.stringify(rewards));
    if (winnerIsFake) {
      console.log(`[RANKED MATCH] Winner is a BOT - no rewards given, only losses applied`);
    }
    
    // Track actual points changes for battle report
    const actualPointsChanges = new Map();
    
    // Calculate random XP for winners (between xpWinMin and xpWinMax)
    const xpWin = Math.floor(Math.random() * (rewards.xpWinMax - rewards.xpWinMin + 1)) + rewards.xpWinMin;
    
    // Update winner rankings (only for real players, not bots)
    for (const playerId of winnerPlayers) {
      let ranking = await Ranking.findOne({ user: playerId, mode: match.mode });
      if (!ranking) {
        ranking = new Ranking({ user: playerId, mode: match.mode });
      }
      const pointsBefore = ranking.points || 0;
      ranking.points += rewards.pointsWin;
      ranking.wins += 1;
      ranking.currentStreak = (ranking.currentStreak || 0) + 1;
      ranking.hasPlayed = true;
      await ranking.save();
      
      // Store actual points gained
      actualPointsChanges.set(playerId.toString(), ranking.points - pointsBefore);
      
      // Update user coins and XP
      await User.findByIdAndUpdate(playerId, {
        $inc: { 
          goldCoins: rewards.coinsWin,
          experience: xpWin
        }
      });
      
      console.log(`[RANKED MATCH] Winner ${playerId}: +${rewards.pointsWin} pts, +${rewards.coinsWin} coins, +${xpWin} XP`);
    }
    
    // Update loser rankings
    for (const playerId of loserPlayers) {
      let ranking = await Ranking.findOne({ user: playerId, mode: match.mode });
      if (!ranking) {
        ranking = new Ranking({ user: playerId, mode: match.mode });
      }
      const pointsBefore = ranking.points || 0;
      ranking.points = Math.max(0, ranking.points + rewards.pointsLoss);
      ranking.losses += 1;
      ranking.currentStreak = 0;
      ranking.hasPlayed = true;
      await ranking.save();
      
      // Store actual points lost (negative value)
      const actualPointsLost = ranking.points - pointsBefore;
      actualPointsChanges.set(playerId.toString(), actualPointsLost);
      
      // Losers don't get coins
      console.log(`[RANKED MATCH] Loser ${playerId}: ${rewards.pointsLoss} pts`);
    }
    
    // Update squad stats (totalWins/totalLosses) for ranked matches
    // Track squads with winners and losers separately to handle mixed squads
    const squadsWithWinners = new Set();
    const squadsWithLosers = new Set();
    
    // Collect squads for winners
    for (const playerId of winnerPlayers) {
      const user = await User.findById(playerId).select('squad');
      if (user?.squad) {
        squadsWithWinners.add(user.squad.toString());
      }
    }
    
    // Collect squads for losers
    for (const playerId of loserPlayers) {
      const user = await User.findById(playerId).select('squad');
      if (user?.squad) {
        squadsWithLosers.add(user.squad.toString());
      }
    }
    
    // Update squad stats
    // If a squad has both winners and losers, count it as a loss (mixed result = loss)
    // Otherwise, count wins for winner-only squads and losses for loser-only squads
    const allSquads = new Set([...squadsWithWinners, ...squadsWithLosers]);
    
    for (const squadId of allSquads) {
      const hasWinners = squadsWithWinners.has(squadId);
      const hasLosers = squadsWithLosers.has(squadId);
      
      if (hasWinners && hasLosers) {
        // Mixed: count as loss
        await Squad.findByIdAndUpdate(squadId, {
          $inc: { 'stats.totalLosses': 1 }
        });
        console.log(`[RANKED MATCH] Squad ${squadId} stats updated: +1 loss (mixed result)`);
      } else if (hasWinners) {
        // Only winners: count as win
        await Squad.findByIdAndUpdate(squadId, {
          $inc: { 'stats.totalWins': 1 }
        });
        console.log(`[RANKED MATCH] Squad ${squadId} stats updated: +1 win`);
      } else if (hasLosers) {
        // Only losers: count as loss
        await Squad.findByIdAndUpdate(squadId, {
          $inc: { 'stats.totalLosses': 1 }
        });
        console.log(`[RANKED MATCH] Squad ${squadId} stats updated: +1 loss`);
      }
    }
    
    // Ranks are automatically recalculated via pre-save hook when points are updated
    
    // Populate match for response
    const populatedMatch = await RankedMatch.findById(matchId)
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('team1.players', 'username avatar avatarUrl platform')
      .populate('team2.players', 'username avatar avatarUrl platform')
      .populate('host', 'username avatar avatarUrl')
      .populate('result.winnerUser', 'username avatar avatarUrl');
    
    // Emit socket events
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      // Update match state
      io.to(`ranked-match:${matchId}`).emit('rankedMatchUpdate', populatedMatch);
      
      // Get winner name for FFA mode
      let winnerName = null;
      if (!hasTeams) {
        if (winnerIsFake) {
          // Winner is a bot
          winnerName = fakeWinnerName;
        } else if (winnerUserId) {
          const winnerUser = await User.findById(winnerUserId).select('username');
          winnerName = winnerUser?.username;
        }
      }
      
      // Calculate average actual points changes for display
      // For winners: average of actual points gained (0 if bot won)
      const winnerPointsChanges = winnerPlayers
        .map(id => actualPointsChanges.get(id.toString()) || 0)
        .filter(change => change > 0);
      const avgPointsWin = winnerPointsChanges.length > 0
        ? Math.round(winnerPointsChanges.reduce((sum, val) => sum + val, 0) / winnerPointsChanges.length)
        : rewards.pointsWin;
      
      // For losers: average of actual points lost (as positive value)
      const loserPointsChanges = loserPlayers
        .map(id => actualPointsChanges.get(id.toString()) || 0)
        .filter(change => change < 0)
        .map(change => Math.abs(change));
      const avgPointsLose = loserPointsChanges.length > 0
        ? Math.round(loserPointsChanges.reduce((sum, val) => sum + val, 0) / loserPointsChanges.length)
        : Math.abs(rewards.pointsLoss);
      
      // Battle report data
      const battleReportData = {
        winnerTeam: winner,
        winnerUserId: winnerIsFake ? null : (winnerUserId || null),
        winnerName,
        winnerPlayers,
        loserPlayers,
        winnerIsFake,
        coinsWin: winnerIsFake ? 0 : rewards.coinsWin,
        pointsWin: winnerIsFake ? 0 : avgPointsWin,
        pointsLose: avgPointsLose,
        xpWin: winnerIsFake ? 0 : xpWin
      };
      
      // Send battle report to all players in the match via socket
      io.to(`ranked-match:${matchId}`).emit('rankedBattleReport', battleReportData);
      
      // Also include in API response so the player who validated gets it
      res.json({ success: true, match: populatedMatch, battleReport: battleReportData });
      return;
    }
    
    res.json({ success: true, match: populatedMatch });
  } catch (error) {
    console.error('Error reporting result:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Report dispute
router.post('/:matchId/dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    
    const match = await RankedMatch.findById(matchId).populate('dispute.reportedBy', 'username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'disputed') {
      return res.status(400).json({ success: false, message: 'Le match est déjà en litige' });
    }
    
    // Check if user is in the match
    const isInMatch = match.players.some(p => p.user.toString() === userId.toString());
    if (!isInMatch) {
      return res.status(403).json({ success: false, message: 'Vous ne participez pas à ce match' });
    }
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Vous devez fournir une raison pour le litige' });
    }
    
    // Remove winner and set status to disputed
    match.status = 'disputed';
    match.result = null; // Remove winner
    match.dispute = {
      reportedBy: userId,
      reason: reason.trim(),
      reportedAt: new Date()
    };
    
    await match.save();
    
    // Populate reportedBy for response
    await match.populate('dispute.reportedBy', 'username');
    
    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('rankedMatchUpdate', match);
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error reporting dispute:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get pending disputes (Staff only)
router.get('/disputes/pending', verifyToken, async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const disputes = await RankedMatch.find({ status: 'disputed' })
      .populate('players.user', 'username avatar avatarUrl')
      .populate('host', 'username')
      .populate('dispute.reportedBy', 'username')
      .sort({ 'dispute.reportedAt': -1 });

    res.json({ success: true, disputes });
  } catch (error) {
    console.error('Get ranked disputes error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Cancel dispute (Staff only)
router.post('/:matchId/cancel-dispute', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status !== 'disputed') {
      return res.status(400).json({ success: false, message: 'Ce match n\'est pas en litige' });
    }

    // Remove dispute and set back to in_progress
    match.status = 'in_progress';
    match.dispute = null;
    await match.save();

    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({ success: true, message: 'Litige annulé', match });
  } catch (error) {
    console.error('Cancel ranked dispute error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Annuler complètement un match classé (admin/staff) - match cancelled sans gagnant ni perdant
router.post('/:matchId/admin-cancel', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }

    if (match.status === 'completed' || match.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce match est déjà terminé ou annulé' 
      });
    }

    // Annuler le match complètement
    match.status = 'cancelled';
    match.dispute = null;
    
    await match.save();

    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('rankedMatchUpdate', match);
    }

    res.json({ 
      success: true, 
      match,
      message: 'Match annulé avec succès' 
    });
  } catch (error) {
    console.error('Admin cancel ranked match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get user's recent ranked matches (authenticated)
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, mode } = req.query;
    
    const query = {
      'players.user': userId,
      status: { $in: ['completed', 'in_progress'] }
    };
    
    if (mode) {
      query.mode = mode;
    }
    
    const matches = await RankedMatch.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('team1Captain', 'username')
      .populate('team2Captain', 'username')
      .populate('host', 'username avatar avatarUrl');
    
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error fetching user matches:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get player's ranked match history (public - for profiles)
router.get('/player-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, mode } = req.query;
    
    const query = {
      'players.user': userId,
      status: 'completed'
    };
    
    if (mode) {
      query.mode = mode;
    }
    
    const matches = await RankedMatch.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('team1.players', 'username avatar avatarUrl platform')
      .populate('team2.players', 'username avatar avatarUrl platform')
      .populate('host', 'username avatar avatarUrl')
      .populate('result.winnerUser', 'username avatar avatarUrl');
    
    // Calculate wins/losses for this player
    let wins = 0;
    let losses = 0;
    
    const matchesWithResult = matches.map(match => {
      const m = match.toObject();
      const isFFA = m.gameMode === 'Team Deathmatch' || m.gameMode === 'Duel';
      
      let isWinner = false;
      if (isFFA) {
        isWinner = m.result?.winnerUser?._id?.toString() === userId || 
                   m.result?.winnerUser?.toString() === userId;
      } else {
        const isInTeam1 = m.team1?.players?.some(p => 
          p._id?.toString() === userId || p.toString() === userId
        );
        if (m.result?.winner === 'team1' && isInTeam1) isWinner = true;
        if (m.result?.winner === 'team2' && !isInTeam1) isWinner = true;
      }
      
      if (isWinner) wins++;
      else losses++;
      
      return {
        ...m,
        playerResult: isWinner ? 'win' : 'loss'
      };
    });
    
    res.json({ 
      success: true, 
      matches: matchesWithResult,
      stats: { wins, losses }
    });
  } catch (error) {
    console.error('Error fetching player ranked history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to get ranked rank from points
const getRankedRankFromPoints = (points) => {
  if (points >= 2800) return { name: 'Champion', division: 'champion' };
  if (points >= 2400) return { name: 'Grandmaster', division: 'grandmaster' };
  if (points >= 2000) return { name: 'Master', division: 'master' };
  if (points >= 1600) return { name: 'Diamond', division: 'diamond' };
  if (points >= 1200) return { name: 'Platinum', division: 'platinum' };
  if (points >= 800) return { name: 'Gold', division: 'gold' };
  if (points >= 400) return { name: 'Silver', division: 'silver' };
  return { name: 'Bronze', division: 'bronze' };
};

// Get player's ranked stats (public)
router.get('/player-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { mode } = req.query;
    
    // Get ranking from Ranking model
    const query = { user: userId };
    if (mode) query.mode = mode;
    
    const ranking = await Ranking.findOne(query);
    
    // Calculate stats from completed matches
    const matchQuery = {
      'players.user': userId,
      status: 'completed'
    };
    if (mode) matchQuery.mode = mode;
    
    const matches = await RankedMatch.find(matchQuery);
    
    let wins = 0;
    let losses = 0;
    
    matches.forEach(match => {
      const isFFA = match.gameMode === 'Team Deathmatch' || match.gameMode === 'Duel';
      
      let isWinner = false;
      if (isFFA) {
        isWinner = match.result?.winnerUser?.toString() === userId;
      } else {
        const isInTeam1 = match.team1?.players?.some(p => p.toString() === userId);
        if (match.result?.winner === 'team1' && isInTeam1) isWinner = true;
        if (match.result?.winner === 'team2' && !isInTeam1) isWinner = true;
      }
      
      if (isWinner) wins++;
      else losses++;
    });
    
    // Calculate ranked rank from points
    const points = ranking?.points || 0;
    const rankedRank = getRankedRankFromPoints(points);
    
    res.json({ 
      success: true, 
      ranking: ranking ? {
        points: points,
        wins: ranking.wins,
        losses: ranking.losses,
        division: rankedRank.division,
        rankName: rankedRank.name
      } : null,
      stats: { wins, losses, totalMatches: wins + losses }
    });
  } catch (error) {
    console.error('Error fetching player ranked stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Start the match (host only)
router.post('/:matchId/start', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { gameCode, map } = req.body;
    const userId = req.user._id;
    
    const match = await RankedMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Check if user is the host
    if (match.host?.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Seul l\'hôte peut démarrer le match' });
    }
    
    if (match.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Le match a déjà commencé' });
    }
    
    match.status = 'in_progress';
    match.startedAt = new Date();
    if (gameCode) match.gameCode = gameCode;
    if (map) match.map = map;
    
    await match.save();
    
    // Populate for response
    const populatedMatch = await RankedMatch.findById(matchId)
      .populate('players.user', 'username avatar avatarUrl platform')
      .populate('host', 'username avatar avatarUrl');
    
    // Emit socket event
    const { getIO } = await import('../index.js');
    const io = getIO();
    if (io) {
      io.to(`ranked-match:${matchId}`).emit('rankedMatchUpdate', populatedMatch);
    }
    
    res.json({ success: true, match: populatedMatch });
  } catch (error) {
    console.error('Start match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

