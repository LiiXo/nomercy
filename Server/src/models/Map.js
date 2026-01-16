import mongoose from 'mongoose';

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
  // Mode principal (hardcore, cdl, ou both)
  mode: {
    type: String,
    enum: ['hardcore', 'cdl', 'both'],
    default: 'both'
  },
  // Ladders où cette map est disponible
  ladders: [{
    type: String,
    enum: ['duo-trio', 'squad-team', 'ranked']
  }],
  // Modes de jeu où cette map est disponible
  gameModes: [{
    type: String,
    enum: ['Search & Destroy', 'Domination', 'Team Deathmatch', 'Hardpoint', 'Control']
  }],
  // Formats pour le mode classé (ranked) - Search & Destroy uniquement
  rankedFormats: [{
    type: String,
    enum: ['4v4', '5v5']
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Map = mongoose.model('Map', mapSchema);

export default Map;


