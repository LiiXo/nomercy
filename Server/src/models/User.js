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
  platformChangedAt: {
    type: Date,
    default: null // Tracks when platform was last changed (24h cooldown)
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
      enum: ['user', 'admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore', 'vip']
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
  
  // Game Stats per mode (Stricker) - Legacy (kept for backward compatibility)
  statsStricker: {
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },
  
  // Game Stats per format (Stricker 3v3)
  statsStricker3v3: {
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },
  
  // Game Stats per format (Stricker 5v5)
  statsStricker5v5: {
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

  // Squad per mode (users can have one squad per mode)
  squadHardcore: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  squadCdl: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  squadStricker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  
  // Legacy squad field (deprecated, kept for backward compatibility)
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
  statsResetAt: {
    type: Date,
    default: null // When stats were last reset - matches before this date are excluded from history
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

  // Equipped cosmetics from shop
  equippedTitle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopItem',
    default: null
  },
  equippedProfileAnimation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopItem',
    default: null
  },
  
  // MVP count per mode (voted by players after ranked matches)
  mvpCountHardcore: {
    type: Number,
    default: 0
  },
  mvpCountCdl: {
    type: Number,
    default: 0
  },
  
  // Trophies earned (ranked mode seasons, achievements, etc.)
  trophies: [{
    trophy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trophy'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    season: {
      type: Number,
      default: null
    },
    reason: String,
    // Season stats (for ranked trophies)
    position: {
      type: Number,
      default: null
    },
    wins: {
      type: Number,
      default: null
    },
    losses: {
      type: Number,
      default: null
    },
    points: {
      type: Number,
      default: null
    },
    mode: {
      type: String,
      enum: ['hardcore', 'cdl', null],
      default: null
    }
  }],

  // Iris Anticheat - Hardware binding
  irisHardwareId: {
    type: String,
    default: null,
    sparse: true,
    index: true
  },
  irisSystemInfo: {
    cpu: {
      manufacturer: String,
      brand: String,
      cores: Number,
      physicalCores: Number
    },
    system: {
      manufacturer: String,
      model: String,
      uuid: String
    },
    os: {
      platform: String,
      distro: String,
      release: String,
      arch: String
    },
    memory: {
      total: Number
    },
    gpu: {
      vendor: String,
      model: String,
      vram: Number
    },
    baseboard: {
      manufacturer: String,
      model: String
    }
  },
  irisLastSeen: {
    type: Date,
    default: null
  },
  irisRegisteredAt: {
    type: Date,
    default: null
  },
  irisSecurityStatus: {
    tpm: {
      present: Boolean,
      enabled: Boolean,
      version: String
    },
    secureBoot: Boolean,
    virtualization: Boolean,
    virtualizationType: String,
    iommu: Boolean,
    kernelDmaProtection: Boolean, // Critical: IOMMU enforced at OS level to block DMA cheats
    hvci: Boolean,
    vbs: Boolean,
    defender: Boolean,
    defenderRealtime: Boolean,
    // Process and device info
    processes: [{
      name: String,
      pid: Number,
      path: String
    }],
    usbDevices: [{
      name: String,
      device_id: String,
      manufacturer: String
    }],
    cheatDetection: {
      found: { type: Boolean, default: false },
      riskScore: { type: Number, default: 0 },
      riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
      devices: [{
        type: String,
        name: String,
        vid: String,
        pid: String,
        manufacturer: String,
        severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'critical' }
      }],
      processes: [{
        name: String,
        pid: Number,
        path: String,
        matchedCheat: String
      }],
      suspiciousUsb: [{
        name: String,
        manufacturer: String,
        vid: String,
        pid: String,
        reason: String
      }],
      gamesRunning: [{
        name: String,
        display: String,
        processName: String
      }],
      warnings: [String]
    },
    // Verification fields
    verified: { type: Boolean, default: false },
    tamperDetected: { type: Boolean, default: false },
    verificationIssues: [String],
    antiTamperClean: { type: Boolean, default: true },
    antiTamperAlerts: [String],
    integrityHash: String,
    verifiedAt: Date,
    // Client tampering
    clientTampered: { type: Boolean, default: false },
    tamperDetectedAt: Date,
    // Network Monitor (VPN/Proxy detection)
    networkMonitor: {
      vpnDetected: { type: Boolean, default: false },
      proxyDetected: { type: Boolean, default: false },
      vpnAdapters: [String],
      vpnProcesses: [String],
      proxySettings: String,
      riskScore: { type: Number, default: 0 }
    },
    // Registry Scan (cheat traces)
    registryScan: {
      tracesFound: { type: Boolean, default: false },
      traces: [{
        path: String,
        cheatName: String,
        traceType: { type: String, enum: ['install', 'uninstall', 'spoofer', 'driver'] }
      }],
      riskScore: { type: Number, default: 0 }
    },
    // Driver Integrity (suspicious kernel drivers)
    driverIntegrity: {
      suspiciousFound: { type: Boolean, default: false },
      suspiciousDrivers: [{
        name: String,
        displayName: String,
        path: String,
        reason: String
      }],
      riskScore: { type: Number, default: 0 }
    },
    // Macro Detection (AHK, Logitech macros, etc.)
    macroDetection: {
      macrosDetected: { type: Boolean, default: false },
      detectedSoftware: [{
        name: String,
        macroType: { type: String, enum: ['ahk', 'logitech', 'razer', 'corsair', 'generic'] },
        source: { type: String, enum: ['process', 'registry', 'window'] }
      }],
      riskScore: { type: Number, default: 0 }
    },
    // Overlay Detection (cheat overlays, ESP, aimbot visual)
    overlayDetection: {
      overlaysFound: { type: Boolean, default: false },
      suspiciousOverlays: [{
        windowTitle: String,
        processName: String,
        className: String,
        reason: { type: String, enum: ['transparent_topmost', 'layered_topmost', 'cheat_process', 'suspicious_class'] }
      }],
      riskScore: { type: Number, default: 0 }
    },
    // DLL Injection Detection
    dllInjection: {
      injectionDetected: { type: Boolean, default: false },
      suspiciousDlls: [{
        name: String,
        path: String,
        reason: String
      }],
      riskScore: { type: Number, default: 0 }
    },
    // VM Detection (Virtual Machine)
    vmDetection: {
      vmDetected: { type: Boolean, default: false },
      vmType: String, // "VMware", "VirtualBox", "Hyper-V", "QEMU", etc.
      vmIndicators: [String],
      riskScore: { type: Number, default: 0 }
    },
    // Cloud PC Detection (Shadow, GeForce NOW, etc.)
    cloudPcDetection: {
      cloudPcDetected: { type: Boolean, default: false },
      cloudProvider: String, // "Shadow", "GeForce NOW", "Parsec", etc.
      cloudIndicators: [String],
      isGamingCloud: { type: Boolean, default: false },
      riskScore: { type: Number, default: 0 }
    }
  },
  
  // Iris client verification
  irisClientVerified: { type: Boolean, default: false },
  irisClientVersion: String,
  irisClientCodeHash: String,
  irisVerifiedAt: Date,
  
  // Iris scan channel (for Discord notifications)
  irisScanChannelId: String,
  irisScanMode: { type: Boolean, default: false }, // Scan mode enabled by admin
  irisScanImmediateRequest: { type: Boolean, default: false }, // Request immediate screenshots on next ping/heartbeat
  irisWasConnected: { type: Boolean, default: false }, // Track connection state for notifications
  
  // Iris detection history (keeps track of all detections even if no longer active)
  irisDetectionHistory: [{
    detectedAt: { type: Date, required: true },
    type: { type: String, required: true }, // 'cheat', 'macro', 'cheat_window', 'driver', 'registry', etc.
    name: { type: String, required: true }, // e.g., 'DS4Windows', 'EngineOwning', etc.
    details: { type: String }, // Additional details
    riskLevel: { type: String }, // 'critical', 'high', 'medium', 'low'
    riskScore: { type: Number }
  }],
  
  // Iris session history (connection/disconnection tracking)
  irisSessionHistory: [{
    connectedAt: { type: Date, required: true },
    disconnectedAt: { type: Date, default: null },
    duration: { type: Number, default: null }, // Duration in seconds
    clientVersion: String,
    hardwareId: String
  }],
  // Current session ID (to track ongoing session)
  irisCurrentSessionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  
  // Iris game detection (anti-bypass: detect if game is running on Iris machine)
  irisGameDetection: {
    lastDetected: { type: Date, default: null },
    gameRunning: { type: Boolean, default: false },
    gameName: { type: String, default: null },
    gameWindowActive: { type: Boolean, default: false },
    mismatchCount: { type: Number, default: 0 }, // Consecutive times in match without game detected
    lastMismatchAt: { type: Date, default: null },
    // Window activity tracking during matches
    matchActivityTracking: {
      matchId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Current match being tracked
      matchType: { type: String, enum: ['ranked', 'stricker', null], default: null },
      trackingStartedAt: { type: Date, default: null },
      totalSamples: { type: Number, default: 0 },    // Total heartbeat samples during match
      activeSamples: { type: Number, default: 0 },   // Samples where game window was active
      activityPercentage: { type: Number, default: 0 }, // Calculated % (0-100)
      lastActiveAt: { type: Date, default: null },
      consecutiveInactive: { type: Number, default: 0 }, // Consecutive samples with inactive window
      lowActivityAlertSent: { type: Boolean, default: false } // Prevent duplicate alerts
    }
  },
  
}, {
  timestamps: true
});

// Virtual for full avatar URL (site avatar only, no Discord fallback)
userSchema.virtual('avatarUrl').get(function() {
  // If custom avatar is set (uploaded), return full URL
  if (this.avatar && this.avatar.startsWith('/uploads/avatars/')) {
    return `https://api-nomercy.ggsecure.io${this.avatar}`;
  }
  // If avatar is already a full URL (but not Discord), return it
  if (this.avatar && !this.avatar.includes('cdn.discordapp.com')) {
    return this.avatar;
  }
  // No fallback to Discord - return null so frontend uses default avatar
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

// Performance indexes for leaderboard and ranking queries
userSchema.index({ 'statsHardcore.xp': -1 }); // Top players hardcore
userSchema.index({ 'statsCdl.xp': -1 }); // Top players CDL
userSchema.index({ 'statsStricker.points': -1 }); // Stricker leaderboard (legacy)
userSchema.index({ 'statsStricker3v3.points': -1 }); // Stricker 3v3 leaderboard
userSchema.index({ 'statsStricker5v5.points': -1 }); // Stricker 5v5 leaderboard
userSchema.index({ mvpCountHardcore: -1 }); // MVP leader hardcore
userSchema.index({ mvpCountCdl: -1 }); // MVP leader CDL
userSchema.index({ isBanned: 1, username: 1 }); // Filtered user queries

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;

