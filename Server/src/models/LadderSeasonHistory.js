import mongoose from 'mongoose';

const ladderSeasonHistorySchema = new mongoose.Schema({
  // Season identification
  seasonNumber: {
    type: Number,
    required: true
  },
  seasonName: {
    type: String,
    required: true
  },
  
  // Month/Year for the season
  month: {
    type: Number,
    required: true // 1-12
  },
  year: {
    type: Number,
    required: true
  },
  
  // Ladder type
  ladderId: {
    type: String,
    required: true,
    enum: ['duo-trio', 'squad-team']
  },
  ladderName: {
    type: String,
    required: true
  },
  
  // Top 3 winners
  winners: [{
    rank: {
      type: Number,
      required: true,
      min: 1,
      max: 3
    },
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      required: true
    },
    squadName: String,
    squadTag: String,
    squadColor: String,
    squadLogo: String,
    // Stats at end of season
    points: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    // Rewards given
    rewardPoints: {
      type: Number,
      default: 0
    },
    trophy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trophy'
    }
  }],
  
  // When the reset happened
  resetAt: {
    type: Date,
    default: Date.now
  },
  
  // Who triggered the reset (admin or system)
  resetBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null means automatic system reset
  }
}, {
  timestamps: true
});

// Indexes
ladderSeasonHistorySchema.index({ ladderId: 1, year: 1, month: 1 }, { unique: true });
ladderSeasonHistorySchema.index({ seasonNumber: 1 });
ladderSeasonHistorySchema.index({ ladderId: 1, resetAt: -1 });

// Get the latest season history for a ladder
ladderSeasonHistorySchema.statics.getLatest = async function(ladderId) {
  return this.findOne({ ladderId })
    .sort({ resetAt: -1 })
    .populate('winners.squad', 'name tag color logo')
    .populate('winners.trophy');
};

// Get the current season number
ladderSeasonHistorySchema.statics.getCurrentSeasonNumber = async function(ladderId) {
  const latest = await this.findOne({ ladderId }).sort({ seasonNumber: -1 });
  return latest ? latest.seasonNumber + 1 : 1;
};

const LadderSeasonHistory = mongoose.model('LadderSeasonHistory', ladderSeasonHistorySchema);

export default LadderSeasonHistory;










