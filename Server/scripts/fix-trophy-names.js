import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixTrophyNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Get trophies directly from collection
    const trophies = await mongoose.connection.db.collection('trophies').find({}).toArray();
    console.log(`Found ${trophies.length} trophies:\n`);
    
    for (const t of trophies) {
      console.log(`- name: "${t.name}"`);
      console.log(`  fr: "${t.translations?.fr?.name || '-'}"`);
    }

    console.log('\n--- Checking if any have season in name ---');
    
    let updated = 0;
    for (const trophy of trophies) {
      const regex = /\s*-\s*Saison\s*\d+/gi;
      const needsUpdate = regex.test(trophy.name) || 
                          regex.test(trophy.translations?.fr?.name || '') ||
                          regex.test(trophy.translations?.en?.name || '');
      
      if (needsUpdate) {
        const newName = trophy.name.replace(/\s*-\s*Saison\s*\d+/gi, '').trim();
        const newFr = (trophy.translations?.fr?.name || '').replace(/\s*-\s*Saison\s*\d+/gi, '').trim();
        
        await mongoose.connection.db.collection('trophies').updateOne(
          { _id: trophy._id },
          { 
            $set: { 
              name: newName,
              'translations.fr.name': newFr || newName
            } 
          }
        );
        console.log(`✅ Updated: "${trophy.name}" → "${newName}"`);
        updated++;
      }
    }

    console.log(`\nDone! Updated ${updated} trophies.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixTrophyNames();
