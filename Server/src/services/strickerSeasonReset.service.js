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
 * Reset Stricker season for a specific format
 * - Creates trophies for ALL squads from Vétérans rank and above
 * - Gold rewards only for top 3
 * - Resets all stricker stats (points, wins, losses)
 * - Increments season number
 * @param {string} adminUserId - Admin user ID performing the reset
 * @param {string} format - Format to reset ('3v3' or '5v5'), defaults to '5v5'
 */
export const resetStrickerSeason = async (adminUserId, format = '5v5') => {
  // 5v5 uses legacy 'statsStricker' for backward compatibility with existing data
  const statsField = format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
  const seasonKey = format === '3v3' ? 'strickerSettings3v3' : 'strickerSettings';
  
  // Get current settings
  const settings = await AppSettings.getSettings();
  const formatSettings = settings?.[seasonKey] || settings?.strickerSettings || {};
  const endingSeason = formatSettings.currentSeason || 1;
  
  
  const results = {
    seasonNumber: endingSeason,
    format: format,
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
  
  // Get ALL squads with points >= 500 (Vétérans and above) for this format
  const eligibleSquads = await Squad.find({
    [`${statsField}.points`]: { $gte: 500 },
    isDeleted: { $ne: true }
  })
    .sort({ [`${statsField}.points`]: -1 })
    .populate('leader', 'username');
  
  
  // Create trophies cache by rank to avoid creating duplicates
  const trophyCache = {};
  
  // Process User model import
  const User = (await import('../models/User.js')).default;
  
  // Process each eligible squad
  for (let i = 0; i < eligibleSquads.length; i++) {
    const squad = eligibleSquads[i];
    const points = squad[statsField]?.points || 0;
    const rankKey = getRankFromPoints(points);
    const rankInfo = STRICKER_RANKS[rankKey];
    const position = i + 1; // Overall position
    
    // Create or get cached trophy for this rank
    if (!trophyCache[rankKey]) {
      const trophy = new Trophy({
        name: `Saison ${endingSeason} Stricker ${format} - ${rankInfo.name}`,
        description: `Trophée de fin de saison ${endingSeason} du mode Stricker ${format} - Rang ${rankInfo.name}`,
        image: rankInfo.image,
        rarity: rankInfo.rarity,
        type: 'season',
        mode: 'stricker',
        category: `stricker_season_${format}`,
        isUnique: true,
        createdBy: adminUserId
      });
      await trophy.save();
      trophyCache[rankKey] = trophy;
    }
    
    const trophy = trophyCache[rankKey];
    
    // Assign trophy to squad
    squad.trophies.push({
      trophy: trophy._id,
      earnedAt: new Date(),
      reason: `${rankInfo.name} - Saison ${endingSeason} Stricker ${format} (${points} pts)`
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
        wins: squad[statsField].wins,
        losses: squad[statsField].losses,
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
      
    }
    
    await squad.save();
    
    results.trophiesDistributed++;
    results.trophiesByRank[rankKey]++;
    
  }
  
  // Reset all squad stricker stats for this format
  const resetResult = await Squad.updateMany(
    { [`${statsField}.points`]: { $gt: 0 } },
    {
      $set: {
        [`${statsField}.points`]: 0,
        [`${statsField}.wins`]: 0,
        [`${statsField}.losses`]: 0,
        [`${statsField}.rank`]: 'Recrues'
      }
    }
  );
  
  results.squadsReset = resetResult.modifiedCount;
  
  // Increment season number and update start date for this format
  const newSeasonNumber = endingSeason + 1;
  await AppSettings.findOneAndUpdate(
    {},
    {
      $set: {
        [`${seasonKey}.currentSeason`]: newSeasonNumber,
        [`${seasonKey}.seasonStartDate`]: new Date()
      }
    },
    { upsert: true }
  );
  
  
  return results;
};

/**
 * Get Stricker season info for admin display
 * @param {string} format - Format to get info for ('3v3' or '5v5'), defaults to '5v5'
 */
export const getStrickerSeasonInfo = async (format = '5v5') => {
  // 5v5 uses legacy 'statsStricker' for backward compatibility with existing data
  const statsField = format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
  const seasonKey = format === '3v3' ? 'strickerSettings3v3' : 'strickerSettings';
  
  const settings = await AppSettings.getSettings();
  const formatSettings = settings?.[seasonKey] || settings?.strickerSettings || {};
  
  const currentSeason = formatSettings.currentSeason || 1;
  const seasonDurationMonths = formatSettings.seasonDurationMonths || 2;
  const seasonStartDate = formatSettings.seasonStartDate || new Date();
  
  // Calculate season end date
  const seasonEndDate = new Date(seasonStartDate);
  seasonEndDate.setMonth(seasonEndDate.getMonth() + seasonDurationMonths);
  
  // Get top squads for this format
  const topSquads = await Squad.find({
    [`${statsField}.points`]: { $gt: 0 },
    isDeleted: { $ne: true }
  })
    .sort({ [`${statsField}.points`]: -1 })
    .limit(10)
    .select(`name tag logo ${statsField} members`)
    .populate('leader', 'username');
  
  // Get total active squads for this format
  const totalSquads = await Squad.countDocuments({
    [`${statsField}.points`]: { $gt: 0 },
    isDeleted: { $ne: true }
  });
  
  return {
    currentSeason,
    seasonDurationMonths,
    seasonStartDate,
    seasonEndDate,
    format,
    topSquads: topSquads.map((s, i) => ({
      position: i + 1,
      id: s._id,
      name: s.name,
      tag: s.tag,
      logo: s.logo,
      points: s[statsField]?.points || 0,
      wins: s[statsField]?.wins || 0,
      losses: s[statsField]?.losses || 0,
      rank: s[statsField]?.rank || 'Recrues',
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

