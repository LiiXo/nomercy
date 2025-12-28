import express from 'express';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get active match for current user
router.get('/active/me', verifyToken, async (req, res) => {
  try {
    // TODO: Implement ranked match logic
    res.json({ success: true, match: null });
  } catch (error) {
    console.error('Get active match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get matchmaking queues
router.get('/matchmaking/queues', verifyToken, async (req, res) => {
  try {
    const { mode } = req.query;
    // TODO: Implement matchmaking queues logic
    res.json({ success: true, queues: [] });
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Join matchmaking queue
router.post('/matchmaking/join', verifyToken, async (req, res) => {
  try {
    const { mode, queueType } = req.body;
    // TODO: Implement join queue logic
    res.json({ success: true, message: 'Joined queue' });
  } catch (error) {
    console.error('Join queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Leave matchmaking queue
router.post('/matchmaking/leave', verifyToken, async (req, res) => {
  try {
    // TODO: Implement leave queue logic
    res.json({ success: true, message: 'Left queue' });
  } catch (error) {
    console.error('Leave queue error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get match by ID
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    // TODO: Implement get match logic
    res.status(404).json({ success: false, message: 'Match non trouvé' });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all ranked matches (admin)
// Get all ranked matches (admin/staff)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const matches = await RankedMatch.find(query)
      .populate('players.user', 'username')
      .populate('host', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await RankedMatch.countDocuments(query);
    
    res.json({
      success: true,
      matches,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all ranked matches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete ranked match (admin/staff)
router.delete('/admin/:matchId', verifyToken, requireStaff, async (req, res) => {
  try {
    const match = await RankedMatch.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match classé non trouvé'
      });
    }

    await RankedMatch.findByIdAndDelete(req.params.matchId);

    res.json({
      success: true,
      message: 'Match classé supprimé'
    });
  } catch (error) {
    console.error('Delete ranked match error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;
