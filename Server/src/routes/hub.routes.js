import express from 'express';
import HubPost from '../models/HubPost.js';
import User from '../models/User.js';
import Squad from '../models/Squad.js';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get all posts (with filters)
router.get('/posts', async (req, res) => {
  try {
    const { type, mode, platform, page = 1, limit = 20 } = req.query;
    
    const query = { isActive: true, expiresAt: { $gt: new Date() } };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    if (mode && mode !== 'all') {
      query.$or = [{ mode }, { mode: 'both' }];
    }
    if (platform && platform !== 'All') {
      query.$or = query.$or || [];
      query.$or.push({ platform }, { platform: 'All' });
    }
    
    const posts = await HubPost.find(query)
      .populate('author', 'username avatar avatarUrl discordAvatar platform activisionId')
      .populate({
        path: 'squad',
        select: 'name tag color logo members stats',
        populate: {
          path: 'members.user',
          select: 'username'
        }
      })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await HubPost.countDocuments(query);
    
    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get hub posts error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get my posts
router.get('/my-posts', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const posts = await HubPost.find({ author: userId })
      .populate('squad', 'name tag color logo')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, posts });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create recruitment post (squad members only)
router.post('/recruitment', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, description, platform, mode, spotsAvailable, discordTag } = req.body;
    
    // Check if user has a squad
    const user = await User.findById(userId).populate('squad');
    if (!user.squad) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez être dans une escouade pour publier une annonce de recrutement.'
      });
    }
    
    const squad = await Squad.findById(user.squad._id);
    
    // Check if user is leader or officer
    if (!squad.canManage(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls le leader et les officiers peuvent publier des annonces de recrutement.'
      });
    }
    
    // Check if squad already has an active recruitment post
    const existingPost = await HubPost.findOne({
      squad: squad._id,
      type: 'recruitment',
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (existingPost) {
      return res.status(400).json({
        success: false,
        message: 'Votre escouade a déjà une annonce de recrutement active.'
      });
    }
    
    // Create post
    const post = new HubPost({
      type: 'recruitment',
      author: userId,
      squad: squad._id,
      title,
      description,
      platform: platform || 'All',
      mode: mode || 'both',
      spotsAvailable: spotsAvailable || 1,
      discordTag: discordTag || ''
    });
    
    await post.save();
    
    await post.populate('author', 'username avatar avatarUrl discordAvatar platform');
    await post.populate('squad', 'name tag color logo members');
    
    res.json({ success: true, post, message: 'Annonce de recrutement publiée !' });
  } catch (error) {
    console.error('Create recruitment post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create LFT (looking for team) post
router.post('/looking-for-team', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, description, platform, mode, playerRole, discordTag } = req.body;
    
    // Check if user does NOT have a squad
    const user = await User.findById(userId);
    if (user.squad) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà dans une escouade. Quittez-la pour publier une annonce de recherche de team.'
      });
    }
    
    // Check if user already has an active LFT post
    const existingPost = await HubPost.findOne({
      author: userId,
      type: 'looking_for_team',
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (existingPost) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une annonce de recherche active.'
      });
    }
    
    // Create post
    const post = new HubPost({
      type: 'looking_for_team',
      author: userId,
      title,
      description,
      platform: platform || user.platform || 'All',
      mode: mode || 'both',
      playerRole: playerRole || '',
      discordTag: discordTag || ''
    });
    
    await post.save();
    
    await post.populate('author', 'username avatar avatarUrl discordAvatar platform activisionId');
    
    res.json({ success: true, post, message: 'Annonce de recherche publiée !' });
  } catch (error) {
    console.error('Create LFT post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Update post
router.put('/:postId', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const { title, description, platform, mode, spotsAvailable, playerRole, discordTag } = req.body;
    
    const post = await HubPost.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Annonce non trouvée' });
    }
    
    // Check ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Update fields
    if (title) post.title = title;
    if (description) post.description = description;
    if (platform) post.platform = platform;
    if (mode) post.mode = mode;
    if (spotsAvailable !== undefined) post.spotsAvailable = spotsAvailable;
    if (playerRole !== undefined) post.playerRole = playerRole;
    if (discordTag !== undefined) post.discordTag = discordTag;
    
    await post.save();
    
    await post.populate('author', 'username avatar avatarUrl discordAvatar platform');
    if (post.squad) {
      await post.populate('squad', 'name tag color logo');
    }
    
    res.json({ success: true, post, message: 'Annonce mise à jour' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete/deactivate post
router.delete('/:postId', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    
    const post = await HubPost.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Annonce non trouvée' });
    }
    
    // Check ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Soft delete
    post.isActive = false;
    await post.save();
    
    res.json({ success: true, message: 'Annonce supprimée' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Renew post (extend expiration)
router.post('/:postId/renew', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    
    const post = await HubPost.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Annonce non trouvée' });
    }
    
    // Check ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    
    // Extend by 30 days from now
    post.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    post.isActive = true;
    await post.save();
    
    res.json({ success: true, post, message: 'Annonce renouvelée pour 30 jours' });
  } catch (error) {
    console.error('Renew post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all posts for admin (including inactive)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    // Check if user is staff or admin
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { page = 1, limit = 20, search = '', type = 'all' } = req.query;
    
    const query = {};
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const posts = await HubPost.find(query)
      .populate('author', 'username avatar avatarUrl discordAvatar')
      .populate('squad', 'name tag color logo')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await HubPost.countDocuments(query);
    
    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin hub posts error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin delete post (hard delete or soft delete)
router.delete('/admin/:postId', verifyToken, async (req, res) => {
  try {
    // Check if user is staff or admin
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { postId } = req.params;
    const { hardDelete } = req.query;
    
    const post = await HubPost.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Annonce non trouvée' });
    }
    
    if (hardDelete === 'true') {
      // Hard delete
      await HubPost.findByIdAndDelete(postId);
      res.json({ success: true, message: 'Annonce supprimée définitivement' });
    } else {
      // Soft delete
      post.isActive = false;
      await post.save();
      res.json({ success: true, message: 'Annonce désactivée' });
    }
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;





