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
  // Ladders où cette map est disponible
  ladders: [{
    type: String,
    enum: ['duo-trio', 'squad-team']
  }],
  // Modes de jeu où cette map est disponible
  gameModes: [{
    type: String,
    enum: ['Search & Destroy', 'Domination', 'Team Deathmatch', 'Hardpoint', 'Control']
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


