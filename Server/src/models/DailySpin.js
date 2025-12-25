import mongoose from 'mongoose';

const dailySpinSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastSpinDate: {
    type: Date,
    default: null
  },
  totalSpins: {
    type: Number,
    default: 0
  },
  itemsWon: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopItem'
    },
    wonAt: {
      type: Date,
      default: Date.now
    }
  }],
  goldWon: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index pour recherche rapide par user
dailySpinSchema.index({ user: 1 });

export default mongoose.model('DailySpin', dailySpinSchema);


