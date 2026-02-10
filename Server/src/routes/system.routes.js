import express from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import Ranking from '../models/Ranking.js';
import HubPost from '../models/HubPost.js';
import Announcement from '../models/Announcement.js';
import Purchase from '../models/Purchase.js';
import ItemUsage from '../models/ItemUsage.js';
import Season from '../models/Season.js';
import { deleteMatchVoiceChannels } from '../services/discordBot.service.js';

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

// Get site statistics (public) - cached to avoid hammering DB
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached stats if still fresh
    if (cachedStats && (now - lastStatsRefresh) < STATS_CACHE_TTL) {
      return res.json({ success: true, stats: cachedStats });
    }
    
    // Run all counts in parallel
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    const [totalUsers, totalSquads, totalLadderMatches, totalRankedMatches, rankedLast10] = await Promise.all([
      User.countDocuments({ isBanned: { $ne: true }, isDeleted: { $ne: true } }),
      Squad.countDocuments({ isDeleted: { $ne: true } }),
      Match.countDocuments({ status: 'completed' }),
      RankedMatch.countDocuments({ status: 'completed' }),
      RankedMatch.countDocuments({ status: 'completed', createdAt: { $gte: tenDaysAgo } })
    ]);

    const totalMatches = totalLadderMatches + totalRankedMatches;
    const avgMatchesPerDay = Math.round(rankedLast10 / 10 * 10) / 10;

    cachedStats = { totalUsers, totalSquads, totalMatches, avgMatchesPerDay };
    lastStatsRefresh = now;

    res.json({ success: true, stats: cachedStats });
  } catch (error) {
    console.error('Get site stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

