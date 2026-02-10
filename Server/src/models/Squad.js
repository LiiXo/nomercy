import mongoose from 'mongoose';

const squadSchema = new mongoose.Schema({
  // Squad info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  tag: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 5
  },
  description: {
    type: String,
    default: '',
    maxlength: 200
  },
  
  // Leader
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Members (including leader)
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['leader', 'officer', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Invites pending
  pendingInvites: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Join requests
  joinRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Settings
  isPublic: {
    type: Boolean,
    default: true // true = anyone can request to join, false = invite only
  },
  maxMembers: {
    type: Number,
    default: 10
  },
  
  // Mode
  mode: {
    type: String,
    enum: ['hardcore', 'cdl', 'both'],
    default: 'both'
  },
  
  // Stats per mode (Hardcore)
  statsHardcore: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  
  // Stats per mode (CDL)
  statsCdl: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  
  // Stats per mode (Stricker)
  statsStricker: {
    points: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: String, default: 'Recrues' } // Default rank for Stricker mode
  },
  
  // Munitions - Squad currency for Stricker mode
  // Earned: 20 per Stricker match, bonus from season rewards (top 10)
  cranes: {
    type: Number,
    default: 0
  },
  
  // Legacy stats field (deprecated, kept for backward compatibility)
  stats: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 }
  },
  
  // Level system
  experience: {
    type: Number,
    default: 0
  },
  
  // Logo/Avatar (URL)
  logo: {
    type: String,
    default: ''
  },
  
  // Banner image (uploaded)
  banner: {
    type: String, // Banner image URL (PNG, JPEG, GIF - max 10MB)
    default: null
  },
  
  // Banner color
  color: {
    type: String,
    default: '#ef4444' // red by default
  },
  
  // Invite code for direct join
  inviteCode: {
    type: String,
    unique: true,
    sparse: true // allows null/undefined values while keeping uniqueness
  },
  inviteCodeExpiresAt: {
    type: Date,
    default: null
  },
  
  // Registered ladders
  registeredLadders: [{
    ladderId: {
      type: String,
      required: true
    },
    ladderName: String,
    registeredAt: {
      type: Date,
      default: Date.now
    },
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
    }
  }],
  
  // Trophies earned/assigned
  trophies: [{
    trophy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trophy'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],

  // Deletion status
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for searching
squadSchema.index({ name: 'text', tag: 'text' });
squadSchema.index({ 'members.user': 1 });
squadSchema.index({ leader: 1 });
// Performance indexes for leaderboard queries
squadSchema.index({ 'statsHardcore.totalPoints': -1 }); // Top squad hardcore
squadSchema.index({ 'statsCdl.totalPoints': -1 }); // Top squad CDL
squadSchema.index({ 'statsStricker.points': -1 }); // Stricker squad leaderboard
squadSchema.index({ isDeleted: 1, 'statsStricker.points': -1 }); // Stricker leaderboard filtered
squadSchema.index({ 'registeredLadders.ladderId': 1 }); // Ladder queries

// Virtual for member count
squadSchema.virtual('memberCount').get(function() {
  return this.members?.length || 0;
});

// XP Table - Total XP needed for each level (1-100)
// Formula: level^2 * 100 (smoother progression)
const getXpForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(Math.pow(level, 2) * 100);
};

// Virtual for level calculation
squadSchema.virtual('level').get(function() {
  const xp = this.experience || 0;
  for (let lvl = 100; lvl >= 1; lvl--) {
    if (xp >= getXpForLevel(lvl)) {
      return lvl;
    }
  }
  return 1;
});

// Virtual for XP progress within current level
squadSchema.virtual('levelProgress').get(function() {
  const xp = this.experience || 0;
  const currentLevel = this.level;
  if (currentLevel >= 100) return { current: 0, required: 0, percentage: 100 };
  
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpInLevel = xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  
  return {
    current: xpInLevel,
    required: xpNeeded,
    percentage: Math.floor((xpInLevel / xpNeeded) * 100)
  };
});

// Static method to get XP requirements
squadSchema.statics.getXpForLevel = getXpForLevel;

// Check if user is member
squadSchema.methods.isMember = function(userId) {
  if (!this.members) return false;
  return this.members.some(m => m.user?.toString() === userId?.toString());
};

// Check if user is leader or officer
squadSchema.methods.canManage = function(userId) {
  if (!this.members) return false;
  const member = this.members.find(m => m.user?.toString() === userId?.toString());
  return member && (member.role === 'leader' || member.role === 'officer');
};

// Check if user is leader
squadSchema.methods.isLeader = function(userId) {
  return this.leader.toString() === userId.toString();
};

squadSchema.set('toJSON', { virtuals: true });
squadSchema.set('toObject', { virtuals: true });

const Squad = mongoose.model('Squad', squadSchema);

export default Squad;



