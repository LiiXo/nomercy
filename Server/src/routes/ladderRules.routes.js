import express from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import LadderRules from '../models/LadderRules.js';

const router = express.Router();

// Get all ladder rules
router.get('/', async (req, res) => {
  try {
    const rules = await LadderRules.find().sort({ order: 1 });
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Get ladder rules error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get ladder rules by mode
router.get('/mode/:mode', async (req, res) => {
  try {
    const { mode } = req.params;
    const rules = await LadderRules.find({ mode }).sort({ order: 1 });
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Get ladder rules by mode error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create ladder rule (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const rule = new LadderRules(req.body);
    await rule.save();
    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Create ladder rule error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update ladder rule (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await LadderRules.findByIdAndUpdate(id, req.body, { new: true });
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Règle non trouvée' });
    }
    res.json({ success: true, rule });
  } catch (error) {
    console.error('Update ladder rule error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete ladder rule (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await LadderRules.findByIdAndDelete(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Règle non trouvée' });
    }
    res.json({ success: true, message: 'Règle supprimée' });
  } catch (error) {
    console.error('Delete ladder rule error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
