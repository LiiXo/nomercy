import express from 'express';
import mongoose from 'mongoose';
import StrickerMatch from '../models/StrickerMatch.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Config from '../models/Config.js';
import AppSettings from '../models/AppSettings.js';
import Map from '../models/Map.js';
import { verifyToken, requireAdmin, requireStaff, requireArbitre } from '../middleware/auth.middleware.js';
import ggsecureMonitoring from '../services/ggsecureMonitoring.service.js';
import discordBot from '../services/discordBot.service.js';

const router = express.Router();

// ==================== CACHED STRICKER ACCESS CHECK ====================
// Cache AppSettings to avoid hitting DB on every single request
let cachedStrickerEnabled = null;
let strickerEnabledCacheTime = 0;
const STRICKER_ACCESS_CACHE_TTL = 30000; // 30 seconds

async function isStrickerModeEnabledCached() {
  const now = Date.now();
  if (cachedStrickerEnabled !== null && (now - strickerEnabledCacheTime) < STRICKER_ACCESS_CACHE_TTL) {
    return cachedStrickerEnabled;
  }
  try {
    const appSettings = await AppSettings.findOne().select('features.strickerMode.enabled').lean();
    cachedStrickerEnabled = appSettings?.features?.strickerMode?.enabled === true;
    strickerEnabledCacheTime = now;
  } catch (err) {
    console.error('Error checking strickerMode setting:', err);
    // Return last known value or false
    if (cachedStrickerEnabled === null) cachedStrickerEnabled = false;
  }
  return cachedStrickerEnabled;
}

// Middleware to check if user has access (admin/staff/arbitre OR strickerMode enabled for everyone)
const checkStrickerAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    
    // Use select to only fetch needed fields instead of entire User document
    const user = await User.findById(req.user._id).select('_id username roles squadStricker squadHardcore squadCdl squad discordId discordAvatar avatar platform statsStricker activisionId isBanned isProfileComplete');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Check if user has admin/staff/arbitre role
    const hasAdminAccess = user.roles?.some(r => ['admin', 'staff', 'arbitre'].includes(r));
    
    // Use cached AppSettings check instead of querying DB every time
    const isStrickerEnabled = await isStrickerModeEnabledCached();
    
    // Allow access if admin/staff/arbitre OR if stricker mode is enabled
    if (!hasAdminAccess && !isStrickerEnabled) {
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

// ==================== STRICKER LEADERBOARD CACHE ====================
const strickerCache = new Map();
const STRICKER_CACHE_TTL = 15000; // 15 seconds

function getStrickerCached(key) {
  const entry = strickerCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < STRICKER_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setStrickerCache(key, data) {
  strickerCache.set(key, { data, timestamp: Date.now() });
}

// ==================== QUEUE MANAGEMENT ====================
// In-memory queue for stricker matchmaking (same pattern as ranked mode)
const ONLINE_TIMEOUT = 60000; // 1 minute
const JOIN_RATE_LIMIT_MS = 3000; // 3 seconds between join attempts
const MATCH_CREATION_LOCK_TIMEOUT = 10000; // 10 seconds max lock time

// Simple object storage (like ranked mode uses)
// Format-specific queues for 3v3 and 5v5
const strickerQueue = [];  // Legacy/combined queue - Array of { odId, odUsername, odPoints, odRank, odSquadId, odSquadName, joinedAt, format }
const strickerQueue3v3 = [];  // 3v3 format queue
const strickerQueue5v5 = [];  // 5v5 format queue
const strickerOnlineUsers = {};  // { odId: timestamp }

// Helper to get queue by format
function getQueueByFormat(format) {
  if (format === '3v3') return strickerQueue3v3;
  if (format === '5v5') return strickerQueue5v5;
  return strickerQueue5v5; // Default to 5v5
}

// Helper to get stats field by format
// 5v5 uses legacy 'statsStricker' for backward compatibility with existing data
// 3v3 uses new 'statsStricker3v3' field
function getStatsFieldByFormat(format) {
  if (format === '3v3') return 'statsStricker3v3';
  return 'statsStricker'; // 5v5 uses legacy field for backward compatibility
}

// Helper to get team size by format
function getTeamSizeByFormat(format) {
  return format === '3v3' ? 3 : 5;
}

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
    const mode = req.query.mode || 'hardcore'; // Default to hardcore (valid enum: 'hardcore' or 'cdl')
    const format = req.query.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    
    // Update online status
    strickerOnlineUsers[odId] = Date.now();
    
    // Get user's squad ID - reuse from middleware (already fetched in checkStrickerAccess)
    const userSquad = req.user?.squadStricker || req.user?.squadHardcore || req.user?.squadCdl || req.user?.squad;
    const userSquadId = userSquad?._id?.toString() || userSquad?.toString();
    
    // Get the format-specific queue
    const formatQueue = getQueueByFormat(format);
    
    // Filter queue by mode and format
    const modeQueue = formatQueue.filter(p => p.mode === mode);
    
    // Check if user's squad is in queue (for this mode and format)
    const inQueue = modeQueue.some(p => p.squadId === userSquadId);
    const queueSize = modeQueue.length;
    
    // 2-hour cooldown constant (in ms)
    const REMATCH_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
    
    // Get recent matches for cooldown check
    let recentMatches = [];
    if (userSquadId) {
      const cooldownCutoff = new Date(Date.now() - REMATCH_COOLDOWN_MS);
      recentMatches = await StrickerMatch.find({
        $or: [
          { team1Squad: userSquadId },
          { team2Squad: userSquadId }
        ],
        format: format,
        status: 'completed',
        completedAt: { $gte: cooldownCutoff }
      }).select('team1Squad team2Squad completedAt').lean();
    }
    
    // Build a map of opponent squad IDs to their cooldown end time
    const cooldownMap = {};
    recentMatches.forEach(match => {
      const opponentSquadId = match.team1Squad?.toString() === userSquadId 
        ? match.team2Squad?.toString() 
        : match.team1Squad?.toString();
      
      if (opponentSquadId) {
        const cooldownEnd = new Date(match.completedAt).getTime() + REMATCH_COOLDOWN_MS;
        // Keep the latest cooldown if multiple matches
        if (!cooldownMap[opponentSquadId] || cooldownEnd > cooldownMap[opponentSquadId]) {
          cooldownMap[opponentSquadId] = cooldownEnd;
        }
      }
    });
    
    // Get stats field based on format
    const statsField = getStatsFieldByFormat(format);
    
    // Get list of squads searching (including user's own squad, marked as isOwnSquad)
    const searchingSquads = [];
    const seenSquads = new Set();
    modeQueue.forEach((entry) => {
      if (entry && entry.squadId && !seenSquads.has(entry.squadId)) {
        seenSquads.add(entry.squadId);
        const isOwnSquad = entry.squadId === userSquadId;
        const cooldownEndTime = cooldownMap[entry.squadId];
        const now = Date.now();
        const isOnCooldown = !isOwnSquad && cooldownEndTime && cooldownEndTime > now;
        
        searchingSquads.push({
          odId: entry.odId,
          odUser: entry.odUser,
          username: entry.username,
          squadId: entry.squadId,
          squadName: entry.squadName,
          squadTag: entry.squadTag,
          squadLogo: entry.squad?.logo || null,
          points: entry.points,
          joinedAt: entry.joinedAt,
          // Cooldown info (not applicable to own squad)
          onCooldown: isOnCooldown,
          cooldownEndsAt: isOnCooldown ? cooldownEndTime : null,
          cooldownRemaining: isOnCooldown ? cooldownEndTime - now : 0,
          // Mark if this is the user's own squad
          isOwnSquad: isOwnSquad
        });
      }
    });
    
    // Check for active match (mode and format specific)
    let activeMatch = null;
    try {
      activeMatch = await StrickerMatch.findOne({
        'players.user': req.user._id,
        mode: mode,
        format: format,
        status: { $in: ['pending', 'ready', 'in_progress', 'disputed'] }
      })
      .populate('players.user', 'username avatar avatarUrl discordAvatar discordId platform irisLastSeen')
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo')
      .lean();
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
      format: format,
      teamSize: getTeamSizeByFormat(format),
      gameMode: 'Search & Destroy',
      mode: mode
    });
  } catch (error) {
    console.error('Stricker matchmaking status error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les statistiques des matchs Stricker en cours (public - pour le dashboard)
router.get('/active-matches/stats', async (req, res) => {
  try {
    const { mode = 'hardcore' } = req.query;
    
    // Récupérer tous les matchs Stricker actifs (pending, ready, roster_selection, map_vote, in_progress)
    const activeMatches = await StrickerMatch.find({
      mode,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress'] }
    }).select('status gameMode').lean();
    
    // Calculer le nombre total de joueurs (5v5 = 10 joueurs par match)
    const totalPlayers = activeMatches.length * 10;
    
    // Grouper par statut pour plus de détails
    const matchesByStatus = {};
    activeMatches.forEach(match => {
      if (!matchesByStatus[match.status]) {
        matchesByStatus[match.status] = 0;
      }
      matchesByStatus[match.status]++;
    });
    
    res.json({
      success: true,
      totalMatches: activeMatches.length,
      totalPlayers,
      stats: Object.entries(matchesByStatus).map(([status, count]) => ({
        status,
        count
      })),
      mode,
      format: '5v5',
      gameMode: 'Search & Destroy'
    });
  } catch (error) {
    console.error('Error fetching stricker active matches stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const odId = req.user._id.toString();
    const now = Date.now();
    const mode = req.body.mode || 'hardcore'; // Default to hardcore (valid enum: 'hardcore' or 'cdl')
    const format = req.body.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    const teamSize = getTeamSizeByFormat(format);
    const statsField = getStatsFieldByFormat(format);
    
    // Rate limiting: Prevent rapid join attempts (anti race condition)
    const lastUserAttempt = recentJoinAttempts.get(`user:${odId}:${mode}:${format}`);
    if (lastUserAttempt && (now - lastUserAttempt) < JOIN_RATE_LIMIT_MS) {
      const timeRemaining = JOIN_RATE_LIMIT_MS - (now - lastUserAttempt);
      console.warn(`[STRICKER] Rate limit hit | user: ${odId} | mode: ${mode} | format: ${format} | retry in: ${timeRemaining}ms`);
      return res.status(429).json({ 
        success: false, 
        message: 'Veuillez patienter quelques secondes avant de réessayer.' 
      });
    }
    recentJoinAttempts.set(`user:${odId}:${mode}:${format}`, now);
    
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
    const lastSquadAttempt = recentJoinAttempts.get(`squad:${squadId}:${format}`);
    if (lastSquadAttempt && (Date.now() - lastSquadAttempt) < JOIN_RATE_LIMIT_MS) {
      console.warn(`[STRICKER] Squad rate limit hit | squad: ${squadId} | format: ${format}`);
      return res.status(429).json({ 
        success: false, 
        message: 'Votre escouade a déjà lancé une recherche. Veuillez patienter.' 
      });
    }
    recentJoinAttempts.set(`squad:${squadId}:${format}`, Date.now());
    
    // Check if squad has at least the required number of members for the format
    if (!squad.members || squad.members.length < teamSize) {
      return res.status(400).json({ 
        success: false, 
        message: `Votre escouade doit avoir au moins ${teamSize} membres pour le format ${format} (actuellement ${squad.members?.length || 0})` 
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
    
    // IRIS verification for PC players
    if (user.platform === 'PC') {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const isIrisConnected = user.irisLastSeen && new Date(user.irisLastSeen) > threeMinutesAgo;
      
      if (!isIrisConnected) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous devez être connecté à IRIS pour lancer une recherche de match (joueur PC).',
          irisRequired: true
        });
      }
    }
    
    // Get the format-specific queue
    const formatQueue = getQueueByFormat(format);
    
    // Check if already in queue (for this mode and format)
    if (formatQueue.some(p => p.odId === odId && p.mode === mode)) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà dans la file d\'attente' });
    }
    
    // Check if squad is already in queue for this mode and format (another member searching)
    if (formatQueue.some(p => p.squadId === squad._id.toString() && p.mode === mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Votre escouade est déjà dans la file d\'attente' 
      });
    }
    
    // Check for active match for user (mode and format specific) - includes disputed matches
    const activeMatch = await StrickerMatch.findOne({
      'players.user': req.user._id,
      mode: mode,
      format: format,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress', 'disputed'] }
    });
    
    if (activeMatch) {
      const isDisputed = activeMatch.status === 'disputed';
      return res.status(400).json({ 
        success: false, 
        message: isDisputed 
          ? 'Vous avez un match en litige en attente d\'arbitrage. Vous ne pouvez pas lancer de nouveau match.'
          : 'Vous avez déjà un match en cours' 
      });
    }
    
    // Check if squad already has an active match (mode and format specific) - includes disputed matches
    const squadActiveMatch = await StrickerMatch.findOne({
      $or: [
        { team1Squad: squad._id },
        { team2Squad: squad._id }
      ],
      mode: mode,
      format: format,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress', 'disputed'] }
    });
    
    if (squadActiveMatch) {
      const isDisputed = squadActiveMatch.status === 'disputed';
      return res.status(400).json({ 
        success: false, 
        message: isDisputed
          ? 'Votre escouade a un match en litige en attente d\'arbitrage. Vous ne pouvez pas lancer de nouveau match.'
          : 'Votre escouade a déjà un match en cours' 
      });
    }
    
    // Get format-specific stats
    const userStats = user[statsField] || { points: 0 };
    
    // Add to format-specific queue
    formatQueue.push({
      odId: odId,
      odUser: req.user._id,
      username: user.username,
      points: userStats.points || 0,
      squad: squad,
      squadId: squad._id.toString(),
      squadName: squad.name,
      squadTag: squad.tag,
      squadMembers: squad.members.length,
      joinedAt: new Date(),
      mode: mode,
      format: format
    });
    
    // Filter queue by mode for display
    const modeQueue = formatQueue.filter(p => p.mode === mode);
    
    // Get updated list of searching squads (excluding own squad) - mode and format specific
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
    
    // Broadcast queue update to all users in stricker-mode room
    const io = req.app.get('io');
    if (io) {
      io.to('stricker-mode').emit('strickerQueueUpdate', {
        mode: mode,
        format: format,
        action: 'join',
        squad: {
          squadId: squadId,
          squadName: squad.name,
          squadTag: squad.tag,
          squadLogo: squad.logo || null,
          points: userStats.points || 0,
          joinedAt: new Date()
        },
        queueSize: modeQueue.length
      });
    }
    
    res.json({
      success: true,
      message: 'Vous avez rejoint la file d\'attente',
      queueSize: modeQueue.length,
      position: modeQueue.length,
      searchingSquads,
      mode: mode,
      format: format,
      teamSize: teamSize
    });
  } catch (error) {
    console.error('Stricker join queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Challenge a squad - Create match directly
router.post('/matchmaking/challenge', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { targetSquadId, mode: requestMode, format: requestFormat } = req.body;
    const mode = requestMode || 'hardcore'; // Default to hardcore (valid enum: 'hardcore' or 'cdl')
    const format = requestFormat || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    const teamSize = getTeamSizeByFormat(format);
    const statsField = getStatsFieldByFormat(format);
    const odId = req.user._id.toString();
    const now = Date.now();
    
    if (!targetSquadId) {
      return res.status(400).json({ success: false, message: 'Escouade cible non sp\u00e9cifi\u00e9e' });
    }
    
    // Rate limiting
    const lastAttempt = recentJoinAttempts.get(`challenge:${odId}:${format}`);
    if (lastAttempt && (now - lastAttempt) < JOIN_RATE_LIMIT_MS) {
      return res.status(429).json({ 
        success: false, 
        message: 'Veuillez patienter quelques secondes avant de réessayer.' 
      });
    }
    recentJoinAttempts.set(`challenge:${odId}:${format}`, now);
    
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
    
    // IRIS verification for PC players
    if (user.platform === 'PC') {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const isIrisConnected = user.irisLastSeen && new Date(user.irisLastSeen) > threeMinutesAgo;
      
      if (!isIrisConnected) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vous devez être connecté à IRIS pour lancer un défi (joueur PC).',
          irisRequired: true
        });
      }
    }
    
    // Get the format-specific queue
    const formatQueue = getQueueByFormat(format);
    
    // Check if target squad is in queue (for this mode and format)
    const targetEntry = formatQueue.find(p => p.squadId === targetSquadId && p.mode === mode);
    if (!targetEntry) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette escouade n\'est plus en recherche de match' 
      });
    }
        
    // Can't challenge own squad
    if (targetSquadId === challengerSquadId) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous défier vous-même' });
    }
        
    // Check for active matches (mode and format specific) - includes disputed matches
    const activeMatch = await StrickerMatch.findOne({
      $or: [
        { 'players.user': req.user._id },
        { team1Squad: challengerSquad._id },
        { team2Squad: challengerSquad._id }
      ],
      mode: mode,
      format: format,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress', 'disputed'] }
    });
    
    if (activeMatch) {
      const isDisputed = activeMatch.status === 'disputed';
      return res.status(400).json({ 
        success: false, 
        message: isDisputed
          ? 'Vous avez un match en litige en attente d\'arbitrage. Vous ne pouvez pas lancer de nouveau match.'
          : 'Vous avez déjà un match en cours'
      });
    }
    
    // 2-hour cooldown check - can't challenge same team twice within 2 hours (per format)
    const REMATCH_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
    const cooldownCutoff = new Date(Date.now() - REMATCH_COOLDOWN_MS);
    
    const recentMatchWithTarget = await StrickerMatch.findOne({
      $or: [
        { team1Squad: challengerSquadId, team2Squad: targetSquadId },
        { team1Squad: targetSquadId, team2Squad: challengerSquadId }
      ],
      format: format,
      status: 'completed',
      completedAt: { $gte: cooldownCutoff }
    }).select('completedAt').lean();
    
    if (recentMatchWithTarget) {
      const cooldownEnd = new Date(recentMatchWithTarget.completedAt).getTime() + REMATCH_COOLDOWN_MS;
      const remainingMs = cooldownEnd - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      
      return res.status(400).json({ 
        success: false, 
        message: `Vous devez attendre ${hours}h${minutes.toString().padStart(2, '0')} avant de pouvoir rejouer contre cette équipe.`,
        cooldownEndsAt: cooldownEnd,
        cooldownRemaining: remainingMs
      });
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
      // Double-check target is still in queue (mode and format specific)
      const targetStillInQueue = formatQueue.find(p => p.squadId === targetSquadId && p.mode === mode);
      if (!targetStillInQueue) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cette escouade n\'est plus en recherche de match' 
        });
      }
      
      
      // Get ALL stricker maps for ban phase (filtered by format)
      let maps = await Map.find({
        isActive: true,
        'strickerConfig.ranked.enabled': true,
        'strickerConfig.ranked.formats': format
      });
      
      // For 5v5 only: Fallback to legacy maps without formats array
      if (maps.length === 0 && format === '5v5') {
        maps = await Map.find({
          isActive: true,
          'strickerConfig.ranked.enabled': true,
          $or: [
            { 'strickerConfig.ranked.formats': { $exists: false } },
            { 'strickerConfig.ranked.formats': { $size: 0 } }
          ]
        });
      }
      
      // Final fallback for 5v5: regular S&D maps (legacy support)
      if (maps.length === 0 && format === '5v5') {
        maps = await Map.find({
          isActive: true,
          'rankedConfig.searchAndDestroy.enabled': true
        });
      }
      
      // Note: For 3v3, no fallback - maps must be explicitly configured
      
      // Get format-specific stats for players
      const userStats = user[statsField] || { points: 0 };
      
      // Create the match
      const match = new StrickerMatch({
        gameMode: 'Search & Destroy',
        mode: mode, // hardcore or cdl
        format: format, // 3v3 or 5v5
        teamSize: teamSize,
        players: [
          {
            user: req.user._id,
            username: user.username,
            rank: getStrickerRank(userStats.points || 0),
            points: userStats.points || 0,
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
      
      
      // Remove both squads from format-specific queue
      for (let i = formatQueue.length - 1; i >= 0; i--) {
        if (formatQueue[i].squadId === challengerSquadId || formatQueue[i].squadId === targetSquadId) {
          formatQueue.splice(i, 1);
        }
      }
      
      // Emit socket event to notify both teams
      const io = req.app.get('io');
      if (io) {
        io.to('stricker-mode').emit('strickerMatchCreated', {
          matchId: match._id,
          team1Squad: challengerSquad._id,
          team2Squad: targetEntry.squad?._id || targetSquadId,
          mode: mode,
          format: format
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
          team2Squad: { name: targetEntry.squadName, tag: targetEntry.squadTag },
          format: format,
          teamSize: teamSize
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
    const mode = req.body.mode || 'hardcore'; // Default to hardcore (valid enum: 'hardcore' or 'cdl')
    const format = req.body.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    
    // Get the format-specific queue
    const formatQueue = getQueueByFormat(format);
    
    const playerIndex = formatQueue.findIndex(p => p.odId === odId && p.mode === mode);
    if (playerIndex === -1) {
      return res.status(400).json({ success: false, message: 'Vous n\'êtes pas dans la file d\'attente' });
    }
    
    // Get squad info before removing
    const leavingEntry = formatQueue[playerIndex];
    const squadId = leavingEntry?.squadId;
    
    formatQueue.splice(playerIndex, 1);
    const modeQueue = formatQueue.filter(p => p.mode === mode);
    
    // Broadcast queue update to all users in stricker-mode room
    const io = req.app.get('io');
    if (io && squadId) {
      io.to('stricker-mode').emit('strickerQueueUpdate', {
        mode: mode,
        format: format,
        action: 'leave',
        squadId: squadId,
        queueSize: modeQueue.length
      });
    }
    
    res.json({
      success: true,
      message: 'Vous avez quitté la file d\'attente',
      queueSize: modeQueue.length,
      format: format
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
      mode: 'hardcore', // Default to hardcore (valid enum: 'hardcore' or 'cdl')
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
    
    // Add prevention warning message to chat
    match.chat.push({
      isSystem: true,
      messageType: 'warning',
      message: '⚠️ Tout comportement toxique ou insultant sera sévèrement sanctionné. Restez fair-play !'
    });
    
    await match.save();
    
    
    // Remove both squad entries from queue
    const matchedSquadIds = [team1Entry.squadId, team2Entry.squadId];
    for (let i = strickerQueue.length - 1; i >= 0; i--) {
      if (matchedSquadIds.includes(strickerQueue[i].squadId)) {
        strickerQueue.splice(i, 1);
      }
    }
    
    
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
    const format = req.query.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    const statsField = getStatsFieldByFormat(format);
    
    // Get user's squad
    const userSquadId = req.user?.squadStricker?.toString();
    
    // Check cache first (keyed by format and existence of userSquadId to handle position lookup)
    const cacheKey = `stricker-leaderboard-squads-${format}`;
    const cached = getStrickerCached(cacheKey);
    
    if (cached) {
      // Reuse cached leaderboard, just find user's squad position
      let userSquad = null;
      if (userSquadId) {
        const userSquadIndex = cached.allSquads.findIndex(s => s._id.toString() === userSquadId);
        if (userSquadIndex >= 15) {
          userSquad = cached.allSquads[userSquadIndex];
        }
      }
      return res.json({
        success: true,
        top15: cached.allSquads.slice(0, 15),
        userSquad,
        totalSquads: cached.allSquads.length,
        format: format
      });
    }
    
    // Build dynamic match and project stages based on format
    // For 3v3, we need to ensure only squads with ACTUAL 3v3 activity are shown
    // (not squads that just have default 0 values from schema)
    const matchCondition = {
      isDeleted: { $ne: true }
    };
    
    // Get all squads and filter by actual format-specific activity
    const allSquads = await Squad.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          strickerPoints: { $ifNull: [`$${statsField}.points`, 0] },
          strickerWins: { $ifNull: [`$${statsField}.wins`, 0] },
          strickerLosses: { $ifNull: [`$${statsField}.losses`, 0] },
          // Calculate total activity to filter out squads with no activity
          totalActivity: {
            $add: [
              { $ifNull: [`$${statsField}.points`, 0] },
              { $ifNull: [`$${statsField}.wins`, 0] },
              { $ifNull: [`$${statsField}.losses`, 0] }
            ]
          }
        }
      },
      // CRITICAL: Only include squads with actual activity in this format
      // This filters out squads that have never played in this format
      {
        $match: {
          totalActivity: { $gt: 0 }
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
          stats: `$${statsField}`,
          strickerPoints: 1,
          strickerWins: 1,
          strickerLosses: 1,
          memberCount: { $size: '$members' },
          leader: { $arrayElemAt: ['$leaderInfo.username', 0] }
        }
      }
    ]);
    
    
    // Add positions to all squads
    const allSquadsWithPosition = allSquads.map((squad, index) => ({
      ...squad,
      position: index + 1,
      rank: getStrickerRank(squad.stats?.points || squad.strickerPoints || 0),
      rankImage: STRICKER_RANKS[getStrickerRank(squad.stats?.points || squad.strickerPoints || 0)]?.image
    }));
    
    // Cache the full leaderboard
    setStrickerCache(cacheKey, { allSquads: allSquadsWithPosition });
    
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
      totalSquads: allSquads.length,
      format: format
    });
  } catch (error) {
    console.error('Stricker squad leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get top 100 squad leaderboard for stricker mode
router.get('/leaderboard/squads/top100', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const format = req.query.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    const statsField = getStatsFieldByFormat(format);
    
    // Check cache first
    const cacheKey = `stricker-top100-squads-${format}`;
    const cached = getStrickerCached(cacheKey);
    if (cached) return res.json(cached);
    
    // Build dynamic match condition based on format
    // For 3v3, we need to ensure only squads with ACTUAL 3v3 activity are shown
    const matchCondition = {
      isDeleted: { $ne: true }
    };
    
    // Get all squads with format-specific stricker stats sorted by points
    const top100Squads = await Squad.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          strickerPoints: { $ifNull: [`$${statsField}.points`, 0] },
          strickerWins: { $ifNull: [`$${statsField}.wins`, 0] },
          strickerLosses: { $ifNull: [`$${statsField}.losses`, 0] },
          // Calculate total activity to filter out squads with no activity
          totalActivity: {
            $add: [
              { $ifNull: [`$${statsField}.points`, 0] },
              { $ifNull: [`$${statsField}.wins`, 0] },
              { $ifNull: [`$${statsField}.losses`, 0] }
            ]
          }
        }
      },
      // CRITICAL: Only include squads with actual activity in this format
      {
        $match: {
          totalActivity: { $gt: 0 }
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
          stats: `$${statsField}`,
          strickerPoints: 1,
          strickerWins: 1,
          strickerLosses: 1,
          memberCount: { $size: '$members' },
          leader: { $arrayElemAt: ['$leaderInfo.username', 0] }
        }
      }
    ]);
    
    
    // Add positions and rank info
    const top100WithPosition = top100Squads.map((squad, index) => ({
      ...squad,
      position: index + 1,
      rank: getStrickerRank(squad.stats?.points || squad.strickerPoints || 0),
      rankImage: STRICKER_RANKS[getStrickerRank(squad.stats?.points || squad.strickerPoints || 0)]?.image
    }));
    
    const result = {
      success: true,
      squads: top100WithPosition,
      total: top100Squads.length,
      format: format
    };
    setStrickerCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Stricker top 100 error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== USER RANKING ====================

// Get current user's stricker ranking
router.get('/my-ranking', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { format = '5v5' } = req.query;
    
    // Populate both stats fields for format-specific data
    const user = await User.findById(req.user._id)
      .populate('squadStricker', 'name tag logo statsStricker statsStricker3v3 cranes');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Get format-specific user stats
    // 3v3 uses statsStricker3v3, 5v5 uses legacy statsStricker for backward compatibility
    const userStatsField = format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
    const stats = user[userStatsField] || { points: 0, wins: 0, losses: 0, xp: 0 };
    const rank = getStrickerRank(stats.points);
    const rankInfo = STRICKER_RANKS[rank];
    
    // Get format-specific squad stats
    // 5v5 uses legacy 'statsStricker' for backward compatibility
    const squadStatsField = format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
    const squadStats = user.squadStricker?.[squadStatsField] || { points: 0, wins: 0, losses: 0 };
    
    // Get user's position in squad leaderboard (format-specific)
    let squadPosition = null;
    if (user.squadStricker) {
      const pointsField = format === '3v3' ? 'statsStricker3v3.points' : 'statsStricker.points';
      const higherSquads = await Squad.countDocuments({
        isDeleted: { $ne: true },
        [pointsField]: { $gt: squadStats.points || 0 }
      });
      squadPosition = higherSquads + 1;
    }
    
    res.json({
      success: true,
      ranking: {
        odId: user._id,
        username: user.username,
        points: stats.points || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        xp: stats.xp || 0,
        rank: rank,
        rankName: rankInfo.name,
        rankImage: rankInfo.image,
        nextRank: rank !== 'immortel' ? Object.keys(STRICKER_RANKS)[Object.keys(STRICKER_RANKS).indexOf(rank) + 1] : null,
        pointsToNextRank: rankInfo.max ? rankInfo.max - (stats.points || 0) + 1 : null,
        squad: user.squadStricker ? {
          _id: user.squadStricker._id,
          name: user.squadStricker.name,
          tag: user.squadStricker.tag,
          logo: user.squadStricker.logo,
          points: squadStats.points || 0,
          wins: squadStats.wins || 0,
          losses: squadStats.losses || 0,
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
        select: 'username avatar avatarUrl discordAvatar discordId activisionId platform equippedTitle irisLastSeen',
        populate: {
          path: 'equippedTitle',
          select: 'name nameTranslations color rarity'
        }
      })
      .populate('players.squad', 'name tag logo')
      .populate('team1Squad', 'name tag logo members statsStricker')
      .populate('team2Squad', 'name tag logo members statsStricker')
      .populate('team1Referent', 'username avatar avatarUrl')
      .populate('team2Referent', 'username avatar avatarUrl')
      .populate('chat.user', 'username roles')
      .populate('mvp.player', 'username avatar avatarUrl discordAvatar discordId')
      .populate('mvp.votes.voter', 'username')
      .populate('mvp.votes.votedFor', 'username avatar avatarUrl discordAvatar discordId');
    
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
            select: 'username avatar avatarUrl discordAvatar discordId statsStricker equippedTitle platform',
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
          // Include platform and check Iris connection status for PC players
          const membersToCheck = mySquad.members
            .filter(m => m.user && !selectedPlayerIds.includes(m.user._id?.toString()));
          
          // Get full user data with irisLastSeen for PC players
          const memberUserIds = membersToCheck.map(m => m.user._id);
          const usersWithIris = await User.find({ _id: { $in: memberUserIds } })
            .select('_id username platform irisLastSeen')
            .lean();
          
          // Build a map of userId -> { platform, irisConnected }
          // Use data from this query to ensure consistency
          const userDataMap = new Map();
          const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
          console.log('[DEBUG IRIS] Checking roster members iris status, threeMinutesAgo:', threeMinutesAgo);
          usersWithIris.forEach(u => {
            const platform = u.platform;
            let irisConnected = null;
            if (platform === 'PC') {
              const lastSeen = u.irisLastSeen ? new Date(u.irisLastSeen) : null;
              irisConnected = !!(lastSeen && lastSeen > threeMinutesAgo);
              console.log(`[DEBUG IRIS] User ${u.username}: platform=${platform}, irisLastSeen=${u.irisLastSeen}, lastSeen=${lastSeen}, threeMinutesAgo=${threeMinutesAgo}, isConnected=${irisConnected}`);
            } else {
              console.log(`[DEBUG IRIS] User ${u.username}: platform=${platform} (not PC, irisConnected=null)`);
            }
            userDataMap.set(u._id.toString(), { platform, irisConnected });
          });
          
          // Build available members list
          availableMembers = membersToCheck.map(m => {
            const userId = m.user._id.toString();
            const userData = userDataMap.get(userId);
            // Use platform from fresh query, fallback to populated data
            const platform = userData?.platform || m.user.platform;
            const irisConnected = userData?.irisConnected ?? (platform === 'PC' ? false : null);
            
            return {
              _id: m.user._id,
              username: m.user.username,
              avatarUrl: m.user.avatarUrl,
              discordAvatar: m.user.discordAvatar,
              discordId: m.user.discordId,
              strickerPoints: m.user.statsStricker?.points || 0,
              role: m.role,
              equippedTitle: m.user.equippedTitle,
              platform: platform,
              irisConnected: irisConnected
            };
          });
        }
      }
    }
    
    // Check if team has a helper
    const team1HasHelper = match.players.some(p => p.team === 1 && p.isHelper);
    const team2HasHelper = match.players.some(p => p.team === 2 && p.isHelper);
    
    res.json({
      success: true,
      match,
      myTeam,
      isReferent,
      availableMembers,
      mySquad: mySquad ? { _id: mySquad._id, name: mySquad.name, tag: mySquad.tag, logo: mySquad.logo } : null,
      team1HasHelper,
      team2HasHelper
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
      status: { $in: ['pending', 'ready', 'in_progress', 'disputed'] }
    })
    .populate('players.user', 'username avatar avatarUrl discordAvatar discordId platform irisLastSeen')
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
    const memberUser = await User.findById(memberId).select('_id username avatarUrl discordAvatar discordId platform statsStricker activisionId irisLastSeen');
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
    
    // Iris check for PC players
    if (memberUser.platform === 'PC') {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const isIrisConnected = memberUser.irisLastSeen && new Date(memberUser.irisLastSeen) > threeMinutesAgo;
      
      if (!isIrisConnected) {
        return res.status(400).json({ 
          success: false, 
          message: `${memberUser.username} n'est pas connecté à Iris. Les joueurs PC doivent être connectés à Iris pour jouer.`
        });
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
    
    // Switch turns or complete roster selection (based on match format)
    const requiredSize = match.teamSize || 5; // 3 for 3v3, 5 for 5v5
    if (team1Count >= requiredSize && team2Count >= requiredSize) {
      // Both teams have required players, roster selection complete
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

// Search users to add as helper for stricker match
router.get('/match/:matchId/roster/search-helper', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ success: false, message: 'La recherche doit contenir au moins 2 caractères' });
    }
    
    const match = await StrickerMatch.findById(matchId)
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
      return res.status(403).json({ success: false, message: 'Seul le référent peut rechercher des aides' });
    }
    
    const myTeam = isTeam1Referent ? 1 : 2;
    
    // Check if team already has a helper
    const hasHelper = match.players.some(p => p.team === myTeam && p.isHelper);
    if (hasHelper) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà sélectionné une aide pour ce match' });
    }
    
    // Get IDs of players already in the match
    const playersInMatch = match.players.map(p => p.user?.toString()).filter(Boolean);
    
    // Search for users matching the query (not already in match, not banned, not the opponent squad members)
    const users = await User.find({
      _id: { $nin: playersInMatch.map(id => new mongoose.Types.ObjectId(id)) },
      username: { $regex: query, $options: 'i' },
      isBanned: { $ne: true }
    })
    .select('_id username avatarUrl discordAvatar discordId platform statsStricker equippedTitle irisLastSeen')
    .limit(10)
    .lean();
    
    // Check if each user is currently in an active Stricker match
    const userIds = users.map(u => u._id);
    const activeMatches = await StrickerMatch.find({
      'players.user': { $in: userIds },
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress', 'disputed'] }
    }).select('players.user').lean();
    
    // Build a Set of user IDs that are in active matches
    const usersInActiveMatch = new Set();
    activeMatches.forEach(m => {
      m.players.forEach(p => {
        if (p.user) {
          usersInActiveMatch.add(p.user.toString());
        }
      });
    });
    
    // Calculate Iris connection status for PC players
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    res.json({
      success: true,
      users: users.map(u => ({
        _id: u._id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        discordAvatar: u.discordAvatar,
        discordId: u.discordId,
        platform: u.platform,
        strickerPoints: u.statsStricker?.points || 0,
        equippedTitle: u.equippedTitle,
        inActiveMatch: usersInActiveMatch.has(u._id.toString()),
        irisConnected: u.platform === 'PC' ? (u.irisLastSeen && new Date(u.irisLastSeen) > threeMinutesAgo) : null
      }))
    });
  } catch (error) {
    console.error('Stricker helper search error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Select a helper player for stricker match
router.post('/match/:matchId/roster/select-helper', verifyToken, checkStrickerAccess, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { helperId } = req.body;
    
    if (!helperId) {
      return res.status(400).json({ success: false, message: 'Aide non spécifié' });
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
      return res.status(403).json({ success: false, message: 'Seul le référent peut sélectionner des aides' });
    }
    
    const myTeam = isTeam1Referent ? 1 : 2;
    
    // Check if this team already has 5 players
    const myTeamCount = match.players.filter(p => p.team === myTeam).length;
    if (myTeamCount >= 5) {
      return res.status(400).json({ success: false, message: 'Votre équipe est déjà complète (5 joueurs)' });
    }
    
    // Check if team already has a helper
    const hasHelper = match.players.some(p => p.team === myTeam && p.isHelper);
    if (hasHelper) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà sélectionné une aide pour ce match. Une seule aide est autorisée.' });
    }
    
    // Get the helper user
    const helperUser = await User.findById(helperId).select('_id username avatarUrl discordAvatar discordId platform statsStricker activisionId equippedTitle irisLastSeen');
    if (!helperUser) {
      return res.status(404).json({ success: false, message: 'Joueur non trouvé' });
    }
    
    // Check if helper is already in the match
    const alreadySelected = match.players.some(p => 
      p.user?.toString() === helperId || p.user?._id?.toString() === helperId
    );
    
    if (alreadySelected) {
      return res.status(400).json({ success: false, message: 'Ce joueur est déjà dans le match' });
    }
    
    // Check if helper is currently in an active Stricker match (different from this one)
    const helperActiveMatch = await StrickerMatch.findOne({
      _id: { $ne: matchId },
      'players.user': helperId,
      status: { $in: ['pending', 'ready', 'roster_selection', 'map_vote', 'in_progress', 'disputed'] }
    }).lean();
    
    if (helperActiveMatch) {
      return res.status(400).json({ 
        success: false, 
        message: `${helperUser.username} est actuellement en match et ne peut pas être sélectionné comme aide.`
      });
    }
    
    // Iris check for PC players
    if (helperUser.platform === 'PC') {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const isIrisConnected = helperUser.irisLastSeen && new Date(helperUser.irisLastSeen) > threeMinutesAgo;
      
      if (!isIrisConnected) {
        return res.status(400).json({ 
          success: false, 
          message: `${helperUser.username} n'est pas connecté à Iris. Les joueurs PC doivent être connectés à Iris pour jouer.`
        });
      }
    }
    
    // Add helper to the match
    const mySquad = myTeam === 1 ? match.team1Squad : match.team2Squad;
    const newPlayer = {
      user: helperUser._id,
      username: helperUser.username,
      rank: getStrickerRank(helperUser.statsStricker?.points || 0),
      points: helperUser.statsStricker?.points || 0,
      team: myTeam,
      squad: mySquad?._id || null, // Helper may not be in the squad but gets associated for rewards
      isReferent: false,
      isHelper: true
    };
    
    match.players.push(newPlayer);
    
    // Count players per team
    const team1Count = match.players.filter(p => p.team === 1).length;
    const team2Count = match.players.filter(p => p.team === 2).length;
    
    // Switch turns or complete roster selection (based on match format)
    const requiredSize = match.teamSize || 5; // 3 for 3v3, 5 for 5v5
    if (team1Count >= requiredSize && team2Count >= requiredSize) {
      match.rosterSelection.isActive = false;
      
      const io = req.app.get('io');
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerRosterComplete', {
          matchId,
          mapVoteOptions: match.mapVoteOptions
        });
      }
    } else {
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
      message: 'Aide ajoutée au roster',
      player: newPlayer,
      team1Count: match.players.filter(p => p.team === 1).length,
      team2Count: match.players.filter(p => p.team === 2).length,
      rosterComplete: !match.rosterSelection.isActive
    });
  } catch (error) {
    console.error('Stricker helper select error:', error);
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
      
      // Shuffle remaining maps and select up to 3 for tiebreaker
      // (in case some maps have already been played by teams)
      const shuffled = [...remainingMaps].sort(() => Math.random() - 0.5);
      const randomMaps = shuffled.slice(0, Math.min(3, shuffled.length)).map(m => ({
        name: m.name,
        image: m.image
      }));
      
      // Set free map choice with random maps generated
      match.freeMapChoice = true;
      match.randomMaps = randomMaps;
      match.randomMap = null; // Deprecated, use randomMaps instead
      match.selectedMap = null;
      match.maps = [];
      match.status = 'ready';
      
      // IMPORTANT: Save BEFORE emitting socket so data is ready when clients fetch
      await match.save();
      
      // Emit socket event for bans complete - free map choice with random maps
      if (io) {
        io.to(`stricker-match-${matchId}`).emit('strickerMapSelected', {
          matchId,
          freeMapChoice: true,
          randomMaps: match.randomMaps,
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
      freeMapChoice: bothBanned ? true : false,
      randomMaps: bothBanned ? match.randomMaps : null,
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
    const isMapBanPhase = match.status === 'pending' && !match.rosterSelection?.isActive && !match.selectedMap?.name && !match.freeMapChoice;
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
    // Ensure winner is a number for type consistency
    const winner = Number(req.body.winner); // 1 or 2
    
    if (!winner || ![1, 2].includes(winner)) {
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
        
        
        // Distribute rewards (no MVP system for Stricker)
        await distributeStrickerRewards(match);
      } else {
        // Disagreement - mark as disputed
        match.status = 'disputed';
        
        // Send Discord notification to arbitrators
        try {
          await discordBot.logStrickerDispute(match);
        } catch (discordError) {
          console.error('[STRICKER] Error sending Discord dispute notification:', discordError);
          // Don't fail the request if Discord notification fails
        }
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

// Get player's stricker rank key based on points
function getStrickerRankKey(points) {
  if (points >= 1500) return 'immortel';
  if (points >= 1000) return 'seigneurs';
  if (points >= 750) return 'commandants';
  if (points >= 500) return 'veterans';
  if (points >= 250) return 'operateurs';
  return 'recrues';
}

// Get points loss based on player's current rank (HARDCODED - ignores config)
function getPointsLossForRank(points, pointsLossConfig = null) {
  const rankKey = getStrickerRankKey(points);
  
  // STRICKER MODE: Point loss is HARDCODED based on rank (ignores config)
  // Recrues: -15, Opérateurs: -20, Vétérans: -25, Commandants: -30, Seigneurs: -40, Immortel: -50
  return STRICKER_RANK_POINTS[rankKey]?.pointsLoss || -15;
}

// Distribute rewards for stricker match
async function distributeStrickerRewards(match) {
  try {
    // Prevent double distribution
    if (match.rewardsDistributed) {
      return;
    }
    
    
    // Load config for rewards
    const config = await Config.getOrCreate();
    const rewardsConfig = config.strickerMatchRewards?.['Search & Destroy'] || {};
    const pointsLossConfig = config.strickerPointsLossPerRank || {};
    
    // Get format-specific stats field from match
    const format = match.format || '5v5';
    const statsField = getStatsFieldByFormat(format);
    
    // IMPORTANT: Ensure winningTeam is a Number to avoid type comparison issues
    const winningTeam = Number(match.result.winner);
    
    // STRICKER MODE: Victory is ALWAYS +30 pts (hardcoded, ignores config)
    const POINTS_WIN = 30;
    
    // Stricker mode: NO gold rewards, NO XP rewards
    // Only: Points (+30 win, -X loss based on rank) and Munitions (+50 win, +25 loss consolation)
    
    // Munitions rewards - Winners get 50, losers get 25 (consolation)
    const CRANES_WIN = 50;
    const CRANES_LOSS = 25;
    
    // Top Squad (general ranking) points - Win: +30, Loss: -15 (never below 0)
    const TOP_SQUAD_POINTS_WIN = 30;
    const TOP_SQUAD_POINTS_LOSS = 15;
    const squadsAwarded = {}; // { squadId: { cranes, pointsChange, topSquadPointsChange } } to track rewards per squad
    
    let processedPlayers = 0;
    let skippedFake = 0;
    let skippedNoUser = 0;
    let skippedUserNotFound = 0;
    
    // Process each player
    for (const player of match.players) {
      if (player.isFake) {
        skippedFake++;
        continue;
      }
      
      if (!player.user) {
        skippedNoUser++;
        continue;
      }
      
      const user = await User.findById(player.user);
      if (!user) {
        skippedUserNotFound++;
        continue;
      }
      
      processedPlayers++;
      // IMPORTANT: Use Number() for comparison to avoid type mismatch
      const isWinner = Number(player.team) === winningTeam;
      
      // Initialize format-specific stats if not exists
      if (!user[statsField]) user[statsField] = { points: 0, wins: 0, losses: 0, xp: 0 };
      
      const oldPoints = user[statsField].points || 0;
      
      // Calculate points change based on rank
      // Winners get +30 pts, losers lose based on their current rank
      const pointsChange = isWinner ? POINTS_WIN : getPointsLossForRank(oldPoints, pointsLossConfig);
      
      user[statsField].points = Math.max(0, oldPoints + pointsChange);
      
      // NO gold rewards in Stricker mode
      const goldEarned = 0;
      
      // NO XP rewards in Stricker mode
      const xpEarned = 0;
      
      if (isWinner) {
        user[statsField].wins = (user[statsField].wins || 0) + 1;
      } else {
        user[statsField].losses = (user[statsField].losses || 0) + 1;
      }
      
      await user.save();
      
      
      // Update squad stats if player has a squad
      let cranesAwarded = 0;
      if (player.squad) {
        const squadId = player.squad.toString();
        
        // Check if this squad was already processed
        if (squadId in squadsAwarded) {
          // Squad already processed, just get the cranes value that was awarded
          cranesAwarded = squadsAwarded[squadId].cranes;
        } else {
          // First player from this squad - process squad stats
          const squad = await Squad.findById(player.squad);
          if (squad) {
            // Initialize format-specific stats if not exists
            if (!squad[statsField]) squad[statsField] = { points: 0, wins: 0, losses: 0 };
            
            const oldSquadPoints = squad[statsField].points || 0;
            const squadPointsChange = isWinner ? POINTS_WIN : getPointsLossForRank(oldSquadPoints, pointsLossConfig);
            
            squad[statsField].points = Math.max(0, oldSquadPoints + squadPointsChange);
            
            if (isWinner) {
              squad[statsField].wins = (squad[statsField].wins || 0) + 1;
            } else {
              squad[statsField].losses = (squad[statsField].losses || 0) + 1;
            }
            
            // Award munitions
            // Winners get 50 munitions, losers get 25 munitions (consolation)
            const cranesReward = isWinner ? CRANES_WIN : CRANES_LOSS;
            squad.cranes = (squad.cranes || 0) + cranesReward;
            
            // Update Top Squad general ranking (statsHardcore.totalPoints)
            if (!squad.statsHardcore) squad.statsHardcore = { totalWins: 0, totalLosses: 0, totalPoints: 0 };
            const oldTopSquadPoints = squad.statsHardcore.totalPoints || 0;
            let topSquadPointsChange;
            if (isWinner) {
              topSquadPointsChange = TOP_SQUAD_POINTS_WIN;
              squad.statsHardcore.totalPoints = oldTopSquadPoints + topSquadPointsChange;
            } else {
              topSquadPointsChange = -Math.min(TOP_SQUAD_POINTS_LOSS, oldTopSquadPoints); // Never go below 0
              squad.statsHardcore.totalPoints = Math.max(0, oldTopSquadPoints - TOP_SQUAD_POINTS_LOSS);
            }
            
            squadsAwarded[squadId] = { cranes: cranesReward, pointsChange: squadPointsChange, topSquadPointsChange }; // Store values for other players
            cranesAwarded = cranesReward;
            
            
            await squad.save();
          } else {
            console.warn(`[STRICKER] Squad ${squadId} not found for player ${user.username}`);
          }
        }
      }
      
      // Store all rewards in match player data
      const topSquadPtsChange = player.squad ? (squadsAwarded[player.squad.toString()]?.topSquadPointsChange || 0) : 0;
      player.rewards = {
        pointsChange,
        oldPoints,
        newPoints: user[statsField].points,
        goldEarned: 0,
        xpEarned: 0,
        cranesEarned: cranesAwarded,
        topSquadPointsChange: topSquadPtsChange,
        format: format
      };
      
    }
    
    
    match.rewardsDistributed = true;
    match.markModified('players');
    await match.save();
    
  } catch (error) {
    console.error('[STRICKER REWARDS] ERROR during distribution:', error);
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
    const format = req.query.format || '5v5'; // Default to 5v5 (valid: '3v3' or '5v5')
    
    // Find maps with format-specific filter
    // Maps must have the format in their strickerConfig.ranked.formats array
    let maps = await Map.find({
      isActive: true,
      'strickerConfig.ranked.enabled': true,
      'strickerConfig.ranked.formats': format
    }).select('name image strickerConfig');
    
    // If no format-specific maps found AND looking for 5v5, try legacy maps without formats array
    // (for backward compatibility with maps that don't have formats configured yet)
    if (maps.length === 0 && format === '5v5') {
      maps = await Map.find({
        isActive: true,
        'strickerConfig.ranked.enabled': true,
        'strickerConfig.ranked.formats': { $exists: false }
      }).select('name image strickerConfig');
      
      // If still no maps, try maps that have empty formats array
      if (maps.length === 0) {
        maps = await Map.find({
          isActive: true,
          'strickerConfig.ranked.enabled': true,
          'strickerConfig.ranked.formats': { $size: 0 }
        }).select('name image strickerConfig');
      }
    }
    
    // Note: For 3v3, NO fallback - maps must be explicitly configured for 3v3
    
    res.json({
      success: true,
      maps,
      format: format,
      teamSize: getTeamSizeByFormat(format),
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
      winner: { $exists: true, $ne: null } // Must have a winner
    })
    .populate('team1Squad', 'name tag logo')
    .populate('team2Squad', 'name tag logo')
    .sort({ completedAt: -1 })
    .limit(Math.min(parseInt(limit), 50));
    
    // Additional filter for safety
    const validMatches = matches.filter(match => {
      return match.status === 'completed' && match.winner;
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
    .populate('players.user', 'username avatar avatarUrl')
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

// Get squad Stricker match history (public)
router.get('/history/squad/:squadId', async (req, res) => {
  try {
    const { squadId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {
      $or: [
        { team1Squad: squadId },
        { team2Squad: squadId }
      ],
      status: 'completed',
      isTestMatch: { $ne: true },
      winner: { $exists: true, $ne: null }
    };
    
    const matches = await StrickerMatch.find(query)
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo')
      .populate('players.user', 'username avatar avatarUrl discordAvatar discordId')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await StrickerMatch.countDocuments(query);
    
    // Format matches with win/loss info for the squad
    const formattedMatches = matches.map(match => {
      const isTeam1 = match.team1Squad?._id?.toString() === squadId;
      const squadTeam = isTeam1 ? 1 : 2;
      const isWinner = match.winner === squadTeam;
      const opponentSquad = isTeam1 ? match.team2Squad : match.team1Squad;
      
      return {
        ...match,
        squadTeam,
        isWinner,
        opponentSquad
      };
    });
    
    res.json({
      success: true,
      matches: formattedMatches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Squad stricker history error:', error);
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
      .populate('players.user', 'username avatar avatarUrl')
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
        
        // IMPORTANT: Use Number() for type-safe comparison
        const isWinner = Number(player.team) === Number(match.winner);
        
        // Refund stricker points
        if (isWinner) {
          user.statsStricker = user.statsStricker || {};
          user.statsStricker.points = Math.max(0, (user.statsStricker.points || 0) - (rewards.pointsWin || 30));
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
      // Winners had 50 munitions, losers had 25 munitions
      const CRANES_WIN = 50;
      const CRANES_LOSS = 25;
      // Top Squad refund amounts
      const TOP_SQUAD_POINTS_WIN = 30;
      const TOP_SQUAD_POINTS_LOSS = 15;
      
      if (match.team1Squad) {
        const squad1 = await Squad.findById(match.team1Squad._id);
        if (squad1) {
          squad1.statsStricker = squad1.statsStricker || {};
          if (!squad1.statsHardcore) squad1.statsHardcore = { totalWins: 0, totalLosses: 0, totalPoints: 0 };
          if (match.winner === 1) {
            squad1.statsStricker.wins = Math.max(0, (squad1.statsStricker.wins || 0) - 1);
            squad1.statsStricker.points = Math.max(0, (squad1.statsStricker.points || 0) - (rewards.pointsWin || 30));
            // Refund winner munitions
            squad1.cranes = Math.max(0, (squad1.cranes || 0) - CRANES_WIN);
            // Refund top squad points (winner had +30)
            squad1.statsHardcore.totalPoints = Math.max(0, (squad1.statsHardcore.totalPoints || 0) - TOP_SQUAD_POINTS_WIN);
          } else {
            squad1.statsStricker.losses = Math.max(0, (squad1.statsStricker.losses || 0) - 1);
            squad1.statsStricker.points = Math.max(0, (squad1.statsStricker.points || 0) + Math.abs(rewards.pointsLoss || 18));
            // Refund loser munitions
            squad1.cranes = Math.max(0, (squad1.cranes || 0) - CRANES_LOSS);
            // Refund top squad points (loser had -15, so give back up to 15)
            squad1.statsHardcore.totalPoints = (squad1.statsHardcore.totalPoints || 0) + TOP_SQUAD_POINTS_LOSS;
          }
          await squad1.save();
        }
      }
      
      if (match.team2Squad) {
        const squad2 = await Squad.findById(match.team2Squad._id);
        if (squad2) {
          squad2.statsStricker = squad2.statsStricker || {};
          if (!squad2.statsHardcore) squad2.statsHardcore = { totalWins: 0, totalLosses: 0, totalPoints: 0 };
          if (match.winner === 2) {
            squad2.statsStricker.wins = Math.max(0, (squad2.statsStricker.wins || 0) - 1);
            squad2.statsStricker.points = Math.max(0, (squad2.statsStricker.points || 0) - (rewards.pointsWin || 30));
            // Refund winner munitions
            squad2.cranes = Math.max(0, (squad2.cranes || 0) - CRANES_WIN);
            // Refund top squad points (winner had +30)
            squad2.statsHardcore.totalPoints = Math.max(0, (squad2.statsHardcore.totalPoints || 0) - TOP_SQUAD_POINTS_WIN);
          } else {
            squad2.statsStricker.losses = Math.max(0, (squad2.statsStricker.losses || 0) - 1);
            squad2.statsStricker.points = Math.max(0, (squad2.statsStricker.points || 0) + Math.abs(rewards.pointsLoss || 18));
            // Refund loser munitions
            squad2.cranes = Math.max(0, (squad2.cranes || 0) - CRANES_LOSS);
            // Refund top squad points (loser had -15, so give back up to 15)
            squad2.statsHardcore.totalPoints = (squad2.statsHardcore.totalPoints || 0) + TOP_SQUAD_POINTS_LOSS;
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
    
    // Emit socket event so match sheet updates in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`stricker-match-${matchId}`).emit('strickerMatchUpdate', { matchId });
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

// Force winner for stricker match (admin/staff/arbitre only) - triggers reward distribution
router.post('/admin/match/:matchId/force-winner', verifyToken, requireArbitre, async (req, res) => {
  try {
    const { matchId } = req.params;
    // Ensure winner is a number (fix type comparison issues)
    const winner = Number(req.body.winner);
    
    if (!winner || ![1, 2].includes(winner)) {
      return res.status(400).json({ success: false, message: 'Gagnant invalide (1 ou 2)' });
    }
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'name tag logo')
      .populate('team2Squad', 'name tag logo');
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match non trouvé' });
    }
    
    // Prevent forcing if rewards were already distributed
    const alreadyRewarded = match.rewardsDistributed || match.players?.some(p => p.rewards);
    if (match.status === 'completed' && match.result?.confirmed && alreadyRewarded) {
      return res.status(400).json({ success: false, message: 'Match déjà terminé avec récompenses distribuées' });
    }
    
    // Set result
    if (!match.result) match.result = {};
    match.result.winner = winner;
    match.winner = winner;
    match.result.confirmed = true;
    match.result.confirmedAt = new Date();
    match.result.forcedBy = req.user._id;
    match.result.forcedAt = new Date();
    match.status = 'completed';
    match.completedAt = new Date();
    
    await match.save();
    
    
    // Distribute rewards
    try {
      await distributeStrickerRewards(match);
    } catch (rewardError) {
      console.error(`[STRICKER ADMIN] Error distributing rewards for match ${matchId}:`, rewardError);
    }
    
    // Add system message to chat
    match.chat.push({
      isSystem: true,
      messageType: 'admin_action',
      message: `⚡ Victoire forcée pour ${winner === 1 ? (match.team1Squad?.name || 'Équipe 1') : (match.team2Squad?.name || 'Équipe 2')} par un administrateur`
    });
    await match.save();
    
    // Emit socket event so match sheet updates in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`stricker-match-${matchId}`).emit('strickerMatchUpdate', { matchId });
      io.to(`stricker-match-${matchId}`).emit('strickerMatchCompleted', {
        matchId,
        winner,
        forced: true
      });
    }
    
    res.json({
      success: true,
      message: `Victoire forcée pour l'équipe ${winner}. Récompenses distribuées.`,
      match
    });
  } catch (error) {
    console.error('Admin force winner error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN: RESET ALL COOLDOWNS ====================
// Push completedAt back by 3 hours on all recent completed matches so the 2h cooldown no longer applies
router.post('/admin/reset-cooldowns', verifyToken, requireAdmin, async (req, res) => {
  try {
    const REMATCH_COOLDOWN_MS = 2 * 60 * 60 * 1000;
    const cooldownCutoff = new Date(Date.now() - REMATCH_COOLDOWN_MS);

    // Find all completed matches within the cooldown window
    const result = await StrickerMatch.updateMany(
      {
        status: 'completed',
        completedAt: { $gte: cooldownCutoff }
      },
      [
        {
          $set: {
            completedAt: {
              $subtract: ['$completedAt', 3 * 60 * 60 * 1000] // Push back 3 hours
            }
          }
        }
      ]
    );

    res.json({
      success: true,
      message: `Cooldowns réinitialisés. ${result.modifiedCount} match(s) affectés.`,
      matchesAffected: result.modifiedCount
    });
  } catch (error) {
    console.error('Admin reset cooldowns error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
