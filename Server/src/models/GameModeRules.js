import mongoose from 'mongoose';

const gameModeRulesSchema = new mongoose.Schema({
  // Mode identifier (hardcore, cdl, or stricker)
  mode: {
    type: String,
    required: true,
    enum: ['hardcore', 'cdl', 'stricker']
  },
  
  // Location where rules will be displayed
  location: {
    type: String,
    required: true,
    enum: ['rankings', 'ranked'],
    default: 'ranked'
  },
  
  // Sub-type for more specific targeting
  // For rankings: 'duo-trio' or 'squad-team'
  // For ranked: 'snd', 'hardpoint'
  // For stricker: 'stricker-snd'
  subType: {
    type: String,
    required: true,
    enum: ['duo-trio', 'squad-team', 'duel', 'tdm', 'domination', 'snd', 'hardpoint', 'stricker-snd'],
    default: 'snd'
  },
  
  // Title of the rules page
  title: {
    fr: { type: String, default: '' },
    en: { type: String, default: '' },
    it: { type: String, default: '' },
    de: { type: String, default: '' }
  },
  
  // Sections with rich text content
  sections: [{
    // Section title
    title: {
      fr: { type: String, required: true },
      en: { type: String, required: true },
      it: { type: String, default: '' },
      de: { type: String, default: '' }
    },
    
    // Rich text content (supports HTML)
    content: {
      fr: { type: String, required: true },
      en: { type: String, required: true },
      it: { type: String, default: '' },
      de: { type: String, default: '' }
    },
    
    // Order within the mode
    order: {
      type: Number,
      default: 0
    },
    
    // Icon identifier (optional)
    icon: {
      type: String,
      default: 'fileText'
    }
  }],
  
  // Is this active?
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Who created/updated
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries - unique combination of mode + location + subType
gameModeRulesSchema.index({ mode: 1, location: 1, subType: 1 }, { unique: true });
gameModeRulesSchema.index({ isActive: 1 });
gameModeRulesSchema.index({ location: 1 });
gameModeRulesSchema.index({ subType: 1 });

export default mongoose.model('GameModeRules', gameModeRulesSchema);

