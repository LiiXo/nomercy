import mongoose from 'mongoose';

const tournamentMatchSchema = new mongoose.Schema({
  // Reference to the tournament
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  
  // Round number (1, 2, 3... or 'group')
  round: {
    type: Number,
    required: true
  },
  
  // Round name (e.g., "Round of 16", "Quarter-Finals", "Semi-Finals", "Finals")
  roundName: {
    type: String,
    default: ''
  },
  
  // Match number within the round
  matchNumber: {
    type: Number,
    required: true
  },
  
  // Group name if group stage match
  groupName: {
    type: String,
    default: null
  },
  
  // Participant 1 (can be squad or user based on tournament type)
  participant1: {
    // For team tournaments
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      default: null
    },
    squadInfo: {
      name: String,
      tag: String,
      color: String,
      logo: String
    },
    // For solo tournaments
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userInfo: {
      username: String,
      discordId: String,
      avatar: String,
      avatarUrl: String
    },
    // If this is a bot
    isBot: { type: Boolean, default: false },
    botName: { type: String, default: null },
    // Index in tournament.participants array
    participantIndex: { type: Number, default: null },
    // Score for this match
    score: { type: Number, default: 0 },
    // Victory claim
    claimedVictory: { type: Boolean, default: false },
    claimedAt: { type: Date, default: null }
  },
  
  // Participant 2
  participant2: {
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      default: null
    },
    squadInfo: {
      name: String,
      tag: String,
      color: String,
      logo: String
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userInfo: {
      username: String,
      discordId: String,
      avatar: String,
      avatarUrl: String
    },
    isBot: { type: Boolean, default: false },
    botName: { type: String, default: null },
    participantIndex: { type: Number, default: null },
    score: { type: Number, default: 0 },
    claimedVictory: { type: Boolean, default: false },
    claimedAt: { type: Date, default: null }
  },
  
  // Match status
  status: {
    type: String,
    enum: ['pending', 'ready', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  
  // Winner (participant1 or participant2 or null)
  winner: {
    type: String,
    enum: ['participant1', 'participant2', null],
    default: null
  },
  
  // Winner participant index (from tournament.participants)
  winnerIndex: {
    type: Number,
    default: null
  },
  
  // Game code for the match
  gameCode: {
    type: String,
    default: null
  },
  
  // Host (who provides the game code)
  host: {
    type: String,
    enum: ['participant1', 'participant2', null],
    default: null
  },
  
  // Maps for the match (for BO3)
  maps: [{
    name: String,
    image: String,
    order: Number,
    winner: {
      type: String,
      enum: ['participant1', 'participant2', null],
      default: null
    },
    score1: { type: Number, default: 0 },
    score2: { type: Number, default: 0 }
  }],
  
  // Format (bo1, bo3)
  format: {
    type: String,
    enum: ['bo1', 'bo3'],
    default: 'bo1'
  },
  
  // Mode (hardcore, cdl)
  mode: {
    type: String,
    enum: ['hardcore', 'cdl'],
    required: true
  },
  
  // Team size
  teamSize: {
    type: Number,
    default: 4
  },
  
  // Chat messages
  chat: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderUsername: String,
    senderSquad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    message: String,
    isSystem: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Dispute information
  dispute: {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: Date,
    reason: String,
    evidence: [{
      uploadedBy: mongoose.Schema.Types.ObjectId,
      imageUrl: String,
      description: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String
  },
  
  // Timestamps
  scheduledAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Indexes
tournamentMatchSchema.index({ tournament: 1, round: 1 });
tournamentMatchSchema.index({ tournament: 1, status: 1 });
tournamentMatchSchema.index({ 'participant1.squad': 1 });
tournamentMatchSchema.index({ 'participant2.squad': 1 });
tournamentMatchSchema.index({ 'participant1.user': 1 });
tournamentMatchSchema.index({ 'participant2.user': 1 });

// Method to check if both participants have claimed victory for themselves
tournamentMatchSchema.methods.hasConflict = function() {
  return this.participant1.claimedVictory && this.participant2.claimedVictory;
};

// Method to check if match can be auto-completed (both claim same winner)
tournamentMatchSchema.methods.canAutoComplete = function() {
  // If one claims victory for self and other doesn't claim
  if (this.participant1.claimedVictory && !this.participant2.claimedVictory) {
    return { canComplete: false, waitingFor: 'participant2' };
  }
  if (this.participant2.claimedVictory && !this.participant1.claimedVictory) {
    return { canComplete: false, waitingFor: 'participant1' };
  }
  // Both claimed - conflict
  if (this.participant1.claimedVictory && this.participant2.claimedVictory) {
    return { canComplete: false, conflict: true };
  }
  return { canComplete: false };
};

export default mongoose.model('TournamentMatch', tournamentMatchSchema);
