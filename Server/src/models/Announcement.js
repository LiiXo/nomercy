import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // Type/Category
  type: {
    type: String,
    enum: ['patch_note', 'announcement', 'maintenance', 'event', 'rules', 'important'],
    default: 'announcement'
  },
  
  // Version (for patch notes)
  version: {
    type: String,
    default: ''
  },
  
  // Display settings
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal'
  },
  
  // Who should see it
  targetMode: {
    type: String,
    enum: ['all', 'hardcore', 'cdl'],
    default: 'all'
  },
  
  // Requires acknowledgment
  requiresAcknowledgment: {
    type: Boolean,
    default: true
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Scheduling
  publishAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  
  // Users who have read/acknowledged
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
announcementSchema.index({ isActive: 1, publishAt: -1 });
announcementSchema.index({ 'readBy.user': 1 });

// Virtual to check if announcement is currently visible
announcementSchema.virtual('isVisible').get(function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.publishAt && now < this.publishAt) return false;
  if (this.expiresAt && now > this.expiresAt) return false;
  
  return true;
});

// Method to check if a user has read this announcement
announcementSchema.methods.hasUserRead = function(userId) {
  return this.readBy.some(r => r.user.toString() === userId.toString());
};

announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;

