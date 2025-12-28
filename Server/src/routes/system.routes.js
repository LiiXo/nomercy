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
    
    console.log('🔥 Starting full system reset...');
    
    // Delete all users EXCEPT admins
    const deletedUsers = await User.deleteMany({
      roles: { $nin: ['admin'] }
    });
    console.log(`✅ Deleted ${deletedUsers.deletedCount} users (kept admins)`);
    
    // Delete all squads
    const deletedSquads = await Squad.deleteMany({});
    console.log(`✅ Deleted ${deletedSquads.deletedCount} squads`);
    
    // Delete all matches (both ladder and ranked)
    const deletedMatches = await Match.deleteMany({});
    console.log(`✅ Deleted ${deletedMatches.deletedCount} ladder matches`);
    
    const deletedRankedMatches = await RankedMatch.deleteMany({});
    console.log(`✅ Deleted ${deletedRankedMatches.deletedCount} ranked matches`);
    
    // Delete all rankings
    const deletedRankings = await Ranking.deleteMany({});
    console.log(`✅ Deleted ${deletedRankings.deletedCount} rankings`);
    
    // Delete all hub posts
    const deletedHubPosts = await HubPost.deleteMany({});
    console.log(`✅ Deleted ${deletedHubPosts.deletedCount} hub posts`);
    
    // Delete all announcements
    const deletedAnnouncements = await Announcement.deleteMany({});
    console.log(`✅ Deleted ${deletedAnnouncements.deletedCount} announcements`);
    
    // Delete all purchases
    const deletedPurchases = await Purchase.deleteMany({});
    console.log(`✅ Deleted ${deletedPurchases.deletedCount} purchases`);
    
    // Delete all item usages
    const deletedItemUsages = await ItemUsage.deleteMany({});
    console.log(`✅ Deleted ${deletedItemUsages.deletedCount} item usages`);
    
    // Delete all seasons
    const deletedSeasons = await Season.deleteMany({});
    console.log(`✅ Deleted ${deletedSeasons.deletedCount} seasons`);
    
    console.log('✅ System reset completed successfully');
    console.log('📋 Preserved: Game rules, Maps, Shop items, Trophies, Config');
    
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

export default router;

