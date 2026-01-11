import mongoose from 'mongoose';

const helperConfirmationSchema = new mongoose.Schema({
  // The user who is being asked to help
  helper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The user who is requesting the help
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The squad requesting the help
  squad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    required: true
  },
  // Type of action: 'post' or 'accept'
  actionType: {
    type: String,
    enum: ['post', 'accept'],
    required: true
  },
  // Match details for context
  matchDetails: {
    ladderId: String,
    gameMode: String,
    teamSize: Number,
    matchId: String // Only for 'accept' action
  },
  // Status of the confirmation
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending'
  },
  // When it expires (30 seconds from creation)
  expiresAt: {
    type: Date,
    required: true
  },
  // Response time
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for quick lookups
helperConfirmationSchema.index({ helper: 1, status: 1 });
helperConfirmationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index to auto-delete

// Static method to create a confirmation request
helperConfirmationSchema.statics.createRequest = async function(data) {
  const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds from now
  return this.create({
    ...data,
    expiresAt
  });
};

// Static method to check if user has pending confirmations
helperConfirmationSchema.statics.hasPendingRequest = async function(helperId) {
  return this.findOne({
    helper: helperId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

// Method to accept the request
helperConfirmationSchema.methods.accept = async function() {
  if (this.status !== 'pending') {
    throw new Error('Request is no longer pending');
  }
  if (new Date() > this.expiresAt) {
    this.status = 'expired';
    await this.save();
    throw new Error('Request has expired');
  }
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

// Method to decline the request
helperConfirmationSchema.methods.decline = async function() {
  if (this.status !== 'pending') {
    throw new Error('Request is no longer pending');
  }
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

const HelperConfirmation = mongoose.model('HelperConfirmation', helperConfirmationSchema);

export default HelperConfirmation;








