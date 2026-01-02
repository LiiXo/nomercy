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
    enum: ['double_xp', 'double_gold', 'cancel_match', 'emote', 'other'],
    required: true
  },
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null // null if not used in a match
  },
  usedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date, // null for one-time use items
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for active usages
itemUsageSchema.index({ user: 1, isActive: 1, expiresAt: 1 });
itemUsageSchema.index({ match: 1 });

const ItemUsage = mongoose.model('ItemUsage', itemUsageSchema);

export default ItemUsage;























