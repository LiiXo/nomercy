import Squad from '../models/Squad.js';
import Trophy from '../models/Trophy.js';
import LadderSeasonHistory from '../models/LadderSeasonHistory.js';

// Reward points for top 3 squads
export const REWARD_POINTS = {
  1: 150, // First place
  2: 100, // Second place
  3: 75   // Third place
};

// Generate multilingual season trophy name and description
const generateSeasonTrophyData = (seasonNumber, ladderId, rank, month, year) => {
  const ladderNames = {
    'duo-trio': {
      fr: 'Chill',
      en: 'Chill',
      de: 'Chill',
      it: 'Chill'
    },
    'squad-team': {
      fr: 'Compétitif',
      en: 'Competitive',
      de: 'Kompetitiv',
      it: 'Competitivo'
    }
  };

  const rankNames = {
    1: { fr: 'Champion', en: 'Champion', de: 'Champion', it: 'Campione' },
    2: { fr: 'Vice-Champion', en: 'Runner-up', de: 'Vizemeister', it: 'Vice-Campione' },
    3: { fr: 'Troisième', en: 'Third Place', de: 'Dritter Platz', it: 'Terzo Posto' }
  };

  const monthNames = {
    fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
  };

  const colors = {
    1: 'amber',   // Gold for first
    2: 'gray',    // Silver for second
    3: 'orange'   // Bronze for third
  };

  const icons = {
    1: 'Crown',
    2: 'Medal',
    3: 'Award'
  };

  const rarities = {
    1: { level: 5, name: 'legendary' },
    2: { level: 4, name: 'epic' },
    3: { level: 3, name: 'rare' }
  };

  // Create trophy name and description in all languages
  const translations = {};
  ['fr', 'en', 'de', 'it'].forEach(lang => {
    const monthName = monthNames[lang][month - 1];
    const ladderName = ladderNames[ladderId][lang];
    const rankName = rankNames[rank][lang];

    if (lang === 'fr') {
      translations[lang] = {
        name: `${rankName} ${ladderName} - ${monthName} ${year}`,
        description: `Trophée de saison attribué au ${rank === 1 ? 'champion' : rank === 2 ? 'vice-champion' : 'troisième'} du ladder ${ladderName} pour le mois de ${monthName} ${year}.`
      };
    } else if (lang === 'en') {
      translations[lang] = {
        name: `${ladderName} ${rankName} - ${monthName} ${year}`,
        description: `Season trophy awarded to the ${rank === 1 ? 'champion' : rank === 2 ? 'runner-up' : 'third place'} of ${ladderName} ladder for ${monthName} ${year}.`
      };
    } else if (lang === 'de') {
      translations[lang] = {
        name: `${ladderName} ${rankName} - ${monthName} ${year}`,
        description: `Saison-Trophäe für den ${rank === 1 ? 'Champion' : rank === 2 ? 'Vizemeister' : 'dritten Platz'} der ${ladderName}-Rangliste für ${monthName} ${year}.`
      };
    } else if (lang === 'it') {
      translations[lang] = {
        name: `${rankName} ${ladderName} - ${monthName} ${year}`,
        description: `Trofeo di stagione assegnato al ${rank === 1 ? 'campione' : rank === 2 ? 'vice-campione' : 'terzo classificato'} della ladder ${ladderName} per ${monthName} ${year}.`
      };
    }
  });

  return {
    name: translations.en.name, // Default name in English
    description: translations.en.description, // Default description in English
    translations,
    icon: icons[rank],
    color: colors[rank],
    rarity: rarities[rank].level,
    rarityName: rarities[rank].name,
    isDefault: false,
    isActive: true
  };
};

/**
 * Reset a specific ladder and award top 3 squads
 * @param {string} ladderId - 'duo-trio' or 'squad-team'
 * @param {ObjectId} adminId - ID of admin triggering the reset (null for automatic)
 * @returns {Object} - Result with season history and rewards given
 */
export const resetLadderSeason = async (ladderId, adminId = null) => {
  const ladderNames = {
    'duo-trio': 'Chill',
    'squad-team': 'Compétitif'
  };

  if (!ladderNames[ladderId]) {
    throw new Error('Invalid ladder ID');
  }

  // Get current date for season naming
  const now = new Date();
  // Season is for the PREVIOUS month (since we reset on the 1st)
  const seasonDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = seasonDate.getMonth() + 1; // 1-12
  const year = seasonDate.getFullYear();

  // Get the current season number
  const seasonNumber = await LadderSeasonHistory.getCurrentSeasonNumber(ladderId);
  
  // Generate season name
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const seasonName = `Season ${seasonNumber} - ${monthNames[month - 1]} ${year}`;

  // Get top 3 squads for this ladder
  const topSquads = await Squad.find({
    'registeredLadders.ladderId': ladderId,
    isDeleted: { $ne: true }
  })
    .populate('leader', 'isBanned isDeleted')
    .select('name tag color logo registeredLadders stats experience')
    .lean();

  // Filter valid squads and sort by points
  const validSquads = topSquads
    .filter(s => s.leader && !s.leader.isBanned && !s.leader.isDeleted)
    .map(squad => {
      const ladderData = squad.registeredLadders.find(l => l.ladderId === ladderId);
      return {
        ...squad,
        ladderPoints: ladderData?.points || 0,
        ladderWins: ladderData?.wins || 0,
        ladderLosses: ladderData?.losses || 0
      };
    })
    .sort((a, b) => b.ladderPoints - a.ladderPoints)
    .slice(0, 3);

  // Create trophies and assign rewards
  const winners = [];
  const rewardsGiven = [];

  for (let i = 0; i < validSquads.length; i++) {
    const squad = validSquads[i];
    const rank = i + 1;
    const rewardPoints = REWARD_POINTS[rank];

    // Generate and create season trophy
    const trophyData = generateSeasonTrophyData(seasonNumber, ladderId, rank, month, year);
    const trophy = new Trophy(trophyData);
    await trophy.save();

    // Update squad: add trophy and reward points (to stats.totalPoints for Top 10 Escouade)
    await Squad.findByIdAndUpdate(squad._id, {
      $push: {
        trophies: {
          trophy: trophy._id,
          earnedAt: new Date(),
          reason: `${rank === 1 ? 'Champion' : rank === 2 ? 'Vice-Champion' : 'Troisième'} du ladder ${ladderNames[ladderId]} - ${seasonName}`
        }
      },
      $inc: {
        'stats.totalPoints': rewardPoints
      }
    });

    winners.push({
      rank,
      squad: squad._id,
      squadName: squad.name,
      squadTag: squad.tag,
      squadColor: squad.color,
      squadLogo: squad.logo,
      points: squad.ladderPoints,
      wins: squad.ladderWins,
      losses: squad.ladderLosses,
      rewardPoints,
      trophy: trophy._id
    });

    rewardsGiven.push({
      squadId: squad._id,
      squadName: squad.name,
      rank,
      points: rewardPoints,
      trophy: trophy.name
    });
  }

  // Create season history record
  const seasonHistory = new LadderSeasonHistory({
    seasonNumber,
    seasonName,
    month,
    year,
    ladderId,
    ladderName: ladderNames[ladderId],
    winners,
    resetAt: new Date(),
    resetBy: adminId
  });
  await seasonHistory.save();

  // Reset all squads' ladder stats for this ladder
  await Squad.updateMany(
    { 'registeredLadders.ladderId': ladderId },
    {
      $set: {
        'registeredLadders.$[elem].points': 0,
        'registeredLadders.$[elem].wins': 0,
        'registeredLadders.$[elem].losses': 0
      }
    },
    {
      arrayFilters: [{ 'elem.ladderId': ladderId }]
    }
  );

  return {
    success: true,
    seasonNumber,
    seasonName,
    ladderId,
    ladderName: ladderNames[ladderId],
    month,
    year,
    winners: rewardsGiven,
    totalSquadsReset: topSquads.length
  };
};

/**
 * Reset both ladders (duo-trio and squad-team)
 * @param {ObjectId} adminId - ID of admin triggering the reset (null for automatic)
 * @returns {Object} - Results for both ladders
 */
export const resetAllLadderSeasons = async (adminId = null) => {
  const duoTrioResult = await resetLadderSeason('duo-trio', adminId);
  const squadTeamResult = await resetLadderSeason('squad-team', adminId);

  return {
    success: true,
    duoTrio: duoTrioResult,
    squadTeam: squadTeamResult
  };
};

/**
 * Get the previous season history for display on rankings page
 * @returns {Object} - Previous season winners for both ladders
 */
export const getPreviousSeasonWinners = async () => {
  const duoTrioHistory = await LadderSeasonHistory.getLatest('duo-trio');
  const squadTeamHistory = await LadderSeasonHistory.getLatest('squad-team');

  return {
    duoTrio: duoTrioHistory,
    squadTeam: squadTeamHistory
  };
};

export default {
  resetLadderSeason,
  resetAllLadderSeasons,
  getPreviousSeasonWinners,
  REWARD_POINTS
};

