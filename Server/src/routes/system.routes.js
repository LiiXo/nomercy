import express from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import StrickerMatch from '../models/StrickerMatch.js';
import Ranking from '../models/Ranking.js';
import HubPost from '../models/HubPost.js';
import Announcement from '../models/Announcement.js';
import Purchase from '../models/Purchase.js';
import ItemUsage from '../models/ItemUsage.js';
import Season from '../models/Season.js';
import { deleteMatchVoiceChannels } from '../services/discordBot.service.js';
import { getAllQueueCounts } from '../services/casualMatchmaking.service.js';

const router = express.Router();

// Reset all system data (admin only)
router.post('/admin/reset-all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { confirmation } = req.body;
    
    // Verify confirmation
    if (confirmation !== 'RESET ALL') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation incorrecte'
      });
    }
    
    // Only admin can do this
    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    
    // Supprimer les salons vocaux Discord pour tous les matchs classés avant suppression
    const rankedMatchesWithVoice = await RankedMatch.find({
      $or: [
        { 'team1VoiceChannel.channelId': { $ne: null } },
        { 'team2VoiceChannel.channelId': { $ne: null } }
      ]
    }).select('team1VoiceChannel team2VoiceChannel');
    
    for (const match of rankedMatchesWithVoice) {
      if (match.team1VoiceChannel?.channelId || match.team2VoiceChannel?.channelId) {
        await deleteMatchVoiceChannels(match.team1VoiceChannel?.channelId, match.team2VoiceChannel?.channelId);
      }
    }
    
    // Delete ALL users including admins
    const deletedUsers = await User.deleteMany({});
    
    // Delete all squads
    const deletedSquads = await Squad.deleteMany({});
    
    // Delete all matches (both ladder and ranked)
    const deletedMatches = await Match.deleteMany({});
    
    const deletedRankedMatches = await RankedMatch.deleteMany({});
    
    // Delete all rankings
    const deletedRankings = await Ranking.deleteMany({});
    
    // Delete all hub posts
    const deletedHubPosts = await HubPost.deleteMany({});
    
    // Delete all announcements
    const deletedAnnouncements = await Announcement.deleteMany({});
    
    // Delete all purchases
    const deletedPurchases = await Purchase.deleteMany({});
    
    // Delete all item usages
    const deletedItemUsages = await ItemUsage.deleteMany({});
    
    // Delete all seasons
    const deletedSeasons = await Season.deleteMany({});
    
    
    res.json({
      success: true,
      message: 'Système réinitialisé avec succès',
      details: {
        users: deletedUsers.deletedCount,
        squads: deletedSquads.deletedCount,
        matches: deletedMatches.deletedCount,
        rankedMatches: deletedRankedMatches.deletedCount,
        rankings: deletedRankings.deletedCount,
        hubPosts: deletedHubPosts.deletedCount,
        announcements: deletedAnnouncements.deletedCount,
        purchases: deletedPurchases.deletedCount,
        itemUsages: deletedItemUsages.deletedCount,
        seasons: deletedSeasons.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ System reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du système'
    });
  }
});

// In-memory cache for site stats (refreshed every 30 seconds)
let cachedStats = null;
let lastStatsRefresh = 0;
const STATS_CACHE_TTL = 30000; // 30 seconds

// Online presence tracking
const onlineUsers = new Map(); // visitorId -> { lastSeen, authenticated }
const searchingUsers = new Map(); // visitorId -> { mode, lastSeen }
const ONLINE_TIMEOUT = 60000; // 60 seconds - consider user offline after this

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [visitorId, data] of onlineUsers.entries()) {
    if (now - data.lastSeen > ONLINE_TIMEOUT) {
      onlineUsers.delete(visitorId);
    }
  }
  for (const [visitorId, data] of searchingUsers.entries()) {
    if (now - data.lastSeen > ONLINE_TIMEOUT) {
      searchingUsers.delete(visitorId);
    }
  }
}, 30000);

// Get searching count per mode
const getSearchingCounts = () => {
  const counts = { ranked: 0, casual: 0, tournament: 0, custom: 0 };
  for (const [, data] of searchingUsers.entries()) {
    if (data.mode && counts.hasOwnProperty(data.mode)) {
      counts[data.mode]++;
    }
  }
  return counts;
};

// Heartbeat endpoint for presence tracking
router.post('/heartbeat', (req, res) => {
  const { visitorId, searching, mode } = req.body;
  if (!visitorId) {
    return res.status(400).json({ success: false });
  }
  
  onlineUsers.set(visitorId, {
    lastSeen: Date.now(),
    authenticated: !!req.user
  });

  // Track if user is searching
  if (searching && mode) {
    searchingUsers.set(visitorId, {
      mode,
      lastSeen: Date.now()
    });
  } else {
    searchingUsers.delete(visitorId);
  }
  
  // Get casual queue counts and format by modeId
  const casualQueues = getAllQueueCounts();
  const queueCounts = {};
  for (const [key, count] of Object.entries(casualQueues)) {
    // Key format: "modeId_type" (e.g., "duel-1v1_simple")
    // Extract modeId and aggregate counts for both types
    const modeId = key.split('_')[0];
    queueCounts[modeId] = (queueCounts[modeId] || 0) + count;
  }
  
  res.json({ 
    success: true, 
    online: onlineUsers.size,
    searching: { ...getSearchingCounts(), ...queueCounts }
  });
});

// Get site statistics (public) - cached to avoid hammering DB
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached stats if still fresh
    if (cachedStats && (now - lastStatsRefresh) < STATS_CACHE_TTL) {
      return res.json({ 
        success: true, 
        stats: { ...cachedStats, onlineUsers: onlineUsers.size } 
      });
    }
    
    // Run all counts in parallel
    const [totalUsers, totalSquads, totalLadderMatches, totalRankedMatches, totalStrickerMatches] = await Promise.all([
      User.countDocuments({ isBanned: { $ne: true }, isDeleted: { $ne: true } }),
      Squad.countDocuments({ isDeleted: { $ne: true } }),
      Match.countDocuments({ status: 'completed' }),
      RankedMatch.countDocuments({ status: 'completed' }),
      StrickerMatch.countDocuments({ status: 'completed' })
    ]);

    const totalMatches = totalLadderMatches + totalRankedMatches + totalStrickerMatches;
    // avgMatchesPerDay: Client v2 casual matches only (no CasualMatch model yet)
    const avgMatchesPerDay = 0;

    cachedStats = { totalUsers, totalSquads, totalMatches, avgMatchesPerDay };
    lastStatsRefresh = now;

    res.json({ 
      success: true, 
      stats: { ...cachedStats, onlineUsers: onlineUsers.size } 
    });
  } catch (error) {
    console.error('Get site stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

