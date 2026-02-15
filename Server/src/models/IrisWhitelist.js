import mongoose from 'mongoose';

/**
 * IrisWhitelist Schema
 * Stores globally whitelisted items for Iris anticheat detection
 * When an item is whitelisted, it will no longer be detected for ANY player
 */
const irisWhitelistSchema = new mongoose.Schema({
  // Type of detection being whitelisted
  type: {
    type: String,
    required: true,
    enum: [
      'driver',        // Kernel drivers
      'process',       // Running processes
      'registry',      // Registry traces
      'macro',         // Macro software (AHK, Logitech, etc.)
      'overlay',       // Overlay windows
      'dll',           // DLL injections
      'vpn_adapter',   // VPN network adapters
      'vpn_process',   // VPN processes
      'usb_device',    // USB devices
      'cheat_window'   // Cheat window/panel detection
    ]
  },

  // The identifier that matches the detection
  // For drivers: name or displayName
  // For processes: process name
  // For registry: cheatName or path
  // For macros: software name
  // For overlays: process name or window class
  // For DLLs: dll name
  // For VPN: adapter name or process name
  // For USB: VID:PID or device name
  // For cheat windows: matched cheat name
  identifier: {
    type: String,
    required: true,
    trim: true
  },

  // Secondary identifier (optional, for more specific matching)
  // e.g., for USB: PID when VID is the primary identifier
  secondaryIdentifier: {
    type: String,
    trim: true
  },

  // Display name for the whitelist entry (human-readable)
  displayName: {
    type: String,
    required: true,
    trim: true
  },

  // Reason for whitelisting (documented by admin)
  reason: {
    type: String,
    trim: true,
    default: ''
  },

  // Who added this whitelist entry
  addedBy: {
    type: String,
    required: true,
    trim: true
  },

  // Discord ID of who added it (for tracking)
  addedByDiscordId: {
    type: String,
    trim: true
  },

  // When the whitelist entry was added
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Original detection data (for reference)
  originalDetectionData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Player context where it was first whitelisted from
  originalPlayerContext: {
    username: String,
    discordUsername: String,
    discordId: String
  },

  // Is this whitelist entry active?
  isActive: {
    type: Boolean,
    default: true
  }
});

// Compound index for efficient lookups
irisWhitelistSchema.index({ type: 1, identifier: 1 }, { unique: true });
irisWhitelistSchema.index({ type: 1, isActive: 1 });
irisWhitelistSchema.index({ createdAt: -1 });

// Static method to check if an item is whitelisted
irisWhitelistSchema.statics.isWhitelisted = async function(type, identifier, secondaryIdentifier = null) {
  const query = { type, isActive: true };
  
  // Case-insensitive match on identifier
  query.identifier = { $regex: new RegExp(`^${escapeRegex(identifier)}$`, 'i') };
  
  // If secondary identifier is provided, also check it
  if (secondaryIdentifier) {
    // Match if no secondary identifier is set OR if it matches
    query.$or = [
      { secondaryIdentifier: { $exists: false } },
      { secondaryIdentifier: '' },
      { secondaryIdentifier: { $regex: new RegExp(`^${escapeRegex(secondaryIdentifier)}$`, 'i') } }
    ];
  }
  
  const entry = await this.findOne(query);
  return !!entry;
};

// Static method to get all whitelisted identifiers for a type
irisWhitelistSchema.statics.getWhitelistForType = async function(type) {
  return this.find({ type, isActive: true }).lean();
};

// Static method to filter out whitelisted items from a detection array
irisWhitelistSchema.statics.filterDetections = async function(type, detections, identifierField = 'name') {
  if (!detections || detections.length === 0) return detections;
  
  const whitelist = await this.getWhitelistForType(type);
  if (whitelist.length === 0) return detections;
  
  const whitelistSet = new Set(whitelist.map(w => w.identifier.toLowerCase()));
  
  return detections.filter(d => {
    const identifier = d[identifierField]?.toLowerCase();
    return identifier && !whitelistSet.has(identifier);
  });
};

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const IrisWhitelist = mongoose.model('IrisWhitelist', irisWhitelistSchema);

export default IrisWhitelist;
