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
      logo: String
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
      avatarUrl: String
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
        avatarUrl: String
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
  return this.participants.length;
});

// Virtual for checking if registration is full
tournamentSchema.virtual('isFull').get(function() {
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
  
  // Shuffle participants for seeding
  const shuffled = [...Array(participantCount).keys()];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Assign seeds
  if (this.type === 'solo') {
    shuffled.forEach((originalIdx, newIdx) => {
      if (this.formedTeams[originalIdx]) {
        this.formedTeams[originalIdx].seed = newIdx + 1;
      }
    });
  } else {
    shuffled.forEach((originalIdx, newIdx) => {
      if (this.participants[originalIdx]) {
        this.participants[originalIdx].seed = newIdx + 1;
      }
    });
  }
  
  // Determine group size based on teamSize (3v3 = groups of 3, 4v4 = groups of 4, etc.)
  // Default to 4 if teamSize is not 3, 4, or 5
  let groupSize = this.teamSize;
  if (groupSize < 3) groupSize = 3;
  if (groupSize > 5) groupSize = 5;
  this.groupSize = groupSize;
  
  // Calculate number of groups needed
  const numGroups = Math.ceil(participantCount / groupSize);
  
  // If we have enough participants for groups and not a power of 2, use group stage
  const isPowerOf2 = participantCount > 0 && (participantCount & (participantCount - 1)) === 0;
  
  if (participantCount >= 6 && !isPowerOf2) {
    // Use group stage
    this.hasGroupStage = true;
    this.groups = [];
    
    const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    
    // Distribute participants to groups (snake draft for fairness)
    const groupParticipants = Array.from({ length: numGroups }, () => []);
    let groupIdx = 0;
    let direction = 1;
    
    shuffled.forEach(pIdx => {
      groupParticipants[groupIdx].push(pIdx);
      groupIdx += direction;
      if (groupIdx >= numGroups) {
        groupIdx = numGroups - 1;
        direction = -1;
      } else if (groupIdx < 0) {
        groupIdx = 0;
        direction = 1;
      }
    });
    
    // Create groups with round-robin matches
    groupParticipants.forEach((participants, gIdx) => {
      const groupMatches = [];
      let matchNum = 1;
      
      // Generate round-robin matches
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          groupMatches.push({
            matchNumber: matchNum++,
            participant1: { index: participants[i], score: 0 },
            participant2: { index: participants[j], score: 0 },
            winner: null,
            status: 'pending',
            maps: []
          });
        }
      }
      
      // Initialize standings
      const standings = participants.map(pIdx => ({
        participantIndex: pIdx,
        wins: 0,
        losses: 0,
        mapWins: 0,
        mapLosses: 0,
        points: 0
      }));
      
      this.groups.push({
        groupName: `Groupe ${groupNames[gIdx] || (gIdx + 1)}`,
        participants,
        standings,
        matches: groupMatches
      });
    });
    
    // Bracket will be generated later when group stage completes
    // For now, create empty bracket placeholder for finals
    this.bracket = [];
  } else {
    // Standard single elimination bracket (power of 2 or small tournament)
    this.hasGroupStage = false;
    this.groups = [];
    
    // Calculate number of rounds needed
    const rounds = Math.ceil(Math.log2(participantCount));
    
    // Generate bracket structure
    this.bracket = [];
    
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
        
        // For first round, assign seeded participants
        if (round === 1) {
          const idx1 = match * 2;
          const idx2 = match * 2 + 1;
          
          if (idx1 < participantCount) {
            matchData.participant1.index = shuffled[idx1];
          }
          if (idx2 < participantCount) {
            matchData.participant2.index = shuffled[idx2];
          }
          
          // If only one participant in match, auto-advance (bye)
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
  }
  
  return { groups: this.groups, bracket: this.bracket };
};

// Ensure virtuals are included in JSON
tournamentSchema.set('toJSON', { virtuals: true });
tournamentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Tournament', tournamentSchema);
