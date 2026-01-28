import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Member info
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // Avatar (URL or Discord CDN)
  avatar: {
    type: String,
    default: null
  },
  
  // Social links
  discordUsername: {
    type: String,
    default: null
  },
  
  // Display order
  order: {
    type: Number,
    default: 0
  },
  
  // Category (e.g., 'direction', 'staff', 'arbitre', 'moderator')
  category: {
    type: String,
    enum: ['direction', 'staff', 'arbitre', 'moderator', 'other'],
    default: 'other'
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for ordering
teamMemberSchema.index({ category: 1, order: 1 });

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

export default TeamMember;
