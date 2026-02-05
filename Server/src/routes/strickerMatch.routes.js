import express from 'express';
import mongoose from 'mongoose';
import StrickerMatch from '../models/StrickerMatch.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Config from '../models/Config.js';
import AppSettings from '../models/AppSettings.js';
import Map from '../models/Map.js';
import { verifyToken, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import ggsecureMonitoring from '../services/ggsecureMonitoring.service.js';
import discordBot from '../services/discordBot.service.js';

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
  recrues: { min: 0, max: 249, name: 'Recrues', image: '/stricker1.png', pointsWin: 30, pointsLoss: -15 },
  operateurs: { min: 250, max: 499, name: 'Opérateurs', image: '/stricker2.png', pointsWin: 30, pointsLoss: -20 },
  veterans: { min: 500, max: 749, name: 'Vétérans', image: '/stricker3.png', pointsWin: 30, pointsLoss: -25 },
  commandants: { min: 750, max: 999, name: 'Commandants', image: '/stricker4.png', pointsWin: 30, pointsLoss: -30 },
  seigneurs: { min: 1000, max: 1499, name: 'Seigneurs de Guerre', image: '/stricker5.png', pointsWin: 30, pointsLoss: -40 },
  immortel: { min: 1500, max: null, name: 'Immortel', image: '/stricker6.png', pointsWin: 30, pointsLoss: -50 }
};

// Helper to get rank from points
function getStrickerRank(points) {
  if (points >= 1500) return 'immortel';
  if (points >= 1000) return 'seigneurs';
  if (points >= 750) return 'commandants';
  if (points >= 500) return 'veterans';
  if (points >= 250) return 'operateurs';
  return 'recrues';
}

// ==================== QUEUE MANAGEMENT ====================
// In-memory queue for stricker matchmaking (same pattern as ranked mode)
const ONLINE_TIMEOUT = 60000; // 1 minute
const JOIN_RATE_LIMIT_MS = 3000; // 3 seconds between join attempts
const MATCH_CREATION_LOCK_TIMEOUT = 10000; // 10 seconds max lock time

// Simple object storage (like ranked mode uses)
const strickerQueue = [];  // Array of { odId, odUsername, odPoints, odRank, odSquadId, odSquadName, joinedAt }
const strickerOnlineUsers = {};  // { odId: timestamp }

// Rate limiting and locking
const recentJoinAttempts = new Map(); // { odId/squadId: timestamp }
let matchCreationLock = false;
let matchCreationLockTime = 0;


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
    const mode = req.query.mode || 'stricker'; // stricker mode
    
    // Update online status
    strickerOnlineUsers[odId] = Date.now();
    
    // Get user's squad ID
    const user = await User.findById(req.user._id)
      .populate('squadStricker', '_id')
      .populate('squadHardcore', '_id')
      .populate('squadCdl', '_id')
      .populate('squad', '_id');
    const userSquad = user?.squadStricker || user?.squadHardcore || user?.squadCdl || user?.squad;
    const userSquadId = userSquad?._id?.toString();
    
    // Filter queue by mode
    const modeQueue = strickerQueue.filter(p => p.mode === mode);
    
    // Check if user's squad is in queue (for this mode)
    const inQueue = modeQueue.some(p => p.squadId === userSquadId);
    const queueSize = modeQueue.length;
    
    // Get list of squads searching (excluding user's own squad)
    const searchingSquads = [];
    const seenSquads = new Set();
    modeQueue.forEach((entry) => {
      if (entry && entry.squadId && !seenSquads.has(entry.squadId)) {
        seenSquads.add(entry.squadId);
        // Don't include user's own squad in the list
        if (entry.squadId !== userSquadId) {
          searchingSquads.push({
            odId: entry.odId,
            odUser: entry.odUser,
            username: entry.username,
            squadId: entry.squadId,
            squadName: entry.squadName,
            squadTag: entry.squadTag,
            squadLogo: entry.squad?.logo || null,
            points: entry.points,
            joinedAt: entry.joinedAt
          });
        }
      }
    });
    
    // Check for active match (mode-specific)
    let activeMatch = null;
    try {
      activeMatch = await StrickerMatch.findOne({
        'players.user': req.user._id,
        mode: mode,
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
      squadsSearching: searchingSquads.length,
      searchingSquads, // List of squads to challenge
      inMatch: !!activeMatch,
      match: activeMatch || null,
      format: '5v5',
      gameMode: 'Search & Destroy',
      mode: mode
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
    const now = Date.now();
    const mode = req.body.mode || 'stricker'; // stricker mode
    
    // Rate limiting: Prevent rapid join attempts (anti race condition)
    const lastUserAttempt = recentJoinAttempts.get(`user:${odId}:${mode}`);
    if (lastUserAttempt && (now - lastUserAttempt) < JOIN_RATE_LIMIT_MS) {
      const timeRemaining = JOIN_RATE_LIMIT_MS - (now - lastUserAttempt);
      console.warn(`[STRICKER] Rate limit hit | user: ${odId} | mode: ${mode} | retry in: ${timeRemaining}ms`);
      return res.status(429).json({ 
        success: false, 
        message: 'Veuillez patienter quelques secondes avant de réessayer.' 
      });
    }
    recentJoinAttempts.set(`user:${odId}:${mode}`, now);
    
    // Cleanup old rate limit entries periodically
    if (recentJoinAttempts.size > 500) {
      const cutoff = now - JOIN_RATE_LIMIT_MS * 10;
      for (const [key, timestamp] of recentJoinAttempts.entries()) {
        if (timestamp < cutoff) {
          recentJoinAttempts.delete(key);
        }
      }
    }
    
    const user = await User.findById(req.user._id)
      .populate({
        path: 'squadStricker',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squadHardcore',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squadCdl',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squad',
        populate: { path: 'members.user', select: '_id username' }
      });
    
    // Check if user has a squad (stricker, hardcore, cdl, or regular squad fallback)
    const squad = user.squadStricker || user.squadHardcore || user.squadCdl || user.squad;
    if (!squad) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous devez avoir une escouade pour jouer en mode Stricker' 
      });
    }
    
    // Squad rate limiting: Prevent same squad from multiple rapid join attempts
    const squadId = squad._id.toString();
    const lastSquadAttempt = recentJoinAttempts.get(`squad:${squadId}`);
    if (lastSquadAttempt && (Date.now() - lastSquadAttempt) < JOIN_RATE_LIMIT_MS) {
      console.warn(`[STRICKER] Squad rate limit hit | squad: ${squadId}`);
      return res.status(429).json({ 
        success: false, 
        message: 'Votre escouade a déjà lancé une recherche. Veuillez patienter.' 
      });
    }
    recentJoinAttempts.set(`squad:${squadId}`, Date.now());
    
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
    
    // GGSecure check for PC players posting match search
    if (user.platform === 'PC') {
      try {
        const ggsecureResponse = await fetch(`${process.env.GGSECURE_API_URL || 'https://api.ggsecure.io'}/v1/user/${odId}/status`, {
          headers: {
            'Authorization': `Bearer ${process.env.GGSECURE_API_KEY || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (ggsecureResponse.ok) {
          const ggsecureData = await ggsecureResponse.json();
          if (!ggsecureData.isOnline && ggsecureData.reason !== 'api_key_missing') {
            return res.status(400).json({ 
              success: false, 
              message: 'Vous devez être connecté à GGSecure pour lancer une recherche de match (joueur PC).'
            });
          }
        }
      } catch (ggsecureError) {
        console.error('[STRICKER] GGSecure check error for queue join:', ggsecureError);
        // Continue anyway if GGSecure API is unavailable
      }
    }
    
    // Check if already in queue (for this mode)
    if (strickerQueue.some(p => p.odId === odId && p.mode === mode)) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà dans la file d\'attente' });
    }
    
    // Check if squad is already in queue for this mode (another member searching)
    if (strickerQueue.some(p => p.squadId === squad._id.toString() && p.mode === mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade est déjà dans la file d\'attente' 
      });
    }
    
    // Check for active match for user (mode-specific)
    const activeMatch = await StrickerMatch.findOne({
      'players.user': req.user._id,
      mode: mode,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress'] }
    });
    
    if (activeMatch) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà un match en cours' });
    }
    
    // Check if squad already has an active match (mode-specific)
    const squadActiveMatch = await StrickerMatch.findOne({
      $or: [
        { team1Squad: squad._id },
        { team2Squad: squad._id }
      ],
      mode: mode,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress'] }
    });
    
    if (squadActiveMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade a déjà un match en cours' 
      });
    }
    
    // Add to queue with mode
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
      joinedAt: new Date(),
      mode: mode
    });
    
    // Filter queue by mode for display
    const modeQueue = strickerQueue.filter(p => p.mode === mode);
    console.log(`[STRICKER] User ${user.username} (${odId}) joined ${mode} queue | Squad: ${squad.tag} | Mode queue size: ${modeQueue.length}`);
    
    // Get updated list of searching squads (excluding own squad) - mode specific
    const searchingSquads = [];
    const seenSquads = new Set();
    modeQueue.forEach((entry) => {
      if (entry && entry.squadId && !seenSquads.has(entry.squadId)) {
        seenSquads.add(entry.squadId);
        if (entry.squadId !== squadId) {
          searchingSquads.push({
            squadId: entry.squadId,
            squadName: entry.squadName,
            squadTag: entry.squadTag,
            squadLogo: entry.squad?.logo || null,
            points: entry.points,
            joinedAt: entry.joinedAt
          });
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Vous avez rejoint la file d\'attente',
      queueSize: modeQueue.length,
      position: modeQueue.length,
      searchingSquads,
      mode: mode
    });
  } catch (error) {
    console.error('Stricker join queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Challenge a squad - Create match directly
router.post('/matchmaking/challenge', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { targetSquadId, mode: requestMode } = req.body;
    const mode = requestMode || 'stricker'; // stricker mode
    const odId = req.user._id.toString();
    const now = Date.now();
    
    if (!targetSquadId) {
      return res.status(400).json({ success: false, message: 'Escouade cible non sp\u00e9cifi\u00e9e' });
    }
    
    // Rate limiting
    const lastAttempt = recentJoinAttempts.get(`challenge:${odId}`);
    if (lastAttempt && (now - lastAttempt) < JOIN_RATE_LIMIT_MS) {
      return res.status(429).json({ 
        success: false, 
        message: 'Veuillez patienter quelques secondes avant de réessayer.' 
      });
    }
    recentJoinAttempts.set(`challenge:${odId}`, now);
    
    // Get challenger's info
    const user = await User.findById(req.user._id)
      .populate({
        path: 'squadStricker',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squadHardcore',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squadCdl',
        populate: { path: 'members.user', select: '_id username' }
      })
      .populate({
        path: 'squad',
        populate: { path: 'members.user', select: '_id username' }
      });
    
    const challengerSquad = user.squadStricker || user.squadHardcore || user.squadCdl || user.squad;
    if (!challengerSquad) {
      return res.status(400).json({ success: false, message: 'Vous devez avoir une escouade' });
    }
    
    const challengerSquadId = challengerSquad._id.toString();
    
    // Check if challenger is leader/officer
    const challengerMember = challengerSquad.members.find(m => 
      m.user?._id?.toString() === odId || m.user?.toString() === odId
    );
    if (!challengerMember || !['leader', 'officer'].includes(challengerMember.role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Seuls le leader ou les officiers peuvent lancer un défi' 
      });
    }
    
    // GGSecure check for PC players challenging
    if (user.platform === 'PC') {
      try {
        const ggsecureResponse = await fetch(`${process.env.GGSECURE_API_URL || 'https://api.ggsecure.io'}/v1/user/${odId}/status`, {
          headers: {
            'Authorization': `Bearer ${process.env.GGSECURE_API_KEY || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (ggsecureResponse.ok) {
          const ggsecureData = await ggsecureResponse.json();
          if (!ggsecureData.isOnline && ggsecureData.reason !== 'api_key_missing') {
            return res.status(400).json({ 
              success: false, 
              message: 'Vous devez être connecté à GGSecure pour lancer un défi (joueur PC).'
            });
          }
        }
      } catch (ggsecureError) {
        console.error('[STRICKER] GGSecure check error for challenge:', ggsecureError);
        // Continue anyway if GGSecure API is unavailable
      }
    }
    
    // Check if target squad is in queue (for this mode)
    const targetEntry = strickerQueue.find(p => p.squadId === targetSquadId && p.mode === mode);
    if (!targetEntry) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette escouade n\'est plus en recherche de match' 
      });
    }
        
    // Can't challenge own squad
    if (targetSquadId === challengerSquadId) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous d\u00e9fier vous-m\u00eame' });
    }
        
    // Check for active matches (mode-specific)
    const activeMatch = await StrickerMatch.findOne({
      $or: [
        { 'players.user': req.user._id },
        { team1Squad: challengerSquad._id },
        { team2Squad: challengerSquad._id }
      ],
      mode: mode,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress'] }
    });
    
    if (activeMatch) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà un match en cours' });
    }
    
    // Acquire lock for match creation
    const lockAcquiredAt = Date.now();
    if (matchCreationLock && (lockAcquiredAt - matchCreationLockTime) > MATCH_CREATION_LOCK_TIMEOUT) {
      matchCreationLock = false;
    }
    
    if (matchCreationLock) {
      return res.status(429).json({ 
        success: false, 
        message: 'Un match est en cours de création, veuillez réessayer' 
      });
    }
    
    matchCreationLock = true;
    matchCreationLockTime = lockAcquiredAt;
    
    try {
      // Double-check target is still in queue (mode-specific)
      const targetStillInQueue = strickerQueue.find(p => p.squadId === targetSquadId && p.mode === mode);
      if (!targetStillInQueue) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cette escouade n\'est plus en recherche de match' 
        });
      }
      
      console.log(`[STRICKER] Challenge: ${challengerSquad.tag} vs ${targetEntry.squadTag} (mode: ${mode})`);
      
      // Get ALL stricker maps for ban phase (each team bans 1, then random from remaining)
      let maps = await Map.find({
        isActive: true,
        'strickerConfig.ranked.enabled': true
      });
      
      if (maps.length === 0) {
        maps = await Map.find({
          isActive: true,
          'rankedConfig.searchAndDestroy.enabled': true
        });
      }
      
      // Create the match
      const match = new StrickerMatch({
        gameMode: 'Search & Destroy',
        mode: mode, // hardcore or cdl
        teamSize: 5,
        players: [
          {
            user: req.user._id,
            username: user.username,
            rank: getStrickerRank(user.statsStricker?.points || 0),
            points: user.statsStricker?.points || 0,
            team: 1,
            squad: challengerSquad._id,
            isReferent: true
          },
          {
            user: targetEntry.odUser,
            username: targetEntry.username,
            rank: getStrickerRank(targetEntry.points),
            points: targetEntry.points,
            team: 2,
            squad: targetEntry.squad?._id || null,
            isReferent: true
          }
        ],
        team1Referent: req.user._id,
        team2Referent: targetEntry.odUser,
        team1Squad: challengerSquad._id,
        team2Squad: targetEntry.squad?._id || null,
        hostTeam: Math.random() > 0.5 ? 1 : 2,
        status: 'pending', // Roster selection tracked via rosterSelection.isActive
        mapVoteOptions: maps.map((m) => ({
          name: m.name,
          image: m.image,
          votes: 0,
          votedBy: []
        })),
        matchmakingStartedAt: new Date(),
        rosterSelection: {
          isActive: true,
          currentTurn: 1,
          timeLimit: 30,
          team1Selected: [],
          team2Selected: []
        }
      });
      
      await match.save();
      
      console.log(`[STRICKER] Match created via challenge: ${match._id}`);
      
      // Remove both squads from queue
      for (let i = strickerQueue.length - 1; i >= 0; i--) {
        if (strickerQueue[i].squadId === challengerSquadId || strickerQueue[i].squadId === targetSquadId) {
          strickerQueue.splice(i, 1);
        }
      }
      
      // Emit socket event to notify both teams
      const io = req.app.get('io');
      if (io) {
        io.to('stricker-mode').emit('strickerMatchCreated', {
          matchId: match._id,
          team1Squad: challengerSquad._id,
          team2Squad: targetEntry.squad?._id || targetSquadId
        });
      }
      
      // GGSecure check
      ggsecureMonitoring.checkStrickerMatchGGSecureStatus(match).catch(err => {
        console.error('[STRICKER] Error in GGSecure check:', err);
      });
      
      res.json({
        success: true,
        message: 'Match créé !',
        match: {
          _id: match._id,
          team1Squad: { name: challengerSquad.name, tag: challengerSquad.tag },
          team2Squad: { name: targetEntry.squadName, tag: targetEntry.squadTag }
        }
      });
    } finally {
      matchCreationLock = false;
    }
  } catch (error) {
    matchCreationLock = false;
    console.error('Stricker challenge error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const odId = req.user._id.toString();
    const mode = req.body.mode || 'stricker'; // stricker mode
    
    const playerIndex = strickerQueue.findIndex(p => p.odId === odId && p.mode === mode);
    if (playerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Vous n\'\u00eates pas dans la file d\'attente' });
    }
    
    strickerQueue.splice(playerIndex, 1);
    const modeQueue = strickerQueue.filter(p => p.mode === mode);
    
    res.json({
      success: true,
      message: 'Vous avez quitt\u00e9 la file d\'attente',
      queueSize: modeQueue.length
    });
  } catch (error) {
    console.error('Stricker leave queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper function to create a stricker match (squad vs squad)
async function createStrickerMatch() {
  try {
    // Get unique squads from queue (take first 2)
    const uniqueSquads = new Map();
    const squadEntries = [];
    
    for (const entry of strickerQueue) {
      if (!uniqueSquads.has(entry.squadId)) {
        uniqueSquads.set(entry.squadId, entry);
        squadEntries.push(entry);
        if (squadEntries.length >= 2) break;
      }
    }
    
    if (squadEntries.length < 2) {
      console.error('[STRICKER] Not enough squads to create match');
      return null;
    }
    
    const team1Entry = squadEntries[0];
    const team2Entry = squadEntries[1];
    
    console.log(`[STRICKER] Creating match: ${team1Entry.squadTag} vs ${team2Entry.squadTag}`);
    
    // Get ALL stricker maps for ban phase (each team bans 1, then random from remaining)
    const maps = await Map.find({
      isActive: true,
      'strickerConfig.ranked.enabled': true
    });
    
    // If no maps with stricker config, try regular ranked maps
    let mapOptions = maps;
    if (maps.length === 0) {
      mapOptions = await Map.find({
        isActive: true,
        'rankedConfig.searchAndDestroy.enabled': true
      });
    }
    
    // Create the match with squad info
    const match = new StrickerMatch({
      gameMode: 'Search & Destroy',
      mode: 'stricker',
      teamSize: 5,
      // For now, just add the referents as players - roster selection happens in pre-match
      players: [
        {
          user: team1Entry.odUser,
          username: team1Entry.username,
          rank: getStrickerRank(team1Entry.points),
          points: team1Entry.points,
          team: 1,
          squad: team1Entry.squad?._id || null,
          isReferent: true
        },
        {
          user: team2Entry.odUser,
          username: team2Entry.username,
          rank: getStrickerRank(team2Entry.points),
          points: team2Entry.points,
          team: 2,
          squad: team2Entry.squad?._id || null,
          isReferent: true
        }
      ],
      team1Referent: team1Entry.odUser,
      team2Referent: team2Entry.odUser,
      team1Squad: team1Entry.squad?._id || null,
      team2Squad: team2Entry.squad?._id || null,
      hostTeam: Math.random() > 0.5 ? 1 : 2,
      status: 'pending', // Roster selection tracked via rosterSelection.isActive
      mapVoteOptions: mapOptions.map((m) => ({
        name: m.name,
        image: m.image,
        votes: 0,
        votedBy: []
      })),
      matchmakingStartedAt: new Date(),
      rosterSelection: {
        isActive: true,
        currentTurn: 1,
        timeLimit: 30,
        team1Selected: [],
        team2Selected: []
      }
    });
    
    await match.save();
    
    console.log(`[STRICKER] Match created: ${match._id} | ${team1Entry.squadTag} vs ${team2Entry.squadTag}`);
    
    // Remove both squad entries from queue
    const matchedSquadIds = [team1Entry.squadId, team2Entry.squadId];
    for (let i = strickerQueue.length - 1; i >= 0; i--) {
      if (matchedSquadIds.includes(strickerQueue[i].squadId)) {
        strickerQueue.splice(i, 1);
      }
    }
    
    console.log(`[STRICKER] Queue cleared for matched squads | Remaining queue size: ${strickerQueue.length}`);
    
    // Vérifier immédiatement le statut GGSecure des joueurs PC et notifier sur la feuille de match
    ggsecureMonitoring.checkStrickerMatchGGSecureStatus(match).catch(err => {
      console.error('[STRICKER] Error in immediate GGSecure check:', err);
    });
    
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
    console.log('[STRICKER LEADERBOARD] Fetching squad leaderboard...');
    
    // Get user's squad
    const user = await User.findById(req.user._id).select('squadStricker');
    const userSquadId = user?.squadStricker?.toString();
    
    // Get all squads with stricker stats sorted by points
    const allSquads = await Squad.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          $or: [
            { 'statsStricker.points': { $gt: 0 } },
            { 'statsStricker.wins': { $gt: 0 } },
            { 'statsStricker.losses': { $gt: 0 } }
          ]
        }
      },
      {
        $addFields: {
          strickerPoints: { $ifNull: ['$statsStricker.points', 0] },
          strickerWins: { $ifNull: ['$statsStricker.wins', 0] },
          strickerLosses: { $ifNull: ['$statsStricker.losses', 0] }
        }
      },
      {
        $sort: { strickerPoints: -1, strickerWins: -1 }
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
          strickerPoints: 1,
          strickerWins: 1,
          strickerLosses: 1,
          memberCount: { $size: '$members' },
          leader: { $arrayElemAt: ['$leaderInfo.username', 0] }
        }
      }
    ]);
    
    console.log(`[STRICKER LEADERBOARD] Found ${allSquads.length} squads with Stricker stats`);
    
    // Add positions to all squads
    const allSquadsWithPosition = allSquads.map((squad, index) => ({
      ...squad,
      position: index + 1,
      rank: getStrickerRank(squad.stats?.points || squad.strickerPoints || 0),
      rankImage: STRICKER_RANKS[getStrickerRank(squad.stats?.points || squad.strickerPoints || 0)]?.image
    }));
    
    // Get top 15
    const top15 = allSquadsWithPosition.slice(0, 15);
    
    // Find user's squad position if not in top 15
    let userSquad = null;
    if (userSquadId) {
      const userSquadIndex = allSquadsWithPosition.findIndex(s => s._id.toString() === userSquadId);
      if (userSquadIndex >= 15) {
        userSquad = allSquadsWithPosition[userSquadIndex];
      }
    }
    
    res.json({
      success: true,
      top15,
      userSquad,
      totalSquads: allSquads.length
    });
  } catch (error) {
    console.error('Stricker squad leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get top 100 squad leaderboard for stricker mode
router.get('/leaderboard/squads/top100', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    console.log('[STRICKER TOP 100] Fetching top 100 squads...');
    
    // Get all squads with stricker stats sorted by points
    const top100Squads = await Squad.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          $or: [
            { 'statsStricker.points': { $gt: 0 } },
            { 'statsStricker.wins': { $gt: 0 } },
            { 'statsStricker.losses': { $gt: 0 } }
          ]
        }
      },
      {
        $addFields: {
          strickerPoints: { $ifNull: ['$statsStricker.points', 0] },
          strickerWins: { $ifNull: ['$statsStricker.wins', 0] },
          strickerLosses: { $ifNull: ['$statsStricker.losses', 0] }
        }
      },
      {
        $sort: { strickerPoints: -1, strickerWins: -1 }
      },
      {
        $limit: 100
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
          strickerPoints: 1,
          strickerWins: 1,
          strickerLosses: 1,
          memberCount: { $size: '$members' },
          leader: { $arrayElemAt: ['$leaderInfo.username', 0] }
        }
      }
    ]);
    
    console.log(`[STRICKER TOP 100] Found ${top100Squads.length} squads`);
    
    // Add positions and rank info
    const top100WithPosition = top100Squads.map((squad, index) => ({
      ...squad,
      position: index + 1,
      rank: getStrickerRank(squad.stats?.points || squad.strickerPoints || 0),
      rankImage: STRICKER_RANKS[getStrickerRank(squad.stats?.points || squad.strickerPoints || 0)]?.image
    }));
    
    res.json({
      success: true,
      squads: top100WithPosition,
      total: top100Squads.length
    });
  } catch (error) {
    console.error('Stricker top 100 error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== USER RANKING ====================

// Get current user's stricker ranking
router.get('/my-ranking', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('squadStricker', 'name tag logo statsStricker cranes');
    
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
          position: squadPosition,
          cranes: user.squadStricker.cranes || 0
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
      .populate({
        path: 'players.user',
        select: 'username avatarUrl discordAvatar discordId activisionId platform equippedTitle',
        populate: {
          path: 'equippedTitle',
          select: 'name nameTranslations color rarity'
        }
      })
      .populate('players.squad', 'name tag logo')
      .populate('team1Squad', 'name tag logo members statsStricker')
      .populate('team2Squad', 'name tag logo members statsStricker')
      .populate('team1Referent', 'username avatarUrl')
      .populate('team2Referent', 'username avatarUrl')
      .populate('chat.user', 'username roles')
      .populate('mvp.player', 'username avatarUrl discordAvatar discordId')
      .populate('mvp.votes.voter', 'username')
      .populate('mvp.votes.votedFor', 'username avatarUrl discordAvatar discordId');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Determine user's team
    const userPlayer = match.players.find(p => 
      p.user?._id?.toString() === req.user._id.toString()
    );
    
    const myTeam = userPlayer?.team || null;
    const isReferent = match.team1Referent?._id?.toString() === req.user._id.toString() ||
                       match.team2Referent?._id?.toString() === req.user._id.toString();
    
    console.log('[STRICKER GET MATCH] Debug:', {
      matchId,
      userId: req.user._id.toString(),
      team1ReferentId: match.team1Referent?._id?.toString(),
      team2ReferentId: match.team2Referent?._id?.toString(),
      isReferent,
      myTeam,
      matchStatus: match.status
    });
    
    // Get available members for roster selection if active
    let availableMembers = [];
    let mySquad = null;
    
    if (match.rosterSelection?.isActive) {
      // Get the user's squad
      const userSquadId = myTeam === 1 ? match.team1Squad?._id : match.team2Squad?._id;
      
      if (userSquadId) {
        mySquad = await Squad.findById(userSquadId)
          .populate({
            path: 'members.user',
            select: 'username avatarUrl discordAvatar discordId statsStricker equippedTitle',
            populate: {
              path: 'equippedTitle',
              select: 'name nameTranslations color rarity'
            }
          });
        
        if (mySquad) {
          // Get already selected player IDs for this team
          const selectedPlayerIds = match.players
            .filter(p => p.team === myTeam)
            .map(p => p.user?._id?.toString() || p.user?.toString());
          
          // Available members = squad members not yet selected
          availableMembers = mySquad.members
            .filter(m => m.user && !selectedPlayerIds.includes(m.user._id?.toString()))
            .map(m => ({
              _id: m.user._id,
              username: m.user.username,
              avatarUrl: m.user.avatarUrl,
              discordAvatar: m.user.discordAvatar,
              discordId: m.user.discordId,
              strickerPoints: m.user.statsStricker?.points || 0,
              role: m.role,
              equippedTitle: m.user.equippedTitle
            }));
        }
      }
    }
    
    res.json({
      success: true,
      match,
      myTeam,
      isReferent,
      availableMembers,
      mySquad: mySquad ? { _id: mySquad._id, name: mySquad.name, tag: mySquad.tag, logo: mySquad.logo } : null
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

// Select roster member for stricker match
router.post('/match/:matchId/roster/select', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { memberId } = req.body;
    
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Membre non spécifié' });
    }
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'members')
      .populate('team2Squad', 'members')
      .populate('team1Referent', '_id')
      .populate('team2Referent', '_id');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (!match.rosterSelection?.isActive) {
      return res.status(400).json({ success: false, message: 'La sélection du roster n\'est pas active' });
    }
    
    // Check if user is a referent
    const userId = req.user._id.toString();
    const isTeam1Referent = match.team1Referent?._id?.toString() === userId || match.team1Referent?.toString() === userId;
    const isTeam2Referent = match.team2Referent?._id?.toString() === userId || match.team2Referent?.toString() === userId;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul le référent peut sélectionner des joueurs' });
    }
    
    // Determine which team this referent belongs to
    const myTeam = isTeam1Referent ? 1 : 2;
    
    // Check if this team already has 5 players
    const myTeamCount = match.players.filter(p => p.team === myTeam).length;
    if (myTeamCount >= 5) {
      return res.status(400).json({ success: false, message: 'Votre équipe est déjà complète (5 joueurs)' });
    }
    
    // Get the member to add
    const memberUser = await User.findById(memberId).select('_id username avatarUrl discordAvatar discordId platform statsStricker activisionId');
    if (!memberUser) {
      return res.status(404).json({ success: false, message: 'Joueur non trouvé' });
    }
    
    // Check if member is in the correct squad
    const mySquad = myTeam === 1 ? match.team1Squad : match.team2Squad;
    const isMemberInSquad = mySquad?.members?.some(m => 
      m.user?.toString() === memberId || m.user?._id?.toString() === memberId
    );
    
    if (!isMemberInSquad) {
      return res.status(400).json({ success: false, message: 'Ce joueur n\'est pas dans votre escouade' });
    }
    
    // Check if member is already selected
    const alreadySelected = match.players.some(p => 
      p.user?.toString() === memberId || p.user?._id?.toString() === memberId
    );
    
    if (alreadySelected) {
      return res.status(400).json({ success: false, message: 'Ce joueur est déjà sélectionné' });
    }
    
    // GGSecure check for PC players
    if (memberUser.platform === 'PC') {
      try {
        const ggsecureResponse = await fetch(`${process.env.GGSECURE_API_URL || 'https://api.ggsecure.io'}/v1/user/${memberId}/status`, {
          headers: {
            'Authorization': `Bearer ${process.env.GGSECURE_API_KEY || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (ggsecureResponse.ok) {
          const ggsecureData = await ggsecureResponse.json();
          if (!ggsecureData.isOnline && ggsecureData.reason !== 'api_key_missing') {
            return res.status(400).json({ 
              success: false, 
              message: `${memberUser.username} n'est pas connecté à GGSecure. Les joueurs PC doivent être connectés pour jouer.`
            });
          }
        }
      } catch (ggsecureError) {
        console.error('[STRICKER] GGSecure check error:', ggsecureError);
        // Continue anyway if GGSecure API is unavailable
      }
    }
    
    // Add player to the match
    const newPlayer = {
      user: memberUser._id,
      username: memberUser.username,
      rank: getStrickerRank(memberUser.statsStricker?.points || 0),
      points: memberUser.statsStricker?.points || 0,
      team: myTeam,
      squad: mySquad._id,
      isReferent: false
    };
    
    match.players.push(newPlayer);
    
    // Count players per team
    const team1Count = match.players.filter(p => p.team === 1).length;
    const team2Count = match.players.filter(p => p.team === 2).length;
    
    // Switch turns or complete roster selection
    if (team1Count >= 5 && team2Count >= 5) {
      // Both teams have 5 players, roster selection complete
      match.rosterSelection.isActive = false;
      
      // Emit socket event for roster complete
      const io = req.app.get('io');
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerRosterComplete', {
          matchId,
          mapVoteOptions: match.mapVoteOptions
        });
      }
    } else {
      // Emit socket event for roster update (both teams can select simultaneously)
      const io = req.app.get('io');
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerRosterUpdate', {
          matchId,
          team1Selected: match.players.filter(p => p.team === 1),
          team2Selected: match.players.filter(p => p.team === 2),
          team1Count,
          team2Count
        });
      }
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Joueur ajouté au roster',
      player: newPlayer,
      team1Count: match.players.filter(p => p.team === 1).length,
      team2Count: match.players.filter(p => p.team === 2).length,
      rosterComplete: !match.rosterSelection.isActive
    });
  } catch (error) {
    console.error('Stricker roster select error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Deselect/remove a roster member from stricker match
router.post('/match/:matchId/roster/deselect', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { memberId } = req.body;
    
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Membre non sp\u00e9cifi\u00e9' });
    }
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'members')
      .populate('team2Squad', 'members')
      .populate('team1Referent', '_id')
      .populate('team2Referent', '_id');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouv\u00e9' });
    }
    
    if (!match.rosterSelection?.isActive) {
      return res.status(400).json({ success: false, message: 'La s\u00e9lection du roster n\'est pas active' });
    }
    
    // Check if user is a referent
    const userId = req.user._id.toString();
    const isTeam1Referent = match.team1Referent?._id?.toString() === userId || match.team1Referent?.toString() === userId;
    const isTeam2Referent = match.team2Referent?._id?.toString() === userId || match.team2Referent?.toString() === userId;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul le r\u00e9f\u00e9rent peut retirer des joueurs' });
    }
    
    const myTeam = isTeam1Referent ? 1 : 2;
    
    // Find the player to remove
    const playerIndex = match.players.findIndex(p => 
      (p.user?.toString() === memberId || p.user?._id?.toString() === memberId) && 
      p.team === myTeam &&
      !p.isReferent // Can't remove the referent
    );
    
    if (playerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Joueur non trouv\u00e9 dans votre \u00e9quipe ou c\'est le r\u00e9f\u00e9rent' });
    }
    
    // Remove the player
    const removedPlayer = match.players[playerIndex];
    match.players.splice(playerIndex, 1);
    
    await match.save();
    
    // Emit socket event for roster update
    const io = req.app.get('io');
    if (io) {
      io.to(`stricker-match-${matchId}`).emit('strickerRosterUpdate', {
        matchId,
        team1Selected: match.players.filter(p => p.team === 1),
        team2Selected: match.players.filter(p => p.team === 2),
        team1Count: match.players.filter(p => p.team === 1).length,
        team2Count: match.players.filter(p => p.team === 2).length
      });
    }
    
    console.log(`[STRICKER] Player ${removedPlayer.username} removed from roster by referent`);
    
    res.json({
      success: true,
      message: 'Joueur retir\u00e9 du roster',
      removedPlayer: removedPlayer.username,
      team1Count: match.players.filter(p => p.team === 1).length,
      team2Count: match.players.filter(p => p.team === 2).length
    });
  } catch (error) {
    console.error('Stricker roster deselect error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Map vote for stricker match
router.post('/match/:matchId/map-vote', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { mapIndex } = req.body;
    
    if (mapIndex === undefined || mapIndex === null) {
      return res.status(400).json({ success: false, message: 'Index de map non spécifié' });
    }
    
    const match = await StrickerMatch.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    if (!match.mapVoteOptions || mapIndex >= match.mapVoteOptions.length) {
      return res.status(400).json({ success: false, message: 'Map invalide' });
    }
    
    const userId = req.user._id.toString();
    
    // Remove previous vote if any
    match.mapVoteOptions.forEach(option => {
      const voteIndex = option.votedBy?.indexOf(userId);
      if (voteIndex > -1) {
        option.votedBy.splice(voteIndex, 1);
        option.votes = Math.max(0, (option.votes || 0) - 1);
      }
    });
    
    // Add new vote
    if (!match.mapVoteOptions[mapIndex].votedBy) {
      match.mapVoteOptions[mapIndex].votedBy = [];
    }
    match.mapVoteOptions[mapIndex].votedBy.push(userId);
    match.mapVoteOptions[mapIndex].votes = (match.mapVoteOptions[mapIndex].votes || 0) + 1;
    
    match.markModified('mapVoteOptions');
    
    // Check if voting is complete (all players voted)
    const totalVotes = match.mapVoteOptions.reduce((sum, opt) => sum + (opt.votedBy?.length || 0), 0);
    const totalPlayers = match.players.filter(p => !p.isFake).length;
    
    if (totalVotes >= totalPlayers) {
      // Find winning map
      let maxVotes = 0;
      let winningMap = match.mapVoteOptions[0];
      match.mapVoteOptions.forEach(opt => {
        if ((opt.votes || 0) > maxVotes) {
          maxVotes = opt.votes;
          winningMap = opt;
        }
      });
      
      // selectedMap is an object in the schema, not a string
      match.selectedMap = {
        name: winningMap.name,
        image: winningMap.image,
        votes: winningMap.votes || 0
      };
      match.status = 'ready';
      
      // Emit socket event for map selected
      const io = req.app.get('io');
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerMapSelected', {
          matchId,
          selectedMap: winningMap.name,
          mapImage: winningMap.image
        });
      }
    } else {
      // Emit socket event for vote update
      const io = req.app.get('io');
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerMapVoteUpdate', {
          matchId,
          mapVoteOptions: match.mapVoteOptions
        });
      }
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Vote enregistré',
      mapVoteOptions: match.mapVoteOptions,
      selectedMap: match.selectedMap || null
    });
  } catch (error) {
    console.error('Stricker map vote error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Map ban for stricker match (referents ban 1 map each, then random selection from remaining)
router.post('/match/:matchId/map-ban', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { mapName } = req.body;
    
    console.log(`[STRICKER MAP BAN] User ${req.user.username} trying to ban map: ${mapName} for match ${matchId}`);
    
    if (!mapName) {
      return res.status(400).json({ success: false, message: 'Nom de map non sp\u00e9cifi\u00e9' });
    }
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Referent', '_id username')
      .populate('team2Referent', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouv\u00e9' });
    }
    
    // Ensure mapVoteOptions exists
    if (!match.mapVoteOptions || match.mapVoteOptions.length === 0) {
      console.error(`[STRICKER MAP BAN] No mapVoteOptions for match ${matchId}`);
      return res.status(400).json({ success: false, message: 'Aucune option de map disponible' });
    }
    
    // Verify the map exists in mapVoteOptions
    const mapExists = match.mapVoteOptions.some(m => m.name === mapName);
    if (!mapExists) {
      return res.status(400).json({ success: false, message: 'Map invalide' });
    }
    
    const userId = req.user._id.toString();
    const team1RefId = match.team1Referent?._id?.toString() || match.team1Referent?.toString();
    const team2RefId = match.team2Referent?._id?.toString() || match.team2Referent?.toString();
    
    console.log(`[STRICKER MAP BAN] userId: ${userId}, team1RefId: ${team1RefId}, team2RefId: ${team2RefId}`);
    
    // Only referents can ban maps
    const isTeam1Referent = userId === team1RefId;
    const isTeam2Referent = userId === team2RefId;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seuls les r\u00e9f\u00e9rents peuvent bannir des maps' 
      });
    }
    
    // Initialize mapBans if not exists
    if (!match.mapBans) {
      match.mapBans = {
        team1BannedMap: null,
        team1BannedAt: null,
        team2BannedMap: null,
        team2BannedAt: null,
        currentTurn: 1
      };
    }
    
    // Ensure currentTurn is set
    if (match.mapBans.currentTurn === undefined || match.mapBans.currentTurn === null) {
      match.mapBans.currentTurn = match.mapBans.team1BannedMap ? 2 : 1;
    }
    
    const currentTurn = match.mapBans.currentTurn;
    console.log(`[STRICKER MAP BAN] currentTurn: ${currentTurn}, isTeam1Referent: ${isTeam1Referent}, isTeam2Referent: ${isTeam2Referent}`);
    
    // Check if it's this referent's turn
    if ((isTeam1Referent && currentTurn !== 1) || (isTeam2Referent && currentTurn !== 2)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce n\'est pas votre tour de bannir' 
      });
    }
    
    // Check if this referent already banned
    if (isTeam1Referent && match.mapBans.team1BannedMap) {
      return res.status(400).json({ success: false, message: 'Vous avez d\u00e9j\u00e0 banni une map' });
    }
    if (isTeam2Referent && match.mapBans.team2BannedMap) {
      return res.status(400).json({ success: false, message: 'Vous avez d\u00e9j\u00e0 banni une map' });
    }
    
    // Check if map is already banned by the other team
    if (match.mapBans.team1BannedMap === mapName || match.mapBans.team2BannedMap === mapName) {
      return res.status(400).json({ success: false, message: 'Cette map a d\u00e9j\u00e0 \u00e9t\u00e9 bannie' });
    }
    
    // Record the ban
    if (isTeam1Referent) {
      match.mapBans.team1BannedMap = mapName;
      match.mapBans.team1BannedAt = new Date();
      match.mapBans.currentTurn = 2; // Now team 2's turn
    } else if (isTeam2Referent) {
      match.mapBans.team2BannedMap = mapName;
      match.mapBans.team2BannedAt = new Date();
    }
    
    match.markModified('mapBans');
    
    const io = req.app.get('io');
    
    // Check if both referents have banned
    const bothBanned = match.mapBans.team1BannedMap && match.mapBans.team2BannedMap;
    
    if (bothBanned) {
      // Get remaining maps (not banned)
      const remainingMaps = match.mapVoteOptions.filter(m => 
        m.name !== match.mapBans.team1BannedMap && 
        m.name !== match.mapBans.team2BannedMap
      );
      
      if (remainingMaps.length === 0) {
        return res.status(400).json({ success: false, message: 'Aucune map disponible' });
      }
      
      // Randomly select from remaining maps
      const randomIndex = Math.floor(Math.random() * remainingMaps.length);
      const selectedMap = remainingMaps[randomIndex];
      
      // selectedMap is an object in the schema, not a string
      match.selectedMap = {
        name: selectedMap.name,
        image: selectedMap.image,
        votes: 0
      };
      match.status = 'ready';
      
      // IMPORTANT: Save BEFORE emitting socket so data is ready when clients fetch
      await match.save();
      
      // Emit socket event for map selected
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerMapSelected', {
          matchId,
          selectedMap: selectedMap.name,
          mapImage: selectedMap.image,
          mapBans: {
            team1BannedMap: match.mapBans.team1BannedMap,
            team2BannedMap: match.mapBans.team2BannedMap
          }
        });
      }
    } else {
      // Save first, then emit
      await match.save();
      
      // Emit socket event for ban update
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerMapBanUpdate', {
          matchId,
          mapBans: {
            team1BannedMap: match.mapBans.team1BannedMap,
            team2BannedMap: match.mapBans.team2BannedMap,
            currentTurn: match.mapBans.currentTurn
          }
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Map bannie',
      mapBans: {
        team1BannedMap: match.mapBans.team1BannedMap,
        team2BannedMap: match.mapBans.team2BannedMap,
        currentTurn: match.mapBans.currentTurn
      },
      selectedMap: match.selectedMap || null,
      banComplete: bothBanned
    });
  } catch (error) {
    console.error('Stricker map ban error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Request match cancellation vote
router.post('/match/:matchId/cancel-vote', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { vote } = req.body; // true = wants to cancel, false = doesn't want to cancel
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Referent', '_id username')
      .populate('team2Referent', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Allow cancellation during pre-match AND during ready/in_progress
    const isRosterSelectionActive = match.rosterSelection?.isActive === true;
    // Check selectedMap.name because selectedMap is an embedded object that may be {} when empty
    const isMapBanPhase = match.status === 'pending' && !match.rosterSelection?.isActive && !match.selectedMap?.name;
    const isMatchPhase = match.status === 'ready' || match.status === 'in_progress';
    const canCancel = isRosterSelectionActive || isMapBanPhase || isMatchPhase;
    
    if (!canCancel) {
      return res.status(400).json({ 
        success: false, 
        message: 'L\'annulation n\'est plus possible pour ce match' 
      });
    }
    
    const userId = req.user._id.toString();
    const team1RefId = match.team1Referent?._id?.toString() || match.team1Referent?.toString();
    const team2RefId = match.team2Referent?._id?.toString() || match.team2Referent?.toString();
    
    // Only referents can vote for cancellation
    const isTeam1Referent = userId === team1RefId;
    const isTeam2Referent = userId === team2RefId;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seuls les référents peuvent demander l\'annulation du match' 
      });
    }
    
    // Initialize cancellation votes if not exists
    if (!match.cancellationVotes) {
      match.cancellationVotes = {
        team1: null,
        team2: null,
        team1VotedAt: null,
        team2VotedAt: null
      };
    }
    
    // Record the vote
    if (isTeam1Referent) {
      match.cancellationVotes.team1 = vote;
      match.cancellationVotes.team1VotedAt = new Date();
    } else if (isTeam2Referent) {
      match.cancellationVotes.team2 = vote;
      match.cancellationVotes.team2VotedAt = new Date();
    }
    
    match.markModified('cancellationVotes');
    
    // Check if both voted yes
    const bothAgreed = match.cancellationVotes.team1 === true && match.cancellationVotes.team2 === true;
    const oneDeclined = match.cancellationVotes.team1 === false || match.cancellationVotes.team2 === false;
    
    let matchCancelled = false;
    
    if (bothAgreed) {
      // Cancel the match
      match.status = 'cancelled';
      match.cancelledAt = new Date();
      match.cancelledBy = 'mutual_agreement';
      matchCancelled = true;
      
      console.log(`[STRICKER] Match ${matchId} cancelled by mutual agreement`);
    } else if (oneDeclined && match.cancellationVotes.team1 !== null && match.cancellationVotes.team2 !== null) {
      // One team declined, reset the votes
      match.cancellationVotes = {
        team1: null,
        team2: null,
        team1VotedAt: null,
        team2VotedAt: null
      };
    }
    
    await match.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      if (matchCancelled) {
        io.to(`stricker-match-${matchId}`).emit('strickerMatchCancelled', {
          matchId,
          reason: 'mutual_agreement'
        });
      } else {
        io.to(`stricker-match-${matchId}`).emit('strickerCancelVoteUpdate', {
          matchId,
          cancellationVotes: {
            team1: match.cancellationVotes.team1,
            team2: match.cancellationVotes.team2
          }
        });
      }
    }
    
    res.json({
      success: true,
      message: matchCancelled ? 'Match annulé' : 'Vote enregistré',
      cancellationVotes: {
        team1: match.cancellationVotes.team1,
        team2: match.cancellationVotes.team2
      },
      matchCancelled
    });
  } catch (error) {
    console.error('Stricker cancel vote error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Call arbitrator for help
router.post('/match/:matchId/call-arbitrator', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouv\u00e9' });
    }
    
    // Check if user is in the match
    const userId = req.user._id.toString();
    const isInMatch = match.players.some(p => p.user?.toString() === userId);
    
    if (!isInMatch) {
      return res.status(403).json({ success: false, message: 'Vous n\'\u00eates pas dans ce match' });
    }
    
    // Check if user already called arbitrator
    const alreadyCalled = match.arbitratorCalls?.some(c => c.user?.toString() === userId);
    if (alreadyCalled) {
      return res.status(400).json({ success: false, message: 'Vous avez d\u00e9j\u00e0 appel\u00e9 un arbitre' });
    }
    
    // Add arbitrator call
    if (!match.arbitratorCalls) match.arbitratorCalls = [];
    match.arbitratorCalls.push({
      user: req.user._id,
      calledAt: new Date()
    });
    
    // Add system message to chat
    match.chat.push({
      isSystem: true,
      messageType: 'arbitrator_called',
      message: `${req.user.username} a demand\u00e9 l'intervention d'un arbitre`
    });
    
    await match.save();
    
    // Send Discord notification
    try {
      await discordBot.logStrickerArbitratorCall(match, req.user);
    } catch (discordError) {
      console.error('Error sending Discord notification for Stricker arbitrator call:', discordError);
      // Don't fail the request if Discord fails
    }
    
    // Notify arbitrators via socket
    const io = req.app.get('io');
    if (io) {
      io.to('arbitrators').emit('strickerArbitratorCall', {
        matchId,
        calledBy: req.user.username,
        team1Squad: match.team1Squad?.name || 'Team 1',
        team2Squad: match.team2Squad?.name || 'Team 2'
      });
      
      // Also emit match update to all players in the match
      io.to(`stricker-match-${matchId}`).emit('strickerMatchUpdate', { matchId });
    }
    
    console.log(`[STRICKER] Arbitrator called for match ${matchId} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Arbitre appel\u00e9 avec succ\u00e8s'
    });
  } catch (error) {
    console.error('Stricker call arbitrator error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Submit match result (referents only)
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
    
    // Check if user is a referent (only referents can vote)
    const userId = req.user._id.toString();
    const isTeam1Referent = match.team1Referent?.toString() === userId;
    const isTeam2Referent = match.team2Referent?.toString() === userId;
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul le référent peut valider le résultat' });
    }
    
    // Initialize result reports if not exists
    if (!match.result) match.result = {};
    
    // Store the referent's vote
    if (isTeam1Referent) {
      if (match.result.team1Report?.winner) {
        return res.status(400).json({ success: false, message: 'Vous avez déjà voté' });
      }
      match.result.team1Report = {
        winner,
        votedBy: req.user._id,
        votedAt: new Date()
      };
    } else if (isTeam2Referent) {
      if (match.result.team2Report?.winner) {
        return res.status(400).json({ success: false, message: 'Vous avez déjà voté' });
      }
      match.result.team2Report = {
        winner,
        votedBy: req.user._id,
        votedAt: new Date()
      };
    }
    
    // Check if both referents have voted
    if (match.result.team1Report?.winner && match.result.team2Report?.winner) {
      // Check if they agree
      if (match.result.team1Report.winner === match.result.team2Report.winner) {
        // Both agree - complete the match
        match.result.winner = match.result.team1Report.winner;
        match.winner = match.result.team1Report.winner; // Set winner at root level for filtering
        match.result.confirmed = true;
        match.result.confirmedAt = new Date();
        match.status = 'completed';
        match.completedAt = new Date();
        
        console.log(`[STRICKER] Match ${match._id} completed - Winner: Team ${match.winner}`);
        
        // Distribute rewards (no MVP system for Stricker)
        await distributeStrickerRewards(match);
      } else {
        // Disagreement - mark as disputed
        match.status = 'disputed';
        console.log(`[STRICKER] Match ${match._id} disputed - Team1 voted ${match.result.team1Report.winner}, Team2 voted ${match.result.team2Report.winner}`);
      }
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Vote enregistré',
      team1Report: match.result.team1Report,
      team2Report: match.result.team2Report,
      isCompleted: match.status === 'completed',
      isDisputed: match.status === 'disputed'
    });
  } catch (error) {
    console.error('Stricker result error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Hardcoded Stricker ranks with points loss per rank
const STRICKER_RANK_POINTS = {
  recrues: { min: 0, max: 249, pointsLoss: -15 },
  operateurs: { min: 250, max: 499, pointsLoss: -20 },
  veterans: { min: 500, max: 749, pointsLoss: -25 },
  commandants: { min: 750, max: 999, pointsLoss: -30 },
  seigneurs: { min: 1000, max: 1499, pointsLoss: -40 },
  immortel: { min: 1500, max: null, pointsLoss: -50 }
};

// Get points loss based on player's current rank
function getPointsLossForRank(points) {
  if (points >= 1500) return STRICKER_RANK_POINTS.immortel.pointsLoss;
  if (points >= 1000) return STRICKER_RANK_POINTS.seigneurs.pointsLoss;
  if (points >= 750) return STRICKER_RANK_POINTS.commandants.pointsLoss;
  if (points >= 500) return STRICKER_RANK_POINTS.veterans.pointsLoss;
  if (points >= 250) return STRICKER_RANK_POINTS.operateurs.pointsLoss;
  return STRICKER_RANK_POINTS.recrues.pointsLoss;
}

// Distribute rewards for stricker match
async function distributeStrickerRewards(match) {
  try {
    const winningTeam = match.result.winner;
    
    // Fixed points for victory (+30 for everyone)
    const POINTS_WIN = 30;
    
    // Munitions rewards - Winners get 50, losers get 10 (consolation)
    const CRANES_WIN = 50;
    const CRANES_LOSS = 10;
    const squadsAwarded = new Map(); // Map<squadId, cranesEarned> to track rewards per squad
    
    // Process each player
    for (const player of match.players) {
      if (player.isFake || !player.user) continue;
      
      const user = await User.findById(player.user);
      if (!user) continue;
      
      const isWinner = player.team === winningTeam;
      
      // Initialize stats if not exists
      if (!user.statsStricker) user.statsStricker = { points: 0, wins: 0, losses: 0, xp: 0 };
      
      const oldPoints = user.statsStricker.points || 0;
      
      // Calculate points change based on rank (hardcoded)
      // Winners get +30, losers lose based on their current rank
      const pointsChange = isWinner ? POINTS_WIN : getPointsLossForRank(oldPoints);
      
      user.statsStricker.points = Math.max(0, oldPoints + pointsChange);
      
      if (isWinner) {
        user.statsStricker.wins = (user.statsStricker.wins || 0) + 1;
      } else {
        user.statsStricker.losses = (user.statsStricker.losses || 0) + 1;
      }
      
      await user.save();
      
      console.log(`[STRICKER] ${user.username}: ${isWinner ? 'WIN' : 'LOSS'} - Points: ${oldPoints} -> ${user.statsStricker.points} (${pointsChange > 0 ? '+' : ''}${pointsChange})`);
      
      // Update squad stats if player has a squad
      let cranesAwarded = 0;
      if (player.squad) {
        const squadId = player.squad.toString();
        
        // Check if this squad was already processed
        if (squadsAwarded.has(squadId)) {
          // Squad already processed, just get the cranes value that was awarded
          cranesAwarded = squadsAwarded.get(squadId);
          console.log(`[STRICKER] Squad already processed for ${user.username}, using cached cranes: ${cranesAwarded}`);
        } else {
          // First player from this squad - process squad stats
          const squad = await Squad.findById(player.squad);
          if (squad) {
            if (!squad.statsStricker) squad.statsStricker = { points: 0, wins: 0, losses: 0 };
            
            const oldSquadPoints = squad.statsStricker.points || 0;
            const squadPointsChange = isWinner ? POINTS_WIN : getPointsLossForRank(oldSquadPoints);
            
            squad.statsStricker.points = Math.max(0, oldSquadPoints + squadPointsChange);
            
            if (isWinner) {
              squad.statsStricker.wins = (squad.statsStricker.wins || 0) + 1;
            } else {
              squad.statsStricker.losses = (squad.statsStricker.losses || 0) + 1;
            }
            
            // Award munitions
            // Winners get 50 munitions, losers get 10 munitions (consolation)
            const cranesReward = isWinner ? CRANES_WIN : CRANES_LOSS;
            squad.cranes = (squad.cranes || 0) + cranesReward;
            squadsAwarded.set(squadId, cranesReward); // Store cranes value for other players
            cranesAwarded = cranesReward;
            
            console.log(`[STRICKER] Squad ${squad.tag} (${squad._id}) ${isWinner ? 'WON' : 'LOST'} - Stats: ${oldSquadPoints} → ${squad.statsStricker.points} pts (${squadPointsChange > 0 ? '+' : ''}${squadPointsChange}), ${squad.statsStricker.wins}W/${squad.statsStricker.losses}L - Munitions: ${cranesReward} (total: ${squad.cranes})`);
            
            await squad.save();
            console.log(`[STRICKER] Squad ${squad.tag} saved successfully. Current statsStricker:`, squad.statsStricker);
          } else {
            console.warn(`[STRICKER] Squad ${squadId} not found for player ${user.username}`);
          }
        }
      }
      
      // Store rewards in match player data
      player.rewards = {
        pointsChange,
        oldPoints,
        newPoints: user.statsStricker.points,
        cranesEarned: cranesAwarded
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
    
    // Get user with roles
    const user = await User.findById(req.user._id).select('username roles');
    
    const userPlayer = match.players.find(p => 
      p.user?.toString() === req.user._id.toString()
    );
    
    // Determine if user is staff (admin, staff, or arbitre)
    const isStaff = user?.roles?.some(r => ['admin', 'staff', 'arbitre'].includes(r)) || false;
    
    match.chat.push({
      user: req.user._id,
      username: user?.username,
      message: message.trim().substring(0, 500),
      team: userPlayer?.team || null,
      isSystem: false,
      isStaff: isStaff,
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
      isTestMatch: { $ne: true },
      winner: { $exists: true, $ne: null }, // Must have a winner
      $or: [
        { team1Score: { $gt: 0 } },
        { team2Score: { $gt: 0 } }
      ] // At least one team must have scored
    })
    .populate('players.user', 'username avatarUrl discordAvatar discordId')
    .populate('team1Squad', 'name tag logo')
    .populate('team2Squad', 'name tag logo')
    .sort({ completedAt: -1 })
    .limit(Math.min(parseInt(limit), 50));
    
    // Additional filter for safety - exclude any match without valid scores
    const validMatches = matches.filter(match => {
      return match.status === 'completed' && 
             match.winner && 
             (match.team1Score > 0 || match.team2Score > 0);
    });
    
    res.json({
      success: true,
      matches: validMatches,
      total: validMatches.length
    });
  } catch (error) {
    console.error('Stricker recent history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get player Stricker match history
router.get('/history/player/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 500 } = req.query;
    
    // Find all completed matches where user participated
    const matches = await StrickerMatch.find({
      'players.user': userId,
      status: 'completed',
      isTestMatch: { $ne: true },
      winner: { $exists: true, $ne: null }
    })
    .populate('team1Squad', 'name tag logo')
    .populate('team2Squad', 'name tag logo')
    .populate('players.user', 'username avatarUrl')
    .sort({ completedAt: -1 })
    .limit(parseInt(limit))
    .lean();
    
    // Format matches with win/loss info for the player
    const formattedMatches = matches.map(match => {
      // Find player's team
      const playerData = match.players.find(p => 
        p.user?._id?.toString() === userId || p.user?.toString() === userId
      );
      
      const playerTeam = playerData?.team;
      const isWinner = (playerTeam === 1 && match.winner === 1) || (playerTeam === 2 && match.winner === 2);
      
      return {
        ...match,
        playerTeam,
        isWinner,
        matchType: 'stricker'
      };
    });
    
    res.json({
      success: true,
      matches: formattedMatches,
      total: formattedMatches.length
    });
  } catch (error) {
    console.error('Player stricker history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all stricker matches (admin/staff/arbitre only)
router.get('/admin/matches', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const matches = await StrickerMatch.find(query)
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo')
      .populate('players.user', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await StrickerMatch.countDocuments(query);
    
    res.json({
      success: true,
      matches,
      total,
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Admin stricker matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Report AFK team (send Discord notification)
router.post('/match/:matchId/report-afk', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'name tag')
      .populate('team2Squad', 'name tag')
      .populate('team1Referent', '_id username')
      .populate('team2Referent', '_id username');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Check if user is a referent
    const isTeam1Referent = match.team1Referent?._id?.toString() === req.user._id.toString();
    const isTeam2Referent = match.team2Referent?._id?.toString() === req.user._id.toString();
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return res.status(403).json({ success: false, message: 'Seul un référent peut signaler une équipe AFK' });
    }
    
    // Determine reporter and reported teams
    const reporterTeam = isTeam1Referent ? 1 : 2;
    const reportedTeam = isTeam1Referent ? 2 : 1;
    const reporterSquadName = reporterTeam === 1 ? match.team1Squad?.name : match.team2Squad?.name;
    const reportedSquadName = reportedTeam === 1 ? match.team1Squad?.name : match.team2Squad?.name;
    
    // Send Discord notification with embed
    const STRICKER_AFK_CHANNEL_ID = '1464005794289815746';
    const ARBITRATOR_ROLE_ID = '1461108156913680647';
    
    // Import EmbedBuilder, ButtonBuilder, ActionRowBuilder dynamically
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');
    
    const embed = new EmbedBuilder()
      .setColor(0xFF6600) // Orange
      .setTitle('⚠️ SIGNALEMENT - ROSTER NON SÉLECTIONNÉ')
      .setDescription(`Une équipe ne sélectionne pas son roster dans le temps imparti.`)
      .addFields(
        { name: '🎮 Match', value: `${match.team1Squad?.name || 'Équipe 1'} vs ${match.team2Squad?.name || 'Équipe 2'}`, inline: false },
        { name: '📋 Match ID', value: `\`${matchId}\``, inline: true },
        { name: '👤 Signalé par', value: `${req.user.username} (${reporterSquadName})`, inline: true },
        { name: '🚨 Équipe signalée', value: reportedSquadName, inline: true },
        { name: '📍 Phase', value: 'Sélection du roster', inline: true },
        { name: '⏰ Date', value: new Date().toLocaleString('fr-FR'), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'NoMercy Stricker' });
    
    // Create cancel button
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_stricker_match_${matchId}`)
      .setLabel('❌ Annuler le match')
      .setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(cancelButton);
    
    await discordBot.sendToChannel(STRICKER_AFK_CHANNEL_ID, { 
      content: `<@&${ARBITRATOR_ROLE_ID}>`,
      embeds: [embed],
      components: [row]
    });
    
    res.json({
      success: true,
      message: 'Signalement envoyé'
    });
  } catch (error) {
    console.error('Report AFK error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete a stricker match (admin/staff/arbitre only)
router.delete('/admin/matches/:matchId', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad')
      .populate('team2Squad')
      .populate('players.user');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // If match is completed, refund rewards
    if (match.status === 'completed' && match.winner) {
      const config = await Config.getOrCreate();
      const rewards = config.strickerMatchRewards?.['Search & Destroy'] || {};
      
      // Refund points and stats
      for (const player of match.players) {
        if (!player.user) continue;
        
        const user = await User.findById(player.user._id);
        if (!user) continue;
        
        const isWinner = player.team === match.winner;
        
        // Refund stricker points
        if (isWinner) {
          user.statsStricker = user.statsStricker || {};
          user.statsStricker.points = Math.max(0, (user.statsStricker.points || 0) - (rewards.pointsWin || 35));
          user.statsStricker.wins = Math.max(0, (user.statsStricker.wins || 0) - 1);
        } else {
          user.statsStricker = user.statsStricker || {};
          user.statsStricker.points = Math.max(0, (user.statsStricker.points || 0) + Math.abs(rewards.pointsLoss || 18));
          user.statsStricker.losses = Math.max(0, (user.statsStricker.losses || 0) - 1);
        }
        
        // Refund gold coins
        const coinsToRefund = isWinner ? (rewards.coinsWin || 80) : (rewards.coinsLoss || 25);
        user.goldCoins = Math.max(0, (user.goldCoins || 0) - coinsToRefund);
        
        await user.save();
      }
      
      // Refund squad stats and munitions
      // Winners had 50 munitions, losers had 10 munitions
      const CRANES_WIN = 50;
      const CRANES_LOSS = 10;
      
      if (match.team1Squad) {
        const squad1 = await Squad.findById(match.team1Squad._id);
        if (squad1) {
          squad1.statsStricker = squad1.statsStricker || {};
          if (match.winner === 1) {
            squad1.statsStricker.wins = Math.max(0, (squad1.statsStricker.wins || 0) - 1);
            squad1.statsStricker.points = Math.max(0, (squad1.statsStricker.points || 0) - (rewards.pointsWin || 35));
            // Refund winner munitions
            squad1.cranes = Math.max(0, (squad1.cranes || 0) - CRANES_WIN);
          } else {
            squad1.statsStricker.losses = Math.max(0, (squad1.statsStricker.losses || 0) - 1);
            squad1.statsStricker.points = Math.max(0, (squad1.statsStricker.points || 0) + Math.abs(rewards.pointsLoss || 18));
            // Refund loser munitions
            squad1.cranes = Math.max(0, (squad1.cranes || 0) - CRANES_LOSS);
          }
          await squad1.save();
        }
      }
      
      if (match.team2Squad) {
        const squad2 = await Squad.findById(match.team2Squad._id);
        if (squad2) {
          squad2.statsStricker = squad2.statsStricker || {};
          if (match.winner === 2) {
            squad2.statsStricker.wins = Math.max(0, (squad2.statsStricker.wins || 0) - 1);
            squad2.statsStricker.points = Math.max(0, (squad2.statsStricker.points || 0) - (rewards.pointsWin || 35));
            // Refund winner munitions
            squad2.cranes = Math.max(0, (squad2.cranes || 0) - CRANES_WIN);
          } else {
            squad2.statsStricker.losses = Math.max(0, (squad2.statsStricker.losses || 0) - 1);
            squad2.statsStricker.points = Math.max(0, (squad2.statsStricker.points || 0) + Math.abs(rewards.pointsLoss || 18));
            // Refund loser munitions
            squad2.cranes = Math.max(0, (squad2.cranes || 0) - CRANES_LOSS);
          }
          await squad2.save();
        }
      }
    }
    
    await StrickerMatch.findByIdAndDelete(matchId);
    
    res.json({
      success: true,
      message: 'Match Stricker supprimé avec succès. Les récompenses ont été remboursées.'
    });
  } catch (error) {
    console.error('Admin delete stricker match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update stricker match status (admin/staff/arbitre only)
router.patch('/admin/matches/:matchId/status', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'ready', 'in_progress', 'completed', 'disputed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }
    
    const match = await StrickerMatch.findByIdAndUpdate(
      matchId,
      { status },
      { new: true }
    );
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    res.json({
      success: true,
      message: 'Statut mis à jour',
      match
    });
  } catch (error) {
    console.error('Admin update stricker match status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
