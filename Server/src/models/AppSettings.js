import mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema({
  // Feature toggles - Fonctionnalités activables/désactivables
  features: {
    // Mode Classé
    rankedMatchmaking: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Le matchmaking classé est temporairement désactivé.' }
    },
    rankedPosting: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'La création de matchs classés est temporairement désactivée.' }
    },
    
    // Mode Ladder (Escouades)
    ladderMatchmaking: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Les matchs ladder sont temporairement désactivés.' }
    },
    ladderPosting: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'La création de matchs ladder est temporairement désactivée.' }
    },
    
    // Escouades
    squadCreation: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'La création d\'escouades est temporairement désactivée.' }
    },
    squadInvites: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Les invitations d\'escouade sont temporairement désactivées.' }
    },
    
    // Hub
    hubPosting: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'La publication sur le hub est temporairement désactivée.' }
    },
    
    // Boutique
    shopPurchases: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Les achats sont temporairement désactivés.' }
    },
    
    // Profil
    profileEditing: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'La modification du profil est temporairement désactivée.' }
    },
    
    // Modes de jeu
    hardcoreMode: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Le mode Hardcore est temporairement désactivé.' }
    },
    cdlMode: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Le mode CDL est temporairement désactivé.' }
    },
    
    // Chat
    globalChat: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Le chat est temporairement désactivé.' }
    },
    
    // Inscription
    registration: {
      enabled: { type: Boolean, default: true },
      disabledMessage: { type: String, default: 'Les inscriptions sont temporairement fermées.' }
    },
    
    // Mode Stricker (visible pour tout le monde si activé)
    strickerMode: {
      enabled: { type: Boolean, default: false },
      disabledMessage: { type: String, default: 'Le mode Stricker sera bientôt disponible.' }
    }
  },
  
  // Messages globaux affichés sur l'app
  globalAlerts: [{
    id: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'error', 'success'], default: 'info' },
    message: { type: String, required: true },
    dismissible: { type: Boolean, default: true },
    showOnPages: [{ type: String }], // Pages où afficher l'alerte (vide = toutes)
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }
  }],
  
  // Maintenance
  maintenance: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: 'L\'application est en maintenance. Veuillez réessayer plus tard.' },
    estimatedEndTime: { type: Date, default: null }
  },
  
  // Fixed banner at top of site
  banner: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: '' },
    bgColor: { type: String, enum: ['purple', 'blue', 'green', 'orange', 'red', 'cyan'], default: 'purple' },
    link: { type: String, default: '' }
  },
  
  // Lobby game modes configuration
  lobbyGameModes: [{
    id: { type: String, required: true },
    name: {
      fr: { type: String, default: '' },
      en: { type: String, default: '' },
      de: { type: String, default: '' },
      it: { type: String, default: '' }
    },
    icon: { type: String, default: '●' },
    type: { type: String, enum: ['simple', 'hardcore'], default: 'simple' },
    enabled: { type: Boolean, default: true },
    minPlayers: { type: Number, default: 1 },
    maxPlayers: { type: Number, default: 5 },
    rules: {
      fr: { type: String, default: '' },
      en: { type: String, default: '' },
      de: { type: String, default: '' },
      it: { type: String, default: '' }
    }
  }],
  
  // Staff admin panel access control
  staffAdminAccess: {
    overview: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
    squads: { type: Boolean, default: true },
    'deleted-accounts': { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    disputes: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
    hub: { type: Boolean, default: true },
    maps: { type: Boolean, default: true },
    gamerules: { type: Boolean, default: true },
    matches: { type: Boolean, default: true },
    seasons: { type: Boolean, default: false } // Admin only by default
  },
  
  // Ladder settings
  ladderSettings: {
    // Duo/Trio time restriction (00:00-20:00 French time)
    duoTrioTimeRestriction: {
      enabled: { type: Boolean, default: true }, // When false, ladder is always open
      startHour: { type: Number, default: 0 },   // Start hour (0-23)
      endHour: { type: Number, default: 20 }     // End hour (0-23)
    }
  },
  
  // Ranked mode settings (récompenses configurées dans Config.rankedMatchRewards)
  rankedSettings: {
    // Saison en cours
    currentSeason: { type: Number, default: 1, min: 1 },
    
    // Format de match: BO1 = 1 map, BO3 = 3 maps
    bestOf: { type: Number, enum: [1, 3], default: 3 },
    
    // Seuils de points par rang
    rankPointsThresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        bronze: { min: 0, max: 499 },
        silver: { min: 500, max: 999 },
        gold: { min: 1000, max: 1499 },
        platinum: { min: 1500, max: 1999 },
        diamond: { min: 2000, max: 2499 },
        master: { min: 2500, max: 2999 },
        grandmaster: { min: 3000, max: 3499 },
        champion: { min: 3500, max: null }
      })
    },
    
    // Points perdus en défaite selon le rang du joueur (négatifs)
    pointsLossPerRank: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        bronze: -10,
        silver: -12,
        gold: -15,
        platinum: -18,
        diamond: -20,
        master: -22,
        grandmaster: -25,
        champion: -30
      })
    }
  },
  
  // Stricker mode settings
  strickerSettings: {
    // Season configuration
    currentSeason: { type: Number, default: 1, min: 1 },
    seasonDurationMonths: { type: Number, default: 2 }, // Reset every 2 months
    seasonStartDate: { type: Date, default: () => new Date() },
    
    // Points par match (victoire)
    pointsPerWin: { type: Number, default: 30 },
    
    // Points perdus par défaite
    pointsPerLoss: { type: Number, default: -15 },
    
    // Seuils de points par rang Stricker
    rankPointsThresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        recrues: { min: 0, max: 499 },
        operateurs: { min: 500, max: 999 },
        veterans: { min: 1000, max: 1499 },
        commandants: { min: 1500, max: 1999 },
        seigneurs: { min: 2000, max: 2499 },
        immortel: { min: 2500, max: null }
      })
    },
    
    // Points perdus selon différence de rang (si on perd contre un rang plus bas)
    // Index = différence de rangs (0 = même rang, 1 = 1 rang de différence, etc.)
    pointsLossPerRankDiff: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        0: -15,  // Même rang
        1: -12,  // 1 rang de différence
        2: -9,   // 2 rangs de différence
        3: -6,   // 3 rangs de différence
        4: -3,   // 4 rangs de différence
        5: -1    // 5 rangs de différence (max)
      })
    },
    
    // Bonus de points si une équipe plus faible bat une plus forte
    // Index = différence de rangs
    bonusPointsForUpset: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        0: 0,    // Même rang, pas de bonus
        1: 5,    // 1 rang de différence
        2: 10,   // 2 rangs de différence
        3: 15,   // 3 rangs de différence
        4: 20,   // 4 rangs de différence
        5: 30    // 5 rangs de différence (max)
      })
    }
  },
  
  // Événements temporaires (Double XP, Double Gold, etc.)
  events: {
    // Double XP sur le mode classé (double les points gagnés en victoire)
    doubleXP: {
      enabled: { type: Boolean, default: false },
      startsAt: { type: Date, default: null },  // Date de début programmée
      expiresAt: { type: Date, default: null }, // Date de fin
      enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      enabledAt: { type: Date, default: null }  // Date de création de l'événement
    },
    // Double Gold (double les pièces gagnées)
    doubleGold: {
      enabled: { type: Boolean, default: false },
      startsAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      enabledAt: { type: Date, default: null }
    }
  }
}, {
  timestamps: true
});

// Singleton pattern - une seule config app
appSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne().lean();
  if (!settings) {
    const newSettings = new this();
    await newSettings.save();
    settings = newSettings.toObject();
  }
  return settings;
};

export default mongoose.model('AppSettings', appSettingsSchema);

