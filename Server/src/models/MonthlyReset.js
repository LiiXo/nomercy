import mongoose from 'mongoose';

const monthlyResetSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  ladderId: {
    type: String,
    required: true
  },
  // Snapshot des 3 premières places avant le reset
  winners: [{
    rank: Number,
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    squadName: String,
    points: Number,
    wins: Number,
    losses: Number,
    trophy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trophy'
    }
  }],
  resetAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index composé pour éviter les doublons
monthlyResetSchema.index({ month: 1, year: 1, ladderId: 1 }, { unique: true });

const MonthlyReset = mongoose.model('MonthlyReset', monthlyResetSchema);

export default MonthlyReset;




















