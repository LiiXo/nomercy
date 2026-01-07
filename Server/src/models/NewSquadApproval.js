import mongoose from 'mongoose';

const newSquadApprovalSchema = new mongoose.Schema({
  approvalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  requestingSquadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    required: true
  },
  requestingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchPosterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  roster: [{
    type: mongoose.Schema.Types.Mixed
  }],
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// TTL index - auto-delete expired approvals after 1 minute
newSquadApprovalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });

export default mongoose.model('NewSquadApproval', newSquadApprovalSchema);

