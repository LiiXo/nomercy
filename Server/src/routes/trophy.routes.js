import express from 'express';
import Trophy from '../models/Trophy.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get all trophies (public)
router.get('/', async (req, res) => {
  try {
    const trophies = await Trophy.find({ isActive: true }).sort({ rarity: -1, createdAt: 1 });
    res.json({ success: true, trophies });
  } catch (error) {
    console.error('Get trophies error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get all trophies including inactive (admin only)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const trophies = await Trophy.find().sort({ rarity: -1, createdAt: -1 });
    res.json({ success: true, trophies });
  } catch (error) {
    console.error('Get all trophies error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get default trophies (for all squads)
router.get('/default', async (req, res) => {
  try {
    const trophies = await Trophy.find({ isDefault: true, isActive: true }).sort({ rarity: -1 });
    res.json({ success: true, trophies });
  } catch (error) {
    console.error('Get default trophies error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get single trophy
router.get('/:id', async (req, res) => {
  try {
    const trophy = await Trophy.findById(req.params.id);
    if (!trophy) {
      return res.status(404).json({ success: false, message: 'Trophée non trouvé' });
    }
    res.json({ success: true, trophy });
  } catch (error) {
    console.error('Get trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create trophy (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, translations, icon, color, rarity, rarityName, isDefault, isActive } = req.body;

    // Check if trophy with same name exists
    const existingTrophy = await Trophy.findOne({ name });
    if (existingTrophy) {
      return res.status(400).json({ success: false, message: 'Un trophée avec ce nom existe déjà' });
    }

    const trophy = new Trophy({
      name,
      description,
      translations,
      icon: icon || 'Trophy',
      color: color || 'amber',
      rarity: rarity || 1,
      rarityName: rarityName || 'common',
      isDefault: isDefault || false,
      isActive: isActive !== undefined ? isActive : true
    });

    await trophy.save();
    res.status(201).json({ success: true, trophy });
  } catch (error) {
    console.error('Create trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update trophy (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, translations, icon, color, rarity, rarityName, isDefault, isActive } = req.body;

    const trophy = await Trophy.findById(req.params.id);
    if (!trophy) {
      return res.status(404).json({ success: false, message: 'Trophée non trouvé' });
    }

    // Check if new name conflicts with another trophy
    if (name && name !== trophy.name) {
      const existingTrophy = await Trophy.findOne({ name, _id: { $ne: req.params.id } });
      if (existingTrophy) {
        return res.status(400).json({ success: false, message: 'Un trophée avec ce nom existe déjà' });
      }
    }

    // Update fields
    if (name !== undefined) trophy.name = name;
    if (description !== undefined) trophy.description = description;
    if (translations !== undefined) trophy.translations = translations;
    if (icon !== undefined) trophy.icon = icon;
    if (color !== undefined) trophy.color = color;
    if (rarity !== undefined) trophy.rarity = rarity;
    if (rarityName !== undefined) trophy.rarityName = rarityName;
    if (isDefault !== undefined) trophy.isDefault = isDefault;
    if (isActive !== undefined) trophy.isActive = isActive;

    await trophy.save();
    res.json({ success: true, trophy });
  } catch (error) {
    console.error('Update trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete trophy (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const trophy = await Trophy.findById(req.params.id);
    if (!trophy) {
      return res.status(404).json({ success: false, message: 'Trophée non trouvé' });
    }

    await Trophy.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Trophée supprimé' });
  } catch (error) {
    console.error('Delete trophy error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Seed default trophies (admin only) - useful for initial setup
router.post('/seed-defaults', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Check if La Bravoure already exists
    const existing = await Trophy.findOne({ name: 'La Bravoure' });
    if (existing) {
      return res.json({ success: true, message: 'Trophées par défaut déjà présents', trophy: existing });
    }

    // Create La Bravoure trophy
    const laBravoure = new Trophy({
      name: 'La Bravoure',
      description: 'Création de l\'escouade',
      translations: {
        fr: {
          name: 'La Bravoure',
          description: 'Création de l\'escouade'
        },
        en: {
          name: 'Bravery',
          description: 'Squad creation'
        },
        de: {
          name: 'Tapferkeit',
          description: 'Squad-Erstellung'
        },
        it: {
          name: 'Il Coraggio',
          description: 'Creazione della squadra'
        }
      },
      icon: 'Trophy',
      color: 'amber',
      rarity: 1,
      rarityName: 'common',
      isDefault: true,
      isActive: true
    });

    await laBravoure.save();
    res.status(201).json({ success: true, message: 'Trophée "La Bravoure" créé', trophy: laBravoure });
  } catch (error) {
    console.error('Seed default trophies error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

