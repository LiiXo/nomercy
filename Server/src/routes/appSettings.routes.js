import express from 'express';
import AppSettings from '../models/AppSettings.js';
import Ranking from '../models/Ranking.js';
import RankedMatch from '../models/RankedMatch.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';
import { logAdminAction } from '../services/discordBot.service.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Default rank thresholds (fallback)
const DEFAULT_RANK_THRESHOLDS = {
  bronze: { min: 0, max: 499 },
  silver: { min: 500, max: 999 },
  gold: { min: 1000, max: 1499 },
  platinum: { min: 1500, max: 1999 },
  diamond: { min: 2000, max: 2499 },
  master: { min: 2500, max: 2999 },
  grandmaster: { min: 3000, max: 3499 },
  champion: { min: 3500, max: null }
};

// Get current app settings (public - for checking feature flags)
// Also accessible via root route for backward compatibility
const getPublicSettings = async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    
    // Return only what's needed for the frontend
    res.json({
      success: true,
      features: settings.features,
      globalAlerts: settings.globalAlerts?.filter(a => a.active && (!a.expiresAt || new Date(a.expiresAt) > new Date())) || [],
      maintenance: settings.maintenance,
      banner: settings.banner,
      staffAdminAccess: settings.staffAdminAccess,
      ladderSettings: settings.ladderSettings || {
        duoTrioTimeRestriction: { enabled: true, startHour: 0, endHour: 20 }
      },
      rankedSettings: {
        currentSeason: new Date().getMonth() + 1, // Dynamic: February = 2, etc.
        bestOf: settings.rankedSettings?.bestOf || 3,
        // Important: inclure les seuils de rang pour le calcul des rangs côté client
        rankPointsThresholds: settings.rankedSettings?.rankPointsThresholds || DEFAULT_RANK_THRESHOLDS,
        pointsLossPerRank: settings.rankedSettings?.pointsLossPerRank || {
          bronze: -10,
          silver: -12,
          gold: -15,
          platinum: -18,
          diamond: -20,
          master: -22,
          grandmaster: -25,
          champion: -30
        }
      },
      // Événements actifs (Double XP, Double Gold)
      events: {
        doubleXP: {
          enabled: settings.events?.doubleXP?.enabled && 
                   (!settings.events?.doubleXP?.expiresAt || new Date(settings.events.doubleXP.expiresAt) > new Date()),
          expiresAt: settings.events?.doubleXP?.expiresAt
        },
        doubleGold: {
          enabled: settings.events?.doubleGold?.enabled && 
                   (!settings.events?.doubleGold?.expiresAt || new Date(settings.events.doubleGold.expiresAt) > new Date()),
          expiresAt: settings.events?.doubleGold?.expiresAt
        }
      },
      // Pour compatibilité avec l'ancien format (settings directement)
      settings: {
        rankedSettings: {
          rankPointsThresholds: settings.rankedSettings?.rankPointsThresholds || DEFAULT_RANK_THRESHOLDS
        }
      }
    });
  } catch (error) {
    console.error('Error fetching public app settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Route racine (pour compatibilité avec /api/app-settings)
router.get('/', getPublicSettings);

// Route /public explicite
router.get('/public', getPublicSettings);

// ==================== ADMIN ROUTES ====================

// Get full app settings (admin/staff)
router.get('/admin', verifyToken, requireStaff, async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update app settings (admin/staff)
router.put('/admin', verifyToken, requireStaff, async (req, res) => {
  try {
    const { features, globalAlerts, maintenance, banner, staffAdminAccess, rankedSettings, ladderSettings } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    if (features) {
      settings.features = { ...settings.features, ...features };
    }
    
    if (globalAlerts !== undefined) {
      settings.globalAlerts = globalAlerts;
    }
    
    if (maintenance) {
      settings.maintenance = { ...settings.maintenance, ...maintenance };
    }
    
    if (banner) {
      settings.banner = { ...settings.banner, ...banner };
      settings.markModified('banner');
    }
    
    if (staffAdminAccess) {
      settings.staffAdminAccess = { ...settings.staffAdminAccess, ...staffAdminAccess };
      settings.markModified('staffAdminAccess');
    }
    
    // Handle rankedSettings updates (bestOf, rankPointsThresholds, etc.)
    if (rankedSettings) {
      if (!settings.rankedSettings) {
        settings.rankedSettings = {};
      }
      
      // Update current season
      if (typeof rankedSettings.currentSeason === 'number' && rankedSettings.currentSeason >= 1) {
        settings.rankedSettings.currentSeason = rankedSettings.currentSeason;
      }
      
      // Update bestOf format (BO1 or BO3)
      if (typeof rankedSettings.bestOf === 'number') {
        settings.rankedSettings.bestOf = rankedSettings.bestOf;
      }
      
      // Update rank points thresholds
      if (rankedSettings.rankPointsThresholds) {
        settings.rankedSettings.rankPointsThresholds = {
          ...settings.rankedSettings.rankPointsThresholds,
          ...rankedSettings.rankPointsThresholds
        };
      }
      
      // Update points loss per rank
      if (rankedSettings.pointsLossPerRank) {
        settings.rankedSettings.pointsLossPerRank = {
          ...settings.rankedSettings.pointsLossPerRank,
          ...rankedSettings.pointsLossPerRank
        };
      }
      
      // Update game mode specific settings
      const gameModes = ['searchAndDestroy', 'teamDeathmatch', 'domination', 'captureTheFlag', 'killConfirmed'];
      for (const mode of gameModes) {
        if (rankedSettings[mode]) {
          if (!settings.rankedSettings[mode]) {
            settings.rankedSettings[mode] = {};
          }
          settings.rankedSettings[mode] = {
            ...settings.rankedSettings[mode],
            ...rankedSettings[mode]
          };
        }
      }
      
      settings.markModified('rankedSettings');
    }
    
    // Handle ladderSettings updates
    if (ladderSettings) {
      if (!settings.ladderSettings) {
        settings.ladderSettings = {};
      }
      settings.ladderSettings = { ...settings.ladderSettings, ...ladderSettings };
      settings.markModified('ladderSettings');
    }
    
    await settings.save();
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating app settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Toggle a specific feature (admin/staff)
router.patch('/admin/feature/:featureKey', verifyToken, requireStaff, async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { enabled, disabledMessage } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    if (!settings.features[featureKey]) {
      return res.status(400).json({ success: false, message: 'Feature non trouvée' });
    }
    
    if (typeof enabled === 'boolean') {
      settings.features[featureKey].enabled = enabled;
    }
    
    if (disabledMessage !== undefined) {
      settings.features[featureKey].disabledMessage = disabledMessage;
    }
    
    settings.markModified('features');
    await settings.save();

    // Log to Discord
    await logAdminAction(req.user, 'Toggle Feature', featureKey, {
      fields: [
        { name: 'État', value: enabled ? 'Activé' : 'Désactivé' }
      ]
    });
    
    res.json({ 
      success: true, 
      feature: settings.features[featureKey],
      message: `Feature ${featureKey} ${enabled ? 'activée' : 'désactivée'}`
    });
  } catch (error) {
    console.error('Error toggling feature:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Add global alert (admin/staff)
router.post('/admin/alert', verifyToken, requireStaff, async (req, res) => {
  try {
    const { type, message, dismissible, showOnPages, expiresAt } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    const newAlert = {
      id: `alert_${Date.now()}`,
      type: type || 'info',
      message,
      dismissible: dismissible !== false,
      showOnPages: showOnPages || [],
      active: true,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null
    };
    
    settings.globalAlerts.push(newAlert);
    await settings.save();

    // Log to Discord
    await logAdminAction(req.user, 'Add Alert', newAlert.type, {
      fields: [
        { name: 'Message', value: message.substring(0, 100) + (message.length > 100 ? '...' : '') }
      ]
    });
    
    res.json({ success: true, alert: newAlert });
  } catch (error) {
    console.error('Error adding alert:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete global alert (admin/staff)
router.delete('/admin/alert/:alertId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { alertId } = req.params;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Paramètres non trouvés' });
    }
    
    settings.globalAlerts = settings.globalAlerts.filter(a => a.id !== alertId);
    await settings.save();
    
    res.json({ success: true, message: 'Alerte supprimée' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Toggle maintenance mode (admin/staff)
router.patch('/admin/maintenance', verifyToken, requireStaff, async (req, res) => {
  try {
    const { enabled, message, estimatedEndTime } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    if (typeof enabled === 'boolean') {
      settings.maintenance.enabled = enabled;
    }
    
    if (message) {
      settings.maintenance.message = message;
    }
    
    if (estimatedEndTime !== undefined) {
      settings.maintenance.estimatedEndTime = estimatedEndTime ? new Date(estimatedEndTime) : null;
    }
    
    settings.markModified('maintenance');
    await settings.save();

    // Log to Discord
    await logAdminAction(req.user, 'Toggle Maintenance', enabled ? 'Activé' : 'Désactivé', {
      description: message || 'Maintenance mode toggled'
    });
    
    res.json({ success: true, maintenance: settings.maintenance });
  } catch (error) {
    console.error('Error toggling maintenance:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Prepare for API restart - cancel all pending pre-match matches (admin only)
router.post('/admin/prepare-restart', verifyToken, requireAdmin, async (req, res) => {
  try {
    // 1. Enable maintenance mode
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    settings.maintenance.enabled = true;
    settings.maintenance.message = 'Redémarrage du serveur en cours. Veuillez patienter...';
    settings.markModified('maintenance');
    await settings.save();
    
    // 2. Cancel all pending/ready matches (pre-match phase)
    const cancelledMatches = await RankedMatch.updateMany(
      { status: { $in: ['pending', 'ready'] } },
      { 
        $set: { 
          status: 'cancelled',
          'result.isForfeit': true,
          'result.forfeitReason': 'Match annulé - Redémarrage serveur'
        }
      }
    );
    
    // 3. Get count of in_progress matches (these can't be cancelled)
    const inProgressCount = await RankedMatch.countDocuments({ status: 'in_progress' });
    
    // Log to Discord
    await logAdminAction(req.user, 'Prepare Restart', 'API', {
      fields: [
        { name: 'Matchs annulés', value: cancelledMatches.modifiedCount.toString() },
        { name: 'Matchs en cours', value: inProgressCount.toString() }
      ]
    });
    
    res.json({ 
      success: true, 
      message: 'Prêt pour le redémarrage',
      cancelledMatches: cancelledMatches.modifiedCount,
      inProgressMatches: inProgressCount,
      warning: inProgressCount > 0 ? `Attention: ${inProgressCount} match(s) sont encore en cours` : null
    });
  } catch (error) {
    console.error('Error preparing restart:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update ladder settings (admin only)
router.patch('/admin/ladder-settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { duoTrioTimeRestriction } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    // Initialize ladderSettings if not exists
    if (!settings.ladderSettings) {
      settings.ladderSettings = {
        duoTrioTimeRestriction: { enabled: true, startHour: 0, endHour: 20 }
      };
    }
    
    if (duoTrioTimeRestriction) {
      if (typeof duoTrioTimeRestriction.enabled === 'boolean') {
        settings.ladderSettings.duoTrioTimeRestriction.enabled = duoTrioTimeRestriction.enabled;
      }
      if (typeof duoTrioTimeRestriction.startHour === 'number') {
        settings.ladderSettings.duoTrioTimeRestriction.startHour = duoTrioTimeRestriction.startHour;
      }
      if (typeof duoTrioTimeRestriction.endHour === 'number') {
        settings.ladderSettings.duoTrioTimeRestriction.endHour = duoTrioTimeRestriction.endHour;
      }
    }
    
    settings.markModified('ladderSettings');
    await settings.save();
    
    res.json({ 
      success: true, 
      ladderSettings: settings.ladderSettings,
      message: 'Paramètres ladder mis à jour'
    });
  } catch (error) {
    console.error('Error updating ladder settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// NOTE: Les récompenses du mode classé sont configurées dans Config.rankedMatchRewards (onglet Config)
// Cette route n'est plus utilisée pour les récompenses - elles sont gérées via /config/admin

// Reset ranked leaderboard for a specific mode (admin only)
router.post('/admin/reset-ranked-leaderboard/:mode', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { mode } = req.params;
    
    // Validate mode
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mode invalide. Utilisez "hardcore" ou "cdl".' 
      });
    }
    
    // Reset all rankings for this mode
    const result = await Ranking.updateMany(
      { mode: mode },
      { 
        $set: { 
          points: 0, 
          wins: 0, 
          losses: 0,
          kills: 0,
          deaths: 0,
          currentStreak: 0,
          bestStreak: 0,
          rank: 0,
          division: 'bronze'
        } 
      }
    );
    

    // Log to Discord
    await logAdminAction(req.user, 'Reset Leaderboard', mode === 'hardcore' ? 'Hardcore' : 'CDL', {
      fields: [
        { name: 'Mode', value: mode },
        { name: 'Rankings réinitialisés', value: result.modifiedCount.toString() }
      ]
    });
    
    res.json({ 
      success: true, 
      message: `Classement ${mode === 'hardcore' ? 'Hardcore' : 'CDL'} réinitialisé avec succès.`,
      resetCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error resetting ranked leaderboard:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// RAZ TOTAL CLASSÉ - Reset ALL ranked stats for BOTH modes (admin only)
router.post('/admin/reset-all-ranked', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Reset all rankings for ALL modes (hardcore + cdl)
    const result = await Ranking.updateMany(
      {},  // All rankings
      { 
        $set: { 
          points: 0, 
          wins: 0, 
          losses: 0,
          kills: 0,
          deaths: 0,
          currentStreak: 0,
          bestStreak: 0,
          rank: 0,
          division: 'bronze'
        } 
      }
    );

    // Log to Discord
    await logAdminAction(req.user, 'RAZ TOTAL CLASSÉ', 'Tous les modes', {
      fields: [
        { name: 'Action', value: 'Remise à zéro complète du mode classé' },
        { name: 'Rankings réinitialisés', value: result.modifiedCount.toString() },
        { name: 'Modes affectés', value: 'Hardcore + CDL' }
      ]
    });
    
    res.json({ 
      success: true, 
      message: `RAZ TOTAL CLASSÉ: ${result.modifiedCount} classements réinitialisés (Hardcore + CDL).`,
      resetCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error resetting all ranked:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== EVENTS ROUTES (ADMIN ONLY) ====================

// Toggle/Schedule Double XP event (admin only)
router.post('/admin/events/double-xp', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, startsAt, expiresAt } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    // Initialize events if not exists
    if (!settings.events) {
      settings.events = {};
    }
    
    if (enabled) {
      // Programmer ou activer double XP
      const startDate = startsAt ? new Date(startsAt) : new Date();
      const endDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      settings.events.doubleXP = {
        enabled: true,
        startsAt: startDate,
        expiresAt: endDate,
        enabledBy: req.user._id,
        enabledAt: new Date()
      };
      
    } else {
      // Disable double XP
      settings.events.doubleXP = {
        enabled: false,
        startsAt: null,
        expiresAt: null,
        enabledBy: null,
        enabledAt: null
      };
      
    }
    
    settings.markModified('events');
    await settings.save();

    // Log to Discord
    const isScheduled = startsAt && new Date(startsAt) > new Date();
    await logAdminAction(req.user, 'Toggle Event', 'Double XP', {
      fields: [
        { name: 'État', value: enabled ? (isScheduled ? 'Programmé' : 'Activé') : 'Désactivé' },
        { name: 'Début', value: enabled ? settings.events.doubleXP.startsAt.toLocaleString('fr-FR') : 'N/A' },
        { name: 'Fin', value: enabled ? settings.events.doubleXP.expiresAt.toLocaleString('fr-FR') : 'N/A' }
      ]
    });
    
    res.json({ 
      success: true, 
      message: enabled 
        ? (isScheduled ? `Événement Double XP programmé du ${settings.events.doubleXP.startsAt.toLocaleString('fr-FR')} au ${settings.events.doubleXP.expiresAt.toLocaleString('fr-FR')}` 
                       : `Événement Double XP activé jusqu'au ${settings.events.doubleXP.expiresAt.toLocaleString('fr-FR')}`)
        : 'Événement Double XP désactivé',
      event: settings.events.doubleXP
    });
  } catch (error) {
    console.error('Error toggling double XP event:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Toggle Double Gold event (admin only)
router.post('/admin/events/double-gold', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, durationHours = 24 } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    // Initialize events if not exists
    if (!settings.events) {
      settings.events = {};
    }
    
    if (enabled) {
      // Enable double gold for specified duration
      settings.events.doubleGold = {
        enabled: true,
        expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
        enabledBy: req.user._id,
        enabledAt: new Date()
      };
      
    } else {
      // Disable double gold
      settings.events.doubleGold = {
        enabled: false,
        expiresAt: null,
        enabledBy: null,
        enabledAt: null
      };
      
    }
    
    settings.markModified('events');
    await settings.save();

    // Log to Discord
    await logAdminAction(req.user, 'Toggle Event', 'Double Gold', {
      fields: [
        { name: 'État', value: enabled ? `Activé (${durationHours}h)` : 'Désactivé' },
        { name: 'Expiration', value: enabled ? settings.events.doubleGold.expiresAt.toLocaleString('fr-FR') : 'N/A' }
      ]
    });
    
    res.json({ 
      success: true, 
      message: enabled ? `Événement Double Gold activé pour ${durationHours}h` : 'Événement Double Gold désactivé',
      event: settings.events.doubleGold
    });
  } catch (error) {
    console.error('Error toggling double gold event:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get current events status (admin only)
router.get('/admin/events', verifyToken, requireAdmin, async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    
    // Check if events are currently active (within start/end window)
    const now = new Date();
    
    const isDoubleXPActive = settings.events?.doubleXP?.enabled && 
      (!settings.events?.doubleXP?.startsAt || new Date(settings.events.doubleXP.startsAt) <= now) &&
      (!settings.events?.doubleXP?.expiresAt || new Date(settings.events.doubleXP.expiresAt) > now);
    
    const isDoubleGoldActive = settings.events?.doubleGold?.enabled && 
      (!settings.events?.doubleGold?.startsAt || new Date(settings.events.doubleGold.startsAt) <= now) &&
      (!settings.events?.doubleGold?.expiresAt || new Date(settings.events.doubleGold.expiresAt) > now);
    
    const events = {
      doubleXP: {
        enabled: settings.events?.doubleXP?.enabled || false,
        active: isDoubleXPActive,  // Currently active (within time window)
        startsAt: settings.events?.doubleXP?.startsAt,
        expiresAt: settings.events?.doubleXP?.expiresAt,
        enabledBy: settings.events?.doubleXP?.enabledBy,
        enabledAt: settings.events?.doubleXP?.enabledAt
      },
      doubleGold: {
        enabled: settings.events?.doubleGold?.enabled || false,
        active: isDoubleGoldActive,
        startsAt: settings.events?.doubleGold?.startsAt,
        expiresAt: settings.events?.doubleGold?.expiresAt,
        enabledBy: settings.events?.doubleGold?.enabledBy,
        enabledAt: settings.events?.doubleGold?.enabledAt
      }
    };
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

