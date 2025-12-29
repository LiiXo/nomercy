import express from 'express';
import multer from 'multer';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Multer configuration for message image upload
const storage = multer.memoryStorage();
const uploadMessageImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed.'));
    }
  }
});

// ==================== USER ROUTES ====================

// Get all conversations for current user
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { archived = 'false' } = req.query;
    
    const query = {
      participants: userId
    };
    
    if (archived === 'true') {
      query.archivedBy = userId;
    } else {
      query.archivedBy = { $ne: userId };
    }
    
    const conversations = await Conversation.find(query)
      .populate('participants', 'username avatar avatarUrl discordAvatar roles')
      .populate('lastMessage.sender', 'username')
      .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 });
    
    // Format conversations
    const formatted = conversations.map(conv => {
      const otherParticipants = conv.participants.filter(
        p => p._id.toString() !== userId.toString()
      );
      const unreadCount = conv.unreadCounts.find(
        uc => uc.user.toString() === userId.toString()
      )?.count || 0;
      
      return {
        _id: conv._id,
        type: conv.type,
        isStaffInitiated: conv.isStaffInitiated,
        name: conv.name || otherParticipants.map(p => p.username).join(', '),
        participants: otherParticipants,
        lastMessage: conv.lastMessage,
        unreadCount,
        isArchived: conv.archivedBy.includes(userId),
        updatedAt: conv.updatedAt
      };
    });
    
    res.json({ success: true, conversations: formatted });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get single conversation with messages
router.get('/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username avatar avatarUrl discordAvatar roles');
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    // Check if user is participant
    const isParticipant = conversation.participants.some(
      p => p._id.toString() === userId.toString()
    );
    
    // Check if user is staff (can view all conversations)
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    
    if (!isParticipant && !isStaff) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    
    // Mark as read
    if (isParticipant) {
      await conversation.markAsRead(userId);
    }
    
    // Sort messages by createdAt to ensure correct order
    const sortedMessages = [...conversation.messages].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
    
    // Paginate messages (get most recent ones first for pagination, then reverse for display)
    const totalMessages = sortedMessages.length;
    const start = Math.max(0, totalMessages - parseInt(page) * parseInt(limit));
    const end = totalMessages - (parseInt(page) - 1) * parseInt(limit);
    const messages = sortedMessages.slice(start, end);
    
    // Populate message senders
    await Conversation.populate(messages, {
      path: 'sender',
      select: 'username avatar avatarUrl discordAvatar roles'
    });
    
    const otherParticipants = conversation.participants.filter(
      p => p._id.toString() !== userId.toString()
    );
    
    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        isStaffInitiated: conversation.isStaffInitiated,
        name: conversation.name || otherParticipants.map(p => p.username).join(', '),
        participants: conversation.participants,
        blockedBy: conversation.blockedBy,
        createdAt: conversation.createdAt
      },
      messages: messages, // Already in chronological order after sorting
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Start or get conversation with another user
router.post('/conversations/start', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Utilisateur cible requis' });
    }
    
    if (targetUserId === userId.toString()) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous envoyer de message' });
    }
    
    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Check if staff-initiated
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    
    const conversation = await Conversation.findOrCreatePrivate(
      userId, 
      targetUserId,
      isStaff
    );
    
    await conversation.populate('participants', 'username avatar avatarUrl discordAvatar roles');
    
    res.json({ success: true, conversation });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Send message in conversation
router.post('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    // Check if user is participant
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    
    // Check if blocked
    if (conversation.blockedBy.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cette conversation est bloquée' 
      });
    }
    
    const message = await conversation.addMessage(userId, content.trim());
    
    // Populate sender
    await Conversation.populate(message, {
      path: 'sender',
      select: 'username avatar avatarUrl discordAvatar roles'
    });
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Upload image in conversation
router.post('/conversations/:conversationId/messages/image', verifyToken, uploadMessageImage.single('image'), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image requise' });
    }
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    // Check if user is participant
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    
    // Check if blocked
    if (conversation.blockedBy.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cette conversation est bloquée' 
      });
    }
    
    // Convert to base64 data URL
    const base64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    
    const message = await conversation.addMessage(userId, '', false, imageUrl);
    
    // Populate sender
    await Conversation.populate(message, {
      path: 'sender',
      select: 'username avatar avatarUrl discordAvatar roles'
    });
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Upload message image error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get unread count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Conversation.getTotalUnreadCount(userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Archive conversation
router.post('/conversations/:conversationId/archive', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    if (!conversation.archivedBy.includes(userId)) {
      conversation.archivedBy.push(userId);
      await conversation.save();
    }
    
    res.json({ success: true, message: 'Conversation archivée' });
  } catch (error) {
    console.error('Archive conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Unarchive conversation
router.post('/conversations/:conversationId/unarchive', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    conversation.archivedBy = conversation.archivedBy.filter(
      id => id.toString() !== userId.toString()
    );
    await conversation.save();
    
    res.json({ success: true, message: 'Conversation désarchivée' });
  } catch (error) {
    console.error('Unarchive conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Block conversation (private only)
router.post('/conversations/:conversationId/block', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    if (conversation.type !== 'private') {
      return res.status(400).json({ 
        success: false, 
        message: 'Seules les conversations privées peuvent être bloquées' 
      });
    }
    
    if (!conversation.blockedBy.includes(userId)) {
      conversation.blockedBy.push(userId);
      await conversation.save();
    }
    
    res.json({ success: true, message: 'Conversation bloquée' });
  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Unblock conversation
router.post('/conversations/:conversationId/unblock', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    conversation.blockedBy = conversation.blockedBy.filter(
      id => id.toString() !== userId.toString()
    );
    await conversation.save();
    
    res.json({ success: true, message: 'Conversation débloquée' });
  } catch (error) {
    console.error('Unblock conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all conversations (admin only)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { page = 1, limit = 20, search = '', type = 'all' } = req.query;
    
    const query = {};
    if (type && type !== 'all') query.type = type;
    
    let conversations = await Conversation.find(query)
      .populate('participants', 'username avatar avatarUrl discordAvatar roles')
      .populate('lastMessage.sender', 'username')
      .populate('messages.sender', 'username avatar avatarUrl')
      .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter(conv => 
        conv.participants.some(p => 
          p.username.toLowerCase().includes(searchLower)
        )
      );
    }
    
    const total = await Conversation.countDocuments(query);
    
    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        _id: conv._id,
        type: conv.type,
        isStaffInitiated: conv.isStaffInitiated,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessage?.sentAt || conv.updatedAt,
        messages: conv.messages || [],
        messageCount: conv.messages.length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get conversations error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// View any conversation (admin only)
router.get('/admin/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username avatar avatarUrl discordAvatar roles');
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    // Populate message senders
    await Conversation.populate(conversation.messages, {
      path: 'sender',
      select: 'username avatar avatarUrl discordAvatar roles'
    });
    
    // Sort messages by createdAt
    const sortedMessages = [...conversation.messages].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
    
    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        isStaffInitiated: conversation.isStaffInitiated,
        participants: conversation.participants,
        messages: sortedMessages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Admin view conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Send message as staff to any user
router.post('/admin/send', verifyToken, async (req, res) => {
  try {
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { targetUserId, content } = req.body;
    
    if (!targetUserId || !content) {
      return res.status(400).json({ success: false, message: 'Utilisateur et message requis' });
    }
    
    // Find or create staff conversation
    const conversation = await Conversation.findOrCreatePrivate(
      req.user._id,
      targetUserId,
      true // isStaffInitiated
    );
    
    const message = await conversation.addMessage(req.user._id, content.trim());
    
    await Conversation.populate(message, {
      path: 'sender',
      select: 'username avatar avatarUrl discordAvatar roles'
    });
    
    res.json({ success: true, conversation, message });
  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete conversation (admin/staff)
router.delete('/admin/conversations/:conversationId', verifyToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est staff ou admin
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findByIdAndDelete(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
    }
    
    res.json({ success: true, message: 'Conversation supprimée' });
  } catch (error) {
    console.error('Admin delete conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get messaging statistics (admin only)
router.get('/admin/stats', verifyToken, async (req, res) => {
  try {
    const isStaff = req.user.roles?.includes('admin') || req.user.roles?.includes('staff');
    if (!isStaff) {
      return res.status(403).json({ success: false, message: 'Accès réservé au staff' });
    }
    
    const totalConversations = await Conversation.countDocuments();
    const privateConversations = await Conversation.countDocuments({ type: 'private' });
    const staffConversations = await Conversation.countDocuments({ type: 'staff' });
    
    // Messages in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentConversations = await Conversation.find({
      'lastMessage.sentAt': { $gte: oneDayAgo }
    });
    
    let recentMessagesCount = 0;
    recentConversations.forEach(conv => {
      recentMessagesCount += conv.messages.filter(m => m.createdAt >= oneDayAgo).length;
    });
    
    res.json({
      success: true,
      stats: {
        totalConversations,
        privateConversations,
        staffConversations,
        recentMessagesCount,
        activeConversations24h: recentConversations.length
      }
    });
  } catch (error) {
    console.error('Get messaging stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;


