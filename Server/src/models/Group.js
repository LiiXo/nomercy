import mongoose from 'mongoose';

const GroupSchema = new mongoose.Schema({
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isReady: {
      type: Boolean,
      default: true
    }
  }],
  pendingInvites: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
    }
  }],
  maxSize: {
    type: Number,
    default: 5,
    max: 5
  },
  privacy: {
    type: String,
    enum: ['open', 'invite_only', 'closed'],
    default: 'invite_only'
  },
  isInQueue: {
    type: Boolean,
    default: false
  },
  gameMode: {
    type: String,
    enum: ['hardcore', 'cdl', null],
    default: null
  }
}, {
  timestamps: true
});

// Index for quick lookups
GroupSchema.index({ leader: 1 });
GroupSchema.index({ 'members.user': 1 });
GroupSchema.index({ 'pendingInvites.user': 1 });

// Virtual for member count
GroupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for checking if group is full
GroupSchema.virtual('isFull').get(function() {
  return this.members.length >= this.maxSize;
});

// Method to check if a user is in the group
GroupSchema.methods.hasMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString());
};

// Method to check if a user is the leader
GroupSchema.methods.isLeader = function(userId) {
  return this.leader.toString() === userId.toString();
};

// Method to check if user has pending invite
GroupSchema.methods.hasPendingInvite = function(userId) {
  return this.pendingInvites.some(i => 
    i.user.toString() === userId.toString() && 
    new Date(i.expiresAt) > new Date()
  );
};

// Static method to find group by member
GroupSchema.statics.findByMember = function(userId) {
  return this.findOne({ 'members.user': userId });
};

// Static method to find group by leader
GroupSchema.statics.findByLeader = function(userId) {
  return this.findOne({ leader: userId });
};

// Clean up expired invites
GroupSchema.methods.cleanExpiredInvites = function() {
  const now = new Date();
  this.pendingInvites = this.pendingInvites.filter(i => new Date(i.expiresAt) > now);
  return this;
};

export default mongoose.model('Group', GroupSchema);
