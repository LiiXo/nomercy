import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  // Squad qui poste le match
  challenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    required: true
  },
  // Info de la squad challenger (sauvegardé pour l'historique même si squad supprimée)
  challengerInfo: {
    name: String,
    tag: String,
    color: String,
    logo: String
  },
  // Squad qui accepte le match (null si en attente)
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  // Info de la squad opponent (sauvegardé pour l'historique même si squad supprimée)
  opponentInfo: {
    name: String,
    tag: String,
    color: String,
    logo: String
  },
  // Ladder concerné (duo-trio ou squad-team)
  ladderId: {
    type: String,
    required: true,
    enum: ['duo-trio', 'squad-team']
  },
  // Mode de jeu
  mode: {
    type: String,
    required: true,
    enum: ['hardcore', 'cdl']
  },
  // Mode de jeu spécifique
  gameMode: {
    type: String,
    required: true,
    enum: ['Search & Destroy', 'Domination', 'Kill Confirmed', 'CTF']
  },
  // Taille de l'équipe (2, 3, 4 ou 5)
  teamSize: {
    type: Number,
    required: true,
    enum: [2, 3, 4, 5]
  },
  // Type de map (aléatoire ou libre)
  mapType: {
    type: String,
    enum: ['random', 'free'],
    default: 'random'
  },
  // Maps générées aléatoirement (3 maps)
  randomMaps: [{
    name: String,
    image: String,
    order: Number // 1, 2, 3
  }],
  // Match instantané (prêt maintenant) ou planifié
  isReady: {
    type: Boolean,
    default: false
  },
  // Date et heure du match (null si isReady = true)
  scheduledAt: {
    type: Date,
    default: null
  },
  // Statut du match
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired', 'disputed'],
    default: 'pending'
  },
  // Équipe hôte (celle qui fournit le code)
  hostTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad'
  },
  // Code de partie pour rejoindre
  gameCode: {
    type: String,
    default: null
  },
  // Roster de l'équipe challenger
  challengerRoster: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isHelper: { type: Boolean, default: false }
  }],
  // Roster de l'équipe adversaire
  opponentRoster: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isHelper: { type: Boolean, default: false }
  }],
  // Demandes d'annulation mutuelle
  cancelRequests: [{
    squad: { type: mongoose.Schema.Types.ObjectId, ref: 'Squad' },
    requestedAt: { type: Date, default: Date.now }
  }],
  
  // Informations sur le litige
  dispute: {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    reportedAt: Date,
    reason: {
      type: String,
      maxlength: 500
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String,
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    }
  },
  // Description/message optionnel
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  // Résultat du match (après completion)
  result: {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    challengerScore: {
      type: Number,
      default: 0
    },
    opponentScore: {
      type: Number,
      default: 0
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    reportedAt: Date,
    confirmed: {
      type: Boolean,
      default: false
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmedAt: Date,
    isForfeit: {
      type: Boolean,
      default: false
    },
    forfeitReason: {
      type: String,
      maxlength: 200
    }
  },
  // Qui a créé le match
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Date d'acceptation
  acceptedAt: Date,
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Date de début du match (pour les matchs "ready" ou au moment où le match planifié commence)
  startedAt: Date,
  // Chat du match
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Optional for system messages
    },
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad'
    },
    message: {
      type: String,
      required: false, // Not required if image is present
      maxlength: 500
    },
    imageUrl: {
      type: String,
      default: null
    },
    isStaff: {
      type: Boolean,
      default: false
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { 
  timestamps: true 
});

// Index pour les requêtes fréquentes
matchSchema.index({ status: 1, scheduledAt: 1 });
matchSchema.index({ challenger: 1, status: 1 });
matchSchema.index({ opponent: 1, status: 1 });
matchSchema.index({ ladderId: 1, mode: 1, status: 1 });
matchSchema.index({ isReady: 1, status: 1 });

// Index TTL pour supprimer automatiquement les matchs expirés après 24h
// (les matchs pending seront marqués expired par le cron job)
matchSchema.index({ scheduledAt: 1 }, { 
  expireAfterSeconds: 86400, // 24 heures après scheduledAt
  partialFilterExpression: { status: 'expired' }
});

export default mongoose.model('Match', matchSchema);
