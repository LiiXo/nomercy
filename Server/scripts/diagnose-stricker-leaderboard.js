/**
 * Diagnose and fix Stricker leaderboard issues
 * 
 * This script checks:
 * 1. All squads with statsStricker field
 * 2. All Stricker matches and their status
 * 3. Identifies squads that played matches but have no stats
 * 4. Offers to fix missing squad stats
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models
import Squad from '../src/models/Squad.js';
import StrickerMatch from '../src/models/StrickerMatch.js';
import User from '../src/models/User.js';

async function diagnoseStrickerLeaderboard() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STRICKER LEADERBOARD DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Check all squads with statsStricker
    console.log('1️⃣ Checking all squads with statsStricker...\n');
    
    // First, let's see ALL squads, regardless of stats or active status
    const allSquads = await Squad.find({}).select('name tag logo statsStricker cranes isActive isDeleted').limit(20);
    
    console.log(`   Total squads found (first 20): ${allSquads.length}\n`);
    allSquads.forEach((squad, i) => {
      console.log(`   ${i + 1}. [${squad.tag}] ${squad.name}`);
      console.log(`      isActive: ${squad.isActive}, isDeleted: ${squad.isDeleted || false}`);
      console.log(`      statsStricker:`, squad.statsStricker || 'None');
      console.log(`      Munitions: ${squad.cranes || 0}`);
      console.log();
    });
    
    const squadsWithStats = await Squad.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [
        { 'statsStricker.points': { $gt: 0 } },
        { 'statsStricker.wins': { $gt: 0 } },
        { 'statsStricker.losses': { $gt: 0 } }
      ]
    }).select('name tag logo statsStricker cranes');

    console.log(`\n   Squads with Stricker stats (points>0 OR wins>0 OR losses>0): ${squadsWithStats.length}\n`);
    squadsWithStats.forEach((squad, i) => {
      console.log(`   ${i + 1}. [${squad.tag}] ${squad.name}`);
      console.log(`      Points: ${squad.statsStricker?.points || 0} | Wins: ${squad.statsStricker?.wins || 0} | Losses: ${squad.statsStricker?.losses || 0}`);
      console.log(`      Munitions: ${squad.cranes || 0}`);
      console.log();
    });

    // 2. Check all Stricker matches
    console.log('\n2️⃣ Checking Stricker matches...\n');
    
    const completedMatches = await StrickerMatch.find({ status: 'completed' })
      .populate('team1Squad', 'name tag')
      .populate('team2Squad', 'name tag')
      .select('_id status winner team1Squad team2Squad completedAt')
      .sort({ completedAt: -1 })
      .limit(20);

    console.log(`   Found ${completedMatches.length} completed matches (last 20):\n`);
    completedMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. Match ${match._id}`);
      console.log(`      Team 1: [${match.team1Squad?.tag || '?'}] ${match.team1Squad?.name || 'Unknown'}`);
      console.log(`      Team 2: [${match.team2Squad?.tag || '?'}] ${match.team2Squad?.name || 'Unknown'}`);
      console.log(`      Winner: Team ${match.winner}`);
      console.log(`      Completed: ${match.completedAt}`);
      console.log();
    });

    const disputedMatches = await StrickerMatch.find({ status: 'disputed' })
      .populate('team1Squad', 'name tag')
      .populate('team2Squad', 'name tag')
      .select('_id status team1Squad team2Squad');

    console.log(`   ⚠️  Found ${disputedMatches.length} disputed matches:\n`);
    disputedMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. Match ${match._id}`);
      console.log(`      Team 1: [${match.team1Squad?.tag || '?'}] ${match.team1Squad?.name || 'Unknown'}`);
      console.log(`      Team 2: [${match.team2Squad?.tag || '?'}] ${match.team2Squad?.name || 'Unknown'}`);
      console.log();
    });

    const pendingMatches = await StrickerMatch.find({ 
      status: { $in: ['pending', 'ready', 'in_progress'] }
    })
      .populate('team1Squad', 'name tag')
      .populate('team2Squad', 'name tag')
      .select('_id status team1Squad team2Squad');

    console.log(`   🕒 Found ${pendingMatches.length} pending/in-progress matches:\n`);
    pendingMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. Match ${match._id} - Status: ${match.status}`);
      console.log(`      Team 1: [${match.team1Squad?.tag || '?'}] ${match.team1Squad?.name || 'Unknown'}`);
      console.log(`      Team 2: [${match.team2Squad?.tag || '?'}] ${match.team2Squad?.name || 'Unknown'}`);
      console.log();
    });

    // 3. Find squads that played matches but have no stats
    console.log('\n3️⃣ Finding squads with completed matches but missing stats...\n');
    
    const allCompletedMatches = await StrickerMatch.find({ status: 'completed' })
      .populate('team1Squad', 'name tag statsStricker')
      .populate('team2Squad', 'name tag statsStricker');

    const squadsInMatches = new Set();
    const squadsWithMissingStats = [];

    allCompletedMatches.forEach(match => {
      if (match.team1Squad) {
        squadsInMatches.add(match.team1Squad._id.toString());
        if (!match.team1Squad.statsStricker || 
            (!match.team1Squad.statsStricker.wins && !match.team1Squad.statsStricker.losses)) {
          squadsWithMissingStats.push({
            squad: match.team1Squad,
            matchId: match._id
          });
        }
      }
      if (match.team2Squad) {
        squadsInMatches.add(match.team2Squad._id.toString());
        if (!match.team2Squad.statsStricker || 
            (!match.team2Squad.statsStricker.wins && !match.team2Squad.statsStricker.losses)) {
          squadsWithMissingStats.push({
            squad: match.team2Squad,
            matchId: match._id
          });
        }
      }
    });

    console.log(`   Total squads that played Stricker: ${squadsInMatches.size}`);
    console.log(`   Squads with stats: ${squadsWithStats.length}`);
    console.log(`   Squads missing stats: ${squadsWithMissingStats.length}\n`);

    if (squadsWithMissingStats.length > 0) {
      console.log('   ❌ Squads with missing stats:');
      const uniqueMissing = [...new Map(squadsWithMissingStats.map(item => 
        [item.squad._id.toString(), item]
      )).values()];
      
      uniqueMissing.forEach((item, i) => {
        console.log(`   ${i + 1}. [${item.squad.tag}] ${item.squad.name}`);
        console.log(`      Last match: ${item.matchId}`);
        console.log(`      statsStricker:`, item.squad.statsStricker);
        console.log();
      });
    }

    // 4. Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   ✅ Squads in leaderboard: ${squadsWithStats.length}`);
    console.log(`   📊 Completed matches: ${completedMatches.length}`);
    console.log(`   ⚠️  Disputed matches: ${disputedMatches.length}`);
    console.log(`   🕒 Pending matches: ${pendingMatches.length}`);
    console.log(`   ❌ Squads missing stats: ${squadsWithMissingStats.length}`);
    console.log();

    if (disputedMatches.length > 0) {
      console.log('   💡 TIP: Disputed matches need admin resolution before stats are awarded.');
    }

    if (squadsWithMissingStats.length > 0) {
      console.log('   💡 TIP: Some squads have completed matches but no stats. This could be due to:');
      console.log('      - Matches completed before the stats system was implemented');
      console.log('      - Database inconsistency');
      console.log('      - Errors during reward distribution');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run the diagnostic
diagnoseStrickerLeaderboard();

