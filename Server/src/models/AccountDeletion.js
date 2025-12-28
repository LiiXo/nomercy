import mongoose from 'mongoose';

const accountDeletionSchema = new mongoose.Schema({
  // User info before deletion (snapshot)
  deletedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  discordId: {
    type: String,
    required: true
  },
  discordUsername: {
    type: String,
    required: true
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
    default: Date.now
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

const AccountDeletion = mongoose.model('AccountDeletion', accountDeletionSchema);

export default AccountDeletion;


















