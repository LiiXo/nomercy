import mongoose from 'mongoose';

// Sub-schema for ladder game mode configuration
const ladderConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  gameModes: [{
    type: String
  }]
}, { _id: false });

// Sub-schema for ranked game mode configuration (includes formats)
const rankedConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  gameModes: [{
    type: String
  }],
  // Formats disponibles pour le mode ranked (4v4, 5v5)
  formats: [{
    type: String,
    enum: ['4v4', '5v5']
  }]
}, { _id: false });

// Sub-schema for mode configuration (ladder + ranked)
const modeConfigSchema = new mongoose.Schema({
  ladder: {
    type: ladderConfigSchema,
    default: () => ({ enabled: false, gameModes: [] })
  },
  ranked: {
    type: rankedConfigSchema,
    default: () => ({ enabled: false, gameModes: [], formats: [] })
  }
}, { _id: false });

const mapSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String, // URL de l'image de la map
    default: null
  },
  // Mode principal (hardcore, cdl, ou both) - kept for backward compatibility
  mode: {
    type: String,
    enum: ['hardcore', 'cdl', 'both'],
    default: 'both'
  },
  // Configuration Hardcore
  // Ladder: Search & Destroy
  // Ranked: Search & Destroy, Team Deathmatch (Mêlée générale), Duel - avec formats 4v4/5v5
  hardcoreConfig: {
    type: modeConfigSchema,
    default: () => ({
      ladder: { enabled: false, gameModes: [] },
      ranked: { enabled: false, gameModes: [], formats: [] }
    })
  },
  // Configuration CDL
  // Ladder: Hardpoint (Points stratégiques), Search & Destroy, Variant
  // Ranked: Hardpoint (Points stratégiques), Search & Destroy - avec formats 4v4/5v5
  cdlConfig: {
    type: modeConfigSchema,
    default: () => ({
      ladder: { enabled: false, gameModes: [] },
      ranked: { enabled: false, gameModes: [], formats: [] }
    })
  },
  // Legacy fields - kept for backward compatibility during migration
  ladders: [{
    type: String,
    enum: ['duo-trio', 'squad-team', 'ranked']
  }],
  gameModes: [{
    type: String,
    enum: ['Search & Destroy', 'Domination', 'Team Deathmatch', 'Hardpoint', 'Control', 'Variant', 'Duel']
  }],
  rankedFormats: [{
    type: String,
    enum: ['4v4', '5v5', 'hardpoint-4v4']
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Helper method to check if map is available for a specific context
mapSchema.methods.isAvailableFor = function(mode, matchType, gameMode, format) {
  const config = mode === 'hardcore' ? this.hardcoreConfig : this.cdlConfig;
  if (!config || !config[matchType]) return false;
  
  const matchConfig = config[matchType];
  if (!matchConfig.enabled) return false;
  
  // Check game mode
  if (gameMode && !matchConfig.gameModes.includes(gameMode)) {
    return false;
  }
  
  // Check format for ranked matches
  if (matchType === 'ranked' && format) {
    if (!matchConfig.formats || !matchConfig.formats.includes(format)) {
      return false;
    }
  }
  
  return matchConfig.gameModes.length > 0;
};

// Static method to find maps for a specific context
mapSchema.statics.findForContext = function(mode, matchType, gameMode, format) {
  const configPath = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
  const query = {
    isActive: true,
    [`${configPath}.${matchType}.enabled`]: true
  };
  
  if (gameMode) {
    query[`${configPath}.${matchType}.gameModes`] = gameMode;
  }
  
  // Add format filter for ranked matches
  if (matchType === 'ranked' && format) {
    query[`${configPath}.${matchType}.formats`] = format;
  }
  
  return this.find(query);
};

const Map = mongoose.model('Map', mapSchema);

export default Map;
