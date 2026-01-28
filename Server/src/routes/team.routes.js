import express from 'express';
import TeamMember from '../models/TeamMember.js';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public: Get all active team members
router.get('/', async (req, res) => {
  try {
    const members = await TeamMember.find({ isActive: true })
      .sort({ category: 1, order: 1 })
      .select('-__v');

    // Group by category
    const grouped = {
      direction: [],
      staff: [],
      arbitre: [],
      moderator: [],
      other: []
    };

    members.forEach(member => {
      if (grouped[member.category]) {
        grouped[member.category].push(member);
      } else {
        grouped.other.push(member);
      }
    });

    res.json({
      success: true,
      team: grouped,
      total: members.length
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'équipe.'
    });
  }
});

// Admin: Get all team members (including inactive)
router.get('/admin/all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const members = await TeamMember.find()
      .sort({ category: 1, order: 1 })
      .select('-__v');

    res.json({
      success: true,
      members
    });
  } catch (error) {
    console.error('Get all team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des membres.'
    });
  }
});

// Admin: Create team member
router.post('/admin', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId, name, role, description, avatar, discordUsername, category, order, isActive } = req.body;

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nom et rôle requis.'
      });
    }

    const member = new TeamMember({
      userId: userId || null,
      name,
      role,
      description: description || '',
      avatar: avatar || null,
      discordUsername: discordUsername || null,
      category: category || 'other',
      order: order || 0,
      isActive: isActive !== false
    });

    await member.save();

    res.json({
      success: true,
      message: 'Membre ajouté avec succès.',
      member
    });
  } catch (error) {
    console.error('Create team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du membre.'
    });
  }
});

// Admin: Update team member
router.put('/admin/:memberId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { userId, name, role, description, avatar, discordUsername, category, order, isActive } = req.body;

    const member = await TeamMember.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Membre non trouvé.'
      });
    }

    // Update fields
    if (userId !== undefined) member.userId = userId;
    if (name !== undefined) member.name = name;
    if (role !== undefined) member.role = role;
    if (description !== undefined) member.description = description;
    if (avatar !== undefined) member.avatar = avatar;
    if (discordUsername !== undefined) member.discordUsername = discordUsername;
    if (category !== undefined) member.category = category;
    if (order !== undefined) member.order = order;
    if (isActive !== undefined) member.isActive = isActive;

    await member.save();

    res.json({
      success: true,
      message: 'Membre mis à jour.',
      member
    });
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du membre.'
    });
  }
});

// Admin: Delete team member
router.delete('/admin/:memberId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await TeamMember.findByIdAndDelete(memberId);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Membre non trouvé.'
      });
    }

    res.json({
      success: true,
      message: 'Membre supprimé.'
    });
  } catch (error) {
    console.error('Delete team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du membre.'
    });
  }
});

// Admin: Reorder team members
router.put('/admin/reorder', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { members } = req.body; // Array of { id, order }

    if (!Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: 'Format invalide.'
      });
    }

    for (const item of members) {
      await TeamMember.findByIdAndUpdate(item.id, { order: item.order });
    }

    res.json({
      success: true,
      message: 'Ordre mis à jour.'
    });
  } catch (error) {
    console.error('Reorder team error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réorganisation.'
    });
  }
});

export default router;
