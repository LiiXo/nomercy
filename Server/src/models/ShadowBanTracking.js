import mongoose from 'mongoose';

/**
 * ShadowBanTracking Model
 * Tracks players who are in a match but not connected to Iris.
 * After 10 minutes, if still disconnected, they get a 24h shadow ban.
 */
const shadowBanTrackingSchema = new mongoose.Schema({
  // User being tracked
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  discordUsername: {
    type: String
  },
  discordId: {
    type: String
  },
  
  // Match info
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  matchType: {
    type: String,
    enum: ['ranked', 'stricker', 'ladder'],
    required: true
  },
  
  // Tracking timestamps
  detectedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  // When the 10 minute check should happen
  checkAt: {
    type: Date,
    required: true
  },
  
  // Discord notification info
  discordNotificationSent: {
    type: Boolean,
    default: false
  },
  discordNotificationSentAt: {
    type: Date
  },
  
  // Status of tracking
  status: {
    type: String,
    enum: ['pending', 'cleared', 'banned', 'expired'],
    default: 'pending'
  },
  
  // Result info (when resolved)
  resolvedAt: {
    type: Date
  },
  resolutionReason: {
    type: String // 'reconnected', 'match_ended', 'banned', 'manual_clear'
  },
  
  // Ban info (if banned)
  banApplied: {
    type: Boolean,
    default: false
  },
  banExpiresAt: {
    type: Date
  },
  banReason: {
    type: String,
    default: 'Non connecté à Iris pendant un match actif'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
shadowBanTrackingSchema.index({ user: 1, status: 1 });
shadowBanTrackingSchema.index({ status: 1, checkAt: 1 });
shadowBanTrackingSchema.index({ matchId: 1, user: 1 }, { unique: true });

const ShadowBanTracking = mongoose.model('ShadowBanTracking', shadowBanTrackingSchema);

export default ShadowBanTracking;
