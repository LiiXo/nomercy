import express from 'express';
import AppSettings from '../models/AppSettings.js';
import Ranking from '../models/Ranking.js';
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
    
    if (disabledMessage) {
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
    
    console.log(`[ADMIN] Ranked leaderboard reset for mode "${mode}" by ${req.user.username}. ${result.modifiedCount} rankings reset.`);

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

// ==================== EVENTS ROUTES (ADMIN ONLY) ====================

// Toggle Double XP event (admin only)
router.post('/admin/events/double-xp', verifyToken, requireAdmin, async (req, res) => {
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
      // Enable double XP for specified duration
      settings.events.doubleXP = {
        enabled: true,
        expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
        enabledBy: req.user._id,
        enabledAt: new Date()
      };
      
      console.log(`[EVENT] Double XP activé pour ${durationHours}h par ${req.user.username}`);
    } else {
      // Disable double XP
      settings.events.doubleXP = {
        enabled: false,
        expiresAt: null,
        enabledBy: null,
        enabledAt: null
      };
      
      console.log(`[EVENT] Double XP désactivé par ${req.user.username}`);
    }
    
    settings.markModified('events');
    await settings.save();

    // Log to Discord
    await logAdminAction(req.user, 'Toggle Event', 'Double XP', {
      fields: [
        { name: 'État', value: enabled ? `Activé (${durationHours}h)` : 'Désactivé' },
        { name: 'Expiration', value: enabled ? settings.events.doubleXP.expiresAt.toLocaleString('fr-FR') : 'N/A' }
      ]
    });
    
    res.json({ 
      success: true, 
      message: enabled ? `Événement Double XP activé pour ${durationHours}h` : 'Événement Double XP désactivé',
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
      
      console.log(`[EVENT] Double Gold activé pour ${durationHours}h par ${req.user.username}`);
    } else {
      // Disable double gold
      settings.events.doubleGold = {
        enabled: false,
        expiresAt: null,
        enabledBy: null,
        enabledAt: null
      };
      
      console.log(`[EVENT] Double Gold désactivé par ${req.user.username}`);
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
    
    // Check if events are still valid (not expired)
    const now = new Date();
    const events = {
      doubleXP: {
        enabled: settings.events?.doubleXP?.enabled && 
                 (!settings.events?.doubleXP?.expiresAt || new Date(settings.events.doubleXP.expiresAt) > now),
        expiresAt: settings.events?.doubleXP?.expiresAt,
        enabledBy: settings.events?.doubleXP?.enabledBy,
        enabledAt: settings.events?.doubleXP?.enabledAt
      },
      doubleGold: {
        enabled: settings.events?.doubleGold?.enabled && 
                 (!settings.events?.doubleGold?.expiresAt || new Date(settings.events.doubleGold.expiresAt) > now),
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

