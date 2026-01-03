import express from 'express';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';
import Config from '../models/Config.js';
import { clearConfigCache } from '../utils/configHelper.js';

const router = express.Router();

// ==================== ADMIN ROUTES ====================
// These must come BEFORE parameterized routes to avoid conflicts

// Get full config (admin/staff)
router.get('/admin', verifyToken, requireStaff, async (req, res) => {
  try {
    const config = await Config.getOrCreate();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get admin config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update full config (admin)
router.put('/admin', verifyToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    
    let config = await Config.findOne({ type: 'rewards' });
    if (!config) {
      config = new Config({ type: 'rewards' });
    }
    
    // Update all provided fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        config[key] = updates[key];
      }
    });
    
    await config.save();
    
    // Clear the config cache so new values are used immediately
    clearConfigCache();
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Update admin config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== PUBLIC ROUTES ====================

// Get public config
router.get('/', async (req, res) => {
  try {
    const config = await Config.findOne() || {};
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get squad match rewards (public - for match sheet display)
router.get('/rewards/squad', async (req, res) => {
  try {
    const config = await Config.getOrCreate();
    const rewards = config.squadMatchRewards || {
      ladderPointsWin: 20,
      ladderPointsLoss: 10,
      generalSquadPointsWin: 15,
      generalSquadPointsLoss: 7,
      playerPointsWin: 20,
      playerPointsLoss: 10,
      playerCoinsWin: 50,
      playerCoinsLoss: 25,
      playerXPWinMin: 450,
      playerXPWinMax: 550
    };
    res.json({ success: true, rewards });
  } catch (error) {
    console.error('Get squad rewards config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get config by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const config = await Config.findOne({ key });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Config non trouvée' });
    }
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get config by key error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update config (admin only)
router.put('/:key', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const config = await Config.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
