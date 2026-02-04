import Squad from '../models/Squad.js';
import Trophy from '../models/Trophy.js';
import AppSettings from '../models/AppSettings.js';

// Reward gold for top 3 squads
export const STRICKER_REWARD_GOLD = {
  1: 50000,  // First place
  2: 30000,  // Second place
  3: 15000   // Third place
};

// Reward munitions for top 10 squads
export const STRICKER_REWARD_CRANES = {
  1: 500,   // 1st place
  2: 400,   // 2nd place
  3: 300,   // 3rd place
  4: 200,   // 4th place
  5: 150,   // 5th place
  6: 120,   // 6th place
  7: 100,   // 7th place
  8: 80,    // 8th place
  9: 60,    // 9th place
  10: 50    // 10th place
};

// Stricker rank thresholds (points)
const STRICKER_RANKS = {
  recrues: { min: 0, max: 249, name: 'Recrues', image: '/stricker1.png', rarity: 'common' },
  operateurs: { min: 250, max: 499, name: 'Opérateurs', image: '/stricker2.png', rarity: 'common' },
  veterans: { min: 500, max: 749, name: 'Vétérans', image: '/stricker3.png', rarity: 'rare' },
  commandants: { min: 750, max: 999, name: 'Commandants', image: '/stricker4.png', rarity: 'rare' },
  seigneurs: { min: 1000, max: 1499, name: 'Seigneurs de Guerre', image: '/stricker5.png', rarity: 'epic' },
  immortel: { min: 1500, max: Infinity, name: 'Immortel', image: '/stricker6.png', rarity: 'legendary' }
};

// Get rank from points
const getRankFromPoints = (points) => {
  if (points >= 1500) return 'immortel';
  if (points >= 1000) return 'seigneurs';
  if (points >= 750) return 'commandants';
  if (points >= 500) return 'veterans';
  if (points >= 250) return 'operateurs';
  return 'recrues';
};

/**
 * Reset Stricker season
 * - Creates trophies for ALL squads from Vétérans rank and above
 * - Gold rewards only for top 3
 * - Resets all stricker stats (points, wins, losses)
 * - Increments season number
 */
export const resetStrickerSeason = async (adminUserId) => {
  console.log('[STRICKER SEASON RESET] Starting season reset...');
  
  // Get current settings
  const settings = await AppSettings.getSettings();
  const endingSeason = settings?.strickerSettings?.currentSeason || 1;
  
  console.log(`[STRICKER SEASON RESET] Ending season ${endingSeason}`);
  
  const results = {
    seasonNumber: endingSeason,
    trophiesDistributed: 0,
    goldDistributed: 0,
    cranesDistributed: 0,
    top3: [],
    top10Cranes: [],
    trophiesByRank: {
      immortel: 0,
      seigneurs: 0,
      commandants: 0,
      veterans: 0
    },
    squadsReset: 0
  };
  
  // Get ALL squads with points >= 500 (Vétérans and above)
  const eligibleSquads = await Squad.find({
    'statsStricker.points': { $gte: 500 },
    isDeleted: { $ne: true }
  })
    .sort({ 'statsStricker.points': -1 })
    .populate('leader', 'username');
  
  console.log(`[STRICKER SEASON RESET] Found ${eligibleSquads.length} squads eligible for trophies (Vétérans+)`);
  
  // Create trophies cache by rank to avoid creating duplicates
  const trophyCache = {};
  
  // Process User model import
  const User = (await import('../models/User.js')).default;
  
  // Process each eligible squad
  for (let i = 0; i < eligibleSquads.length; i++) {
    const squad = eligibleSquads[i];
    const points = squad.statsStricker?.points || 0;
    const rankKey = getRankFromPoints(points);
    const rankInfo = STRICKER_RANKS[rankKey];
    const position = i + 1; // Overall position
    
    // Create or get cached trophy for this rank
    if (!trophyCache[rankKey]) {
      const trophy = new Trophy({
        name: `Saison ${endingSeason} Stricker - ${rankInfo.name}`,
        description: `Trophée de fin de saison ${endingSeason} du mode Stricker - Rang ${rankInfo.name}`,
        image: rankInfo.image,
        rarity: rankInfo.rarity,
        type: 'season',
        mode: 'stricker',
        category: 'stricker_season',
        isUnique: true,
        createdBy: adminUserId
      });
      await trophy.save();
      trophyCache[rankKey] = trophy;
      console.log(`[STRICKER SEASON RESET] Trophy created for rank ${rankInfo.name}: ${trophy.name}`);
    }
    
    const trophy = trophyCache[rankKey];
    
    // Assign trophy to squad
    squad.trophies.push({
      trophy: trophy._id,
      earnedAt: new Date(),
      reason: `${rankInfo.name} - Saison ${endingSeason} Stricker (${points} pts)`
    });
    
    // Gold rewards only for top 3
    let goldReward = 0;
    if (position <= 3) {
      goldReward = STRICKER_REWARD_GOLD[position];
      for (const member of squad.members) {
        await User.findByIdAndUpdate(member.user, {
          $inc: { goldCoins: goldReward }
        });
      }
      results.goldDistributed += goldReward * squad.members.length;
      
      results.top3.push({
        position,
        squadId: squad._id,
        squadName: squad.name,
        squadTag: squad.tag,
        points: points,
        wins: squad.statsStricker.wins,
        losses: squad.statsStricker.losses,
        rank: rankInfo.name,
        goldReward,
        membersCount: squad.members.length
      });
    }
    
    // Munitions rewards for top 10
    let cranesReward = 0;
    if (position <= 10) {
      cranesReward = STRICKER_REWARD_CRANES[position];
      squad.cranes = (squad.cranes || 0) + cranesReward;
      results.cranesDistributed += cranesReward;
      
      results.top10Cranes.push({
        position,
        squadId: squad._id,
        squadName: squad.name,
        squadTag: squad.tag,
        points: points,
        cranesReward
      });
      
      console.log(`[STRICKER SEASON RESET] #${position}: [${squad.tag}] ${squad.name} - +${cranesReward} cranes`);
    }
    
    await squad.save();
    
    results.trophiesDistributed++;
    results.trophiesByRank[rankKey]++;
    
    console.log(`[STRICKER SEASON RESET] #${position}: [${squad.tag}] ${squad.name} - ${points} pts (${rankInfo.name}) - Trophy assigned${goldReward > 0 ? ` + ${goldReward} gold` : ''}`);
  }
  
  // Reset all squad stricker stats
  const resetResult = await Squad.updateMany(
    { 'statsStricker.points': { $gt: 0 } },
    {
      $set: {
        'statsStricker.points': 0,
        'statsStricker.wins': 0,
        'statsStricker.losses': 0,
        'statsStricker.rank': 'Recrues'
      }
    }
  );
  
  results.squadsReset = resetResult.modifiedCount;
  console.log(`[STRICKER SEASON RESET] Reset ${results.squadsReset} squad stats`);
  
  // Increment season number and update start date
  const newSeasonNumber = endingSeason + 1;
  await AppSettings.findOneAndUpdate(
    {},
    {
      $set: {
        'strickerSettings.currentSeason': newSeasonNumber,
        'strickerSettings.seasonStartDate': new Date()
      }
    },
    { upsert: true }
  );
  
  console.log(`[STRICKER SEASON RESET] Season incremented to ${newSeasonNumber}`);
  console.log(`[STRICKER SEASON RESET] Complete! Trophies: ${results.trophiesDistributed} (Immortel: ${results.trophiesByRank.immortel}, Seigneurs: ${results.trophiesByRank.seigneurs}, Commandants: ${results.trophiesByRank.commandants}, Vétérans: ${results.trophiesByRank.veterans}), Gold: ${results.goldDistributed}, Cranes: ${results.cranesDistributed}, Squads reset: ${results.squadsReset}`);
  
  return results;
};

/**
 * Get Stricker season info for admin display
 */
export const getStrickerSeasonInfo = async () => {
  const settings = await AppSettings.getSettings();
  const strickerSettings = settings?.strickerSettings || {};
  
  const currentSeason = strickerSettings.currentSeason || 1;
  const seasonDurationMonths = strickerSettings.seasonDurationMonths || 2;
  const seasonStartDate = strickerSettings.seasonStartDate || new Date();
  
  // Calculate season end date
  const seasonEndDate = new Date(seasonStartDate);
  seasonEndDate.setMonth(seasonEndDate.getMonth() + seasonDurationMonths);
  
  // Get top squads
  const topSquads = await Squad.find({
    'statsStricker.points': { $gt: 0 },
    isDeleted: { $ne: true }
  })
    .sort({ 'statsStricker.points': -1 })
    .limit(10)
    .select('name tag logo statsStricker members')
    .populate('leader', 'username');
  
  // Get total active squads
  const totalSquads = await Squad.countDocuments({
    'statsStricker.points': { $gt: 0 },
    isDeleted: { $ne: true }
  });
  
  return {
    currentSeason,
    seasonDurationMonths,
    seasonStartDate,
    seasonEndDate,
    topSquads: topSquads.map((s, i) => ({
      position: i + 1,
      id: s._id,
      name: s.name,
      tag: s.tag,
      logo: s.logo,
      points: s.statsStricker?.points || 0,
      wins: s.statsStricker?.wins || 0,
      losses: s.statsStricker?.losses || 0,
      rank: s.statsStricker?.rank || 'Recrues',
      membersCount: s.members?.length || 0
    })),
    totalSquads
  };
};

export default {
  resetStrickerSeason,
  getStrickerSeasonInfo,
  STRICKER_REWARD_GOLD,
  STRICKER_REWARD_CRANES
};

