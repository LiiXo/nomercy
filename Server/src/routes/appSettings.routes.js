import express from 'express';
import AppSettings from '../models/AppSettings.js';
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
      staffAdminAccess: settings.staffAdminAccess
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
    const { features, globalAlerts, maintenance, banner, staffAdminAccess } = req.body;
    
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

export default router;

