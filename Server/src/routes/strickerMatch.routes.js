import express from 'express';
import mongoose from 'mongoose';
import StrickerMatch from '../models/StrickerMatch.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Config from '../models/Config.js';
import AppSettings from '../models/AppSettings.js';
import Map from '../models/Map.js';
import { verifyToken, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware to check if user has admin access (admin, staff, or arbitre)
const checkStrickerAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      console.error('Stricker access check: No user in request');
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error('Stricker access check: User not found:', req.user._id);
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const hasAccess = user.roles?.some(r => ['admin', 'staff', 'arbitre'].includes(r));
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs, staff et arbitres' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Stricker access check error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ==================== STRICKER RANKS ====================
const STRICKER_RANKS = {
  recrues: { min: 0, max: 499, name: 'Recrues', image: '/stricker1.png' },
  operateurs: { min: 500, max: 999, name: 'Opérateurs', image: '/stricker2.png' },
  veterans: { min: 1000, max: 1499, name: 'Vétérans', image: '/stricker3.png' },
  commandants: { min: 1500, max: 1999, name: 'Commandants', image: '/stricker4.png' },
  seigneurs: { min: 2000, max: 2499, name: 'Seigneurs de Guerre', image: '/stricker5.png' },
  immortel: { min: 2500, max: null, name: 'Immortel', image: '/stricker6.png' }
};

// Helper to get rank from points
function getStrickerRank(points) {
  if (points >= 2500) return 'immortel';
  if (points >= 2000) return 'seigneurs';
  if (points >= 1500) return 'commandants';
  if (points >= 1000) return 'veterans';
  if (points >= 500) return 'operateurs';
  return 'recrues';
}

// ==================== QUEUE MANAGEMENT ====================
// In-memory queue for stricker matchmaking (same pattern as ranked mode)
const ONLINE_TIMEOUT = 60000; // 1 minute

// Simple object storage (like ranked mode uses)
const strickerQueue = [];  // Array of { odId, odUsername, odPoints, odRank, odSquadId, odSquadName, joinedAt }
const strickerOnlineUsers = {};  // { odId: timestamp }


// Cleanup old online users
setInterval(() => {
  try {
    const now = Date.now();
    const keysToDelete = [];
    for (const odId in strickerOnlineUsers) {
      if (now - strickerOnlineUsers[odId] > ONLINE_TIMEOUT) {
        keysToDelete.push(odId);
      }
    }
    keysToDelete.forEach(key => delete strickerOnlineUsers[key]);
    if (keysToDelete.length > 0) {
    }
  } catch (err) {
    console.error('[STRICKER] Error cleaning up stricker online users:', err.message);
  }
}, 30000);

// Get queue status
router.get('/matchmaking/status', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const odId = req.user._id.toString();
    
    // Update online status
    strickerOnlineUsers[odId] = Date.now();
    
    // Check if user is in queue
    const inQueue = strickerQueue.some(p => p.odId === odId);
    const queueSize = strickerQueue.length;
    
    // Count unique squads searching
    const squadsInQueue = new Set();
    strickerQueue.forEach((data) => {
      if (data && data.squadId) {
        squadsInQueue.add(data.squadId);
      }
    });
    
    // Check for active match
    let activeMatch = null;
    try {
      activeMatch = await StrickerMatch.findOne({
        'players.user': req.user._id,
        status: { $in: ['pending', 'ready', 'in_progress'] }
      })
      .populate('players.user', 'username avatarUrl discordAvatar discordId')
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo');
    } catch (matchErr) {
      console.error('Error finding active stricker match:', matchErr);
      // Continue without active match
    }
    
    res.json({
      success: true,
      inQueue,
      queueSize,
      onlineCount: Object.keys(strickerOnlineUsers).length,
      squadsSearching: squadsInQueue.size,
      inMatch: !!activeMatch,
      match: activeMatch || null,
      format: '5v5',
      gameMode: 'Search & Destroy'
    });
  } catch (error) {
    console.error('Stricker matchmaking status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const odId = req.user._id.toString();
    const user = await User.findById(req.user._id)
      .populate({
        path: 'squadStricker',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squadHardcore',
        populate: { path: 'members.user', select: '_id username' }
      });
    
    // Check if user has a squad (stricker or hardcore fallback)
    const squad = user.squadStricker || user.squadHardcore;
    if (!squad) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous devez avoir une escouade pour jouer en mode Stricker' 
      });
    }
    
    // Check if squad has at least 5 members
    if (!squad.members || squad.members.length < 5) {
      return res.status(400).json({ 
        success: false, 
        message: `Votre escouade doit avoir au moins 5 membres (actuellement ${squad.members?.length || 0})` 
      });
    }
    
    // Check if user is leader or officer
    const userMember = squad.members.find(m => 
      m.user?._id?.toString() === odId || m.user?.toString() === odId
    );
    
    if (!userMember || !['leader', 'officer'].includes(userMember.role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Seuls le leader ou les officiers peuvent lancer une recherche de match' 
      });
    }
    
    // Check if already in queue
    if (strickerQueue.some(p => p.odId === odId)) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà dans la file d\'attente' });
    }
    
    // Check if squad is already in queue (another member searching)
    if (strickerQueue.some(p => p.squadId === squad._id.toString())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade est déjà dans la file d\'attente' 
      });
    }
    
    // Check for active match
    const activeMatch = await StrickerMatch.findOne({
      'players.user': req.user._id,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    });
    
    if (activeMatch) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà un match en cours' });
    }
    
    // Add to queue
    strickerQueue.push({
      odId: odId,
      odUser: req.user._id,
      username: user.username,
      points: user.statsStricker?.points || 0,
      squad: squad,
      squadId: squad._id.toString(),
      squadName: squad.name,
      squadTag: squad.tag,
      squadMembers: squad.members.length,
      joinedAt: new Date()
    });
    
    // Check if we have enough players (10 for 5v5)
    if (strickerQueue.length >= 10) {
      // Create match
      await createStrickerMatch();
    }
    
    res.json({
      success: true,
      message: 'Vous avez rejoint la file d\'attente',
      queueSize: strickerQueue.length,
      position: strickerQueue.length
    });
  } catch (error) {
    console.error('Stricker join queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const odId = req.user._id.toString();
    
    const playerIndex = strickerQueue.findIndex(p => p.odId === odId);
    if (playerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Vous n\'êtes pas dans la file d\'attente' });
    }
    
    strickerQueue.splice(playerIndex, 1);
    
    res.json({
      success: true,
      message: 'Vous avez quitté la file d\'attente',
      queueSize: strickerQueue.length
    });
  } catch (error) {
    console.error('Stricker leave queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to create a stricker match
async function createStrickerMatch() {
  try {
    const players = strickerQueue.slice(0, 10);
    
    // Sort by points for balanced teams
    players.sort((a, b) => b.points - a.points);
    
    // Distribute players alternately to teams for balance
    const team1Players = [];
    const team2Players = [];
    
    players.forEach((player, index) => {
      if (index % 2 === 0) {
        team1Players.push({ ...player, team: 1 });
      } else {
        team2Players.push({ ...player, team: 2 });
      }
    });
    
    // Get random maps for stricker mode
    const maps = await Map.find({
      isActive: true,
      'strickerConfig.ranked.enabled': true
    }).limit(3);
    
    // Create the match
    const match = new StrickerMatch({
      gameMode: 'Search & Destroy',
      mode: 'stricker',
      teamSize: 5,
      players: [...team1Players, ...team2Players].map(p => ({
        user: p.userId,
        username: p.username,
        rank: getStrickerRank(p.points),
        points: p.points,
        team: p.team,
        squad: p.squad?._id || null,
        isReferent: false
      })),
      team1Referent: team1Players[0]?.userId,
      team2Referent: team2Players[0]?.userId,
      team1Squad: team1Players[0]?.squad?._id || null,
      team2Squad: team2Players[0]?.squad?._id || null,
      hostTeam: Math.random() > 0.5 ? 1 : 2,
      status: 'ready',
      mapVoteOptions: maps.map((m, i) => ({
        name: m.name,
        image: m.image,
        votes: 0,
        votedBy: []
      })),
      matchmakingStartedAt: new Date()
    });
    
    // Set referents
    match.players[0].isReferent = true;
    match.players[5].isReferent = true;
    
    await match.save();
    
    // Clear queue for matched players
    const matchedOdIds = players.map(p => p.odId);
    for (let i = strickerQueue.length - 1; i >= 0; i--) {
      if (matchedOdIds.includes(strickerQueue[i].odId)) {
        strickerQueue.splice(i, 1);
      }
    }
    
    
    return match;
  } catch (error) {
    console.error('[STRICKER] Erreur création match:', error);
    return null;
  }
}

// ==================== LEADERBOARD (SQUAD-BASED) ====================

// Get squad leaderboard for stricker mode
router.get('/leaderboard/squads', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    // Get squads with stricker stats sorted by points
    const squads = await Squad.aggregate([
      {
        $match: {
          isActive: true,
          'statsStricker.points': { $gt: 0 }
        }
      },
      {
        $sort: { 'statsStricker.points': -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'users',
          localField: 'leader',
          foreignField: '_id',
          as: 'leaderInfo'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          tag: 1,
          logo: 1,
          stats: '$statsStricker',
          memberCount: { $size: '$members' },
          leader: { $arrayElemAt: ['$leaderInfo.username', 0] }
        }
      }
    ]);
    
    // Add rank position
    const leaderboard = squads.map((squad, index) => ({
      ...squad,
      position: skip + index + 1,
      rank: getStrickerRank(squad.stats?.points || 0),
      rankImage: STRICKER_RANKS[getStrickerRank(squad.stats?.points || 0)]?.image
    }));
    
    const totalSquads = await Squad.countDocuments({
      isActive: true,
      'statsStricker.points': { $gt: 0 }
    });
    
    res.json({
      success: true,
      leaderboard,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalSquads,
        totalPages: Math.ceil(totalSquads / limit)
      }
    });
  } catch (error) {
    console.error('Stricker squad leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== USER RANKING ====================

// Get current user's stricker ranking
router.get('/my-ranking', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('squadStricker', 'name tag logo statsStricker');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const stats = user.statsStricker || { points: 0, wins: 0, losses: 0, xp: 0 };
    const rank = getStrickerRank(stats.points);
    const rankInfo = STRICKER_RANKS[rank];
    
    // Get user's position in squad leaderboard
    let squadPosition = null;
    if (user.squadStricker) {
      const higherSquads = await Squad.countDocuments({
        isActive: true,
        'statsStricker.points': { $gt: user.squadStricker.statsStricker?.points || 0 }
      });
      squadPosition = higherSquads + 1;
    }
    
    res.json({
      success: true,
      ranking: {
        odId: user._id,
        username: user.username,
        points: stats.points,
        wins: stats.wins,
        losses: stats.losses,
        xp: stats.xp,
        rank: rank,
        rankName: rankInfo.name,
        rankImage: rankInfo.image,
        nextRank: rank !== 'immortel' ? Object.keys(STRICKER_RANKS)[Object.keys(STRICKER_RANKS).indexOf(rank) + 1] : null,
        pointsToNextRank: rankInfo.max ? rankInfo.max - stats.points + 1 : null,
        squad: user.squadStricker ? {
          _id: user.squadStricker._id,
          name: user.squadStricker.name,
          tag: user.squadStricker.tag,
          logo: user.squadStricker.logo,
          points: user.squadStricker.statsStricker?.points || 0,
          position: squadPosition
        } : null
      }
    });
  } catch (error) {
    console.error('Stricker my-ranking error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== MATCH ENDPOINTS ====================

// Get match by ID
router.get('/match/:matchId', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await StrickerMatch.findById(matchId)
      .populate('players.user', 'username avatarUrl discordAvatar discordId activisionId platform')
      .populate('players.squad', 'name tag logo')
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo')
      .populate('team1Referent', 'username avatarUrl')
      .populate('team2Referent', 'username avatarUrl')
      .populate('chat.user', 'username roles');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Determine user's team
    const userPlayer = match.players.find(p => 
      p.user?._id?.toString() === req.user._id.toString()
    );
    
    res.json({
      success: true,
      match,
      myTeam: userPlayer?.team || null,
      isReferent: match.team1Referent?._id?.toString() === req.user._id.toString() ||
                  match.team2Referent?._id?.toString() === req.user._id.toString()
    });
  } catch (error) {
    console.error('Stricker get match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get user's active match
router.get('/match/active/me', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const match = await StrickerMatch.findOne({
      'players.user': req.user._id,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    })
    .populate('players.user', 'username avatarUrl discordAvatar discordId')
    .populate('team1Squad', 'name tag logo')
    .populate('team2Squad', 'name tag logo');
    
    res.json({
      success: true,
      match: match || null,
      hasActiveMatch: !!match
    });
  } catch (error) {
    console.error('Stricker active match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Submit match result
router.post('/match/:matchId/result', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body; // 1 or 2
    
    if (![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Gagnant invalide' });
    }
    
    const match = await StrickerMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (match.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Match déjà terminé' });
    }
    
    // Check if user is participant
    const userPlayer = match.players.find(p => 
      p.user?.toString() === req.user._id.toString()
    );
    
    if (!userPlayer) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas participant à ce match' });
    }
    
    // Add vote
    const existingVote = match.result.playerVotes?.find(v => 
      v.user?.toString() === req.user._id.toString()
    );
    
    if (existingVote) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà voté' });
    }
    
    match.result.playerVotes = match.result.playerVotes || [];
    match.result.playerVotes.push({
      user: req.user._id,
      winner,
      votedAt: new Date()
    });
    
    // Check if we have enough votes (60% of players)
    const realPlayers = match.players.filter(p => !p.isFake).length;
    const requiredVotes = Math.ceil(realPlayers * 0.6);
    
    if (match.result.playerVotes.length >= requiredVotes) {
      // Count votes
      const team1Votes = match.result.playerVotes.filter(v => v.winner === 1).length;
      const team2Votes = match.result.playerVotes.filter(v => v.winner === 2).length;
      
      const finalWinner = team1Votes >= team2Votes ? 1 : 2;
      
      // Set result
      match.result.winner = finalWinner;
      match.result.confirmed = true;
      match.result.confirmedAt = new Date();
      match.status = 'completed';
      match.completedAt = new Date();
      
      // Distribute rewards
      await distributeStrickerRewards(match);
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Vote enregistré',
      votesCount: match.result.playerVotes.length,
      requiredVotes,
      isCompleted: match.status === 'completed'
    });
  } catch (error) {
    console.error('Stricker result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Distribute rewards for stricker match
async function distributeStrickerRewards(match) {
  try {
    const config = await Config.getOrCreate();
    const rewards = config.strickerMatchRewards?.['Search & Destroy'] || {
      pointsWin: 35,
      pointsLoss: -18,
      coinsWin: 80,
      coinsLoss: 25,
      xpWinMin: 700,
      xpWinMax: 800
    };
    
    const winningTeam = match.result.winner;
    
    // Process each player
    for (const player of match.players) {
      if (player.isFake || !player.user) continue;
      
      const user = await User.findById(player.user);
      if (!user) continue;
      
      const isWinner = player.team === winningTeam;
      
      // Calculate rewards
      const pointsChange = isWinner ? rewards.pointsWin : rewards.pointsLoss;
      const goldChange = isWinner ? rewards.coinsWin : rewards.coinsLoss;
      const xpChange = isWinner ? Math.floor(Math.random() * (rewards.xpWinMax - rewards.xpWinMin + 1)) + rewards.xpWinMin : 0;
      
      // Update user stats
      if (!user.statsStricker) user.statsStricker = { points: 0, wins: 0, losses: 0, xp: 0 };
      
      const oldPoints = user.statsStricker.points || 0;
      user.statsStricker.points = Math.max(0, oldPoints + pointsChange);
      user.statsStricker.xp = (user.statsStricker.xp || 0) + xpChange;
      
      if (isWinner) {
        user.statsStricker.wins = (user.statsStricker.wins || 0) + 1;
      } else {
        user.statsStricker.losses = (user.statsStricker.losses || 0) + 1;
      }
      
      user.goldCoins = (user.goldCoins || 0) + goldChange;
      
      await user.save();
      
      // Update squad stats if player has a squad
      if (player.squad) {
        const squad = await Squad.findById(player.squad);
        if (squad) {
          if (!squad.statsStricker) squad.statsStricker = { points: 0, wins: 0, losses: 0 };
          
          squad.statsStricker.points = Math.max(0, (squad.statsStricker.points || 0) + pointsChange);
          
          if (isWinner) {
            squad.statsStricker.wins = (squad.statsStricker.wins || 0) + 1;
          } else {
            squad.statsStricker.losses = (squad.statsStricker.losses || 0) + 1;
          }
          
          await squad.save();
        }
      }
      
      // Store rewards in match player data
      player.rewards = {
        pointsChange,
        goldEarned: goldChange,
        xpEarned: xpChange,
        oldPoints,
        newPoints: user.statsStricker.points
      };
    }
    
    match.markModified('players');
    await match.save();
    
  } catch (error) {
    console.error('[STRICKER] Erreur distribution récompenses:', error);
  }
}

// Send chat message
router.post('/match/:matchId/chat', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    
    const match = await StrickerMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    const userPlayer = match.players.find(p => 
      p.user?.toString() === req.user._id.toString()
    );
    
    match.chat.push({
      user: req.user._id,
      message: message.trim().substring(0, 500),
      team: userPlayer?.team || null,
      isSystem: false,
      createdAt: new Date()
    });
    
    await match.save();
    
    res.json({ success: true, message: 'Message envoyé' });
  } catch (error) {
    console.error('Stricker chat error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== CONFIG ====================

// Get stricker configuration
router.get('/config', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const config = await Config.getOrCreate();
    const appSettings = await AppSettings.getSettings();
    
    res.json({
      success: true,
      config: {
        matchmakingEnabled: config.strickerMatchmakingEnabled ?? true,
        rewards: config.strickerMatchRewards,
        rankThresholds: config.strickerRankThresholds || STRICKER_RANKS,
        pointsLossPerRank: config.strickerPointsLossPerRank
      },
      ranks: STRICKER_RANKS
    });
  } catch (error) {
    console.error('Stricker config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get available maps for stricker
router.get('/maps', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const maps = await Map.find({
      isActive: true,
      'strickerConfig.ranked.enabled': true
    }).select('name image strickerConfig');
    
    res.json({
      success: true,
      maps,
      format: '5v5',
      gameMode: 'Search & Destroy'
    });
  } catch (error) {
    console.error('Stricker maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== RECENT MATCHES ====================

router.get('/history/recent', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    
    const matches = await StrickerMatch.find({
      status: 'completed',
      isTestMatch: { $ne: true }
    })
    .populate('players.user', 'username avatarUrl discordAvatar discordId')
    .populate('team1Squad', 'name tag logo')
    .populate('team2Squad', 'name tag logo')
    .sort({ completedAt: -1 })
    .limit(Math.min(parseInt(limit), 50));
    
    res.json({
      success: true,
      matches,
      total: matches.length
    });
  } catch (error) {
    console.error('Stricker recent history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
