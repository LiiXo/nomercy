import express from 'express';
import Config from '../models/Config.js';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import { clearConfigCache } from '../utils/configHelper.js';

const router = express.Router();

// Get rewards configuration (public, for displaying rewards to all users)
router.get('/rewards', async (req, res) => {
  try {
    const config = await Config.getOrCreate();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching rewards config:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update rewards configuration
router.put('/rewards', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { squadMatchRewards, rankedMatchRewards, rankedMaps, ladderRulesText, rankedRules } = req.body;
    
    // Récupérer le document (pas en mode lean pour pouvoir le modifier)
    let config = await Config.findOne({ type: 'rewards' });
    if (!config) {
      config = new Config({ type: 'rewards' });
    }
    
    // Mettre à jour squadMatchRewards
    if (squadMatchRewards) {
      config.squadMatchRewards = { 
        ...config.squadMatchRewards?.toObject?.() || config.squadMatchRewards || {},
        ...squadMatchRewards 
      };
      config.markModified('squadMatchRewards');
    }
    
    // Mettre à jour rankedMatchRewards (Mixed type - nécessite markModified)
    if (rankedMatchRewards) {
      const currentRanked = config.rankedMatchRewards || {};
      
      // Merge hardcore rewards
      if (rankedMatchRewards.hardcore) {
        currentRanked.hardcore = currentRanked.hardcore || {};
        for (const gameMode in rankedMatchRewards.hardcore) {
          currentRanked.hardcore[gameMode] = {
            ...(currentRanked.hardcore[gameMode] || {}),
            ...rankedMatchRewards.hardcore[gameMode]
          };
        }
      }
      
      // Merge cdl rewards
      if (rankedMatchRewards.cdl) {
        currentRanked.cdl = currentRanked.cdl || {};
        for (const gameMode in rankedMatchRewards.cdl) {
          currentRanked.cdl[gameMode] = {
            ...(currentRanked.cdl[gameMode] || {}),
            ...rankedMatchRewards.cdl[gameMode]
          };
        }
      }
      
      config.rankedMatchRewards = currentRanked;
      config.markModified('rankedMatchRewards');
    }
    
    // Mettre à jour rankedMaps (Mixed type - nécessite markModified)
    if (rankedMaps) {
      const currentMaps = config.rankedMaps || {};
      
      // Merge maps pour chaque mode de jeu
      for (const gameMode in rankedMaps) {
        currentMaps[gameMode] = rankedMaps[gameMode];
      }
      
      config.rankedMaps = currentMaps;
      config.markModified('rankedMaps');
      console.log('[CONFIG] Ranked maps updated:', JSON.stringify(currentMaps, null, 2));
    }
    
    // Mettre à jour les règles du ladder
    if (ladderRulesText !== undefined) {
      config.ladderRulesText = ladderRulesText;
    }
    
    // Mettre à jour les règles du mode classé
    if (rankedRules !== undefined) {
      config.rankedRules = rankedRules;
      config.markModified('rankedRules');
    }
    
    await config.save();
    
    // Clear cache to force reload
    clearConfigCache();
    
    // Recharger la config pour renvoyer les données à jour
    const updatedConfig = await Config.getOrCreate();
    
    console.log('[CONFIG] Rewards updated:', JSON.stringify(updatedConfig.rankedMatchRewards, null, 2));
    
    res.json({ success: true, message: 'Configuration mise à jour', config: updatedConfig });
  } catch (error) {
    console.error('Error updating rewards config:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get rules (ladder and ranked)
router.get('/rules', async (req, res) => {
  try {
    const config = await Config.getOrCreate();
    res.json({ 
      success: true, 
      ladderRules: config.ladderRulesText || '',
      rankedRules: config.rankedRules || {}
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update rules (Staff only)
router.put('/rules', verifyToken, async (req, res) => {
  try {
    // Check if user is staff
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user._id);
    const isStaff = user.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
    
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    
    const { ladderRules, rankedRules } = req.body;
    
    let config = await Config.findOne({ type: 'rewards' });
    if (!config) {
      config = new Config({ type: 'rewards' });
    }
    
    if (ladderRules !== undefined) {
      config.ladderRulesText = ladderRules;
    }
    
    if (rankedRules !== undefined) {
      config.rankedRules = rankedRules;
      config.markModified('rankedRules');
    }
    
    await config.save();
    clearConfigCache();
    
    res.json({ 
      success: true, 
      message: 'Règles mises à jour',
      ladderRules: config.ladderRulesText,
      rankedRules: config.rankedRules
    });
  } catch (error) {
    console.error('Error updating rules:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;



