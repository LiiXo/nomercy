import express from 'express';
import HelperConfirmation from '../models/HelperConfirmation.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Request helper confirmation
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { helperId, actionType, matchDetails } = req.body;
    const requesterId = req.user._id;

    // Validate input
    if (!helperId || !actionType || !matchDetails) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes'
      });
    }

    // Get requester's squad
    const requester = await User.findById(requesterId).populate('squad');
    if (!requester || !requester.squad) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez avoir une escouade'
      });
    }

    // Check if helper exists
    const helper = await User.findById(helperId);
    if (!helper) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non trouvé'
      });
    }

    // Check if helper already has a pending request
    const existingRequest = await HelperConfirmation.hasPendingRequest(helperId);
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Ce joueur a déjà une demande en attente'
      });
    }

    // Create confirmation request
    const confirmation = await HelperConfirmation.createRequest({
      helper: helperId,
      requester: requesterId,
      squad: requester.squad._id,
      actionType,
      matchDetails
    });

    // Populate for response
    await confirmation.populate('requester', 'username avatarUrl');
    await confirmation.populate('squad', 'name tag color logo');

    // Emit socket event to the helper
    const io = req.app.get('io');
    if (io) {
      const roomName = `user-${helperId}`;
      const room = io.sockets.adapter.rooms.get(roomName);
      const socketsInRoom = room ? room.size : 0;
      
      
      // Emit to the specific user's room
      io.to(roomName).emit('helperConfirmationRequest', {
        confirmationId: confirmation._id,
        requester: {
          _id: requester._id,
          username: requester.username,
          avatarUrl: requester.avatarUrl
        },
        squad: {
          _id: requester.squad._id,
          name: requester.squad.name,
          tag: requester.squad.tag,
          color: requester.squad.color,
          logo: requester.squad.logo
        },
        actionType,
        matchDetails,
        expiresAt: confirmation.expiresAt
      });
      
    } else {
    }

    res.json({
      success: true,
      confirmationId: confirmation._id,
      expiresAt: confirmation.expiresAt
    });
  } catch (error) {
    console.error('Request helper confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Respond to helper confirmation (accept/decline)
router.post('/:confirmationId/respond', verifyToken, async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const { response } = req.body; // 'accept' or 'decline'
    const userId = req.user._id;

    const confirmation = await HelperConfirmation.findById(confirmationId)
      .populate('requester', 'username')
      .populate('squad', 'name tag');

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    // Verify the user is the helper
    if (confirmation.helper.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    // Check if already expired
    if (new Date() > confirmation.expiresAt) {
      confirmation.status = 'expired';
      await confirmation.save();
      return res.status(400).json({
        success: false,
        message: 'La demande a expiré'
      });
    }

    // Process response
    if (response === 'accept') {
      await confirmation.accept();
    } else if (response === 'decline') {
      await confirmation.decline();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Réponse invalide'
      });
    }

    // Notify the requester via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${confirmation.requester._id}`).emit('helperConfirmationResponse', {
        confirmationId: confirmation._id,
        status: confirmation.status,
        helperUsername: req.user.username
      });
    }

    res.json({
      success: true,
      status: confirmation.status
    });
  } catch (error) {
    console.error('Respond to helper confirmation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur'
    });
  }
});

// Check status of a confirmation
router.get('/:confirmationId/status', verifyToken, async (req, res) => {
  try {
    const { confirmationId } = req.params;

    const confirmation = await HelperConfirmation.findById(confirmationId);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    // Check if expired but not yet marked
    if (confirmation.status === 'pending' && new Date() > confirmation.expiresAt) {
      confirmation.status = 'expired';
      await confirmation.save();
    }

    res.json({
      success: true,
      status: confirmation.status,
      expiresAt: confirmation.expiresAt
    });
  } catch (error) {
    console.error('Check confirmation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Get pending confirmations for the current user (as helper)
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const pendingConfirmations = await HelperConfirmation.find({
      helper: userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .populate('requester', 'username avatarUrl')
      .populate('squad', 'name tag color logo')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      confirmations: pendingConfirmations
    });
  } catch (error) {
    console.error('Get pending confirmations error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

export default router;

