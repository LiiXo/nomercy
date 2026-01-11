import Config from '../models/Config.js';

let cachedConfig = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Default values for ranked match rewards
const DEFAULT_RANKED_REWARDS = {
  hardcore: {
    'Duel': { pointsWin: 20, pointsLoss: -10, coinsWin: 50, coinsLoss: 10, xpWinMin: 700, xpWinMax: 800 },
    'Team Deathmatch': { pointsWin: 25, pointsLoss: -12, coinsWin: 60, coinsLoss: 12, xpWinMin: 700, xpWinMax: 800 },
    'Domination': { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 16, xpWinMin: 700, xpWinMax: 800 },
    'Search & Destroy': { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 16, xpWinMin: 700, xpWinMax: 800 }
  },
  cdl: {
    'Duel': { pointsWin: 25, pointsLoss: -12, coinsWin: 60, coinsLoss: 12, xpWinMin: 700, xpWinMax: 800 },
    'Team Deathmatch': { pointsWin: 30, pointsLoss: -15, coinsWin: 75, coinsLoss: 15, xpWinMin: 700, xpWinMax: 800 },
    'Domination': { pointsWin: 40, pointsLoss: -20, coinsWin: 90, coinsLoss: 18, xpWinMin: 700, xpWinMax: 800 },
    'Search & Destroy': { pointsWin: 40, pointsLoss: -20, coinsWin: 90, coinsLoss: 18, xpWinMin: 700, xpWinMax: 800 }
  }
};

// Get rewards configuration with caching
export const getRewardsConfig = async () => {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedConfig;
  }
  
  // Load config from database (lean returns plain JS object)
  const config = await Config.getOrCreate();
  cachedConfig = config;
  cacheTimestamp = now;
  
  return config;
};

// Clear cache (call this after updating config)
export const clearConfigCache = () => {
  cachedConfig = null;
  cacheTimestamp = null;
};

// Get squad match rewards based on ladder type
export const getSquadMatchRewards = async (ladderId = 'duo-trio') => {
  const config = await getRewardsConfig();
  
  // Default values for chill (duo-trio)
  const defaultChill = {
    ladderPointsWin: 15,
    ladderPointsLoss: 8,
    generalSquadPointsWin: 10,
    generalSquadPointsLoss: 5,
    playerPointsWin: 15,
    playerPointsLoss: 8,
    playerCoinsWin: 40,
    playerCoinsLoss: 20,
    playerXPWinMin: 350,
    playerXPWinMax: 450
  };
  
  // Default values for competitive (squad-team)
  const defaultCompetitive = {
    ladderPointsWin: 25,
    ladderPointsLoss: 12,
    generalSquadPointsWin: 20,
    generalSquadPointsLoss: 10,
    playerPointsWin: 25,
    playerPointsLoss: 12,
    playerCoinsWin: 60,
    playerCoinsLoss: 30,
    playerXPWinMin: 550,
    playerXPWinMax: 650
  };
  
  // Determine which rewards to use based on ladderId
  if (ladderId === 'squad-team') {
    return config.squadMatchRewardsCompetitive || defaultCompetitive;
  } else {
    // Default to chill for duo-trio or any other value
    return config.squadMatchRewardsChill || defaultChill;
  }
};

// Get ranked match rewards
export const getRankedMatchRewards = async (gameMode, mode = 'hardcore') => {
  const config = await getRewardsConfig();
  
  // Get mode rewards (hardcore or cdl)
  const modeRewards = config.rankedMatchRewards?.[mode];
  
  // Debug log - show full config structure
  console.log(`[CONFIG] Full rankedMatchRewards:`, JSON.stringify(config.rankedMatchRewards, null, 2));
  console.log(`[CONFIG] Looking for mode: "${mode}", gameMode: "${gameMode}"`);
  console.log(`[CONFIG] Available modes in config:`, Object.keys(config.rankedMatchRewards || {}));
  console.log(`[CONFIG] Available gameModes for ${mode}:`, modeRewards ? Object.keys(modeRewards) : 'none');
  console.log(`[CONFIG] Found rewards:`, modeRewards?.[gameMode]);
  
  // Check if we have valid rewards for this game mode
  if (modeRewards && modeRewards[gameMode]) {
    const rewards = modeRewards[gameMode];
    const finalRewards = {
      pointsWin: typeof rewards.pointsWin === 'number' ? rewards.pointsWin : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.pointsWin ?? 20),
      pointsLoss: typeof rewards.pointsLoss === 'number' ? rewards.pointsLoss : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.pointsLoss ?? -10),
      coinsWin: typeof rewards.coinsWin === 'number' ? rewards.coinsWin : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.coinsWin ?? 50),
      coinsLoss: typeof rewards.coinsLoss === 'number' ? rewards.coinsLoss : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.coinsLoss ?? 10),
      xpWinMin: typeof rewards.xpWinMin === 'number' ? rewards.xpWinMin : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.xpWinMin ?? 700),
      xpWinMax: typeof rewards.xpWinMax === 'number' ? rewards.xpWinMax : (DEFAULT_RANKED_REWARDS[mode]?.[gameMode]?.xpWinMax ?? 800)
    };
    console.log(`[CONFIG] Final rewards for ${mode}/${gameMode}:`, finalRewards);
    return finalRewards;
  }
  
  // Fallback to defaults
  console.log(`[CONFIG] Using fallback defaults for ${mode}/${gameMode}`);
  return DEFAULT_RANKED_REWARDS[mode]?.[gameMode] || DEFAULT_RANKED_REWARDS.hardcore['Duel'];
};



