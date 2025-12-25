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
    rarity: String
  },
  pricePaid: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Index for user purchases
purchaseSchema.index({ user: 1, createdAt: -1 });
purchaseSchema.index({ item: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;

