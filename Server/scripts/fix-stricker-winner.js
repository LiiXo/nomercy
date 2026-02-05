/**
 * Fix existing Stricker matches that have result.winner but not match.winner
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import StrickerMatch from '../src/models/StrickerMatch.js';
import Squad from '../src/models/Squad.js';

async function fixStrickerMatches() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 FIX STRICKER MATCHES');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find all completed matches where match.winner is undefined but result.winner exists
    const brokenMatches = await StrickerMatch.find({
      status: 'completed',
      winner: { $exists: false },
      'result.winner': { $exists: true }
    }).populate('team1Squad', 'name tag')
      .populate('team2Squad', 'name tag');

    console.log(`Found ${brokenMatches.length} matches to fix:\n`);

    if (brokenMatches.length === 0) {
      console.log('✅ No matches need fixing!\n');
      return;
    }

    for (const match of brokenMatches) {
      console.log(`   📝 Fixing match ${match._id}`);
      console.log(`      Team 1: [${match.team1Squad?.tag}] ${match.team1Squad?.name}`);
      console.log(`      Team 2: [${match.team2Squad?.tag}] ${match.team2Squad?.name}`);
      console.log(`      result.winner: ${match.result.winner}`);
      
      // Set winner at root level
      match.winner = match.result.winner;
      await match.save();
      
      console.log(`      ✅ Fixed! match.winner now set to ${match.winner}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Fixed ${brokenMatches.length} matches successfully!`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

fixStrickerMatches();
