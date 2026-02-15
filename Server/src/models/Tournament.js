import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Tournament type: team (squads register) or solo (players register, teams formed at draw)
  type: {
    type: String,
    enum: ['team', 'solo'],
    required: true
  },
  
  // Game mode (hardcore or cdl)
  mode: {
    type: String,
    enum: ['hardcore', 'cdl'],
    required: true
  },
  
  // Game selection
  game: {
    type: String,
    enum: ['cod_bo7', 'free'],
    default: 'cod_bo7'
  },
  
  // Custom game name (when game is 'free')
  customGame: {
    type: String,
    maxlength: 100,
    default: ''
  },
  
  // Tournament logo (displayed on cards)
  logo: {
    type: String,
    default: ''
  },
  
  // Tournament banner (displayed on detail page)
  banner: {
    type: String,
    default: ''
  },
  
  // Match format
  format: {
    type: String,
    enum: ['bo1', 'bo3'],
    default: 'bo1'
  },
  
  // Map selection type
  mapSelection: {
    type: String,
    enum: ['random', 'free'],
    default: 'random'
  },
  
  // Max participants (squads for team tournaments, players for solo)
  maxParticipants: {
    type: Number,
    required: true,
    min: 2,
    max: 128
  },
  
  // Team size for solo tournaments (how many players per formed team)
  // For team tournaments, this is the expected squad size
  teamSize: {
    type: Number,
    default: 4,
    min: 1,
    max: 6
  },
  
  // Scheduled date and time
  scheduledAt: {
    type: Date,
    required: true
  },
  
  // Registration deadline (defaults to scheduledAt if not set)
  registrationDeadline: {
    type: Date,
    default: null
  },
  
  // Tournament status
  status: {
    type: String,
    enum: ['draft', 'registration', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Streaming options
  streaming: {
    enabled: {
      type: Boolean,
      default: false
    },
    twitchUrl: {
      type: String,
      default: ''
    },
    streamerName: {
      type: String,
      default: ''
    },
    streamerAvatar: {
      type: String,
      default: ''
    }
  },
  
  // Prize configuration
  prizes: {
    // Gold rewards (in-game currency)
    gold: {
      enabled: {
        type: Boolean,
        default: false
      },
      // Gold amount for each position (1st, 2nd, 3rd, etc.)
      first: { type: Number, default: 0 },
      second: { type: Number, default: 0 },
      third: { type: Number, default: 0 }
    },
    // Cash prize (real money)
    cashprize: {
      enabled: {
        type: Boolean,
        default: false
      },
      // Total cash prize pool
      total: { type: Number, default: 0 },
      // Currency (EUR, USD, etc.)
      currency: { type: String, default: 'EUR' },
      // Distribution per position
      first: { type: Number, default: 0 },
      second: { type: Number, default: 0 },
      third: { type: Number, default: 0 }
    }
  },
  
  // Entry fee configuration (registration cost)
  entryFee: {
    enabled: {
      type: Boolean,
      default: false
    },
    // Fee type: 'gold', 'munitions', 'cashprize'
    type: {
      type: String,
      enum: ['gold', 'munitions', 'cashprize'],
      default: 'gold'
    },
    // Amount to pay
    amount: {
      type: Number,
      default: 0
    },
    // Currency (only for cashprize type)
    currency: {
      type: String,
      enum: ['EUR', 'USD', 'GBP'],
      default: 'EUR'
    }
  },
  
  // Participants - for team tournaments: squads, for solo: users
  participants: [{
    // For team tournaments
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      default: null
    },
    // Squad info snapshot (in case squad is deleted)
    squadInfo: {
      name: String,
      tag: String,
      color: String,
      logo: String,
      members: [{
        odUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        discordId: String,
        avatarUrl: String,
        platform: String,
        irisConnected: { type: Boolean, default: false },
        ggSecureConnected: { type: Boolean, default: false },
        role: String
      }]
    },
    // For solo tournaments
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // User info snapshot
    userInfo: {
      username: String,
      discordId: String,
      avatar: String,
      avatarUrl: String,
      platform: String,
      irisConnected: { type: Boolean, default: false },
      ggSecureConnected: { type: Boolean, default: false }
    },
    // Is this a bot participant (for testing)
    isBot: {
      type: Boolean,
      default: false
    },
    // Bot name (if isBot)
    botName: {
      type: String,
      default: null
    },
    // Registration timestamp
    registeredAt: {
      type: Date,
      default: Date.now
    },
    // Seed/position in bracket (set when bracket is generated)
    seed: {
      type: Number,
      default: null
    }
  }],
  
  // Formed teams (for solo tournaments only - created at draw)
  formedTeams: [{
    name: {
      type: String,
      required: true
    },
    members: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      userInfo: {
        username: String,
        discordId: String,
        avatar: String,
        avatarUrl: String,
        platform: String,
        irisConnected: { type: Boolean, default: false },
        ggSecureConnected: { type: Boolean, default: false }
      },
      isBot: {
        type: Boolean,
        default: false
      },
      botName: String
    }],
    seed: {
      type: Number,
      default: null
    }
  }],
  
  // Group stage
  groups: [{
    groupName: { type: String }, // "Groupe A", "Groupe B", etc.
    participants: [{ type: Number }], // Indices of participants in this group
    standings: [{
      participantIndex: Number,
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      mapWins: { type: Number, default: 0 },
      mapLosses: { type: Number, default: 0 },
      points: { type: Number, default: 0 }
    }],
    matches: [{
      matchNumber: Number,
      participant1: {
        index: Number,
        score: { type: Number, default: 0 }
      },
      participant2: {
        index: Number,
        score: { type: Number, default: 0 }
      },
      winner: { type: Number, default: null },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      },
      maps: [{
        name: String,
        winner: Number,
        score1: Number,
        score2: Number
      }]
    }]
  }],
  
  // Whether tournament uses group stage
  hasGroupStage: {
    type: Boolean,
    default: false
  },
  
  // Group size (3, 4, or 5 participants per group)
  groupSize: {
    type: Number,
    default: 4,
    min: 3,
    max: 5
  },
  
  // Tournament bracket
  bracket: [{
    round: {
      type: Number,
      required: true
    },
    roundName: {
      type: String // "Finals", "Semi-Finals", "Quarter-Finals", etc.
    },
    matches: [{
      matchNumber: Number,
      // Participant 1 (squad index or formed team index)
      participant1: {
        index: Number, // Index in participants or formedTeams array
        score: { type: Number, default: 0 }
      },
      // Participant 2
      participant2: {
        index: Number,
        score: { type: Number, default: 0 }
      },
      // Winner index
      winner: {
        type: Number,
        default: null
      },
      // Match status
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      },
      // Maps played (for BO3)
      maps: [{
        name: String,
        winner: Number, // participant index
        score1: Number,
        score2: Number
      }],
      // Scheduled time for this match
      scheduledAt: Date,
      // Actual start/end times
      startedAt: Date,
      completedAt: Date
    }]
  }],
  
  // Tournament winner
  winner: {
    // For team tournaments
    squad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Squad',
      default: null
    },
    squadInfo: {
      name: String,
      tag: String,
      color: String,
      logo: String
    },
    // For solo tournaments (formed team)
    formedTeamIndex: {
      type: Number,
      default: null
    }
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true 
});

// Indexes
tournamentSchema.index({ status: 1, scheduledAt: 1 });
tournamentSchema.index({ mode: 1, status: 1 });
tournamentSchema.index({ 'participants.squad': 1 });
tournamentSchema.index({ 'participants.user': 1 });

// Virtual for participant count
tournamentSchema.virtual('participantCount').get(function() {
  return this.participants?.length || 0;
});

// Virtual for checking if registration is full
tournamentSchema.virtual('isFull').get(function() {
  if (!this.participants) return false;
  return this.participants.length >= this.maxParticipants;
});

// Method to check if a squad is registered
tournamentSchema.methods.isSquadRegistered = function(squadId) {
  return this.participants.some(p => 
    p.squad && p.squad.toString() === squadId.toString()
  );
};

// Method to check if a user is registered
tournamentSchema.methods.isUserRegistered = function(userId) {
  return this.participants.some(p => 
    p.user && p.user.toString() === userId.toString()
  );
};

// Method to generate bracket
tournamentSchema.methods.generateBracket = function() {
  const participantCount = this.type === 'solo' 
    ? this.formedTeams.length 
    : this.participants.length;
  
  if (participantCount < 2) {
    throw new Error('Not enough participants to generate bracket');
  }
  
  // Shuffle participants for random seeding
  const indices = [...Array(participantCount).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // After shuffle: indices[0] is seed 1, indices[1] is seed 2, etc.
  // Assign seeds (1-based) to participants/teams
  if (this.type === 'solo') {
    indices.forEach((originalIdx, seedPosition) => {
      if (this.formedTeams[originalIdx]) {
        this.formedTeams[originalIdx].seed = seedPosition + 1;
      }
    });
  } else {
    indices.forEach((originalIdx, seedPosition) => {
      if (this.participants[originalIdx]) {
        this.participants[originalIdx].seed = seedPosition + 1;
      }
    });
  }
  
  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(participantCount)));
  const rounds = Math.ceil(Math.log2(bracketSize));
  
  this.hasGroupStage = false;
  this.groups = [];
  this.bracket = [];
  
  // Generate proper tournament seeding order
  // This ensures top seeds (1,2) only meet in finals
  // For 8 teams: matches are 1v8, 4v5, 3v6, 2v7
  // So seeds 1,4,3,2 are on top half, seeds 8,5,6,7 on bottom half
  const generateBracketPositions = (size) => {
    if (size === 1) return [0];
    const half = generateBracketPositions(size / 2);
    const result = [];
    for (let i = 0; i < half.length; i++) {
      result.push(half[i]);
      result.push(size - 1 - half[i]);
    }
    return result;
  };
  
  const bracketPositions = generateBracketPositions(bracketSize);
  
  // bracketPositions tells us: for each match slot, which seed number should go there
  // bracketPositions[0] and bracketPositions[1] are paired in match 1
  // For 8 teams: [0,7,3,4,1,6,2,5] means:
  //   Match 1: seed 1 (pos 0) vs seed 8 (pos 7)
  //   Match 2: seed 4 (pos 3) vs seed 5 (pos 4)
  //   Match 3: seed 2 (pos 1) vs seed 7 (pos 6)
  //   Match 4: seed 3 (pos 2) vs seed 6 (pos 5)
  
  // Map: seed position -> participant index
  // indices[seedPos] gives the original participant index for that seed
  const getParticipantForSeed = (seedPos) => {
    if (seedPos >= participantCount) return null;
    return indices[seedPos];
  };
  
  const roundNames = ['Finals', 'Semi-Finals', 'Quarter-Finals', 'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128'];
  
  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    const roundMatches = [];
    
    for (let match = 0; match < matchesInRound; match++) {
      const matchData = {
        matchNumber: match + 1,
        participant1: { index: null, score: 0 },
        participant2: { index: null, score: 0 },
        winner: null,
        status: 'pending',
        maps: []
      };
      
      // For first round, assign participants using proper tournament seeding
      if (round === 1) {
        const seedPos1 = bracketPositions[match * 2];     // e.g., seed 1 (position 0)
        const seedPos2 = bracketPositions[match * 2 + 1]; // e.g., seed 8 (position 7)
        
        matchData.participant1.index = getParticipantForSeed(seedPos1);
        matchData.participant2.index = getParticipantForSeed(seedPos2);
        
        // Handle byes (when a slot has no participant)
        if (matchData.participant1.index !== null && matchData.participant2.index === null) {
          matchData.winner = matchData.participant1.index;
          matchData.status = 'completed';
        } else if (matchData.participant2.index !== null && matchData.participant1.index === null) {
          matchData.winner = matchData.participant2.index;
          matchData.status = 'completed';
        }
      }
      
      roundMatches.push(matchData);
    }
    
    this.bracket.push({
      round,
      roundName: roundNames[rounds - round] || `Round ${round}`,
      matches: roundMatches
    });
  }
  
  console.log(`[generateBracket] Created bracket with ${this.bracket.length} rounds for ${participantCount} participants (bracket size: ${bracketSize})`);
  console.log(`[generateBracket] Seed assignments:`, indices.map((idx, seed) => `Seed ${seed+1} = participant ${idx}`));
  
  return { groups: this.groups, bracket: this.bracket };
};

// Ensure virtuals are included in JSON
tournamentSchema.set('toJSON', { virtuals: true });
tournamentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Tournament', tournamentSchema);
