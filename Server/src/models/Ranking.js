import mongoose from 'mongoose';

const rankingSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Mode (hardcore or cdl)
  mode: {
    type: String,
    enum: ['hardcore', 'cdl'],
    required: true
  },
  
  // Season/Period
  season: {
    type: Number,
    default: 1
  },
  
  // Stats
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
  kills: {
    type: Number,
    default: 0
  },
  deaths: {
    type: Number,
    default: 0
  },
  
  // Calculated rank (updated periodically)
  rank: {
    type: Number,
    default: 0
  },
  
  // Division/Tier
  division: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'],
    default: 'bronze'
  },
  
  // Streak tracking
  currentStreak: {
    type: Number,
    default: 0
  },
  bestStreak: {
    type: Number,
    default: 0
  },
  
  // Team/Squad (optional)
  team: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for unique user per mode per season
rankingSchema.index({ user: 1, mode: 1, season: 1 }, { unique: true });
rankingSchema.index({ mode: 1, points: -1 }); // For leaderboard queries
rankingSchema.index({ mode: 1, season: 1, points: -1 });

// Virtual for K/D ratio
rankingSchema.virtual('kd').get(function() {
  if (this.deaths === 0) return this.kills;
  return (this.kills / this.deaths).toFixed(2);
});

// Virtual for win rate
rankingSchema.virtual('winRate').get(function() {
  const total = this.wins + this.losses;
  if (total === 0) return '0%';
  return ((this.wins / total) * 100).toFixed(1) + '%';
});

// Virtual for total matches
rankingSchema.virtual('totalMatches').get(function() {
  return this.wins + this.losses;
});

// Method to calculate division based on points (aligned with frontend RankedMode.jsx thresholds)
rankingSchema.methods.updateDivision = function() {
  if (this.points >= 3500) this.division = 'champion';
  else if (this.points >= 3000) this.division = 'grandmaster';
  else if (this.points >= 2500) this.division = 'master';
  else if (this.points >= 2000) this.division = 'diamond';
  else if (this.points >= 1500) this.division = 'platinum';
  else if (this.points >= 1000) this.division = 'gold';
  else if (this.points >= 500) this.division = 'silver';
  else this.division = 'bronze';
};

// Pre-save hook to update division
rankingSchema.pre('save', function(next) {
  this.updateDivision();
  next();
});

rankingSchema.set('toJSON', { virtuals: true });
rankingSchema.set('toObject', { virtuals: true });

const Ranking = mongoose.model('Ranking', rankingSchema);

export default Ranking;

