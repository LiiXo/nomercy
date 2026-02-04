/**
 * Inspect a specific Stricker match in detail
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
import User from '../src/models/User.js';

const matchId = process.argv[2];

if (!matchId) {
  console.error('❌ Please provide a match ID');
  console.log('Usage: node scripts/inspect-stricker-match.js <matchId>');
  process.exit(1);
}

async function inspectMatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const match = await StrickerMatch.findById(matchId)
      .populate('team1Squad', 'name tag statsStricker')
      .populate('team2Squad', 'name tag statsStricker')
      .populate('players.user', 'username statsStricker')
      .populate('team1Referent', 'username')
      .populate('team2Referent', 'username');

    if (!match) {
      console.error('❌ Match not found');
      process.exit(1);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`🔍 MATCH DETAILS: ${matchId}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📋 Basic Info:');
    console.log(`   Status: ${match.status}`);
    console.log(`   Created: ${match.createdAt}`);
    console.log(`   Completed: ${match.completedAt || 'Not completed'}`);
    console.log();

    console.log('🏆 Teams:');
    console.log(`   Team 1: [${match.team1Squad?.tag}] ${match.team1Squad?.name}`);
    console.log(`      Referent: ${match.team1Referent?.username || 'None'}`);
    console.log(`      Score: ${match.team1Score || 0}`);
    console.log(`      statsStricker:`, match.team1Squad?.statsStricker || 'None');
    console.log();
    console.log(`   Team 2: [${match.team2Squad?.tag}] ${match.team2Squad?.name}`);
    console.log(`      Referent: ${match.team2Referent?.username || 'None'}`);
    console.log(`      Score: ${match.team2Score || 0}`);
    console.log(`      statsStricker:`, match.team2Squad?.statsStricker || 'None');
    console.log();

    console.log('🎯 Result:');
    console.log(`   Winner: ${match.winner || 'undefined'}`);
    console.log(`   Result object:`, JSON.stringify(match.result, null, 2));
    console.log();

    console.log('👥 Players:');
    match.players.forEach((player, i) => {
      console.log(`   ${i + 1}. ${player.user?.username || 'Unknown'} (Team ${player.team})`);
      console.log(`      isFake: ${player.isFake || false}`);
      console.log(`      rewards:`, player.rewards || 'None');
      console.log(`      user.statsStricker:`, player.user?.statsStricker || 'None');
      console.log();
    });

    console.log('⚠️  Issues Found:');
    const issues = [];
    
    if (!match.winner) {
      issues.push('❌ No winner set (match.winner is undefined)');
    }
    if (!match.result?.winner) {
      issues.push('❌ No result.winner set');
    }
    if (!match.result?.team1Report) {
      issues.push('⚠️  Team 1 referent never voted');
    }
    if (!match.result?.team2Report) {
      issues.push('⚠️  Team 2 referent never voted');
    }
    if (match.status === 'completed' && !match.players.some(p => p.rewards)) {
      issues.push('❌ Match completed but NO rewards distributed to any player');
    }
    if (!match.team1Squad?.statsStricker?.wins && !match.team1Squad?.statsStricker?.losses) {
      issues.push('❌ Team 1 squad has NO statsStricker');
    }
    if (!match.team2Squad?.statsStricker?.wins && !match.team2Squad?.statsStricker?.losses) {
      issues.push('❌ Team 2 squad has NO statsStricker');
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('   ✅ No issues found');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

inspectMatch();
