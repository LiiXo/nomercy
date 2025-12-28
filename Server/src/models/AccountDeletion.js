import mongoose from 'mongoose';

const accountDeletionSchema = new mongoose.Schema({
  // User reference (for pending deletions)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Deletion request info
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  
  // User info before deletion (snapshot - filled when completed)
  deletedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  username: {
    type: String,
    default: null
  },
  discordId: {
    type: String,
    default: null
  },
  discordUsername: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  
  // Stats snapshot
  stats: {
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
  },
  goldCoins: {
    type: Number,
    default: 0
  },
  
  // Squad info if any
  squadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  squadName: {
    type: String,
    default: null
  },
  
  // Rankings snapshot
  rankings: [{
    mode: { type: String, enum: ['hardcore', 'cdl'] },
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  }],
  
  // Deletion info
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: String,
    enum: ['self', 'admin'],
    default: 'self'
  },
  deletionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for queries
accountDeletionSchema.index({ deletedAt: -1 });
accountDeletionSchema.index({ username: 1 });
accountDeletionSchema.index({ status: 1, scheduledFor: 1 });
accountDeletionSchema.index({ user: 1, status: 1 });

const AccountDeletion = mongoose.model('AccountDeletion', accountDeletionSchema);

export default AccountDeletion;



















