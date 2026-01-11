import mongoose from 'mongoose';
import Config from '../src/models/Config.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateLadderRewards() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the config
    const config = await Config.findOne({ type: 'rewards' });
    
    if (!config) {
      console.log('❌ No config found. Creating default config...');
      const newConfig = new Config({ type: 'rewards' });
      await newConfig.save();
      console.log('✅ Default config created');
      return;
    }

    console.log('📋 Current config structure:', JSON.stringify(config, null, 2));

    // Check if old squadMatchRewards exists
    if (config.squadMatchRewards && (!config.squadMatchRewardsChill || !config.squadMatchRewardsCompetitive)) {
      console.log('🔄 Migrating old squadMatchRewards to new structure...');
      
      // Copy old values to Chill (with slightly lower values)
      config.squadMatchRewardsChill = {
        ladderPointsWin: Math.round((config.squadMatchRewards.ladderPointsWin || 20) * 0.75),
        ladderPointsLoss: Math.round((config.squadMatchRewards.ladderPointsLoss || 10) * 0.8),
        generalSquadPointsWin: Math.round((config.squadMatchRewards.generalSquadPointsWin || 15) * 0.67),
        generalSquadPointsLoss: Math.round((config.squadMatchRewards.generalSquadPointsLoss || 7) * 0.71),
        playerPointsWin: Math.round((config.squadMatchRewards.playerPointsWin || 20) * 0.75),
        playerPointsLoss: Math.round((config.squadMatchRewards.playerPointsLoss || 10) * 0.8),
        playerCoinsWin: Math.round((config.squadMatchRewards.playerCoinsWin || 50) * 0.8),
        playerCoinsLoss: Math.round((config.squadMatchRewards.playerCoinsLoss || 25) * 0.8),
        playerXPWinMin: Math.round((config.squadMatchRewards.playerXPWinMin || 450) * 0.78),
        playerXPWinMax: Math.round((config.squadMatchRewards.playerXPWinMax || 550) * 0.82)
      };

      // Copy old values to Competitive (with slightly higher values)
      config.squadMatchRewardsCompetitive = {
        ladderPointsWin: Math.round((config.squadMatchRewards.ladderPointsWin || 20) * 1.25),
        ladderPointsLoss: Math.round((config.squadMatchRewards.ladderPointsLoss || 10) * 1.2),
        generalSquadPointsWin: Math.round((config.squadMatchRewards.generalSquadPointsWin || 15) * 1.33),
        generalSquadPointsLoss: Math.round((config.squadMatchRewards.generalSquadPointsLoss || 7) * 1.43),
        playerPointsWin: Math.round((config.squadMatchRewards.playerPointsWin || 20) * 1.25),
        playerPointsLoss: Math.round((config.squadMatchRewards.playerPointsLoss || 10) * 1.2),
        playerCoinsWin: Math.round((config.squadMatchRewards.playerCoinsWin || 50) * 1.2),
        playerCoinsLoss: Math.round((config.squadMatchRewards.playerCoinsLoss || 25) * 1.2),
        playerXPWinMin: Math.round((config.squadMatchRewards.playerXPWinMin || 450) * 1.22),
        playerXPWinMax: Math.round((config.squadMatchRewards.playerXPWinMax || 550) * 1.18)
      };

      // Remove old field
      config.squadMatchRewards = undefined;
      
      await config.save();
      
      console.log('✅ Migration completed!');
      console.log('\n📊 New Chill Rewards:', JSON.stringify(config.squadMatchRewardsChill, null, 2));
      console.log('\n🔥 New Competitive Rewards:', JSON.stringify(config.squadMatchRewardsCompetitive, null, 2));
    } else if (config.squadMatchRewardsChill && config.squadMatchRewardsCompetitive) {
      console.log('✅ Config already migrated. Nothing to do.');
    } else {
      console.log('⚠️ Unexpected config structure. Please check manually.');
    }

    console.log('\n✅ Migration script completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrateLadderRewards();





