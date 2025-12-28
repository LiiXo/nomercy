import express from 'express';
import Announcement from '../models/Announcement.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC/USER ROUTES ====================

// Get active announcements for current user (unread ones that require acknowledgment)
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const { mode = 'all' } = req.query;
    const now = new Date();

    // Find active announcements
    const announcements = await Announcement.find({
      isActive: true,
      publishAt: { $lte: now },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ],
      $or: [
        { targetMode: 'all' },
        { targetMode: mode }
      ],
      requiresAcknowledgment: true
    })
    .sort({ priority: -1, publishAt: -1 })
    .populate('createdBy', 'username');

    // Filter out announcements the user has already read
    const unreadAnnouncements = announcements.filter(
      a => !a.hasUserRead(req.user._id)
    );

    res.json({
      success: true,
      announcements: unreadAnnouncements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ success: false, message: 'Error fetching announcements' });
  }
});

// Get all visible announcements (for news feed)
router.get('/all', async (req, res) => {
  try {
    const { mode = 'all', limit = 20, page = 1 } = req.query;
    const now = new Date();

    const query = {
      isActive: true,
      publishAt: { $lte: now },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    };

    if (mode !== 'all') {
      query.$or = [{ targetMode: 'all' }, { targetMode: mode }];
    }

    const announcements = await Announcement.find(query)
      .sort({ publishAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'username')
      .select('-readBy'); // Don't send readBy list to client

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      announcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcements' });
  }
});

// Acknowledge/mark as read
router.post('/:id/acknowledge', verifyToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Check if already read
    if (announcement.hasUserRead(req.user._id)) {
      return res.json({ success: true, message: 'Already acknowledged' });
    }

    // Add user to readBy
    announcement.readBy.push({
      user: req.user._id,
      readAt: new Date()
    });
    await announcement.save();

    res.json({
      success: true,
      message: 'Announcement acknowledged'
    });
  } catch (error) {
    console.error('Acknowledge error:', error);
    res.status(500).json({ success: false, message: 'Error acknowledging announcement' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all announcements (admin)
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'username');

    // Add read count to each announcement
    const announcementsWithStats = announcements.map(a => ({
      ...a.toJSON(),
      readCount: a.readBy.length
    }));

    const total = await Announcement.countDocuments();

    res.json({
      success: true,
      announcements: announcementsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcements' });
  }
});

// Create announcement (admin/staff)
router.post('/admin', verifyToken, requireStaff, async (req, res) => {
  try {
    const {
      title,
      content,
      type,
      version,
      priority,
      targetMode,
      requiresAcknowledgment,
      isActive,
      publishAt,
      expiresAt
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const announcement = new Announcement({
      title,
      content,
      type: type || 'announcement',
      version,
      priority: priority || 'normal',
      targetMode: targetMode || 'all',
      requiresAcknowledgment: requiresAcknowledgment !== false,
      isActive: isActive !== false,
      publishAt: publishAt || new Date(),
      expiresAt,
      createdBy: req.user._id
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      message: 'Announcement created',
      announcement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Error creating announcement' });
  }
});

// Update announcement (admin/staff)
router.put('/admin/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const allowedUpdates = [
      'title', 'content', 'type', 'version', 'priority',
      'targetMode', 'requiresAcknowledgment', 'isActive',
      'publishAt', 'expiresAt'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        announcement[field] = req.body[field];
      }
    });

    await announcement.save();

    res.json({
      success: true,
      message: 'Announcement updated',
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating announcement' });
  }
});

// Delete announcement (admin/staff)
router.delete('/admin/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({
      success: true,
      message: 'Announcement deleted'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting announcement' });
  }
});

// Reset read status (force everyone to re-acknowledge)
router.post('/admin/:id/reset-reads', verifyToken, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    announcement.readBy = [];
    await announcement.save();

    res.json({
      success: true,
      message: 'Read status reset for all users'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resetting read status' });
  }
});

// Get announcement stats (admin)
router.get('/admin/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const total = await Announcement.countDocuments();
    const active = await Announcement.countDocuments({ isActive: true });
    
    const byType = await Announcement.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const recentAnnouncements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'username');

    res.json({
      success: true,
      stats: {
        total,
        active,
        byType,
        recentAnnouncements: recentAnnouncements.map(a => ({
          ...a.toJSON(),
          readCount: a.readBy.length
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

export default router;

