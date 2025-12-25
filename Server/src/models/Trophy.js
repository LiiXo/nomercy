import mongoose from 'mongoose';

const trophySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  // Translations
  translations: {
    fr: {
      name: String,
      description: String
    },
    en: {
      name: String,
      description: String
    },
    de: {
      name: String,
      description: String
    },
    it: {
      name: String,
      description: String
    }
  },
  // Icon type from lucide-react
  icon: {
    type: String,
    default: 'Trophy',
    enum: ['Trophy', 'Award', 'Medal', 'Star', 'Crown', 'Shield', 'Zap', 'Target', 'Flame', 'Gem', 'Heart', 'Sword']
  },
  // Color theme
  color: {
    type: String,
    default: 'amber',
    enum: ['amber', 'yellow', 'orange', 'red', 'pink', 'purple', 'blue', 'cyan', 'green', 'emerald', 'gray']
  },
  // Rarity level (higher = rarer, displayed first)
  rarity: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  // Rarity name
  rarityName: {
    type: String,
    default: 'common',
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary']
  },
  // Is this trophy given to all squads by default?
  isDefault: {
    type: Boolean,
    default: false
  },
  // Is this trophy active/visible?
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
trophySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Trophy = mongoose.model('Trophy', trophySchema);
export default Trophy;

