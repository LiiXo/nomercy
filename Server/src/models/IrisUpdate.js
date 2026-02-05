import mongoose from 'mongoose';

/**
 * IrisUpdate Model
 * Stores Iris client update versions and download information
 * Only admins can manage updates through the admin panel
 */
const irisUpdateSchema = new mongoose.Schema({
  // Version info
  version: {
    type: String,
    required: true,
    unique: true,
    match: /^\d+\.\d+\.\d+$/ // Semantic versioning: 1.0.0
  },
  
  // Code hash for this version (for integrity verification)
  codeHash: {
    type: String,
    required: true
  },
  
  // Download URL for the installer
  downloadUrl: {
    type: String,
    required: true
  },
  
  // File size in bytes
  fileSize: {
    type: Number,
    default: 0
  },
  
  // SHA256 hash of the installer file for verification
  fileHash: {
    type: String,
    required: true
  },
  
  // Changelog / release notes
  changelog: {
    type: String,
    default: ''
  },
  
  // Is this a mandatory update?
  // If true, old clients MUST update to continue using Iris
  mandatory: {
    type: Boolean,
    default: false
  },
  
  // Minimum version required to use this update
  // (for incremental updates)
  minVersion: {
    type: String,
    default: null
  },
  
  // Is this the current/latest release?
  isCurrent: {
    type: Boolean,
    default: false
  },
  
  // Is this update active (available for download)?
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Release date
  releasedAt: {
    type: Date,
    default: Date.now
  },
  
  // Who published this update
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Statistics
  downloadCount: {
    type: Number,
    default: 0
  },
  
  // Platform (for future multi-platform support)
  platform: {
    type: String,
    enum: ['windows', 'macos', 'linux'],
    default: 'windows'
  }
  
}, {
  timestamps: true
});

// Index for quick lookups
irisUpdateSchema.index({ version: 1 });
irisUpdateSchema.index({ isCurrent: 1, platform: 1 });
irisUpdateSchema.index({ isActive: 1 });

// Static method to get the current version
irisUpdateSchema.statics.getCurrentVersion = async function(platform = 'windows') {
  return this.findOne({ isCurrent: true, platform, isActive: true });
};

// Static method to check if an update is available for a given version
irisUpdateSchema.statics.checkForUpdate = async function(currentVersion, platform = 'windows') {
  const latestUpdate = await this.findOne({ 
    isCurrent: true, 
    platform, 
    isActive: true 
  });
  
  if (!latestUpdate) {
    return { updateAvailable: false };
  }
  
  // Compare versions
  const current = currentVersion.split('.').map(Number);
  const latest = latestUpdate.version.split('.').map(Number);
  
  let needsUpdate = false;
  for (let i = 0; i < 3; i++) {
    if (latest[i] > current[i]) {
      needsUpdate = true;
      break;
    } else if (latest[i] < current[i]) {
      break;
    }
  }
  
  if (!needsUpdate) {
    return { updateAvailable: false };
  }
  
  return {
    updateAvailable: true,
    version: latestUpdate.version,
    downloadUrl: latestUpdate.downloadUrl,
    fileSize: latestUpdate.fileSize,
    fileHash: latestUpdate.fileHash,
    changelog: latestUpdate.changelog,
    mandatory: latestUpdate.mandatory,
    releasedAt: latestUpdate.releasedAt
  };
};

// Pre-save hook: ensure only one current version per platform
irisUpdateSchema.pre('save', async function(next) {
  if (this.isCurrent && this.isModified('isCurrent')) {
    // Unset current flag on all other versions for this platform
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, platform: this.platform },
      { isCurrent: false }
    );
  }
  next();
});

const IrisUpdate = mongoose.model('IrisUpdate', irisUpdateSchema);

export default IrisUpdate;
