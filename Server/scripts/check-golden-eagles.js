/**
 * Check Golden Eagles squad stats
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Squad from '../src/models/Squad.js';

async function checkGoldenEagles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const geSquad = await Squad.findOne({ tag: 'GE' }).select('name tag statsStricker cranes isActive isDeleted members');
    
    if (!geSquad) {
      console.log('❌ Golden Eagles squad not found');
      return;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🦅 GOLDEN EAGLES SQUAD');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Name: ${geSquad.name}`);
    console.log(`Tag: [${geSquad.tag}]`);
    console.log(`ID: ${geSquad._id}`);
    console.log(`isActive: ${geSquad.isActive}`);
    console.log(`isDeleted: ${geSquad.isDeleted || false}`);
    console.log(`Members: ${geSquad.members.length}`);
    console.log(`\nstatsStricker:`, geSquad.statsStricker);
    console.log(`Munitions: ${geSquad.cranes || 0}`);
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkGoldenEagles();

