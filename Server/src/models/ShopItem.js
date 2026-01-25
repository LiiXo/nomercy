import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Translations
  nameTranslations: {
    fr: { type: String, default: '' },
    en: { type: String, default: '' },
    de: { type: String, default: '' },
    it: { type: String, default: '' }
  },
  descriptionTranslations: {
    fr: { type: String, default: '' },
    en: { type: String, default: '' },
    de: { type: String, default: '' },
    it: { type: String, default: '' }
  },
  
  // Category
  category: {
    type: String,
    required: true,
    enum: ['avatar_frame', 'ornament', 'badge', 'title', 'boost', 'cosmetic', 'emote', 'profile_animation', 'usable_item', 'other']
  },
  
  // Profile animation specific data
  profileAnimationData: {
    animationName: { type: String, default: '' }, // CSS animation class name
    backgroundEffect: { type: String, default: '' }, // Background gradient/effect
    particleEffect: { type: String, default: '' }, // Particle type (fire, snow, stars, etc.)
    borderEffect: { type: String, default: '' }, // Border animation
    glowEffect: { type: String, default: '' } // Glow color/intensity
  },
  
  // Ornament specific data (for avatar frames)
  ornamentData: {
    borderColor: { type: String, default: '' }, // e.g., 'from-yellow-400 to-orange-500'
    glowColor: { type: String, default: '' }, // e.g., 'rgba(251, 191, 36, 0.6)'
    borderWidth: { type: Number, default: 6 }, // Increased default for more impressive look
    animated: { type: Boolean, default: false },
    animationType: { type: String, default: '' }, // e.g., 'demon-fire', 'angel-halo', 'manga-energy', etc.
    multiLayer: { type: Boolean, default: false }, // Enable multi-layer effects
    layer2Color: { type: String, default: '' }, // Second layer gradient
    layer3Color: { type: String, default: '' } // Third layer gradient (outermost)
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number, // For showing discounts
    min: 0
  },
  
  // Display
  image: {
    type: String, // URL to image
    default: ''
  },
  icon: {
    type: String, // Icon name (lucide icon)
    default: 'Package'
  },
  color: {
    type: String, // Tailwind color class
    default: 'cyan'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  
  // Availability
  isActive: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number, // -1 = unlimited
    default: -1
  },
  
  // Mode specific
  mode: {
    type: String,
    enum: ['all', 'hardcore', 'cdl'],
    default: 'all'
  },
  
  // Time-limited
  availableFrom: {
    type: Date
  },
  availableUntil: {
    type: Date
  },
  
  // Stats/Effects (if applicable)
  effects: {
    type: mongoose.Schema.Types.Mixed, // Flexible for different item types
    default: {}
  },
  
  // Usable items (for boosts, consumables, etc.)
  isUsable: {
    type: Boolean,
    default: false
  },
  effectType: {
    type: String,
    enum: ['double_xp', 'double_pts', 'double_gold', 'cancel_match', 'emote', 'other'],
    default: 'other'
  },
  matchCount: {
    type: Number, // Number of matches the item lasts (0 = instant/one-time use, null = unlimited)
    default: 1
  },
  usableInMatch: {
    type: Boolean, // Can be used during a match
    default: false
  },
  
  // Purchase settings
  allowMultiplePurchases: {
    type: Boolean, // Can be purchased multiple times
    default: false
  },
  
  // Purchase tracking
  totalSold: {
    type: Number,
    default: 0
  },
  
  // Order for display
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
shopItemSchema.index({ category: 1, isActive: 1 });
shopItemSchema.index({ mode: 1, isActive: 1 });

// Virtual to check if item is available
shopItemSchema.virtual('isAvailable').get(function() {
  if (!this.isActive) return false;
  if (this.stock === 0) return false;
  
  const now = new Date();
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableUntil && now > this.availableUntil) return false;
  
  return true;
});

// Virtual for discount percentage
shopItemSchema.virtual('discountPercent').get(function() {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round((1 - this.price / this.originalPrice) * 100);
});

shopItemSchema.set('toJSON', { virtuals: true });
shopItemSchema.set('toObject', { virtuals: true });

const ShopItem = mongoose.model('ShopItem', shopItemSchema);

export default ShopItem;

