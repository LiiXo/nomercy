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
  
  // Récompenses pour les matchs squad (top général)
  squadMatchRewards: {
    // Points ladder
    ladderPointsWin: { type: Number, default: 20 },
    ladderPointsLoss: { type: Number, default: 10 },
    
    // Points classement général escouade
    generalSquadPointsWin: { type: Number, default: 15 },
    generalSquadPointsLoss: { type: Number, default: 7 },
    
    // Points joueur individuel
    playerPointsWin: { type: Number, default: 15 },
    playerPointsLoss: { type: Number, default: 5 },
    
    // XP escouade
    squadXPWinDuoTrio: { type: Number, default: 150 },
    squadXPWinSquadTeam: { type: Number, default: 200 },
    
    // XP joueur
    playerXPWinMin: { type: Number, default: 500 },
    playerXPWinMax: { type: Number, default: 600 },
    playerXPLossPercent: { type: Number, default: 20 }, // Pourcentage de l'XP gagnant
    
    // Coins
    playerCoinsWin: { type: Number, default: 50 }
  },
  
  // Récompenses pour le mode classé - utilise Mixed pour les clés dynamiques avec espaces
  rankedMatchRewards: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      hardcore: {
        Duel: { pointsWin: 20, pointsLoss: -10, coinsWin: 50, xpWinMin: 700, xpWinMax: 800 },
        'Team Deathmatch': { pointsWin: 25, pointsLoss: -12, coinsWin: 60, xpWinMin: 700, xpWinMax: 800 },
        Domination: { pointsWin: 35, pointsLoss: -18, coinsWin: 80, xpWinMin: 700, xpWinMax: 800 },
        'Search & Destroy': { pointsWin: 35, pointsLoss: -18, coinsWin: 80, xpWinMin: 700, xpWinMax: 800 }
      },
      cdl: {
        Duel: { pointsWin: 25, pointsLoss: -12, coinsWin: 60, xpWinMin: 700, xpWinMax: 800 },
        'Team Deathmatch': { pointsWin: 30, pointsLoss: -15, coinsWin: 75, xpWinMin: 700, xpWinMax: 800 },
        Domination: { pointsWin: 40, pointsLoss: -20, coinsWin: 90, xpWinMin: 700, xpWinMax: 800 },
        'Search & Destroy': { pointsWin: 40, pointsLoss: -20, coinsWin: 90, xpWinMin: 700, xpWinMax: 800 }
      }
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
      Domination: [
        'Highrise', 'Terminal', 'Raid', 'Standoff', 'Slums', 'Invasion', 'Karachi'
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
      'Team Deathmatch': '• Mode FFA\n• Tous contre tous\n• Premier à atteindre le score limite',
      Domination: '• Mode par équipes\n• Capturez et tenez les points\n• Communication requise',
      'Search & Destroy': '• Mode par équipes\n• Pas de respawn\n• Attaque/Défense alternée'
    })
  }
}, {
  timestamps: true
});

// Ensure only one config document exists
configSchema.statics.getOrCreate = async function() {
  let config = await this.findOne({ type: 'rewards' }).lean();
  if (!config) {
    const newConfig = new this({ type: 'rewards' });
    await newConfig.save();
    config = newConfig.toObject();
  }
  return config;
};

export default mongoose.model('Config', configSchema);



