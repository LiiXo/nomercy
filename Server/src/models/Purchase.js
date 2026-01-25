import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopItem',
    required: true
  },
  // Store item details at time of purchase
  itemSnapshot: {
    name: String,
    price: Number,
    category: String,
    rarity: String,
    isUsable: Boolean,
    effectType: String,
    duration: Number
  },
  pricePaid: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'used'],
    default: 'completed'
  },
  // For usable items
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date,
    default: null
  },
  // For gifted items (admin give feature)
  isGift: {
    type: Boolean,
    default: false
  },
  giftedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for user purchases
purchaseSchema.index({ user: 1, createdAt: -1 });
purchaseSchema.index({ item: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;

