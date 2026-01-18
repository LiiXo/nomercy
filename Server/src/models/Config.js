import mongoose from 'mongoose';

// Sous-schéma pour les récompenses d'un mode de jeu
const gameModeRewardSchema = new mongoose.Schema({
  pointsWin: { type: Number, default: 20 },
  pointsLoss: { type: Number, default: -10 },
  coinsWin: { type: Number, default: 50 }
}, { _id: false });

const configSchema = new mongoose.Schema({
  // Type de configuration
  type: {
    type: String,
    required: true,
    unique: true,
    enum: ['rewards']
  },
  
  // Récompenses pour les matchs squad (ladder) - Ladder Chill (duo-trio)
  squadMatchRewardsChill: {
    // Points ladder escouade (dans le classement du ladder spécifique)
    ladderPointsWin: { type: Number, default: 15 },
    ladderPointsLoss: { type: Number, default: 8 },
    
    // Points classement général escouade (top escouades toutes confondues)
    generalSquadPointsWin: { type: Number, default: 10 },
    generalSquadPointsLoss: { type: Number, default: 5 },
    
    // Points joueur individuel (classement joueurs)
    playerPointsWin: { type: Number, default: 15 },
    playerPointsLoss: { type: Number, default: 8 },
    
    // Coins joueur
    playerCoinsWin: { type: Number, default: 40 },
    playerCoinsLoss: { type: Number, default: 20 },
    
    // XP joueur (gain aléatoire entre min et max pour les gagnants, 0 pour les perdants)
    playerXPWinMin: { type: Number, default: 350 },
    playerXPWinMax: { type: Number, default: 450 }
  },

  // Récompenses pour les matchs squad (ladder) - Ladder Compétitif (squad-team)
  squadMatchRewardsCompetitive: {
    // Points ladder escouade (dans le classement du ladder spécifique)
    ladderPointsWin: { type: Number, default: 25 },
    ladderPointsLoss: { type: Number, default: 12 },
    
    // Points classement général escouade (top escouades toutes confondues)
    generalSquadPointsWin: { type: Number, default: 20 },
    generalSquadPointsLoss: { type: Number, default: 10 },
    
    // Points joueur individuel (classement joueurs)
    playerPointsWin: { type: Number, default: 25 },
    playerPointsLoss: { type: Number, default: 12 },
    
    // Coins joueur
    playerCoinsWin: { type: Number, default: 60 },
    playerCoinsLoss: { type: Number, default: 30 },
    
    // XP joueur (gain aléatoire entre min et max pour les gagnants, 0 pour les perdants)
    playerXPWinMin: { type: Number, default: 550 },
    playerXPWinMax: { type: Number, default: 650 }
  },
  
  // Récompenses pour le mode classé - utilise Mixed pour les clés dynamiques avec espaces
  // Modes disponibles: Duel, Team Deathmatch (Mêlée Générale), Search & Destroy (Recherche et Destruction)
  rankedMatchRewards: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      hardcore: {
        Duel: { 
          pointsWin: 20, 
          pointsLoss: -10, 
          coinsWin: 50, 
          coinsLoss: 15,
          xpWinMin: 700, 
          xpWinMax: 800 
        },
        'Team Deathmatch': { 
          pointsWin: 25, 
          pointsLoss: -12, 
          coinsWin: 60, 
          coinsLoss: 20, 
          xpWinMin: 700, 
          xpWinMax: 800 
        },
        'Search & Destroy': { 
          pointsWin: 35, 
          pointsLoss: -18, 
          coinsWin: 80, 
          coinsLoss: 25, 
          xpWinMin: 700, 
          xpWinMax: 800 
        }
      },
      cdl: {
        Duel: { 
          pointsWin: 25, 
          pointsLoss: -12, 
          coinsWin: 60, 
          coinsLoss: 20, 
          xpWinMin: 700, 
          xpWinMax: 800 
        },
        'Team Deathmatch': { 
          pointsWin: 30, 
          pointsLoss: -15, 
          coinsWin: 75, 
          coinsLoss: 25, 
          xpWinMin: 700, 
          xpWinMax: 800 
        },
        'Search & Destroy': { 
          pointsWin: 40, 
          pointsLoss: -20, 
          coinsWin: 90, 
          coinsLoss: 30, 
          xpWinMin: 700, 
          xpWinMax: 800 
        }
      }
    })
  },
  
  // Points perdus en défaite selon le rang du joueur (plus haut rang = plus de points perdus)
  rankedPointsLossPerRank: {
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
  },
  
  // Maps pour le mode classé (tirage aléatoire) - 1 map par partie
  rankedMaps: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      Duel: [
        'Shipment', 'Rust', 'Nuketown', 'Shoot House', 'Das Haus'
      ],
      'Team Deathmatch': [
        'Shipment', 'Rust', 'Nuketown', 'Shoot House', 'Das Haus', 'Firing Range', 'Dome'
      ],
      'Search & Destroy': [
        'Highrise', 'Terminal', 'Raid', 'Standoff', 'Invasion', 'Karachi', 'Skidrow'
      ]
    })
  },
  
  // Règles pour le mode classement (ladder)
  ladderRulesText: {
    type: String,
    default: '• Respectez vos adversaires\n• Pas de triche ou d\'exploit\n• Signalez les problèmes au staff\n• Le staff a le dernier mot en cas de litige'
  },
  
  // Règles pour chaque mode de jeu classé
  rankedRules: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      Duel: '• Mode 1v1\n• Respectez votre adversaire\n• Pas de camping excessif',
      'Team Deathmatch': '• Mode Mêlée Générale\n• Tous contre tous\n• Premier à atteindre le score limite',
      'Search & Destroy': '• Mode par équipes\n• Pas de respawn\n• Attaque/Défense alternée'
    })
  },
  
  // Activation/désactivation du matchmaking mode classé
  rankedMatchmakingEnabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one config document exists
configSchema.statics.getOrCreate = async function() {
  let config = await this.findOne({ type: 'rewards' });
  if (!config) {
    config = new this({ type: 'rewards' });
    await config.save();
  }
  // Convert to object and ensure all default values are applied
  const configObj = config.toObject();
  
  // Apply defaults for rankedPointsLossPerRank if not set
  if (!configObj.rankedPointsLossPerRank) {
    configObj.rankedPointsLossPerRank = {
      bronze: -10,
      silver: -12,
      gold: -15,
      platinum: -18,
      diamond: -20,
      master: -22,
      grandmaster: -25,
      champion: -30
    };
  }
  
  return configObj;
};

export default mongoose.model('Config', configSchema);



