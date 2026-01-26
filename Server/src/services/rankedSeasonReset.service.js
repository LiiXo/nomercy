import Ranking from '../models/Ranking.js';
import User from '../models/User.js';
import Trophy from '../models/Trophy.js';
import AppSettings from '../models/AppSettings.js';

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
 * Reset ranked season - distribute rewards and reset rankings
 * @param {string} adminId - Admin user ID (optional)
 * @param {number} seasonNumber - Season number to use (optional, uses config if not provided)
 */
export const resetRankedSeason = async (adminId = null, seasonNumber = null) => {
  // Get current season number from config if not provided
  const currentSeason = seasonNumber || await getCurrentRankedSeasonNumber();

  // Get all rankings sorted by points (descending)
  const allRankings = await Ranking.find({})
    .populate('user', 'username avatar discordId goldCoins trophies')
    .sort({ points: -1 });

  // Filter only active players (who have played at least 1 game)
  const activeRankings = allRankings.filter(r => r.user && !r.user.isBanned && (r.wins > 0 || r.losses > 0));

  const results = {
    seasonNumber: currentSeason,
    totalPlayersReset: allRankings.length,
    trophiesDistributed: 0,
    goldDistributed: 0,
    top5: [],
    divisionCounts: {}
  };

  // Create trophies for each eligible division
  const trophyCache = {};
  for (const division of ELIGIBLE_DIVISIONS) {
    const trophyData = generateRankedSeasonTrophyData(currentSeason, division);
    
    // Check if trophy already exists
    let trophy = await Trophy.findOne({ name: trophyData.name });
    if (!trophy) {
      trophy = new Trophy(trophyData);
      await trophy.save();
    }
    trophyCache[division] = trophy;
    results.divisionCounts[division] = 0;
  }

  // Process each player
  for (let i = 0; i < activeRankings.length; i++) {
    const ranking = activeRankings[i];
    const position = i + 1;
    const user = await User.findById(ranking.user._id);
    
    if (!user || user.isBanned) continue;

    // Check if player is eligible for trophy (platinum+)
    const division = ranking.division;
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
          season: currentSeason,
          reason: `${DIVISION_NAMES[division].fr} - Saison ${currentSeason} Mode Classé`
        });
        results.trophiesDistributed++;
        results.divisionCounts[division]++;
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
        points: ranking.points,
        division: ranking.division,
        goldReward
      });
    }

    await user.save();
  }

  // Reset all rankings
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

  return results;
};

export default {
  resetRankedSeason,
  createAndAssignTrophyToUser,
  RANKED_REWARD_GOLD,
  ELIGIBLE_DIVISIONS
};
