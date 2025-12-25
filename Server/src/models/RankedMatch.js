import mongoose from 'mongoose';

// Schema pour les joueurs dans un match classé
const rankedPlayerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rank: String, // Bronze, Silver, Gold, etc.
  points: Number,
  team: {
    type: Number, // 1 ou 2 (null pour mêlée générale)
    default: null
  },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  score: { type: Number, default: 0 }
}, { _id: false });

const rankedMatchSchema = new mongoose.Schema({
  // Mode de jeu spécifique
  gameMode: {
    type: String,
    required: true,
    enum: ['Duel', 'Team Deathmatch', 'Domination', 'Search & Destroy']
  },
  // Mode hardcore ou cdl
  mode: {
    type: String,
    required: true,
    enum: ['hardcore', 'cdl']
  },
  // Liste des joueurs
  players: [rankedPlayerSchema],
  // Faux joueurs pour mode dev (bots)
  fakePlayers: [{
    odId: String,
    username: String,
    rank: String,
    points: Number,
    team: Number
  }],
  // Équipe 1 (pour Domination et S&D)
  team1: {
    players: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    score: { type: Number, default: 0 }
  },
  // Équipe 2 (pour Domination et S&D)
  team2: {
    players: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    score: { type: Number, default: 0 }
  },
  // Capitaine équipe 1 (hôte)
  team1Captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Capitaine équipe 2
  team2Captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Hôte de la partie (pour mode Duel et Team Deathmatch)
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Équipe hôte (pour Domination et S&D - 1 ou 2)
  hostTeam: {
    type: Number,
    enum: [1, 2],
    default: null
  },
  // Statut du match
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  // Code de partie pour rejoindre
  gameCode: {
    type: String,
    default: null
  },
  // Map choisie
  map: {
    name: String,
    image: String
  },
  // Bracket de rang pour le matchmaking
  rankBracket: {
    type: String, // bronze, silver, gold, platinum, diamond, master, grandmaster, champion
    required: true
  },
  // Résultat du match
  result: {
    winner: {
      type: String, // 'team1', 'team2', ou null pour mêlée générale
      default: null
    },
    winnerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // Pour mêlée générale uniquement
    },
    fakeWinner: {
      odId: String,
      username: String
    },
    team1Score: { type: Number, default: 0 },
    team2Score: { type: Number, default: 0 },
    isForfeit: { type: Boolean, default: false },
    forfeitReason: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: Date,
    confirmed: { type: Boolean, default: false },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmedAt: Date
  },
  // Litige
  dispute: {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
    resolution: String
  },
  // Chat du match
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    team: Number, // 1 ou 2
    isSystem: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Timestamps
  startedAt: Date,
  completedAt: Date
}, { 
  timestamps: true 
});

// Index pour les requêtes
rankedMatchSchema.index({ status: 1, gameMode: 1, mode: 1 });
rankedMatchSchema.index({ 'players.user': 1, status: 1 });
rankedMatchSchema.index({ rankBracket: 1, status: 1 });
rankedMatchSchema.index({ createdAt: -1 });

export default mongoose.model('RankedMatch', rankedMatchSchema);

