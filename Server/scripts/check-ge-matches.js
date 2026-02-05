/**
 * Check all Golden Eagles Stricker matches
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Squad from '../src/models/Squad.js';
import StrickerMatch from '../src/models/StrickerMatch.js';

async function checkGEMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find Golden Eagles squad
    const geSquad = await Squad.findOne({ tag: 'GE' });
    if (!geSquad) {
      console.log('❌ Golden Eagles squad not found');
      return;
    }
    
    console.log(`\n🔍 Checking matches for: ${geSquad.name} [${geSquad.tag}] (${geSquad._id})\n`);
    
    // Find all matches involving Golden Eagles
    const matches = await StrickerMatch.find({
      $or: [
        { team1Squad: geSquad._id },
        { team2Squad: geSquad._id }
      ]
    })
    .populate('team1Squad', 'name tag')
    .populate('team2Squad', 'name tag')
    .sort({ createdAt: -1 })
    .lean();
    
    console.log(`Found ${matches.length} matches\n`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    matches.forEach((match, index) => {
      const isTeam1 = match.team1Squad?._id?.toString() === geSquad._id.toString();
      const teamName = isTeam1 ? 'Team 1' : 'Team 2';
      const opponentSquad = isTeam1 ? match.team2Squad : match.team1Squad;
      const score = `${match.team1Score || 0} - ${match.team2Score || 0}`;
      
      console.log(`Match #${index + 1}:`);
      console.log(`  ID: ${match._id}`);
      console.log(`  Status: ${match.status}`);
      console.log(`  Winner: ${match.winner || 'none'}`);
      console.log(`  Score: ${score}`);
      console.log(`  GE plays as: ${teamName}`);
      console.log(`  Opponent: [${opponentSquad?.tag || '???'}] ${opponentSquad?.name || 'Unknown'}`);
      console.log(`  Created: ${match.createdAt}`);
      console.log(`  Completed: ${match.completedAt || 'N/A'}`);
      console.log(`  isTestMatch: ${match.isTestMatch || false}`);
      
      // Check if GE won
      const geWon = (isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2);
      console.log(`  GE Result: ${geWon ? '✅ WIN' : '❌ LOSS'}`);
      
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Count by status
    const statusCount = {};
    matches.forEach(m => {
      statusCount[m.status] = (statusCount[m.status] || 0) + 1;
    });
    
    console.log('📊 Summary by status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Count completed matches
    const completedMatches = matches.filter(m => m.status === 'completed' && m.winner);
    console.log(`\n✅ Completed matches with winner: ${completedMatches.length}`);
    
    const geWins = completedMatches.filter(m => {
      const isTeam1 = m.team1Squad?._id?.toString() === geSquad._id.toString();
      return (isTeam1 && m.winner === 1) || (!isTeam1 && m.winner === 2);
    }).length;
    
    const geLosses = completedMatches.filter(m => {
      const isTeam1 = m.team1Squad?._id?.toString() === geSquad._id.toString();
      return (isTeam1 && m.winner === 2) || (!isTeam1 && m.winner === 1);
    }).length;
    
    console.log(`🏆 GE Wins: ${geWins}`);
    console.log(`💀 GE Losses: ${geLosses}`);
    
    console.log(`\n📝 Squad stats in DB:`);
    console.log(`  Wins: ${geSquad.statsStricker?.wins || 0}`);
    console.log(`  Losses: ${geSquad.statsStricker?.losses || 0}`);
    console.log(`  Points: ${geSquad.statsStricker?.points || 0}`);
    
    if (geWins !== (geSquad.statsStricker?.wins || 0)) {
      console.log(`\n⚠️  MISMATCH: Actual wins (${geWins}) ≠ Squad stats wins (${geSquad.statsStricker?.wins || 0})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkGEMatches();
