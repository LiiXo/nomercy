import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
  // Season identification
  number: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  
  // Season period
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['upcoming', 'active', 'ended'],
    default: 'upcoming'
  },
  
  // Rank thresholds for this season
  rankThresholds: {
    bronze: { type: Number, default: 0 },
    silver: { type: Number, default: 1000 },
    gold: { type: Number, default: 2000 },
    platinum: { type: Number, default: 3000 },
    diamond: { type: Number, default: 4000 },
    master: { type: Number, default: 5000 },
    legend: { type: Number, default: 6000 }
  },
  
  // Points configuration
  pointsConfig: {
    winBase: { type: Number, default: 25 },
    lossBase: { type: Number, default: -15 },
    winStreak: { type: Number, default: 5 }, // Bonus per win streak
    maxWinStreak: { type: Number, default: 5 } // Max win streak multiplier
  },
  
  // Rewards for end of season
  rewards: [{
    rank: String,
    minPosition: Number,
    maxPosition: Number,
    nmCoins: Number,
    trophyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trophy'
    },
    title: String, // Special title reward
    description: String
  }],
  
  // Statistics
  stats: {
    totalPlayers: { type: Number, default: 0 },
    totalMatches: { type: Number, default: 0 },
    averageRank: { type: Number, default: 0 }
  },
  
  // Final leaderboard (populated at end of season)
  finalLeaderboard: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rank: Number,
    points: Number,
    tier: String,
    wins: Number,
    losses: Number,
    rewardsGiven: { type: Boolean, default: false }
  }],
  
  // Mode (hardcore or cdl)
  mode: {
    type: String,
    enum: ['hardcore', 'cdl'],
    default: 'hardcore'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    default: ''
  },
  
  // Feature flags for this season
  features: {
    placements: { type: Boolean, default: true }, // Require placement matches
    placementMatches: { type: Number, default: 10 },
    decayEnabled: { type: Boolean, default: false }, // Rank decay for inactivity
    decayDays: { type: Number, default: 7 },
    decayPoints: { type: Number, default: 50 }
  }
}, {
  timestamps: true
});

// Indexes
seasonSchema.index({ status: 1 });
seasonSchema.index({ mode: 1, status: 1 });
seasonSchema.index({ startDate: 1, endDate: 1 });

// Get current active season
seasonSchema.statics.getCurrentSeason = async function(mode = 'hardcore') {
  return this.findOne({ 
    mode, 
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });
};

// Check and update season statuses
seasonSchema.statics.updateSeasonStatuses = async function() {
  const now = new Date();
  
  // Start upcoming seasons that should be active
  await this.updateMany(
    {
      status: 'upcoming',
      startDate: { $lte: now }
    },
    { $set: { status: 'active' } }
  );
  
  // End active seasons that are past end date
  await this.updateMany(
    {
      status: 'active',
      endDate: { $lt: now }
    },
    { $set: { status: 'ended' } }
  );
};

const Season = mongoose.model('Season', seasonSchema);

export default Season;




















