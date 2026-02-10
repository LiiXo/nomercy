import mongoose from 'mongoose';

// Schema pour les joueurs dans un match stricker
const strickerPlayerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  username: String,
  rank: String, // Recrues, Operateurs, Veterans, Commandants, Seigneurs de Guerre, Immortel
  points: Number,
  team: {
    type: Number, // 1 ou 2
    default: null
  },
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  isReferent: {
    type: Boolean,
    default: false
  },
  isFake: {
    type: Boolean,
    default: false
  },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  rewards: {
    pointsChange: { type: Number, default: 0 },
    goldEarned: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    oldPoints: { type: Number, default: 0 },
    newPoints: { type: Number, default: 0 }
  },
  queueJoinedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const strickerMatchSchema = new mongoose.Schema({
  // Mode de jeu - Stricker uniquement avec Search & Destroy 5v5
  gameMode: {
    type: String,
    required: true,
    enum: ['Search & Destroy'],
    default: 'Search & Destroy'
  },
  // Mode (hardcore ou cdl)
  mode: {
    type: String,
    required: true,
    enum: ['hardcore', 'cdl'],
    default: 'hardcore'
  },
  // Taille des équipes - 5v5 uniquement
  teamSize: {
    type: Number,
    enum: [5],
    default: 5,
    required: true
  },
  // Liste des joueurs
  players: [strickerPlayerSchema],
  
  // Escouades participantes
  team1Squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  team2Squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  
  // Référent équipe 1
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
    order: Number,
    winner: { type: Number, enum: [1, 2], default: null }
  }],
  // Map sélectionnée par vote des joueurs
  selectedMap: {
    name: String,
    image: String,
    votes: { type: Number, default: 0 }
  },
  // Maps sélectionnées aléatoirement après les bans (3 maps)
  selectedMaps: [{
    name: String,
    image: String,
    order: { type: Number, default: 1 }
  }],
  // Maps proposées pour le vote (3 maps)
  mapVoteOptions: [{
    name: String,
    image: String,
    votes: { type: Number, default: 0 },
    votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  // Bracket de rang pour le matchmaking
  rankBracket: {
    type: String,
    default: 'mixed'
  },
  // Winner du match (for filtering) - Duplicate of result.winner
  winner: {
    type: Number,
    enum: [1, 2],
    default: null
  },
  // Team scores (for filtering) - Duplicates of result scores
  team1Score: {
    type: Number,
    default: 0
  },
  team2Score: {
    type: Number,
    default: 0
  },
  // Résultat du match
  result: {
    winner: {
      type: Number,
      default: null
    },
    team1Score: { type: Number, default: 0 },
    team2Score: { type: Number, default: 0 },
    isForfeit: { type: Boolean, default: false },
    forfeitReason: String,
    forfeitTeam: { type: Number, enum: [1, 2], default: null },
    playerVotes: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      winner: { type: Number, enum: [1, 2] },
      votedAt: { type: Date, default: Date.now }
    }],
    team1Report: {
      winner: { type: Number, enum: [1, 2], default: null },
      reportedAt: Date
    },
    team2Report: {
      winner: { type: Number, enum: [1, 2], default: null },
      reportedAt: Date
    },
    confirmed: { type: Boolean, default: false },
    confirmedAt: Date
  },
  // Litige
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
    team: Number,
    isSystem: {
      type: Boolean,
      default: false
    },
    isStaff: {
      type: Boolean,
      default: false
    },
    messageType: { type: String, default: null },
    messageParams: { type: mongoose.Schema.Types.Mixed, default: null },
    username: { type: String, default: null },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Demande d'annulation
  cancellationRequest: {
    isActive: { type: Boolean, default: false },
    votes: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      votedAt: { type: Date, default: Date.now }
    }],
    requiredVotes: { type: Number, default: 0 },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    initiatedAt: Date,
    cancelledAt: Date
  },
  // Votes d'annulation des référents (avant-match)
  cancellationVotes: {
    team1: { type: Boolean, default: null },
    team2: { type: Boolean, default: null },
    team1VotedAt: { type: Date, default: null },
    team2VotedAt: { type: Date, default: null }
  },
  // Map bans by referents (each referent bans 1 map)
  mapBans: {
    team1BannedMap: { type: String, default: null },
    team1BannedAt: { type: Date, default: null },
    team2BannedMap: { type: String, default: null },
    team2BannedAt: { type: Date, default: null },
    currentTurn: { type: Number, enum: [1, 2], default: 1 } // Which referent's turn to ban
  },
  // Match de test
  isTestMatch: {
    type: Boolean,
    default: false
  },
  // Flag to prevent double reward distribution
  rewardsDistributed: {
    type: Boolean,
    default: false
  },
  // Roster selection phase
  rosterSelection: {
    isActive: { type: Boolean, default: false },
    currentTurn: { type: Number, enum: [1, 2], default: 1 },
    turnStartedAt: { type: Date, default: null },
    pickOrder: [{
      team: { type: Number, enum: [1, 2] },
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      pickedAt: { type: Date, default: Date.now }
    }],
    totalPicks: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  // MVP (Most Valuable Player)
  mvp: {
    votingActive: { type: Boolean, default: false },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmed: { type: Boolean, default: false },
    bonusPoints: { type: Number, default: 5 },
    votes: [{
      voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      votedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      votedAt: { type: Date, default: Date.now }
    }]
  },
  // Appels arbitre
  arbitratorCalls: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    calledAt: { type: Date, default: Date.now }
  }],
  // Salons vocaux Discord
  team1VoiceChannel: {
    channelId: { type: String, default: null },
    channelName: { type: String, default: null }
  },
  team2VoiceChannel: {
    channelId: { type: String, default: null },
    channelName: { type: String, default: null }
  },
  // Timestamps
  matchmakingStartedAt: Date,
  startedAt: Date,
  completedAt: Date
}, { 
  timestamps: true 
});

// Index pour les requêtes
strickerMatchSchema.index({ status: 1, gameMode: 1, mode: 1 });
strickerMatchSchema.index({ 'players.user': 1, status: 1 });
strickerMatchSchema.index({ 'players.squad': 1, status: 1 });
strickerMatchSchema.index({ team1Squad: 1, status: 1 });
strickerMatchSchema.index({ team2Squad: 1, status: 1 });
strickerMatchSchema.index({ rankBracket: 1, status: 1 });
strickerMatchSchema.index({ createdAt: -1 });
strickerMatchSchema.index({ team1Referent: 1 });
strickerMatchSchema.index({ team2Referent: 1 });

// Méthode pour vérifier si un joueur est référent
strickerMatchSchema.methods.isPlayerReferent = function(userId) {
  const userIdStr = userId.toString();
  return this.team1Referent?.toString() === userIdStr || 
         this.team2Referent?.toString() === userIdStr;
};

// Méthode pour obtenir l'équipe d'un joueur
strickerMatchSchema.methods.getPlayerTeam = function(userId) {
  const player = this.players.find(p => p.user?.toString() === userId.toString());
  return player?.team || null;
};

// Méthode pour obtenir le référent de l'équipe adverse
strickerMatchSchema.methods.getOpponentReferent = function(userId) {
  const playerTeam = this.getPlayerTeam(userId);
  if (playerTeam === 1) return this.team2Referent;
  if (playerTeam === 2) return this.team1Referent;
  return null;
};

// Méthode pour obtenir l'escouade d'une équipe
strickerMatchSchema.methods.getTeamSquad = function(team) {
  if (team === 1) return this.team1Squad;
  if (team === 2) return this.team2Squad;
  return null;
};

export default mongoose.model('StrickerMatch', strickerMatchSchema);
