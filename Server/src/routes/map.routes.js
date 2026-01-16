import express from 'express';
import Map from '../models/Map.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Obtenir toutes les maps (public)
router.get('/', async (req, res) => {
  try {
    const { ladder, gameMode, mode, activeOnly = 'true' } = req.query;
    
    const query = {};
    if (activeOnly === 'true') query.isActive = true;
    if (ladder) query.ladders = ladder;
    if (gameMode) query.gameModes = gameMode;
    // Filter by mode (hardcore, cdl) - include 'both' maps as well
    if (mode) query.mode = { $in: [mode, 'both'] };
    
    const maps = await Map.find(query).sort({ name: 1 });
    res.json({ success: true, maps });
  } catch (error) {
    console.error('Get maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir 3 maps aléatoires pour un match
router.get('/random/:ladderId', async (req, res) => {
  try {
    const { ladderId } = req.params;
    const { gameMode, mode } = req.query;
    
    const query = { 
      isActive: true, 
      ladders: ladderId 
    };
    if (gameMode) query.gameModes = gameMode;
    // Filter by mode (hardcore, cdl) - include 'both' maps as well
    if (mode) query.mode = { $in: [mode, 'both'] };
    
    // Récupérer toutes les maps éligibles
    const allMaps = await Map.find(query);
    
    if (allMaps.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: `Pas assez de maps disponibles pour ${mode || 'ce mode'} (minimum 3 requises, ${allMaps.length} trouvées)` 
      });
    }
    
    // Mélanger et prendre 3 maps
    const shuffled = allMaps.sort(() => 0.5 - Math.random());
    const selectedMaps = shuffled.slice(0, 3);
    
    res.json({ success: true, maps: selectedMaps });
  } catch (error) {
    console.error('Get random maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir les maps pour le mode classé (ranked)
router.get('/ranked', async (req, res) => {
  try {
    const { gameMode, format, mode } = req.query;
    
    const query = { 
      isActive: true, 
      ladders: 'ranked' 
    };
    if (gameMode) query.gameModes = gameMode;
    // Filtrer par format (4v4 ou 5v5)
    if (format) query.rankedFormats = format;
    // Filter by mode (hardcore, cdl) - include 'both' maps as well
    if (mode) query.mode = { $in: [mode, 'both'] };
    
    const maps = await Map.find(query).sort({ name: 1 });
    res.json({ success: true, maps });
  } catch (error) {
    console.error('Get ranked maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin/Staff: Ajouter une map
router.post('/', verifyToken, requireStaff, async (req, res) => {
  try {
    const { name, image, ladders, gameModes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }
    
    const map = new Map({
      name,
      image,
      ladders: ladders || ['duo-trio', 'squad-team', 'ranked'],
      gameModes: gameModes || ['Search & Destroy', 'Domination'],
      isActive: true
    });
    
    await map.save();
    res.status(201).json({ success: true, map });
  } catch (error) {
    console.error('Create map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin/Staff: Modifier une map
router.put('/:mapId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mapId } = req.params;
    const { name, image, ladders, gameModes, rankedFormats, isActive } = req.body;
    
    const map = await Map.findById(mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    if (name) map.name = name;
    if (image !== undefined) map.image = image;
    if (ladders) map.ladders = ladders;
    if (gameModes) map.gameModes = gameModes;
    if (rankedFormats !== undefined) map.rankedFormats = rankedFormats;
    if (isActive !== undefined) map.isActive = isActive;
    
    await map.save();
    res.json({ success: true, map });
  } catch (error) {
    console.error('Update map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin/Staff: Supprimer une map
router.delete('/:mapId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mapId } = req.params;
    
    const map = await Map.findByIdAndDelete(mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    res.json({ success: true, message: 'Map supprimée' });
  } catch (error) {
    console.error('Delete map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin/Staff: Seed default maps
router.post('/seed', verifyToken, requireStaff, async (req, res) => {
  try {
    // Maps disponibles en Squad/Team uniquement (+ ranked)
    const squadTeamOnly = ['Retrieval'];
    
    // Maps disponibles en Duo/Trio uniquement
    const duoTrioOnly = ['Blackheart', 'Flagship', 'Hijacked', 'Nuketown'];
    
    // Maps disponibles dans tous les ladders (duo-trio, squad-team, ranked)
    const allLadders = [
      'Colossus', 'Cortex', 'Den', 'Exposure', 'Express', 
      'Homestead', 'Imprint', 'Raid', 'Scar', 'Standoff', 
      'The Forge', 'Toshin', 'Utopia'
    ];
    
    const defaultMaps = [];
    
    // Maps Squad/Team + Ranked
    for (const name of squadTeamOnly) {
      defaultMaps.push({
        name,
        mode: 'both',
        ladders: ['squad-team', 'ranked'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    // Maps Duo/Trio uniquement
    for (const name of duoTrioOnly) {
      defaultMaps.push({
        name,
        mode: 'both',
        ladders: ['duo-trio'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    // Maps dans tous les ladders (duo-trio, squad-team, ranked)
    for (const name of allLadders) {
      defaultMaps.push({
        name,
        mode: 'both',
        ladders: ['duo-trio', 'squad-team', 'ranked'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    let created = 0;
    let updated = 0;
    for (const mapData of defaultMaps) {
      const exists = await Map.findOne({ name: mapData.name });
      if (!exists) {
        await Map.create(mapData);
        created++;
      } else {
        // Mettre à jour les maps existantes pour ajouter 'ranked' si manquant
        let needsUpdate = false;
        if (!exists.ladders.includes('ranked') && mapData.ladders.includes('ranked')) {
          exists.ladders.push('ranked');
          needsUpdate = true;
        }
        if (!exists.mode) {
          exists.mode = 'both';
          needsUpdate = true;
        }
        if (needsUpdate) {
          await exists.save();
          updated++;
        }
      }
    }
    
    res.json({ success: true, message: `${created} maps créées, ${updated} maps mises à jour` });
  } catch (error) {
    console.error('Seed maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all maps (admin)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const maps = await Map.find().sort({ name: 1 });
    res.json({ success: true, maps });
  } catch (error) {
    console.error('Get all maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create map (admin)
router.post('/admin/create', verifyToken, requireStaff, async (req, res) => {
  try {
    const { name, image, mode, ladders, gameModes, rankedFormats, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }
    
    const map = new Map({
      name,
      image: image || '',
      mode: mode || 'both',
      ladders: ladders || [],
      gameModes: gameModes || [],
      rankedFormats: rankedFormats || [],
      isActive: isActive !== undefined ? isActive : true
    });
    
    await map.save();
    res.status(201).json({ success: true, map });
  } catch (error) {
    console.error('Create map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update map (admin)
router.put('/admin/:mapId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { name, image, mode, gameMode, ladders, gameModes, rankedFormats, isActive } = req.body;
    
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    if (name !== undefined) map.name = name;
    if (image !== undefined) map.image = image;
    if (mode !== undefined) map.mode = mode;
    if (gameMode !== undefined) map.gameMode = gameMode;
    if (ladders !== undefined) map.ladders = ladders;
    if (gameModes !== undefined) map.gameModes = gameModes;
    if (rankedFormats !== undefined) map.rankedFormats = rankedFormats;
    if (isActive !== undefined) map.isActive = isActive;
    
    await map.save();
    res.json({ success: true, map });
  } catch (error) {
    console.error('Update map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete map (admin)
router.delete('/admin/:mapId', verifyToken, requireStaff, async (req, res) => {
  try {
    const map = await Map.findByIdAndDelete(req.params.mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    res.json({ success: true, message: 'Map supprimée' });
  } catch (error) {
    console.error('Delete map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

