import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: false, // Not required if image is present
    maxlength: 2000
  },
  imageUrl: {
    type: String,
    default: null
  },
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
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

const conversationSchema = new mongoose.Schema({
  // Participants (for 1-on-1 or group)
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  
  // Type of conversation
  type: {
    type: String,
    enum: ['private', 'staff', 'group'],
    default: 'private'
  },
  
  // For staff conversations
  isStaffInitiated: {
    type: Boolean,
    default: false
  },
  
  // Group name (for group chats)
  name: {
    type: String,
    default: ''
  },
  
  // Messages
  messages: [messageSchema],
  
  // Last message (for sorting/preview)
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: Date
  },
  
  // Unread counts per participant
  unreadCounts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  
  // Status
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Block status (for private chats)
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ isStaffInitiated: 1 });

// Find or create private conversation between two users
conversationSchema.statics.findOrCreatePrivate = async function(user1Id, user2Id, isStaffInitiated = false) {
  // Sort IDs to ensure consistent lookup
  const participants = [user1Id, user2Id].sort();
  
  let conversation = await this.findOne({
    type: isStaffInitiated ? 'staff' : 'private',
    participants: { $all: participants, $size: 2 }
  });
  
  if (!conversation) {
    conversation = new this({
      type: isStaffInitiated ? 'staff' : 'private',
      participants,
      isStaffInitiated,
      unreadCounts: participants.map(p => ({ user: p, count: 0 })),
      createdBy: user1Id
    });
    await conversation.save();
  }
  
  return conversation;
};

// Add message to conversation
conversationSchema.methods.addMessage = async function(senderId, content, isSystemMessage = false, imageUrl = null) {
  const message = {
    sender: senderId,
    content: content || '',
    imageUrl: imageUrl,
    isSystemMessage,
    readBy: [{ user: senderId, readAt: new Date() }]
  };
  
  this.messages.push(message);
  
  // Update last message
  const lastMessageContent = imageUrl ? '📷 Image' : (content || '').substring(0, 100);
  this.lastMessage = {
    content: lastMessageContent,
    sender: senderId,
    sentAt: new Date()
  };
  
  // Update unread counts for other participants
  this.unreadCounts.forEach(uc => {
    if (uc.user.toString() !== senderId.toString()) {
      uc.count += 1;
    }
  });
  
  await this.save();
  return this.messages[this.messages.length - 1];
};

// Mark messages as read for a user
conversationSchema.methods.markAsRead = async function(userId) {
  const now = new Date();
  
  // Mark all unread messages as read
  this.messages.forEach(msg => {
    const alreadyRead = msg.readBy.some(r => r.user.toString() === userId.toString());
    if (!alreadyRead) {
      msg.readBy.push({ user: userId, readAt: now });
    }
  });
  
  // Reset unread count for this user
  const unreadIdx = this.unreadCounts.findIndex(uc => uc.user.toString() === userId.toString());
  if (unreadIdx !== -1) {
    this.unreadCounts[unreadIdx].count = 0;
  }
  
  await this.save();
};

// Get total unread count for a user
conversationSchema.statics.getTotalUnreadCount = async function(userId) {
  const conversations = await this.find({
    participants: userId,
    archivedBy: { $ne: userId }
  });
  
  let total = 0;
  conversations.forEach(conv => {
    const uc = conv.unreadCounts.find(u => u.user.toString() === userId.toString());
    if (uc) total += uc.count;
  });
  
  return total;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;


