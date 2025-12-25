import express from 'express';
import Map from '../models/Map.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Obtenir toutes les maps (public)
router.get('/', async (req, res) => {
  try {
    const { ladder, gameMode, activeOnly = 'true' } = req.query;
    
    const query = {};
    if (activeOnly === 'true') query.isActive = true;
    if (ladder) query.ladders = ladder;
    if (gameMode) query.gameModes = gameMode;
    
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
    const { gameMode } = req.query;
    
    const query = { 
      isActive: true, 
      ladders: ladderId 
    };
    if (gameMode) query.gameModes = gameMode;
    
    // Récupérer toutes les maps éligibles
    const allMaps = await Map.find(query);
    
    if (allMaps.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pas assez de maps disponibles (minimum 3 requises)' 
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
      ladders: ladders || ['duo-trio', 'squad-team'],
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
    const { name, image, ladders, gameModes, isActive } = req.body;
    
    const map = await Map.findById(mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    if (name) map.name = name;
    if (image !== undefined) map.image = image;
    if (ladders) map.ladders = ladders;
    if (gameModes) map.gameModes = gameModes;
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
    // Maps disponibles en Squad/Team uniquement
    const squadTeamOnly = ['Retrieval'];
    
    // Maps disponibles en Duo/Trio uniquement
    const duoTrioOnly = ['Blackheart', 'Flagship', 'Hijacked', 'Nuketown'];
    
    // Maps disponibles dans les deux ladders
    const bothLadders = [
      'Colossus', 'Cortex', 'Den', 'Exposure', 'Express', 
      'Homestead', 'Imprint', 'Raid', 'Scar', 'Standoff', 
      'The Forge', 'Toshin', 'Utopia'
    ];
    
    const defaultMaps = [];
    
    // Maps Squad/Team uniquement
    for (const name of squadTeamOnly) {
      defaultMaps.push({
        name,
        ladders: ['squad-team'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    // Maps Duo/Trio uniquement
    for (const name of duoTrioOnly) {
      defaultMaps.push({
        name,
        ladders: ['duo-trio'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    // Maps dans les deux ladders
    for (const name of bothLadders) {
      defaultMaps.push({
        name,
        ladders: ['duo-trio', 'squad-team'],
        gameModes: ['Search & Destroy', 'Domination']
      });
    }
    
    let created = 0;
    for (const mapData of defaultMaps) {
      const exists = await Map.findOne({ name: mapData.name });
      if (!exists) {
        await Map.create(mapData);
        created++;
      }
    }
    
    res.json({ success: true, message: `${created} maps créées` });
  } catch (error) {
    console.error('Seed maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

