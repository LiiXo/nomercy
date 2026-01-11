import mongoose from 'mongoose';

// Schema pour les joueurs dans un match classé
const rankedPlayerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Not required for fake/test players
    default: null
  },
  username: String, // Sauvegardé pour l'historique
  rank: String, // Bronze, Silver, Gold, etc.
  points: Number, // Points au moment du match
  team: {
    type: Number, // 1 ou 2
    default: null
  },
  isReferent: { // Référent de l'équipe (peut déclarer litige et résultat)
    type: Boolean,
    default: false
  },
  isFake: { // Pour identifier les joueurs de test
    type: Boolean,
    default: false
  },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  // Récompenses attribuées à ce joueur
  rewards: {
    pointsChange: { type: Number, default: 0 },
    goldEarned: { type: Number, default: 0 }
  },
  // Date d'entrée dans la file d'attente (pour savoir qui éjecter)
  queueJoinedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const rankedMatchSchema = new mongoose.Schema({
  // Mode de jeu spécifique
  gameMode: {
    type: String,
    required: true,
    enum: ['Search & Destroy', 'Team Deathmatch', 'Duel']
  },
  // Mode hardcore ou cdl
  mode: {
    type: String,
    required: true,
    enum: ['hardcore', 'cdl']
  },
  // Taille des équipes (3v3, 4v4, 5v5)
  teamSize: {
    type: Number,
    enum: [3, 4, 5],
    required: true
  },
  // Liste des joueurs
  players: [rankedPlayerSchema],
  
  // Référent équipe 1 (tiré au sort, peut déclarer résultat/litige)
  team1Referent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Référent équipe 2
  team2Referent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Équipe hôte (1 ou 2 - tirée au sort)
  hostTeam: {
    type: Number,
    enum: [1, 2],
    default: null
  },
  // Statut du match
  status: {
    type: String,
    enum: ['pending', 'ready', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  // Code de partie pour rejoindre
  gameCode: {
    type: String,
    default: null
  },
  // Maps générées aléatoirement (3 maps pour BO3)
  maps: [{
    name: String,
    image: String,
    order: Number, // 1, 2, 3
    winner: { type: Number, enum: [1, 2], default: null } // Équipe gagnante de cette map
  }],
  // Bracket de rang pour le matchmaking (optionnel, peut être mixte)
  rankBracket: {
    type: String,
    default: 'mixed'
  },
  // Résultat du match
  result: {
    winner: {
      type: Number, // 1 ou 2 (équipe gagnante)
      default: null
    },
    team1Score: { type: Number, default: 0 }, // Nombre de maps gagnées
    team2Score: { type: Number, default: 0 },
    isForfeit: { type: Boolean, default: false },
    forfeitReason: String,
    forfeitTeam: { type: Number, enum: [1, 2], default: null },
    // Déclaration du résultat par les référents
    team1Report: {
      winner: { type: Number, enum: [1, 2], default: null },
      reportedAt: Date
    },
    team2Report: {
      winner: { type: Number, enum: [1, 2], default: null },
      reportedAt: Date
    },
    // Résultat confirmé (quand les 2 référents sont d'accord)
    confirmed: { type: Boolean, default: false },
    confirmedAt: Date
  },
  // Litige (si les référents ne sont pas d'accord)
  dispute: {
    isActive: { type: Boolean, default: false },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedByTeam: { type: Number, enum: [1, 2], default: null },
    reportedAt: Date,
    reason: {
      type: String,
      maxlength: 500
    },
    // Preuves uploadées
    evidence: [{
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      team: Number,
      imageUrl: String,
      description: { type: String, maxlength: 200 },
      uploadedAt: { type: Date, default: Date.now }
    }],
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String,
    resolvedWinner: { type: Number, enum: [1, 2], default: null }
  },
  // Chat du match
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      required: false,
      maxlength: 500
    },
    team: Number, // 1 ou 2 (null = visible par tous)
    isSystem: {
      type: Boolean,
      default: false
    },
    messageType: { type: String, default: null }, // Pour les messages système traduits
    messageParams: { type: mongoose.Schema.Types.Mixed, default: null },
    username: { type: String, default: null }, // Pour les messages GGSecure
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Timestamps
  matchmakingStartedAt: Date, // Quand le timer de 2 min a commencé
  startedAt: Date, // Quand le match a réellement commencé
  completedAt: Date
}, { 
  timestamps: true 
});

// Index pour les requêtes
rankedMatchSchema.index({ status: 1, gameMode: 1, mode: 1 });
rankedMatchSchema.index({ 'players.user': 1, status: 1 });
rankedMatchSchema.index({ rankBracket: 1, status: 1 });
rankedMatchSchema.index({ createdAt: -1 });
rankedMatchSchema.index({ team1Referent: 1 });
rankedMatchSchema.index({ team2Referent: 1 });

// Méthode pour vérifier si un joueur est référent
rankedMatchSchema.methods.isPlayerReferent = function(userId) {
  const userIdStr = userId.toString();
  return this.team1Referent?.toString() === userIdStr || 
         this.team2Referent?.toString() === userIdStr;
};

// Méthode pour obtenir l'équipe d'un joueur
rankedMatchSchema.methods.getPlayerTeam = function(userId) {
  const player = this.players.find(p => p.user.toString() === userId.toString());
  return player?.team || null;
};

// Méthode pour obtenir le référent de l'équipe adverse
rankedMatchSchema.methods.getOpponentReferent = function(userId) {
  const playerTeam = this.getPlayerTeam(userId);
  if (playerTeam === 1) return this.team2Referent;
  if (playerTeam === 2) return this.team1Referent;
  return null;
};

export default mongoose.model('RankedMatch', rankedMatchSchema);

