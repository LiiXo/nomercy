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
      enum: ['user', 'admin', 'staff', 'gerant_cdl', 'gerant_hardcore']
    }],
    default: ['user']
  },

  // Game Stats (global - all modes combined)
  stats: {
    points: { type: Number, default: 0 },
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
  }
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

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;

