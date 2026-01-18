import express from 'express';
import GameModeRules from '../models/GameModeRules.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// Valid subTypes for each location
const VALID_SUBTYPES = {
  rankings: ['duo-trio', 'squad-team'],
  ranked: ['duel', 'tdm', 'domination', 'snd', 'hardpoint']
};

// ==================== PUBLIC ROUTES ====================

// Get all rules (for admin editor)
router.get('/', async (req, res) => {
  try {
    const rules = await GameModeRules.find().sort({ mode: 1, location: 1, subType: 1 });
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching all rules:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get rules for a specific mode, location and subType
router.get('/:mode/:location/:subType', async (req, res) => {
  try {
    const { mode, location, subType } = req.params;
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid mode. Must be: hardcore or cdl' 
      });
    }
    
    if (!['rankings', 'ranked'].includes(location)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid location. Must be: rankings or ranked' 
      });
    }
    
    if (!VALID_SUBTYPES[location].includes(subType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid subType for ${location}. Must be: ${VALID_SUBTYPES[location].join(', ')}` 
      });
    }
    
    const rules = await GameModeRules.findOne({ mode, location, subType, isActive: true });
    
    if (!rules) {
      return res.json({
        success: true,
        rules: null,
        message: 'No rules found for this mode, location and subType'
      });
    }
    
    // Sort sections by order
    rules.sections.sort((a, b) => a.order - b.order);
    
    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Error fetching game mode rules:', error);
    res.status(500).json({ success: false, message: 'Error fetching rules' });
  }
});

// Legacy route - Get rules for a specific mode and location (without subType)
router.get('/:mode/:location', async (req, res) => {
  try {
    const { mode, location } = req.params;
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid mode. Must be: hardcore or cdl' 
      });
    }
    
    if (!['rankings', 'ranked'].includes(location)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid location. Must be: rankings or ranked' 
      });
    }
    
    // Get all rules for this mode and location (all subTypes)
    const rules = await GameModeRules.find({ mode, location, isActive: true });
    
    res.json({
      success: true,
      rules: rules || []
    });
  } catch (error) {
    console.error('Error fetching game mode rules:', error);
    res.status(500).json({ success: false, message: 'Error fetching rules' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all game mode rules (for admin)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const rules = await GameModeRules.find()
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .sort({ mode: 1 });
    
    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Error fetching admin game mode rules:', error);
    res.status(500).json({ success: false, message: 'Error fetching rules' });
  }
});

// Create or update game mode rules
router.post('/admin/:mode/:location/:subType', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, location, subType } = req.params;
    const { title, sections, isActive } = req.body;
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid mode' 
      });
    }
    
    if (!['rankings', 'ranked'].includes(location)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid location. Must be: rankings or ranked' 
      });
    }
    
    if (!VALID_SUBTYPES[location].includes(subType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid subType for ${location}` 
      });
    }
    
    // Use findOneAndUpdate with upsert to avoid duplicate key errors
    const updateData = {
      updatedBy: req.user._id
    };
    
    if (title) updateData.title = title;
    if (sections) updateData.sections = sections;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const rules = await GameModeRules.findOneAndUpdate(
      { mode, location, subType },
      {
        $set: updateData,
        $setOnInsert: {
          mode,
          location,
          subType,
          title: title || { fr: '', en: '', it: '', de: '' },
          sections: sections || [],
          isActive: isActive !== undefined ? isActive : true,
          createdBy: req.user._id
        }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );
    
    res.json({
      success: true,
      message: 'Rules saved',
      rules
    });
  } catch (error) {
    console.error('Error saving game mode rules:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error saving rules',
      details: error.code === 11000 ? 'Duplicate key error - please check database indexes' : undefined
    });
  }
});

// Add a section to mode rules
router.post('/admin/:mode/:location/:subType/section', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, location, subType } = req.params;
    const { title, content, icon, order } = req.body;
    
    console.log('Adding section:', { mode, location, subType, title, content });
    
    if (!title?.fr || !title?.en || !content?.fr || !content?.en) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and content (fr, en) are required' 
      });
    }
    
    if (!['hardcore', 'cdl'].includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid mode. Must be: hardcore or cdl' 
      });
    }
    
    if (!['rankings', 'ranked'].includes(location)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid location' 
      });
    }
    
    if (!VALID_SUBTYPES[location].includes(subType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid subType for ${location}. Must be: ${VALID_SUBTYPES[location].join(', ')}` 
      });
    }
    
    // Ensure all language fields are strings (not undefined)
    const sectionToAdd = {
      title: {
        fr: title.fr || '',
        en: title.en || '',
        it: title.it || '',
        de: title.de || ''
      },
      content: {
        fr: content.fr || '',
        en: content.en || '',
        it: content.it || '',
        de: content.de || ''
      },
      icon: icon || 'fileText',
      order: order !== undefined ? order : 0
    };
    
    // Use findOneAndUpdate with upsert to avoid duplicate key errors
    const rules = await GameModeRules.findOneAndUpdate(
      { mode, location, subType },
      {
        $push: { sections: sectionToAdd },
        $set: { updatedBy: req.user._id },
        $setOnInsert: {
          mode,
          location, 
          subType,
          title: { fr: '', en: '', it: '', de: '' },
          createdBy: req.user._id
        }
      },
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Section added',
      rules
    });
  } catch (error) {
    console.error('Error adding section:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error adding section',
      details: error.errors ? Object.keys(error.errors).map(k => error.errors[k].message) : undefined
    });
  }
});

// Update a section
router.put('/admin/:mode/:location/:subType/section/:sectionId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, location, subType, sectionId } = req.params;
    const { title, content, icon, order } = req.body;
    
    const rules = await GameModeRules.findOne({ mode, location, subType });
    
    if (!rules) {
      return res.status(404).json({ success: false, message: 'Rules not found' });
    }
    
    const section = rules.sections.id(sectionId);
    
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    
    // Update section fields
    if (title) section.title = title;
    if (content) section.content = content;
    if (icon !== undefined) section.icon = icon;
    if (order !== undefined) section.order = order;
    
    rules.updatedBy = req.user._id;
    
    // Use save() which is safe for subdocuments
    await rules.save();
    
    // Fetch updated rules
    const updatedRules = await GameModeRules.findOne({ mode, location, subType });
    
    res.json({
      success: true,
      message: 'Section updated',
      rules: updatedRules
    });
  } catch (error) {
    console.error('Error updating section:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error updating section',
      details: error.code === 11000 ? 'Duplicate key error - please check database indexes' : undefined
    });
  }
});

// Delete a section
router.delete('/admin/:mode/:location/:subType/section/:sectionId', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, location, subType, sectionId } = req.params;
    
    let rules = await GameModeRules.findOne({ mode, location, subType });
    
    if (!rules) {
      return res.status(404).json({ success: false, message: 'Rules not found' });
    }
    
    // Use findOneAndUpdate to remove the section
    const updatedRules = await GameModeRules.findOneAndUpdate(
      { mode, location, subType },
      {
        $pull: { sections: { _id: sectionId } },
        $set: { updatedBy: req.user._id }
      },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Section deleted',
      rules: updatedRules
    });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({ success: false, message: 'Error deleting section' });
  }
});

// Delete entire mode rules
router.delete('/admin/:mode/:location/:subType', verifyToken, requireStaff, async (req, res) => {
  try {
    const { mode, location, subType } = req.params;
    
    const rules = await GameModeRules.findOneAndDelete({ mode, location, subType });
    
    if (!rules) {
      return res.status(404).json({ success: false, message: 'Rules not found' });
    }
    
    res.json({
      success: true,
      message: 'Rules deleted'
    });
  } catch (error) {
    console.error('Error deleting rules:', error);
    res.status(500).json({ success: false, message: 'Error deleting rules' });
  }
});

export default router;

