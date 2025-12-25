import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  // Section identifier (for grouping)
  sectionKey: {
    type: String,
    required: true,
    enum: ['generalRules', 'matchRules', 'squadRules', 'sanctions', 'cheating']
  },
  
  // Order within section
  order: {
    type: Number,
    default: 0
  },
  
  // Rule content in multiple languages
  content: {
    fr: { type: String, required: true },
    en: { type: String, required: true },
    it: { type: String, default: '' },
    de: { type: String, default: '' }
  },
  
  // Is this rule active?
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Who created/updated this rule
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

// Index for efficient queries
ruleSchema.index({ sectionKey: 1, order: 1 });
ruleSchema.index({ isActive: 1 });

export default mongoose.model('Rule', ruleSchema);


