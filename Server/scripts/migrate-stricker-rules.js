/**
 * Migration script to copy existing stricker-snd rules to stricker-snd-5v5
 * This ensures backward compatibility after adding 3v3/5v5 format support
 * 
 * Run with: node scripts/migrate-stricker-rules.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// GameModeRules schema definition (simplified for migration)
const gameModeRulesSchema = new mongoose.Schema({
  mode: String,
  location: String,
  subType: String,
  title: {
    fr: String,
    en: String,
    it: String,
    de: String
  },
  sections: [{
    title: {
      fr: String,
      en: String,
      it: String,
      de: String
    },
    content: {
      fr: String,
      en: String,
      it: String,
      de: String
    },
    icon: String,
    order: Number
  }],
  isActive: Boolean,
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const GameModeRules = mongoose.model('GameModeRules', gameModeRulesSchema);

async function migrateStrickerRules() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find existing stricker-snd rules
    const legacyRules = await GameModeRules.find({
      mode: 'stricker',
      location: 'ranked',
      subType: 'stricker-snd'
    });
    
    console.log(`Found ${legacyRules.length} legacy stricker-snd rules`);
    
    if (legacyRules.length === 0) {
      console.log('No legacy rules to migrate.');
      await mongoose.disconnect();
      return;
    }
    
    for (const rule of legacyRules) {
      // Check if stricker-snd-5v5 already exists
      const existing5v5 = await GameModeRules.findOne({
        mode: 'stricker',
        location: 'ranked',
        subType: 'stricker-snd-5v5'
      });
      
      if (existing5v5) {
        console.log('stricker-snd-5v5 rules already exist, skipping...');
        continue;
      }
      
      // Create a copy with stricker-snd-5v5 subType
      const newRules = new GameModeRules({
        mode: 'stricker',
        location: 'ranked',
        subType: 'stricker-snd-5v5',
        title: rule.title,
        sections: rule.sections,
        isActive: rule.isActive,
        createdBy: rule.createdBy,
        updatedBy: rule.updatedBy
      });
      
      await newRules.save();
      console.log(`Created stricker-snd-5v5 rules with ${rule.sections?.length || 0} sections`);
      
      // Optionally, update the old rule's subType to keep it as stricker-snd-5v5
      // and delete the old one - but let's keep the legacy one for now
      console.log('Legacy stricker-snd rules kept for backward compatibility');
    }
    
    console.log('Migration complete!');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateStrickerRules();
