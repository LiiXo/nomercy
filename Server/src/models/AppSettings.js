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
  
  // Ranked mode settings
  rankedSettings: {
    // Format de match: BO1 = 1 map, BO3 = 3 maps
    bestOf: { type: Number, enum: [1, 3], default: 3 },
    
    // Points à gagner/perdre par rang (pour passer au rang supérieur/inférieur)
    rankPointsThresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        bronze: { min: 0, max: 499 },
        silver: { min: 500, max: 999 },
        gold: { min: 1000, max: 1499 },
        platinum: { min: 1500, max: 1999 },
        diamond: { min: 2000, max: 2499 },
        master: { min: 2500, max: 2999 },
        champion: { min: 3000, max: null }
      })
    },
    
    // Configuration par mode de jeu
    searchAndDestroy: {
      enabled: { type: Boolean, default: true },
      // Récompenses en victoire/défaite
      rewards: {
        pointsWin: { type: Number, default: 25 },    // Points gagnés en victoire
        pointsLose: { type: Number, default: -15 },  // Points perdus en défaite
        goldWin: { type: Number, default: 50 },      // Gold gagné en victoire
        goldLoss: { type: Number, default: 10 }      // Gold de consolation en défaite
      },
      // Configuration du matchmaking
      matchmaking: {
        minPlayers: { type: Number, default: 6 },    // Minimum pour 3v3
        maxPlayers: { type: Number, default: 10 },   // Maximum pour 5v5
        waitTimer: { type: Number, default: 120 }    // Timer d'attente en secondes (2 min)
      }
    },
    teamDeathmatch: {
      enabled: { type: Boolean, default: false },
      rewards: {
        pointsWin: { type: Number, default: 25 },
        pointsLose: { type: Number, default: -15 },
        goldWin: { type: Number, default: 50 },
        goldLoss: { type: Number, default: 10 }
      }
    },
    domination: {
      enabled: { type: Boolean, default: false },
      rewards: {
        pointsWin: { type: Number, default: 25 },
        pointsLose: { type: Number, default: -15 },
        goldWin: { type: Number, default: 50 },
        goldLoss: { type: Number, default: 10 }
      }
    },
    captureTheFlag: {
      enabled: { type: Boolean, default: false },
      rewards: {
        pointsWin: { type: Number, default: 25 },
        pointsLose: { type: Number, default: -15 },
        goldWin: { type: Number, default: 50 },
        goldLoss: { type: Number, default: 10 }
      }
    },
    killConfirmed: {
      enabled: { type: Boolean, default: false },
      rewards: {
        pointsWin: { type: Number, default: 25 },
        pointsLose: { type: Number, default: -15 },
        goldWin: { type: Number, default: 50 },
        goldLoss: { type: Number, default: 10 }
      }
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

