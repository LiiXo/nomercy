import express from 'express';
import Map from '../models/Map.js';
import AppSettings from '../models/AppSettings.js';
import { verifyToken, requireStaff } from '../middleware/auth.middleware.js';
import { logAdminAction } from '../services/discordBot.service.js';

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

// Obtenir 3 maps aléatoires pour un match ladder
router.get('/random/:ladderId', async (req, res) => {
  try {
    const { ladderId } = req.params;
    const { gameMode, mode } = req.query;
    
    // Déterminer le configPath en fonction du mode (hardcore/cdl)
    const configPath = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
    
    // Essayer d'abord avec la nouvelle structure de configuration
    let allMaps = await Map.find({ 
      isActive: true,
      [`${configPath}.ladder.enabled`]: true,
      ...(gameMode ? { [`${configPath}.ladder.gameModes`]: gameMode } : {})
    });
    
    console.log(`[Random Maps] Found ${allMaps.length} maps for ${mode} ladder ${gameMode || 'any'} (new config)`);
    
    // Fallback: Si pas assez de maps avec la nouvelle config, essayer l'ancienne structure
    if (allMaps.length < 3) {
      console.log(`[Random Maps] Not enough maps with new config, falling back to legacy structure`);
      const legacyQuery = { 
        isActive: true, 
        ladders: ladderId 
      };
      if (gameMode) legacyQuery.gameModes = gameMode;
      if (mode) legacyQuery.mode = { $in: [mode, 'both'] };
      
      allMaps = await Map.find(legacyQuery);
      console.log(`[Random Maps] Found ${allMaps.length} maps with legacy config`);
    }
    
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
    
    // Déterminer le configPath en fonction du mode (hardcore/cdl)
    const configPath = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
    
    // Essayer d'abord avec la nouvelle structure de configuration (avec format si spécifié)
    let maps = await Map.find({ 
      isActive: true,
      [`${configPath}.ranked.enabled`]: true,
      ...(gameMode ? { [`${configPath}.ranked.gameModes`]: gameMode } : {}),
      ...(format ? { [`${configPath}.ranked.formats`]: format } : {})
    }).sort({ name: 1 });
    
    console.log(`[Ranked Maps] Found ${maps.length} maps for ${mode} ranked ${gameMode || 'any'} format ${format || 'any'} (new config)`);
    
    // Fallback: Si pas assez de maps avec la nouvelle config, essayer l'ancienne structure
    if (maps.length === 0) {
      console.log(`[Ranked Maps] No maps with new config, falling back to legacy structure`);
      const legacyQuery = { 
        isActive: true, 
        ladders: 'ranked' 
      };
      if (gameMode) legacyQuery.gameModes = gameMode;
      
      // Filtrer par format (4v4 ou 5v5)
      if (format) {
        if (format === '4v4' && gameMode === 'Hardpoint') {
          legacyQuery.rankedFormats = { $in: ['4v4', 'hardpoint-4v4'] };
        } else {
          legacyQuery.rankedFormats = format;
        }
      }
      
      if (mode) legacyQuery.mode = { $in: [mode, 'both'] };
      
      maps = await Map.find(legacyQuery).sort({ name: 1 });
      console.log(`[Ranked Maps] Found ${maps.length} maps with legacy config`);
    }
    
    // Récupérer le paramètre BO1/BO3 pour déterminer le minimum de maps requises
    const settings = await AppSettings.getSettings();
    const bestOf = settings?.rankedSettings?.bestOf || 3;
    const minMapsRequired = bestOf === 1 ? 1 : 3;
    
    // Avertissement si pas assez de maps
    const warning = maps.length < minMapsRequired 
      ? `Attention: Seulement ${maps.length} map(s) configurée(s). Minimum ${minMapsRequired} requise(s) pour un BO${bestOf}. Le système utilisera des maps d'autres configurations en fallback.`
      : null;
    
    res.json({ success: true, maps, warning, minRequired: minMapsRequired, bestOf });
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

    // Log to Discord
    await logAdminAction(req.user, 'Create Map', map.name);

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

    // Log to Discord
    await logAdminAction(req.user, 'Update Map', map.name);

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

    // Log to Discord
    await logAdminAction(req.user, 'Delete Map', map.name);
    
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
    const { name, image, mode, hardcoreConfig, cdlConfig, ladders, gameModes, rankedFormats, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }
    
    const map = new Map({
      name,
      image: image || '',
      mode: mode || 'both',
      // New granular configuration
      hardcoreConfig: hardcoreConfig || {
        ladder: { enabled: false, gameModes: [] },
        ranked: { enabled: false, gameModes: [] }
      },
      cdlConfig: cdlConfig || {
        ladder: { enabled: false, gameModes: [] },
        ranked: { enabled: false, gameModes: [] }
      },
      // Legacy fields (kept for backward compatibility)
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
    const { name, image, mode, hardcoreConfig, cdlConfig, ladders, gameModes, rankedFormats, isActive } = req.body;
    
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ success: false, message: 'Map non trouvée' });
    }
    
    if (name !== undefined) map.name = name;
    if (image !== undefined) map.image = image;
    if (mode !== undefined) map.mode = mode;
    
    // New granular configuration
    if (hardcoreConfig !== undefined) {
      map.hardcoreConfig = hardcoreConfig;
    }
    if (cdlConfig !== undefined) {
      map.cdlConfig = cdlConfig;
    }
    
    // Legacy fields (kept for backward compatibility)
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

    // Log to Discord
    await logAdminAction(req.user, 'Delete Map', map.name);
    
    res.json({ success: true, message: 'Map supprimée' });
  } catch (error) {
    console.error('Delete map error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Enable all maps in all modes and formats by default (admin)
// CDL ranked: uniquement 4v4
// Hardcore ranked: 4v4 et 5v5
router.post('/admin/enable-all', verifyToken, requireStaff, async (req, res) => {
  try {
    // Default configuration - all modes enabled with all game modes and formats
    const hardcoreConfig = {
      ladder: {
        enabled: true,
        gameModes: ['Search & Destroy']
      },
      ranked: {
        enabled: true,
        gameModes: ['Search & Destroy', 'Team Deathmatch', 'Duel'],
        formats: ['4v4', '5v5']
      }
    };
    
    const cdlConfig = {
      ladder: {
        enabled: true,
        gameModes: ['Hardpoint', 'Search & Destroy', 'Variant']
      },
      ranked: {
        enabled: true,
        gameModes: ['Hardpoint', 'Search & Destroy'],
        formats: ['4v4'] // CDL ranked: uniquement format 4v4
      }
    };
    
    // Update all maps
    const result = await Map.updateMany(
      { isActive: true },
      { 
        $set: { 
          hardcoreConfig,
          cdlConfig
        } 
      }
    );
    
    console.log(`[Maps] Enabled all configurations for ${result.modifiedCount} maps`);
    
    res.json({ 
      success: true, 
      message: `${result.modifiedCount} maps ont été configurées avec tous les modes et formats activés`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Enable all maps error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;

