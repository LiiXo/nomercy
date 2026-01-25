import mongoose from 'mongoose';

const itemUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopItem',
    required: true
  },
  effectType: {
    type: String,
    enum: ['double_xp', 'double_pts', 'double_gold', 'cancel_match', 'emote', 'other'],
    required: true
  },
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null // null if not used in a match
  },
  rankedMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RankedMatch',
    default: null
  },
  usedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date, // null for one-time use items
    default: null
  },
  // Match-based counting for boosters
  remainingMatches: {
    type: Number, // Number of matches remaining (null = unlimited)
    default: null
  },
  // Legacy fields kept for backward compatibility
  remainingMs: {
    type: Number, // Legacy: Remaining milliseconds (deprecated, use remainingMatches)
    default: null
  },
  matchStartTime: {
    type: Date, // Legacy: When the current match started
    default: null
  },
  inMatch: {
    type: Boolean, // Whether the user is currently in a match
    default: false
  },
  totalMatchesUsed: {
    type: Number, // Total matches used with this booster
    default: 0
  },
  totalMatchTimeUsed: {
    type: Number, // Legacy: Total milliseconds used across all matches
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  wasConsumed: {
    type: Boolean,
    default: false // True when the booster was actually used in a match
  },
  consumedAt: {
    type: Date,
    default: null
  },
  rewardMultiplier: {
    type: Number,
    default: 2 // 2x by default
  }
}, {
  timestamps: true
});

// Index for active usages
itemUsageSchema.index({ user: 1, isActive: 1, expiresAt: 1 });
itemUsageSchema.index({ match: 1 });

const ItemUsage = mongoose.model('ItemUsage', itemUsageSchema);

export default ItemUsage;




































