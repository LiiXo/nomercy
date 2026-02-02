import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import Trophy from '../models/Trophy.js';
import AppSettings from '../models/AppSettings.js';
import RankedMatch from '../models/RankedMatch.js';

// Reward gold for top 5 players
export const RANKED_REWARD_GOLD = {
  1: 100000, // First place
  2: 80000,  // Second place
  3: 60000,  // Third place
  4: 40000,  // Fourth place
  5: 20000   // Fifth place
};

// Divisions eligible for trophies (platinum and above)
export const ELIGIBLE_DIVISIONS = ['platinum', 'diamond', 'master', 'grandmaster', 'champion'];

// Default rank thresholds
const DEFAULT_RANK_THRESHOLDS = {
  bronze: { min: 0, max: 499 },
  silver: { min: 500, max: 999 },
  gold: { min: 1000, max: 1499 },
  platinum: { min: 1500, max: 1999 },
  diamond: { min: 2000, max: 2499 },
  master: { min: 2500, max: 2999 },
  grandmaster: { min: 3000, max: 3499 },
  champion: { min: 3500, max: 99999 }
};

// Division rarity mapping
const DIVISION_RARITY = {
  platinum: { level: 2, name: 'uncommon', color: 'teal', icon: 'Shield' },
  diamond: { level: 3, name: 'rare', color: 'cyan', icon: 'Gem' },
  master: { level: 4, name: 'epic', color: 'purple', icon: 'Medal' },
  grandmaster: { level: 4, name: 'epic', color: 'red', icon: 'Award' },
  champion: { level: 5, name: 'legendary', color: 'amber', icon: 'Crown' }
};

// Division name translations
const DIVISION_NAMES = {
  platinum: { fr: 'Platine', en: 'Platinum', de: 'Platin', it: 'Platino' },
  diamond: { fr: 'Diamant', en: 'Diamond', de: 'Diamant', it: 'Diamante' },
  master: { fr: 'Maître', en: 'Master', de: 'Meister', it: 'Maestro' },
  grandmaster: { fr: 'Grand Maître', en: 'Grandmaster', de: 'Großmeister', it: 'Gran Maestro' },
  champion: { fr: 'Champion', en: 'Champion', de: 'Champion', it: 'Campione' }
};

/**
 * Get division from points using thresholds
 */
const getDivisionFromPoints = (points, thresholds) => {
  const t = thresholds || DEFAULT_RANK_THRESHOLDS;
  if (points >= (t.champion?.min ?? 3500)) return 'champion';
  if (points >= (t.grandmaster?.min ?? 3000)) return 'grandmaster';
  if (points >= (t.master?.min ?? 2500)) return 'master';
  if (points >= (t.diamond?.min ?? 2000)) return 'diamond';
  if (points >= (t.platinum?.min ?? 1500)) return 'platinum';
  if (points >= (t.gold?.min ?? 1000)) return 'gold';
  if (points >= (t.silver?.min ?? 500)) return 'silver';
  return 'bronze';
};

/**
 * Calculate all player stats from match history for a specific season
 * Uses running total that never goes below 0
 */
const calculateSeasonStatsFromHistory = async (seasonNumber) => {
  const currentYear = new Date().getFullYear();
  const seasonMonth = seasonNumber;
  const seasonStartDate = new Date(Date.UTC(currentYear, seasonMonth - 1, 1, 9, 0, 0)); // 10:00 AM French time
  const seasonEndDate = new Date(Date.UTC(currentYear, seasonMonth, 1, 9, 0, 0));

  console.log(`[SEASON RESET] Calculating stats from ${seasonStartDate.toISOString()} to ${seasonEndDate.toISOString()}`);

  // Get all matches for the season, sorted chronologically
  const matches = await RankedMatch.find({
    status: 'completed',
    'result.winner': { $exists: true, $ne: null },
    completedAt: { $gte: seasonStartDate, $lt: seasonEndDate },
    isTestMatch: { $ne: true }
  })
  .sort({ completedAt: 1 })
  .select('players result completedAt')
  .lean();

  // Build player stats with proper running total
  const playerStatsMap = new Map();

  for (const match of matches) {
    const winningTeam = Number(match.result.winner);

    for (const player of match.players) {
      if (!player.user || player.isFake) continue;

      const odiserId = player.user.toString();
      const playerTeam = Number(player.team);
      const isWin = playerTeam === winningTeam;
      const pointsChange = player.rewards?.pointsChange || 0;

      if (!playerStatsMap.has(odiserId)) {
        playerStatsMap.set(odiserId, {
          odiserId,
          wins: 0,
          losses: 0,
          totalMatches: 0,
          runningPoints: 0
        });
      }

      const stats = playerStatsMap.get(odiserId);
      stats.totalMatches++;

      if (isWin) {
        stats.wins++;
      } else {
        stats.losses++;
      }

      // Running total that never goes below 0
      stats.runningPoints = Math.max(0, stats.runningPoints + pointsChange);
    }
  }

  // Convert to array and lookup user info
  const User = (await import('../models/User.js')).default;
  const playerStatsArray = [];

  for (const [odiserId, stats] of playerStatsMap) {
    const user = await User.findById(odiserId).select('username avatar isBanned isDeleted').lean();
    
    if (!user || user.isBanned || user.isDeleted) continue;

    playerStatsArray.push({
      _id: odiserId,
      wins: stats.wins,
      losses: stats.losses,
      totalMatches: stats.totalMatches,
      calculatedPoints: stats.runningPoints,
      userInfo: user
    });
  }

  // Sort by points DESC, wins DESC
  playerStatsArray.sort((a, b) => {
    if (b.calculatedPoints !== a.calculatedPoints) {
      return b.calculatedPoints - a.calculatedPoints;
    }
    return b.wins - a.wins;
  });

  return playerStatsArray;
};

/**
 * Generate trophy data for a ranked season
 */
const generateRankedSeasonTrophyData = (seasonNumber, division) => {
  const rarity = DIVISION_RARITY[division];
  const divisionName = DIVISION_NAMES[division];

  const translations = {
    fr: {
      name: `${divisionName.fr} - Saison ${seasonNumber}`,
      description: `Trophée attribué aux joueurs ayant atteint le rang ${divisionName.fr} lors de la saison ${seasonNumber} du mode classé.`
    },
    en: {
      name: `${divisionName.en} - Season ${seasonNumber}`,
      description: `Trophy awarded to players who reached ${divisionName.en} rank during ranked mode season ${seasonNumber}.`
    },
    de: {
      name: `${divisionName.de} - Saison ${seasonNumber}`,
      description: `Trophäe für Spieler, die in der Ranglisten-Saison ${seasonNumber} den ${divisionName.de}-Rang erreicht haben.`
    },
    it: {
      name: `${divisionName.it} - Stagione ${seasonNumber}`,
      description: `Trofeo assegnato ai giocatori che hanno raggiunto il rango ${divisionName.it} durante la stagione ${seasonNumber} della modalità classificata.`
    }
  };

  return {
    name: translations.en.name,
    description: translations.en.description,
    translations,
    icon: rarity.icon,
    color: rarity.color,
    rarity: rarity.level,
    rarityName: rarity.name,
    isDefault: false,
    isActive: true
  };
};

/**
 * Get the current season number from AppSettings
 */
const getCurrentRankedSeasonNumber = async () => {
  const settings = await AppSettings.getSettings();
  return settings?.rankedSettings?.currentSeason || 1;
};

/**
 * Create a trophy for a specific user (for testing purposes)
 */
export const createAndAssignTrophyToUser = async (userId, division, seasonNumber = null) => {
  // Get season number
  const season = seasonNumber || await getCurrentRankedSeasonNumber();

  // Validate division
  if (!ELIGIBLE_DIVISIONS.includes(division.toLowerCase())) {
    throw new Error(`Invalid division. Must be one of: ${ELIGIBLE_DIVISIONS.join(', ')}`);
  }

  const divisionLower = division.toLowerCase();

  // Generate trophy data
  const trophyData = generateRankedSeasonTrophyData(season, divisionLower);
  
  // Check if trophy already exists
  let trophy = await Trophy.findOne({ name: trophyData.name });
  
  if (!trophy) {
    trophy = new Trophy(trophyData);
    await trophy.save();
  }

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user already has this trophy
  const hasTrophy = user.trophies?.some(t => t.trophy?.toString() === trophy._id.toString());
  if (hasTrophy) {
    return { user, trophy, alreadyHad: true };
  }

  // Add trophy to user
  if (!user.trophies) {
    user.trophies = [];
  }
  user.trophies.push({
    trophy: trophy._id,
    earnedAt: new Date(),
    season: season,
    reason: `${DIVISION_NAMES[divisionLower].fr} - Saison ${season} Mode Classé`
  });

  await user.save();

  return { user, trophy, alreadyHad: false };
};

/**
 * Reset ranked season - distribute rewards based on match history
 * @param {string} adminId - Admin user ID (optional)
 * @param {number} seasonNumber - Season number to reset (the ending season)
 */
export const resetRankedSeason = async (adminId = null, seasonNumber = null) => {
  // Get the season that is ending
  // If not provided, use current month (when called on 1st of new month, pass the previous month)
  const endingSeason = seasonNumber || new Date().getMonth() + 1;
  
  console.log(`[SEASON RESET] Starting reset for season ${endingSeason}`);

  // Get rank thresholds from AppSettings
  const settings = await AppSettings.getSettings();
  const rankThresholds = settings?.rankedSettings?.rankPointsThresholds || DEFAULT_RANK_THRESHOLDS;

  // Calculate stats from match history for the ending season
  const playerStats = await calculateSeasonStatsFromHistory(endingSeason);
  
  console.log(`[SEASON RESET] Found ${playerStats.length} active players`);

  const results = {
    seasonNumber: endingSeason,
    totalPlayers: playerStats.length,
    trophiesDistributed: 0,
    goldDistributed: 0,
    top5: [],
    divisionCounts: {}
  };

  // Create trophies for each eligible division
  const trophyCache = {};
  for (const division of ELIGIBLE_DIVISIONS) {
    const trophyData = generateRankedSeasonTrophyData(endingSeason, division);
    
    // Check if trophy already exists
    let trophy = await Trophy.findOne({ name: trophyData.name });
    if (!trophy) {
      trophy = new Trophy(trophyData);
      await trophy.save();
      console.log(`[SEASON RESET] Created trophy: ${trophyData.name}`);
    }
    trophyCache[division] = trophy;
    results.divisionCounts[division] = 0;
  }

  // Process each player based on calculated stats from match history
  for (let i = 0; i < playerStats.length; i++) {
    const playerStat = playerStats[i];
    const position = i + 1;
    const user = await User.findById(playerStat._id);
    
    if (!user || user.isBanned) continue;

    const points = playerStat.calculatedPoints;
    const division = getDivisionFromPoints(points, rankThresholds);

    // Check if player is eligible for trophy (platinum+)
    if (ELIGIBLE_DIVISIONS.includes(division)) {
      const trophy = trophyCache[division];
      
      // Check if user already has this trophy
      const hasTrophy = user.trophies?.some(t => t.trophy?.toString() === trophy._id.toString());
      
      if (!hasTrophy) {
        if (!user.trophies) {
          user.trophies = [];
        }
        user.trophies.push({
          trophy: trophy._id,
          earnedAt: new Date(),
          season: endingSeason,
          reason: `${DIVISION_NAMES[division].fr} - Saison ${endingSeason} Mode Classé`
        });
        results.trophiesDistributed++;
        results.divisionCounts[division]++;
        console.log(`[SEASON RESET] Trophy ${division} given to ${user.username}`);
      }
    }

    // Top 5 gold rewards
    if (position <= 5) {
      const goldReward = RANKED_REWARD_GOLD[position];
      user.goldCoins = (user.goldCoins || 0) + goldReward;
      results.goldDistributed += goldReward;
      results.top5.push({
        position,
        username: user.username,
        points: points,
        wins: playerStat.wins,
        losses: playerStat.losses,
        division: division,
        goldReward
      });
      console.log(`[SEASON RESET] Top ${position}: ${user.username} - ${goldReward} gold`);
    }

    await user.save();
  }

  // Optional: Clear old Ranking model data (not used for display anymore, but good for cleanup)
  await Ranking.updateMany(
    {},
    {
      $set: {
        points: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        currentStreak: 0,
        bestStreak: 0,
        division: 'bronze',
        rank: 0
      }
    }
  );

  // Increment the season number in AppSettings for the new season
  const newSeasonNumber = endingSeason + 1;
  await AppSettings.findOneAndUpdate(
    {},
    { $set: { 'rankedSettings.currentSeason': newSeasonNumber } },
    { upsert: true }
  );
  console.log(`[SEASON RESET] Season number incremented to ${newSeasonNumber}`);

  console.log(`[SEASON RESET] Complete! Trophies: ${results.trophiesDistributed}, Gold: ${results.goldDistributed}`);
  return results;
};

/**
 * Schedule automatic season reset on 1st of each month at 10:00 AM French time
 * Call this function once when the server starts
 */
export const scheduleAutomaticSeasonReset = () => {
  const checkAndReset = async () => {
    const now = new Date();
    const frenchTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    
    // Check if it's the 1st of the month and 10:00 AM
    if (frenchTime.getDate() === 1 && frenchTime.getHours() === 10 && frenchTime.getMinutes() === 0) {
      // Get the previous month (the season that just ended)
      const previousMonth = frenchTime.getMonth(); // 0-11, so Feb=1, but we want season 2
      const endingSeason = previousMonth === 0 ? 12 : previousMonth; // January edge case
      
      console.log(`[AUTO RESET] Triggering automatic season reset for season ${endingSeason}`);
      
      try {
        const results = await resetRankedSeason(null, endingSeason);
        console.log(`[AUTO RESET] Season ${endingSeason} reset complete:`, results);
      } catch (error) {
        console.error(`[AUTO RESET] Error resetting season:`, error);
      }
    }
  };

  // Check every minute
  setInterval(checkAndReset, 60 * 1000);
  console.log('[AUTO RESET] Automatic season reset scheduler started');
};

export default {
  resetRankedSeason,
  createAndAssignTrophyToUser,
  scheduleAutomaticSeasonReset,
  RANKED_REWARD_GOLD,
  ELIGIBLE_DIVISIONS
};
