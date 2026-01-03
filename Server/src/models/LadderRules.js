import mongoose from 'mongoose';

const ladderRulesSchema = new mongoose.Schema({
  ladderId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: 'Règlement du Classement'
  },
  content: {
    type: String,
    default: ''
  },
  allowedMaps: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Map'
  }],
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const LadderRules = mongoose.model('LadderRules', ladderRulesSchema);

export default LadderRules;

























