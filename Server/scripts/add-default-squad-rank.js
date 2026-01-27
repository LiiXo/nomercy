import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Squad from '../src/models/Squad.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function addDefaultRankToSquads() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all squads that don't have a rank in statsStricker
    const squads = await Squad.find({
      $or: [
        { 'statsStricker.rank': { $exists: false } },
        { 'statsStricker.rank': null },
        { 'statsStricker.rank': '' }
      ]
    });

    console.log(`\n📊 Found ${squads.length} squads without a Stricker rank`);

    if (squads.length === 0) {
      console.log('✅ All squads already have a rank assigned!');
      await mongoose.disconnect();
      return;
    }

    let updatedCount = 0;

    for (const squad of squads) {
      // Initialize statsStricker if it doesn't exist
      if (!squad.statsStricker) {
        squad.statsStricker = {
          points: 0,
          wins: 0,
          losses: 0,
          rank: 'Recrues'
        };
      } else {
        // Add rank to existing statsStricker
        squad.statsStricker.rank = 'Recrues';
      }

      await squad.save();
      updatedCount++;
      
      if (updatedCount % 10 === 0) {
        console.log(`   ⏳ Progress: ${updatedCount}/${squads.length} squads updated...`);
      }
    }

    console.log(`\n✅ Successfully added "Recrues" rank to ${updatedCount} squads!`);
    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
addDefaultRankToSquads()
  .then(() => {
    console.log('🎉 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
