import express from 'express';
import AppSettings from '../models/AppSettings.js';
import Ranking from '../models/Ranking.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get current app settings (public - for checking feature flags)
router.get('/public', async (req, res) => {
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
      rankedSettings: settings.rankedSettings || {
        searchAndDestroy: {
          enabled: true,
          rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
          matchmaking: { minPlayers: 6, maxPlayers: 10, waitTimer: 120 }
        },
        pointsLossPerRank: {
          bronze: -10,
          silver: -12,
          gold: -15,
          platinum: -18,
          diamond: -20,
          master: -22,
          grandmaster: -25,
          champion: -30
        }
      }
    });
  } catch (error) {
    console.error('Error fetching public app settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

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

// Update ranked settings (admin only)
router.patch('/admin/ranked-settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { searchAndDestroy, hardpoint, teamDeathmatch, domination, captureTheFlag, killConfirmed } = req.body;
    
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }
    
    // Initialize rankedSettings if not exists
    if (!settings.rankedSettings) {
      settings.rankedSettings = {
        searchAndDestroy: {
          enabled: true,
          rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
          matchmaking: { minPlayers: 6, maxPlayers: 10, waitTimer: 120 }
        }
      };
    }
    
    // Update Search & Destroy settings
    if (searchAndDestroy) {
      if (!settings.rankedSettings.searchAndDestroy) {
        settings.rankedSettings.searchAndDestroy = {
          enabled: true,
          rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
          matchmaking: { minPlayers: 6, maxPlayers: 10, waitTimer: 120 }
        };
      }
      
      if (typeof searchAndDestroy.enabled === 'boolean') {
        settings.rankedSettings.searchAndDestroy.enabled = searchAndDestroy.enabled;
      }
      
      if (searchAndDestroy.rewards) {
        if (!settings.rankedSettings.searchAndDestroy.rewards) {
          settings.rankedSettings.searchAndDestroy.rewards = { pointsWin: 25, pointsLose: -15, goldWin: 50, goldLoss: 10 };
        }
        if (typeof searchAndDestroy.rewards.pointsWin === 'number') {
          settings.rankedSettings.searchAndDestroy.rewards.pointsWin = searchAndDestroy.rewards.pointsWin;
        }
        if (typeof searchAndDestroy.rewards.pointsLose === 'number') {
          settings.rankedSettings.searchAndDestroy.rewards.pointsLose = searchAndDestroy.rewards.pointsLose;
        }
        if (typeof searchAndDestroy.rewards.goldWin === 'number') {
          settings.rankedSettings.searchAndDestroy.rewards.goldWin = searchAndDestroy.rewards.goldWin;
        }
        if (typeof searchAndDestroy.rewards.goldLoss === 'number') {
          settings.rankedSettings.searchAndDestroy.rewards.goldLoss = searchAndDestroy.rewards.goldLoss;
        }
      }
      
      if (searchAndDestroy.matchmaking) {
        if (!settings.rankedSettings.searchAndDestroy.matchmaking) {
          settings.rankedSettings.searchAndDestroy.matchmaking = { minPlayers: 6, maxPlayers: 10, waitTimer: 120 };
        }
        if (typeof searchAndDestroy.matchmaking.waitTimer === 'number') {
          settings.rankedSettings.searchAndDestroy.matchmaking.waitTimer = searchAndDestroy.matchmaking.waitTimer;
        }
      }
    }
    
    // Update Hardpoint settings (for CDL ranked)
    if (hardpoint) {
      if (!settings.rankedSettings.hardpoint) {
        settings.rankedSettings.hardpoint = {
          enabled: true,
          rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50, goldLoss: 10 },
          matchmaking: { minPlayers: 8, maxPlayers: 8, waitTimer: 120 }
        };
      }
      
      if (typeof hardpoint.enabled === 'boolean') {
        settings.rankedSettings.hardpoint.enabled = hardpoint.enabled;
      }
      
      if (hardpoint.rewards) {
        if (!settings.rankedSettings.hardpoint.rewards) {
          settings.rankedSettings.hardpoint.rewards = { pointsWin: 25, pointsLose: -15, goldWin: 50, goldLoss: 10 };
        }
        if (typeof hardpoint.rewards.pointsWin === 'number') {
          settings.rankedSettings.hardpoint.rewards.pointsWin = hardpoint.rewards.pointsWin;
        }
        if (typeof hardpoint.rewards.pointsLose === 'number') {
          settings.rankedSettings.hardpoint.rewards.pointsLose = hardpoint.rewards.pointsLose;
        }
        if (typeof hardpoint.rewards.goldWin === 'number') {
          settings.rankedSettings.hardpoint.rewards.goldWin = hardpoint.rewards.goldWin;
        }
        if (typeof hardpoint.rewards.goldLoss === 'number') {
          settings.rankedSettings.hardpoint.rewards.goldLoss = hardpoint.rewards.goldLoss;
        }
      }
      
      if (hardpoint.matchmaking) {
        if (!settings.rankedSettings.hardpoint.matchmaking) {
          settings.rankedSettings.hardpoint.matchmaking = { minPlayers: 8, maxPlayers: 8, waitTimer: 120 };
        }
        if (typeof hardpoint.matchmaking.waitTimer === 'number') {
          settings.rankedSettings.hardpoint.matchmaking.waitTimer = hardpoint.matchmaking.waitTimer;
        }
      }
    }
    
    // Update other modes (future)
    const modes = [
      { key: 'teamDeathmatch', data: teamDeathmatch },
      { key: 'domination', data: domination },
      { key: 'captureTheFlag', data: captureTheFlag },
      { key: 'killConfirmed', data: killConfirmed }
    ];
    
    for (const mode of modes) {
      if (mode.data) {
        if (!settings.rankedSettings[mode.key]) {
          settings.rankedSettings[mode.key] = {
            enabled: false,
            rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 }
          };
        }
        if (typeof mode.data.enabled === 'boolean') {
          settings.rankedSettings[mode.key].enabled = mode.data.enabled;
        }
        if (mode.data.rewards) {
          settings.rankedSettings[mode.key].rewards = {
            ...settings.rankedSettings[mode.key].rewards,
            ...mode.data.rewards
          };
        }
      }
    }
    
    settings.markModified('rankedSettings');
    await settings.save();
    
    res.json({ 
      success: true, 
      rankedSettings: settings.rankedSettings,
      message: 'Paramètres classé mis à jour'
    });
  } catch (error) {
    console.error('Error updating ranked settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

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

export default router;

