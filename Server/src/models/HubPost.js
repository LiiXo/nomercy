import mongoose from 'mongoose';

const hubPostSchema = new mongoose.Schema({
  // Type of post
  type: {
    type: String,
    enum: ['recruitment', 'looking_for_team'],
    required: true
  },
  
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // For recruitment posts - the squad
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  },
  
  // Post content
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  
  // Requirements/Info
  platform: {
    type: String,
    enum: ['PC', 'PlayStation', 'Xbox', 'All'],
    default: 'All'
  },
  mode: {
    type: String,
    enum: ['hardcore', 'cdl', 'both'],
    default: 'both'
  },
  language: {
    type: String,
    default: 'fr'
  },
  
  // For LFT posts - player's experience/role
  playerRole: {
    type: String,
    default: ''
  },
  
  // For recruitment - number of spots
  spotsAvailable: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  // Contact info (Discord tag optional)
  discordTag: {
    type: String,
    default: ''
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Expiration (auto-expire after 30 days)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Index for queries
hubPostSchema.index({ type: 1, isActive: 1, createdAt: -1 });
hubPostSchema.index({ author: 1 });
hubPostSchema.index({ squad: 1 });
hubPostSchema.index({ expiresAt: 1 });

// Auto-deactivate expired posts
hubPostSchema.pre('find', function() {
  this.where({ 
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  });
});

const HubPost = mongoose.model('HubPost', hubPostSchema);

export default HubPost;











