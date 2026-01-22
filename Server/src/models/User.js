import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Discord Info
  discordId: {
    type: String,
    required: true,
    unique: true
  },
  discordUsername: {
    type: String,
    required: true
  },
  discordAvatar: {
    type: String
  },
  discordEmail: {
    type: String
  },

  // Profile Info (user defined)
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  avatar: {
    type: String // Custom avatar URL, defaults to Discord avatar
  },
  banner: {
    type: String, // Banner image URL (PNG, JPEG, GIF - max 10MB)
    default: null
  },
  
  // Gaming Info
  platform: {
    type: String,
    enum: ['PC', 'PlayStation', 'Xbox'],
    default: null
  },
  activisionId: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },

  // Profile completion status
  isProfileComplete: {
    type: Boolean,
    default: false
  },

  // Roles
  roles: {
    type: [{
      type: String,
      enum: ['user', 'admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore']
    }],
    default: ['user']
  },

  // Game Stats per mode (Hardcore)
  statsHardcore: {
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },
  
  // Game Stats per mode (CDL)
  statsCdl: {
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },
  
  // Legacy stats field (deprecated, kept for backward compatibility)
  stats: {
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },

  // Currency
  goldCoins: {
    type: Number,
    default: 500
  },

  // Squad
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },

  // Historique des matchs joués (pour tracking fiable)
  matchHistory: [{
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    squad: { type: mongoose.Schema.Types.ObjectId, ref: 'Squad' }, // L'escouade avec laquelle il a joué
    result: { type: String, enum: ['win', 'loss'] },
    playedAt: { type: Date, default: Date.now }
  }],

  // Account status
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String
  },
  bannedAt: {
    type: Date,
    default: null
  },
  banExpiresAt: {
    type: Date,
    default: null // null = permanent ban
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Ban référent - empêche d'être sélectionné comme référent dans les matchs classés
  isReferentBanned: {
    type: Boolean,
    default: false
  },
  referentBannedAt: {
    type: Date,
    default: null
  },
  referentBannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Warnings - avertissements donnés par les admins/staff/arbitres
  warns: [{
    reason: { type: String, required: true },
    warnedAt: { type: Date, default: Date.now },
    warnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Ban du mode classé (ranked) - empêche de jouer en ranked pendant une durée
  isRankedBanned: {
    type: Boolean,
    default: false
  },
  rankedBanReason: {
    type: String,
    default: null
  },
  rankedBannedAt: {
    type: Date,
    default: null
  },
  rankedBanExpiresAt: {
    type: Date,
    default: null // null = permanent ranked ban
  },
  rankedBannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Stats reset - first one is free, then costs 2000 gold each
  statsResetCount: {
    type: Number,
    default: 0
  },
  
  // IP tracking
  lastIp: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  
}, {
  timestamps: true
});

// Virtual for full avatar URL
userSchema.virtual('avatarUrl').get(function() {
  // If custom avatar is set (uploaded), return full URL
  if (this.avatar && this.avatar.startsWith('/uploads/avatars/')) {
    return `https://api-nomercy.ggsecure.io${this.avatar}`;
  }
  // If avatar is already a full URL, return it
  if (this.avatar) return this.avatar;
  // Fallback to Discord avatar
  if (this.discordAvatar && this.discordId) {
    return `https://cdn.discordapp.com/avatars/${this.discordId}/${this.discordAvatar}.png`;
  }
  return null;
});

// Method to check if user has a specific role
userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

// Method to check if user is admin or staff
userSchema.methods.isStaff = function() {
  return this.roles.includes('admin') || this.roles.includes('staff');
};

// Method to check if user is arbitre (referee)
userSchema.methods.isArbitre = function() {
  return this.roles.includes('arbitre');
};

// Method to check if user has admin panel access (admin, staff, or arbitre)
userSchema.methods.hasAdminAccess = function() {
  return this.roles.includes('admin') || this.roles.includes('staff') || this.roles.includes('arbitre');
};

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;

