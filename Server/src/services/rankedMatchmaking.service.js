/**
 * Ranked Matchmaking Service
 * 
 * Gère les files d'attente pour le mode classé:
 * - Search & Destroy: File unique, format déterminé par le nombre de joueurs
 *   - 8 joueurs → 2 min délai → 4v4
 *   - 10 joueurs → match immédiat → 5v5
 * - Si nombre impair quand le timer expire, le dernier arrivé est éjecté
 */

import RankedMatch from '../models/RankedMatch.js';
import User from '../models/User.js';
import Ranking from '../models/Ranking.js';
import AppSettings from '../models/AppSettings.js';
import GameMap from '../models/Map.js';
import { createMatchVoiceChannels } from './discordBot.service.js';
import { checkRankedMatchGGSecureStatus } from './ggsecureMonitoring.service.js';

// Files d'attente par mode de jeu et mode (hardcore/cdl) - UNE SEULE FILE PAR MODE
// Structure: { 'Search & Destroy_hardcore': [{ userId, username, rank, points, platform, joinedAt }] }
const queues = {};

// Configuration des seuils de joueurs pour le mode classé (format dynamique)
// Le format est déterminé par le nombre de joueurs dans la file
// CDL: uniquement 4v4 (8 joueurs)
// Hardcore: 4v4 ou 5v5 (8-10 joueurs)
const PLAYER_THRESHOLDS_HARDCORE = [
  { players: 8, format: '4v4', teamSize: 4 },
  { players: 10, format: '5v5', teamSize: 5 }
];

// CDL: uniquement format 4v4
const PLAYER_THRESHOLDS_CDL = [
  { players: 8, format: '4v4', teamSize: 4 }
];

/**
 * Obtient les seuils de joueurs selon le mode
 */
const getPlayerThresholds = (mode) => {
  return mode === 'cdl' ? PLAYER_THRESHOLDS_CDL : PLAYER_THRESHOLDS_HARDCORE;
};

// Timer de 120 secondes (2 minutes) pour lancer le match
const MATCHMAKING_TIMER_SECONDS = 120;

// Timeout de 15 minutes (900 secondes) - joueurs retirés de la file s'ils n'ont pas trouvé de match
const QUEUE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// Timers actifs pour chaque file d'attente
const queueTimers = {};

// Socket.io instance (set from index.js)
let io = null;

// Historique des équipes récentes pour éviter les répétitions
// Structure: Map<mode_gameMode, Array<{ team1: Set<userId>, team2: Set<userId>, timestamp }>>
const recentTeamHistory = new Map();
const TEAM_HISTORY_SIZE = 10; // Nombre de matchs à garder en historique
const TEAM_HISTORY_DURATION_MS = 30 * 60 * 1000; // 30 minutes d'historique

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Initialise le service avec Socket.io
 */
export const initMatchmaking = (socketIo) => {
  io = socketIo;
  console.log('[Ranked Matchmaking] Service initialized');
  
  // Start the queue cleanup interval (runs every 30 seconds)
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanupTimedOutPlayers, 30000);
  console.log('[Ranked Matchmaking] Queue timeout cleanup started (15 min timeout, 30s interval)');
};

/**
 * Nettoie les joueurs qui ont dépassé le timeout de 15 minutes dans la file
 */
const cleanupTimedOutPlayers = () => {
  const now = Date.now();
  
  for (const key in queues) {
    const queue = queues[key];
    const timedOutPlayers = [];
    
    // Find players who have been in queue for more than 15 minutes
    for (let i = queue.length - 1; i >= 0; i--) {
      const player = queue[i];
      const timeInQueue = now - new Date(player.joinedAt).getTime();
      
      if (timeInQueue >= QUEUE_TIMEOUT_MS) {
        timedOutPlayers.push(player);
        queue.splice(i, 1);
        console.log(`[Ranked Matchmaking] Player ${player.username} timed out from queue (${Math.round(timeInQueue / 1000)}s)`);
      }
    }
    
    // Notify timed out players
    for (const player of timedOutPlayers) {
      if (io) {
        io.to(`user-${player.userId}`).emit('rankedQueueUpdate', {
          type: 'timeout',
          message: 'Vous avez été retiré de la file d\'attente après 15 minutes sans match trouvé.',
          queueSize: 0,
          position: null
        });
      }
    }
    
    // If players were removed, update remaining players
    if (timedOutPlayers.length > 0 && queue.length > 0) {
      const [gameMode, mode] = key.split('_');
      broadcastQueueUpdate(gameMode, mode);
      
      // Cancel timer if we dropped below minimum players
      if (queue.length < 4) {
        cancelMatchmakingTimer(gameMode, mode);
      }
    }
  }
};

/**
 * Obtient la clé unique pour une file d'attente (sans format - file unique)
 */
const getQueueKey = (gameMode, mode) => `${gameMode}_${mode}`;

/**
 * Obtient la file d'attente pour un mode
 */
const getQueue = (gameMode, mode) => {
  const key = getQueueKey(gameMode, mode);
  if (!queues[key]) {
    queues[key] = [];
  }
  return queues[key];
};

/**
 * Détermine le format optimal basé sur le nombre de joueurs et le mode
 */
const getOptimalFormat = (playerCount, mode = 'hardcore') => {
  const thresholds = getPlayerThresholds(mode);
  // Trouver le plus grand format possible avec le nombre de joueurs
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (playerCount >= thresholds[i].players) {
      return thresholds[i];
    }
  }
  return null; // Pas assez de joueurs
};

/**
 * Détermine le prochain seuil de joueurs selon le mode
 */
const getNextThreshold = (currentCount, mode = 'hardcore') => {
  const thresholds = getPlayerThresholds(mode);
  for (const threshold of thresholds) {
    if (currentCount < threshold.players) {
      return threshold;
    }
  }
  return thresholds[thresholds.length - 1]; // Max atteint
};

/**
 * Algorithme de mélange Fisher-Yates (vrai mélange aléatoire uniforme)
 */
const fisherYatesShuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Nettoie l'historique des équipes anciennes
 */
const cleanupTeamHistory = (gameMode, mode) => {
  const key = `${mode}_${gameMode}`;
  const history = recentTeamHistory.get(key);
  if (!history) return;
  
  const now = Date.now();
  const filtered = history.filter(h => now - h.timestamp < TEAM_HISTORY_DURATION_MS);
  
  // Garder seulement les derniers matchs
  if (filtered.length > TEAM_HISTORY_SIZE) {
    filtered.splice(0, filtered.length - TEAM_HISTORY_SIZE);
  }
  
  recentTeamHistory.set(key, filtered);
};

/**
 * Ajoute une composition d'équipe à l'historique
 */
const addTeamToHistory = (gameMode, mode, team1PlayerIds, team2PlayerIds) => {
  const key = `${mode}_${gameMode}`;
  let history = recentTeamHistory.get(key);
  if (!history) {
    history = [];
    recentTeamHistory.set(key, history);
  }
  
  history.push({
    team1: new Set(team1PlayerIds),
    team2: new Set(team2PlayerIds),
    timestamp: Date.now()
  });
  
  // Nettoyer l'historique
  cleanupTeamHistory(gameMode, mode);
};

/**
 * Calcule un score de similarité entre deux compositions d'équipes
 * Plus le score est élevé, plus les équipes sont similaires à des équipes passées
 */
const calculateTeamSimilarityScore = (gameMode, mode, team1PlayerIds, team2PlayerIds) => {
  const key = `${mode}_${gameMode}`;
  const history = recentTeamHistory.get(key);
  if (!history || history.length === 0) return 0;
  
  const now = Date.now();
  let totalScore = 0;
  
  for (const past of history) {
    // Plus le match est récent, plus le poids est élevé
    const ageMs = now - past.timestamp;
    const recencyWeight = Math.max(0, 1 - (ageMs / TEAM_HISTORY_DURATION_MS));
    
    // Compter combien de joueurs sont dans la même équipe qu'avant
    let sameTeamCount = 0;
    
    // Pour team1 actuelle, compter ceux qui étaient déjà ensemble dans le passé
    for (const playerId of team1PlayerIds) {
      if (past.team1.has(playerId)) {
        // Ce joueur était dans l'équipe 1 avant
        for (const otherId of team1PlayerIds) {
          if (otherId !== playerId && past.team1.has(otherId)) {
            sameTeamCount++;
          }
        }
      } else if (past.team2.has(playerId)) {
        // Ce joueur était dans l'équipe 2 avant
        for (const otherId of team1PlayerIds) {
          if (otherId !== playerId && past.team2.has(otherId)) {
            sameTeamCount++;
          }
        }
      }
    }
    
    // Pour team2 actuelle, compter ceux qui étaient déjà ensemble dans le passé
    for (const playerId of team2PlayerIds) {
      if (past.team1.has(playerId)) {
        for (const otherId of team2PlayerIds) {
          if (otherId !== playerId && past.team1.has(otherId)) {
            sameTeamCount++;
          }
        }
      } else if (past.team2.has(playerId)) {
        for (const otherId of team2PlayerIds) {
          if (otherId !== playerId && past.team2.has(otherId)) {
            sameTeamCount++;
          }
        }
      }
    }
    
    totalScore += sameTeamCount * recencyWeight;
  }
  
  return totalScore;
};

/**
 * Calcule la différence de points totaux entre deux équipes
 */
const calculateTeamPointsDifference = (team1, team2) => {
  const team1Points = team1.reduce((sum, p) => sum + (p.points || 0), 0);
  const team2Points = team2.reduce((sum, p) => sum + (p.points || 0), 0);
  return Math.abs(team1Points - team2Points);
};

/**
 * Génère des équipes de manière totalement aléatoire
 * Mélange les joueurs avec Fisher-Yates puis divise en deux équipes
 */
const generateBalancedTeams = (players, teamSize) => {
  // Mélanger les joueurs de manière aléatoire avec Fisher-Yates
  const shuffledPlayers = fisherYatesShuffle([...players]);
  
  const team1 = [];
  const team2 = [];
  
  // Répartition simple: premiers joueurs en team1, reste en team2
  for (let i = 0; i < shuffledPlayers.length; i++) {
    if (team1.length < teamSize) {
      team1.push(shuffledPlayers[i]);
    } else {
      team2.push(shuffledPlayers[i]);
    }
  }
  
  return { team1, team2 };
};

/**
 * Génère des équipes de manière totalement aléatoire
 * Plus d'équilibrage par rang - distribution purement aléatoire
 */
const generateDiverseTeams = (players, teamSize, gameMode, mode) => {
  // Mélanger les joueurs de manière aléatoire
  const shuffledPlayers = fisherYatesShuffle([...players]);
  
  const team1 = shuffledPlayers.slice(0, teamSize);
  const team2 = shuffledPlayers.slice(teamSize, teamSize * 2);
  
  const team1TotalPoints = team1.reduce((sum, p) => sum + (p.points || 0), 0);
  const team2TotalPoints = team2.reduce((sum, p) => sum + (p.points || 0), 0);
  
  console.log(`[Ranked Matchmaking] Random teams: Team1=${team1TotalPoints}pts, Team2=${team2TotalPoints}pts (no balancing)`);
  
  return { team1, team2 };
};

/**
 * Calcule le rang à partir des points (utilise les seuils dynamiques de AppSettings)
 * @param {number} points - Les points du joueur
 * @param {object|null} thresholds - Les seuils de rang (optionnel, sera chargé depuis AppSettings si null)
 */
const getRankFromPoints = async (points, thresholds = null) => {
  // Si les seuils ne sont pas fournis, les charger depuis AppSettings
  if (!thresholds) {
    try {
      const settings = await AppSettings.getSettings();
      thresholds = settings.rankedSettings?.rankPointsThresholds || {};
    } catch (error) {
      console.error('[Ranked Matchmaking] Error loading rank thresholds:', error);
      thresholds = {};
    }
  }
  
  // Seuils par défaut (fallback)
  const defaultThresholds = {
    champion: { min: 3500 },
    grandmaster: { min: 3000 },
    master: { min: 2500 },
    diamond: { min: 2000 },
    platinum: { min: 1500 },
    gold: { min: 1000 },
    silver: { min: 500 },
    bronze: { min: 0 }
  };
  
  // Vérifier chaque rang du plus haut au plus bas
  if (points >= (thresholds.champion?.min ?? defaultThresholds.champion.min)) return 'Champion';
  if (points >= (thresholds.grandmaster?.min ?? defaultThresholds.grandmaster.min)) return 'Grandmaster';
  if (points >= (thresholds.master?.min ?? defaultThresholds.master.min)) return 'Master';
  if (points >= (thresholds.diamond?.min ?? defaultThresholds.diamond.min)) return 'Diamond';
  if (points >= (thresholds.platinum?.min ?? defaultThresholds.platinum.min)) return 'Platinum';
  if (points >= (thresholds.gold?.min ?? defaultThresholds.gold.min)) return 'Gold';
  if (points >= (thresholds.silver?.min ?? defaultThresholds.silver.min)) return 'Silver';
  return 'Bronze';
};

/**
 * Vérifie si un joueur PC est connecté à GGSecure
 */
const checkGGSecureStatus = async (userId) => {
  try {
    const user = await User.findById(userId).select('platform');
    if (!user || user.platform !== 'PC') {
      return { required: false, connected: true };
    }
    
    // Appeler l'API GGSecure
    const GGSECURE_API_KEY = process.env.GGSECURE_API_KEY;
    if (!GGSECURE_API_KEY) {
      return { required: true, connected: true, reason: 'api_key_missing' };
    }
    
    const response = await fetch(`https://api.ggsecure.io/api/v1/fingerprints/player/${userId}`, {
      headers: {
        'Authorization': `Bearer ${GGSECURE_API_KEY}`,
        'X-API-Key': GGSECURE_API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const isOnline = data.data?.isOnline === true || 
                       data.isOnline === true ||
                       data.connected === true ||
                       data.data?.connected === true;
      return { required: true, connected: isOnline };
    }
    
    return { required: true, connected: false };
  } catch (error) {
    console.error('[Ranked Matchmaking] GGSecure check error:', error);
    return { required: true, connected: true }; // En cas d'erreur, on laisse passer
  }
};

/**
 * Rejoint la file d'attente
 */
export const joinQueue = async (userId, gameMode, mode) => {
  try {
    // Vérifier que le mode est activé
    const settings = await AppSettings.getSettings();
    
    // Vérifier si le serveur est en maintenance
    if (settings.maintenance?.enabled) {
      return { 
        success: false, 
        message: settings.maintenance.message || 'Le serveur est en maintenance. Veuillez réessayer plus tard.'
      };
    }
    
    // Définir les settings par défaut si rankedSettings n'existe pas
    const defaultSettings = {
      searchAndDestroy: {
        enabled: true,
        rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
        matchmaking: { minPlayers: 8, maxPlayers: 10, waitTimer: 120 }
      },
      hardpoint: {
        enabled: true,
        rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
        matchmaking: { minPlayers: 8, maxPlayers: 8, waitTimer: 120 }
      }
    };
    
    const rankedSettings = settings.rankedSettings || defaultSettings;
    const gameModeKey = gameMode.replace(/\s+/g, '').replace('&', 'And').toLowerCase();
    
    // Map game mode names to settings keys
    let settingsKey = gameModeKey;
    if (gameModeKey === 'searchanddestroy') settingsKey = 'searchAndDestroy';
    else if (gameModeKey === 'hardpoint') settingsKey = 'hardpoint';
    
    const gameModeSettings = rankedSettings[settingsKey] || defaultSettings[settingsKey] || null;
    
    // Pour S&D et Hardpoint, on autorise par défaut si pas de config
    if (!gameModeSettings) {
      return { success: false, message: 'Ce mode de jeu n\'est pas disponible actuellement.' };
    }
    
    if (gameModeSettings.enabled === false) {
      return { success: false, message: 'Ce mode de jeu est temporairement désactivé.' };
    }
    
    // Récupérer l'utilisateur
    const user = await User.findById(userId).select('username platform isRankedBanned rankedBanExpiresAt rankedBanReason');
    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé.' };
    }
    
    // Vérifier si le joueur est banni du mode ranked
    if (user.isRankedBanned) {
      // Vérifier si le ban a expiré
      if (user.rankedBanExpiresAt && new Date() > new Date(user.rankedBanExpiresAt)) {
        // Le ban a expiré, lever automatiquement le ban
        user.isRankedBanned = false;
        user.rankedBanReason = null;
        user.rankedBannedAt = null;
        user.rankedBanExpiresAt = null;
        user.rankedBannedBy = null;
        await user.save();
        console.log(`[Ranked Matchmaking] Ranked ban expired for ${user.username}, auto-unbanned`);
      } else {
        // Le ban est toujours actif
        const expiresText = user.rankedBanExpiresAt 
          ? `jusqu'au ${new Date(user.rankedBanExpiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` 
          : 'définitivement';
        return { 
          success: false, 
          message: `Vous êtes banni du mode classé ${expiresText}. Raison: ${user.rankedBanReason || 'Non spécifiée'}`,
          rankedBanned: true
        };
      }
    }
    
    // Vérifier GGSecure pour les joueurs PC
    if (user.platform === 'PC') {
      const ggsecure = await checkGGSecureStatus(userId);
      if (ggsecure.required && !ggsecure.connected) {
        return { 
          success: false, 
          message: 'Vous devez être connecté à GGSecure pour jouer en classé.',
          ggsecureRequired: true
        };
      }
    }
    
    // Récupérer ou créer le ranking
    let ranking = await Ranking.findOne({ user: userId, mode });
    if (!ranking) {
      ranking = await Ranking.create({
        user: userId,
        mode,
        points: 0,
        wins: 0,
        losses: 0,
        rank: 1
      });
    }
    
    const queue = getQueue(gameMode, mode);
    
    // Vérifier si le joueur n'est pas déjà dans la file
    if (queue.some(p => p.userId.toString() === userId.toString())) {
      return { success: false, message: 'Vous êtes déjà dans une file d\'attente.' };
    }
    
    // Vérifier si le joueur n'est pas déjà dans un match actif (dans n'importe quel mode)
    const activeMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'ready', 'in_progress'] }
      // Ne pas filtrer par mode/gameMode - on vérifie tous les modes
    });
    
    if (activeMatch) {
      return { 
        success: false, 
        message: 'Vous avez déjà un match en cours.',
        activeMatchId: activeMatch._id
      };
    }
    
    // Ajouter le joueur à la file
    const playerData = {
      userId: userId,
      username: user.username,
      rank: await getRankFromPoints(ranking.points),
      points: ranking.points,
      platform: user.platform,
      joinedAt: new Date()
    };
    
    queue.push(playerData);
    console.log(`[Ranked Matchmaking] ${user.username} joined ${gameMode} ${mode} queue. Queue size: ${queue.length}`);
    
    // Notifier tous les joueurs de la file
    broadcastQueueUpdate(gameMode, mode);
    
    // Vérifier si on peut démarrer le matchmaking
    checkMatchmakingStart(gameMode, mode);
    
    return { 
      success: true, 
      message: 'Vous avez rejoint la file d\'attente.',
      queueSize: queue.length,
      position: queue.length
    };
  } catch (error) {
    console.error('[Ranked Matchmaking] Join queue error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Quitte la file d'attente
 */
export const leaveQueue = async (userId, gameMode, mode) => {
  try {
    const queue = getQueue(gameMode, mode);
    const playerIndex = queue.findIndex(p => p.userId.toString() === userId.toString());
    
    if (playerIndex === -1) {
      return { success: false, message: 'Vous n\'êtes pas dans la file d\'attente.' };
    }
    
    const player = queue[playerIndex];
    queue.splice(playerIndex, 1);
    console.log(`[Ranked Matchmaking] ${player.username} left ${gameMode} ${mode} queue. Queue size: ${queue.length}`);
    
    // Notifier les joueurs restants
    broadcastQueueUpdate(gameMode, mode);
    
    // Si on descend sous le minimum de joueurs (4), annuler le timer
    if (queue.length < 4) {
      cancelMatchmakingTimer(gameMode, mode);
    } else {
      // Vérifier si on doit relancer le timer avec le nouveau format
      checkMatchmakingStart(gameMode, mode);
    }
    
    return { success: true, message: 'Vous avez quitté la file d\'attente.' };
  } catch (error) {
    console.error('[Ranked Matchmaking] Leave queue error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Obtient le statut de la file d'attente pour un joueur
 */
export const getQueueStatus = async (userId, gameMode, mode) => {
  try {
    const queue = getQueue(gameMode, mode);
    const playerInQueue = queue.find(p => p.userId.toString() === userId.toString());
    const timerKey = getQueueKey(gameMode, mode);
    const timerInfo = queueTimers[timerKey];
    
    // Déterminer le format actuel basé sur le nombre de joueurs et le mode
    const optimalFormat = getOptimalFormat(queue.length, mode);
    const nextThreshold = getNextThreshold(queue.length, mode);
    
    // CDL: uniquement 4v4 (8 joueurs max), Hardcore: jusqu'à 5v5 (10 joueurs max)
    const maxPlayers = mode === 'cdl' ? 8 : 10;
    
    return {
      success: true,
      inQueue: !!playerInQueue,
      queueSize: queue.length,
      position: playerInQueue ? queue.findIndex(p => p.userId.toString() === userId.toString()) + 1 : null,
      timerActive: !!timerInfo,
      timerEndTime: timerInfo?.endTime || null,
      currentFormat: optimalFormat?.format || null,
      nextFormat: nextThreshold?.format || null,
      playersNeeded: nextThreshold ? nextThreshold.players - queue.length : 0,
      minPlayers: 8,
      maxPlayers: maxPlayers
    };
  } catch (error) {
    console.error('[Ranked Matchmaking] Get queue status error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Vérifie si on peut démarrer le matchmaking
 * CDL: Match immédiat dès 8 joueurs (4v4 uniquement)
 * Hardcore: Timer 2 min à 8 joueurs, match immédiat à 10 joueurs (5v5)
 */
const checkMatchmakingStart = async (gameMode, mode) => {
  const queue = getQueue(gameMode, mode);
  const timerKey = getQueueKey(gameMode, mode);
  
  // CDL: uniquement 4v4 (8 joueurs max), Hardcore: jusqu'à 5v5 (10 joueurs max)
  const maxPlayers = mode === 'cdl' ? 8 : 10;
  const minPlayers = 8; // Minimum pour un 4v4
  
  // CDL: Match immédiat dès qu'on a 8 joueurs (pas de timer)
  if (mode === 'cdl' && queue.length >= minPlayers) {
    console.log(`[Ranked Matchmaking] CDL mode: ${queue.length} players reached for ${gameMode}, creating 4v4 match immediately`);
    cancelMatchmakingTimer(gameMode, mode);
    createMatchFromQueue(gameMode, mode);
    return;
  }
  
  // Hardcore: Si on a atteint le max de joueurs (10), match immédiat en 5v5
  if (mode === 'hardcore' && queue.length >= maxPlayers) {
    console.log(`[Ranked Matchmaking] Hardcore mode: ${maxPlayers} players reached for ${gameMode}, creating 5v5 match now`);
    cancelMatchmakingTimer(gameMode, mode);
    createMatchFromQueue(gameMode, mode);
    return;
  }
  
  // Hardcore: Trouver le format optimal pour le nombre actuel de joueurs
  const optimalFormat = getOptimalFormat(queue.length, mode);
  
  // Hardcore: Si on a assez de joueurs pour au moins un format (8 pour 4v4), lancer le timer
  if (mode === 'hardcore' && optimalFormat && !queueTimers[timerKey]) {
    const endTime = Date.now() + (MATCHMAKING_TIMER_SECONDS * 1000);
    
    console.log(`[Ranked Matchmaking] Starting ${MATCHMAKING_TIMER_SECONDS}s timer for ${gameMode} ${mode} (current format: ${optimalFormat.format})`);
    
    const timer = setTimeout(() => {
      createMatchFromQueue(gameMode, mode);
    }, MATCHMAKING_TIMER_SECONDS * 1000);
    
    queueTimers[timerKey] = { timer, endTime, format: optimalFormat.format };
    
    // Notifier les joueurs du démarrage du timer
    broadcastQueueUpdate(gameMode, mode);
  }
};

/**
 * Annule le timer de matchmaking
 */
const cancelMatchmakingTimer = (gameMode, mode) => {
  const timerKey = getQueueKey(gameMode, mode);
  const timerInfo = queueTimers[timerKey];
  
  if (timerInfo) {
    clearTimeout(timerInfo.timer);
    delete queueTimers[timerKey];
    console.log(`[Ranked Matchmaking] Timer cancelled for ${gameMode} ${mode}`);
  }
};

/**
 * Crée un match à partir de la file d'attente
 * Le format est déterminé dynamiquement selon le nombre de joueurs et le mode
 * CDL: uniquement 4v4 (8 joueurs max)
 * Hardcore: jusqu'à 5v5 (10 joueurs max)
 * Si nombre impair, le dernier arrivé est éjecté
 */
const createMatchFromQueue = async (gameMode, mode) => {
  const queue = getQueue(gameMode, mode);
  const timerKey = getQueueKey(gameMode, mode);
  
  // Supprimer le timer
  delete queueTimers[timerKey];
  
  if (queue.length < 4) {
    console.log(`[Ranked Matchmaking] Not enough players for ${gameMode} ${mode}`);
    return;
  }
  
  // Trier par date d'arrivée (les premiers arrivés en premier)
  const sortedQueue = [...queue].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  
  // Déterminer le nombre de joueurs pour le match (pair, max selon les seuils)
  let playerCount = sortedQueue.length;
  
  // Si nombre impair, on doit éjecter le dernier arrivé
  const ejectedPlayers = [];
  if (playerCount % 2 !== 0) {
    const ejected = sortedQueue.pop();
    ejectedPlayers.push(ejected);
    playerCount--;
    console.log(`[Ranked Matchmaking] Ejecting ${ejected.username} (odd number of players)`);
  }
  
  // CDL: uniquement 4v4 (8 joueurs max), Hardcore: jusqu'à 5v5 (10 joueurs max)
  const maxPlayers = mode === 'cdl' ? 8 : 10;
  
  // Maintenant on a un nombre pair, trouver le format optimal
  const optimalFormat = getOptimalFormat(playerCount, mode);
    
  if (!optimalFormat) {
    console.log(`[Ranked Matchmaking] No valid format for ${playerCount} players in ${mode} mode`);
    return;
  }
  
  // Si on a plus de joueurs que le format max, on prend les premiers
  if (playerCount > maxPlayers) {
    const excess = sortedQueue.splice(maxPlayers);
    ejectedPlayers.push(...excess);
    playerCount = maxPlayers;
    console.log(`[Ranked Matchmaking] Capping to ${maxPlayers} players for ${mode} mode, ${excess.length} players stay in queue`);
  }
  
  const playersForMatch = sortedQueue.slice(0, playerCount);
  const format = getOptimalFormat(playerCount, mode).format;
  let teamSize = playerCount / 2;
  
  // Retirer les joueurs du match ET les joueurs éjectés de la file
  const playerIdsForMatch = playersForMatch.map(p => p.userId.toString());
  const ejectedPlayerIds = ejectedPlayers.map(p => p.userId.toString());
  const newQueue = queue.filter(p => 
    !playerIdsForMatch.includes(p.userId.toString()) && 
    !ejectedPlayerIds.includes(p.userId.toString())
  );
  queues[getQueueKey(gameMode, mode)] = newQueue;
  
  // Notifier les joueurs éjectés qu'ils ont été retirés de la file (ils devront relancer une recherche)
  for (const ejectedPlayer of ejectedPlayers) {
    if (io) {
      io.to(`user-${ejectedPlayer.userId}`).emit('rankedQueueUpdate', {
        type: 'ejected',
        message: 'Match lancé sans vous (nombre impair). Veuillez relancer une recherche.',
        queueSize: 0,
        position: null
      });
    }
  }
  
  console.log(`[Ranked Matchmaking] Creating ${format} match with ${playerCount} players`);
  
  // Créer le match
  try {
    
    // Re-vérifier GGSecure pour tous les joueurs PC AVANT de créer le match
    // Un joueur pourrait avoir désactivé GGSecure pendant qu'il attendait dans la file
    const playersToRemove = [];
    for (const player of playersForMatch) {
      if (player.platform === 'PC' && !player.isFake && !player.userId.toString().startsWith('fake-')) {
        const ggsecure = await checkGGSecureStatus(player.userId);
        if (ggsecure.required && !ggsecure.connected) {
          playersToRemove.push(player);
          console.log(`[Ranked Matchmaking] Player ${player.username} is no longer connected to GGSecure, removing from match`);
          
          // Notifier le joueur
          if (io) {
            io.to(`user-${player.userId}`).emit('rankedQueueUpdate', {
              type: 'ggsecure_error',
              message: 'Vous avez été retiré du match car vous n\'êtes plus connecté à GGSecure.',
              queueSize: 0,
              position: null
            });
          }
        }
      }
    }
    
    // Si des joueurs ont été retirés, vérifier si on a encore assez de joueurs
    if (playersToRemove.length > 0) {
      let remainingPlayers = playersForMatch.filter(p => 
        !playersToRemove.some(removed => removed.userId.toString() === p.userId.toString())
      );
      
      if (remainingPlayers.length < 4) {
        console.log(`[Ranked Matchmaking] Not enough players after GGSecure check (${remainingPlayers.length}), cancelling match creation`);
        
        // Remettre les joueurs valides dans la file
        const queue = getQueue(gameMode, mode);
        for (const player of remainingPlayers) {
          if (!queue.some(p => p.userId.toString() === player.userId.toString())) {
            queue.push(player);
          }
        }
        
        // Notifier les joueurs restants
        broadcastQueueUpdate(gameMode, mode);
        return;
      }
      
      // Si nombre impair après retrait GGSecure, éjecter le dernier arrivé
      if (remainingPlayers.length % 2 !== 0) {
        // Trier par date d'arrivée pour éjecter le dernier
        remainingPlayers.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
        const ejectedAfterGGSecure = remainingPlayers.pop();
        console.log(`[Ranked Matchmaking] Ejecting ${ejectedAfterGGSecure.username} after GGSecure check (odd number: ${remainingPlayers.length + 1} -> ${remainingPlayers.length})`);
        
        // Remettre le joueur éjecté dans la file d'attente
        const queue = getQueue(gameMode, mode);
        if (!queue.some(p => p.userId.toString() === ejectedAfterGGSecure.userId.toString())) {
          queue.push(ejectedAfterGGSecure);
        }
        
        // Notifier le joueur éjecté
        if (io) {
          io.to(`user-${ejectedAfterGGSecure.userId}`).emit('rankedQueueUpdate', {
            type: 'ejected',
            message: 'Match lancé sans vous (nombre impair après vérification). Vous êtes toujours dans la file.',
            queueSize: queue.length,
            position: queue.findIndex(p => p.userId.toString() === ejectedAfterGGSecure.userId.toString()) + 1
          });
        }
      }
      
      // Continuer avec les joueurs restants (recalculer les équipes)
      playersForMatch.length = 0;
      playersForMatch.push(...remainingPlayers);
      playerCount = remainingPlayers.length;
      
      // IMPORTANT: Recalculer teamSize après retrait de joueurs
      teamSize = playerCount / 2;
      
      console.log(`[Ranked Matchmaking] Continuing with ${playerCount} players after GGSecure check (teamSize: ${teamSize})`);
    }
    
    // Générer des équipes diversifiées en évitant les compositions récentes
    const { team1: team1Players, team2: team2Players } = generateDiverseTeams(
      playersForMatch, 
      teamSize, 
      gameMode, 
      mode
    );
    
    // Sauvegarder cette composition dans l'historique pour les futurs matchs
    const team1Ids = team1Players.map(p => p.userId?.toString()).filter(Boolean);
    const team2Ids = team2Players.map(p => p.userId?.toString()).filter(Boolean);
    addTeamToHistory(gameMode, mode, team1Ids, team2Ids);
    
    // Fonction pour vérifier si un joueur est un faux joueur
    const isFakePlayer = (player) => player.isFake || player.userId.toString().startsWith('fake-');
    
    // Filtrer les vrais joueurs pour les référents
    const realTeam1Players = team1Players.filter(p => !isFakePlayer(p));
    const realTeam2Players = team2Players.filter(p => !isFakePlayer(p));
    
    // Récupérer les IDs des joueurs réels pour vérifier le ban référent
    const realPlayerIds = [...realTeam1Players, ...realTeam2Players]
      .filter(p => !isFakePlayer(p))
      .map(p => p.userId);
    
    // Charger les infos de ban référent depuis la DB
    const usersWithReferentBan = await User.find({
      _id: { $in: realPlayerIds },
      isReferentBanned: true
    }).select('_id');
    const referentBannedIds = new Set(usersWithReferentBan.map(u => u._id.toString()));
    
    // Filtrer les joueurs éligibles pour être référent (vrais joueurs non bannis)
    const eligibleTeam1Referents = realTeam1Players.filter(p => !referentBannedIds.has(p.userId.toString()));
    const eligibleTeam2Referents = realTeam2Players.filter(p => !referentBannedIds.has(p.userId.toString()));
    
    // Tirer au sort les référents (de préférence un joueur éligible, sinon un vrai joueur, sinon le premier)
    const team1Referent = eligibleTeam1Referents.length > 0 
      ? eligibleTeam1Referents[Math.floor(Math.random() * eligibleTeam1Referents.length)]
      : realTeam1Players.length > 0 
        ? realTeam1Players[Math.floor(Math.random() * realTeam1Players.length)]
        : team1Players[0];
    const team2Referent = eligibleTeam2Referents.length > 0 
      ? eligibleTeam2Referents[Math.floor(Math.random() * eligibleTeam2Referents.length)]
      : realTeam2Players.length > 0 
        ? realTeam2Players[Math.floor(Math.random() * realTeam2Players.length)]
        : team2Players[0];
    
    // Tirer au sort l'équipe hôte
    const hostTeam = Math.random() < 0.5 ? 1 : 2;
    
    // Récupérer le format BO1 ou BO3 depuis les paramètres
    const settings = await AppSettings.getSettings();
    const bestOf = settings?.rankedSettings?.bestOf || 3; // Par défaut BO3
    const mapCount = bestOf === 1 ? 1 : 3;
    
    // Sélectionner les maps selon le format (BO1 = 1 map, BO3 = 3 maps)
    // Pour ranked, on utilise la nouvelle structure de configuration
    // Le format est déterminé par la taille d'équipe (4v4 ou 5v5)
    let rankedFormat = teamSize === 5 ? '5v5' : '4v4';
    const isHardpoint = gameMode === 'Hardpoint';
    
    // Déterminer le configPath en fonction du mode (hardcore/cdl)
    const configPath = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
    
    let maps;
    
    // Essayer d'abord avec la nouvelle structure de configuration (avec format)
    maps = await GameMap.find({ 
      isActive: true,
      [`${configPath}.ranked.enabled`]: true,
      [`${configPath}.ranked.gameModes`]: gameMode,
      [`${configPath}.ranked.formats`]: rankedFormat
    });
    console.log(`[Ranked Matchmaking] Found ${maps.length} maps for ${mode} ranked ${gameMode} ${rankedFormat} (new config with format)`);
    
    // Si pas assez de maps avec le format, essayer sans filtrer par format
    if (maps.length < mapCount) {
      console.log(`[Ranked Matchmaking] Not enough maps with format ${rankedFormat}, trying without format filter`);
      maps = await GameMap.find({ 
        isActive: true,
        [`${configPath}.ranked.enabled`]: true,
        [`${configPath}.ranked.gameModes`]: gameMode
      });
      console.log(`[Ranked Matchmaking] Found ${maps.length} maps for ${mode} ranked ${gameMode} (new config without format)`);
    }
    
    // Fallback: Si pas assez de maps avec la nouvelle config, essayer l'ancienne structure
    if (maps.length < mapCount) {
      console.log(`[Ranked Matchmaking] Not enough maps with new config (${maps.length}/${mapCount}), trying legacy structure`);
      
      if (isHardpoint && teamSize === 4) {
        // Pour Hardpoint, chercher d'abord avec le format spécifique hardpoint-4v4
        maps = await GameMap.find({ 
          isActive: true,
          ladders: 'ranked',
          mode: { $in: [mode, 'both'] },
          rankedFormats: 'hardpoint-4v4',
          gameModes: gameMode
        });
        console.log(`[Ranked Matchmaking] Found ${maps.length} maps for ${mode} ranked Hardpoint format hardpoint-4v4 (legacy)`);
        
        // Si pas de maps avec hardpoint-4v4, essayer avec 4v4
        if (maps.length < mapCount) {
          maps = await GameMap.find({ 
            isActive: true,
            ladders: 'ranked',
            mode: { $in: [mode, 'both'] },
            rankedFormats: '4v4',
            gameModes: gameMode
          });
          console.log(`[Ranked Matchmaking] Found ${maps.length} maps for ${mode} ranked Hardpoint format 4v4 (legacy)`);
        }
      } else {
        maps = await GameMap.find({ 
          isActive: true,
          ladders: 'ranked',
          mode: { $in: [mode, 'both'] },
          rankedFormats: rankedFormat,
          ...(gameMode ? { gameModes: gameMode } : {})
        });
        console.log(`[Ranked Matchmaking] Found ${maps.length} maps for ${mode} ranked ${gameMode || 'any'} format ${rankedFormat} (legacy)`);
      }
    }
    
    // Si pas assez de maps avec le format spécifique, essayer sans filtrer par rankedFormats
    if (maps.length < mapCount) {
      console.log(`[Ranked Matchmaking] Not enough maps with format ${rankedFormat} (${maps.length}/${mapCount}), trying without format filter`);
      maps = await GameMap.find({ 
        isActive: true,
        ladders: 'ranked',
        mode: { $in: [mode, 'both'] },
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking] Found ${maps.length} maps without format filter`);
    }
    
    // Si pas assez de maps avec ladder 'ranked', chercher les maps avec ladder 'squad-team' (fallback)
    if (maps.length < mapCount) {
      console.log(`[Ranked Matchmaking] Not enough ranked maps (${maps.length}/${mapCount}), falling back to squad-team maps`);
      maps = await GameMap.find({ 
        isActive: true,
        ladders: { $in: ['ranked', 'squad-team'] },
        mode: { $in: [mode, 'both'] },
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking] Found ${maps.length} maps with fallback (ranked + squad-team)`);
    }
    
    // Si toujours pas assez, prendre toutes les maps actives avec le bon gameMode (sans filtrer par mode)
    let availableMaps = maps;
    if (maps.length < 3) {
      console.log(`[Ranked Matchmaking] Still not enough maps, falling back to all active maps with gameMode (no mode filter)`);
      availableMaps = await GameMap.find({ 
        isActive: true,
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking] Found ${availableMaps.length} maps with second fallback (gameMode only)`);
    }
    
    // Dernier recours : toutes les maps actives
    if (availableMaps.length < 3) {
      console.log(`[Ranked Matchmaking] Last resort: all active maps`);
      availableMaps = await GameMap.find({ isActive: true });
      console.log(`[Ranked Matchmaking] Found ${availableMaps.length} active maps total`);
    }
    
    const selectedMaps = availableMaps.sort(() => Math.random() - 0.5).slice(0, mapCount).map((map, index) => ({
      name: map.name,
      image: map.image || null,
      order: index + 1,
      winner: null
    }));
    
    console.log(`[Ranked Matchmaking] Selected ${mapCount} maps for match (BO${bestOf}):`, selectedMaps);
    
    // Sélectionner 3 maps pour le vote (différentes des maps du match si possible)
    let mapsForVote = availableMaps
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(map => ({
        name: map.name,
        image: map.image || null,
        votes: 0,
        votedBy: []
      }));
    
    // Si pas de maps disponibles, créer des maps par défaut
    if (mapsForVote.length === 0) {
      console.log(`[Ranked Matchmaking] No maps found, using default maps`);
      mapsForVote = [
        { name: 'Raid', image: null, votes: 0, votedBy: [] },
        { name: 'Standoff', image: null, votes: 0, votedBy: [] },
        { name: 'Highrise', image: null, votes: 0, votedBy: [] }
      ];
    }
    
    console.log(`[Ranked Matchmaking] Maps for vote (${mapsForVote.length} maps):`, mapsForVote.map(m => m.name));
    console.log(`[Ranked Matchmaking] Full mapVoteOptions data:`, JSON.stringify(mapsForVote, null, 2));
    
    // Créer les données des joueurs pour le match
    // DISTRIBUTION ALÉATOIRE: Tous les joueurs sont assignés à leur équipe dès le départ
    const matchPlayers = [
      ...team1Players.map(p => {
        const fake = isFakePlayer(p);
        const isTeam1Ref = p.userId.toString() === team1Referent.userId.toString();
        return {
          user: fake ? null : p.userId, // null pour les faux joueurs
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 1, // Tous les joueurs team1 sont dans l'équipe 1
          isReferent: isTeam1Ref,
          isFake: fake,
          queueJoinedAt: p.joinedAt
        };
      }),
      ...team2Players.map(p => {
        const fake = isFakePlayer(p);
        const isTeam2Ref = p.userId.toString() === team2Referent.userId.toString();
        return {
          user: fake ? null : p.userId, // null pour les faux joueurs
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 2, // Tous les joueurs team2 sont dans l'équipe 2
          isReferent: isTeam2Ref,
          isFake: fake,
          queueJoinedAt: p.joinedAt
        };
      })
    ];
    
    // Pour les référents, seulement définir si c'est un vrai joueur
    const team1ReferentId = !isFakePlayer(team1Referent) ? team1Referent.userId : null;
    const team2ReferentId = !isFakePlayer(team2Referent) ? team2Referent.userId : null;
    
    // Créer le match SANS roster selection (distribution aléatoire directe)
    const match = await RankedMatch.create({
      gameMode,
      mode,
      teamSize,
      players: matchPlayers,
      team1Referent: team1ReferentId,
      team2Referent: team2ReferentId,
      hostTeam,
      status: 'pending', // En attente du vote de map
      maps: selectedMaps,
      mapVoteOptions: mapsForVote,
      matchmakingStartedAt: new Date(),
      rosterSelection: {
        isActive: false, // Pas de sélection de roster - distribution aléatoire
        currentTurn: 1,
        turnStartedAt: null,
        pickOrder: [],
        totalPicks: 0,
        startedAt: null,
        completedAt: null
      }
    });
    
    // Populate pour envoyer aux clients (seulement les vrais joueurs)
    if (team1ReferentId || team2ReferentId) {
      await match.populate('players.user', 'username avatar discordId discordAvatar platform');
      if (team1ReferentId) await match.populate('team1Referent', 'username');
      if (team2ReferentId) await match.populate('team2Referent', 'username');
    }
    
    console.log(`[Ranked Matchmaking] Match created: ${match._id} (${teamSize}v${teamSize}) format: ${format}`);
    
    // Ajouter un message système
    match.chat.push({
      isSystem: true,
      messageType: 'match_created',
      messageParams: { teamSize },
      message: `Match ${teamSize}v${teamSize} créé ! ${team1Referent.username} et ${team2Referent.username} sont les référents. Vote de map en cours...`
    });
    await match.save();
    
    // Préparer les données des joueurs pour l'animation de shuffle
    // Inclure tous les joueurs avec leurs infos pour l'animation côté client
    const playersForAnimation = matchPlayers.map((p, index) => {
      // Récupérer l'avatar depuis les données populées ou les données originales
      const populatedPlayer = match.players.find(mp => mp.username === p.username);
      let avatar = null;
      if (populatedPlayer?.user?.discordId && populatedPlayer?.user?.discordAvatar) {
        avatar = `https://cdn.discordapp.com/avatars/${populatedPlayer.user.discordId}/${populatedPlayer.user.discordAvatar}.png`;
      } else if (populatedPlayer?.user?.avatar) {
        avatar = populatedPlayer.user.avatar;
      }
      
      return {
        id: p.user?.toString() || `fake-${index}`,
        username: p.username,
        avatar: avatar,
        team: p.team,
        isReferent: p.isReferent,
        isHost: p.team === hostTeam && p.isReferent,
        isFake: p.isFake,
        points: p.points || 0 // Points classés pour afficher le rang
      };
    });
    
    // Préparer les options de vote de map pour l'envoi
    const mapVoteOptionsForClient = mapsForVote.map(m => ({ name: m.name, image: m.image, votes: 0 }));
    console.log(`[Ranked Matchmaking] Sending mapVoteOptions to clients:`, JSON.stringify(mapVoteOptionsForClient));
    
    // Notifier tous les vrais joueurs du match
    const matchIdStr = match._id.toString();
    
    for (const player of matchPlayers) {
      if (io && player.user) { // Ne notifier que les vrais joueurs
        console.log(`[Ranked Matchmaking] Sending rankedMatchFound to user-${player.user} (${player.username}), team: ${player.team}, matchId: ${matchIdStr}`);
        io.to(`user-${player.user}`).emit('rankedMatchFound', {
          matchId: matchIdStr,
          gameMode,
          mode,
          format,
          teamSize,
          yourTeam: player.team, // 1 ou 2
          isReferent: player.isReferent,
          isHost: player.team === hostTeam && player.isReferent,
          isTestMatch: false,
          hasRosterSelection: false, // Pas de sélection de roster - équipes aléatoires
          players: playersForAnimation, // Tous les joueurs avec leurs équipes assignées
          mapVoteOptions: mapVoteOptionsForClient // Maps pour le vote
        });
      }
    }
    
    // Démarrer le timer de vote de map DIRECTEMENT (pas de roster selection)
    startMapVoteTimer(match._id, matchPlayers.filter(p => p.user));
    
    // Vérifier immédiatement le statut GGSecure des joueurs PC et notifier sur la feuille de match
    checkRankedMatchGGSecureStatus(match).catch(err => {
      console.error('[Ranked Matchmaking] Error in immediate GGSecure check:', err);
    });
    
    // Mettre à jour le statut de la file pour les joueurs restants
    broadcastQueueUpdate(gameMode, mode);
    
    // Si des joueurs restent dans la file, relancer le processus
    if (newQueue.length >= 4) {
      checkMatchmakingStart(gameMode, mode);
    }
    
  } catch (error) {
    console.error('[Ranked Matchmaking] Error creating match:', error);
    
    // En cas d'erreur, remettre les joueurs dans la file
    const currentQueue = getQueue(gameMode, mode);
    for (const player of playersForMatch) {
      if (!currentQueue.some(p => p.userId.toString() === player.userId.toString())) {
        currentQueue.push(player);
      }
    }
    broadcastQueueUpdate(gameMode, mode);
  }
};

/**
 * Broadcast la mise à jour de la file à tous les joueurs concernés
 */
const broadcastQueueUpdate = (gameMode, mode) => {
  if (!io) return;
  
  const queue = getQueue(gameMode, mode);
  const timerKey = getQueueKey(gameMode, mode);
  const timerInfo = queueTimers[timerKey];
  const optimalFormat = getOptimalFormat(queue.length, mode);
  const nextThreshold = getNextThreshold(queue.length, mode);
  
  // CDL: uniquement 4v4 (8 joueurs max), Hardcore: jusqu'à 5v5 (10 joueurs max)
  const maxPlayers = mode === 'cdl' ? 8 : 10;
  
  for (let i = 0; i < queue.length; i++) {
    const player = queue[i];
    io.to(`user-${player.userId}`).emit('rankedQueueUpdate', {
      type: 'queue_status',
      queueSize: queue.length,
      position: i + 1,
      timerActive: !!timerInfo,
      timerEndTime: timerInfo?.endTime || null,
      currentFormat: optimalFormat?.format || null,
      nextFormat: nextThreshold?.format || null,
      playersNeeded: nextThreshold ? nextThreshold.players - queue.length : 0,
      minPlayers: 8,
      maxPlayers: maxPlayers
    });
  }
  
  // Broadcast global queue count to all users on the ranked page for this mode
  broadcastGlobalQueueCount(mode);
};

/**
 * Broadcast le nombre total de joueurs en matchmaking à tous les utilisateurs sur la page ranked
 */
const broadcastGlobalQueueCount = (mode) => {
  if (!io) return;
  
  // Calculer le total de joueurs en file d'attente pour ce mode
  let totalInQueue = 0;
  for (const key in queues) {
    // Les clés sont au format "gameMode_mode" (ex: "Search & Destroy_hardcore")
    if (key.endsWith(`_${mode}`)) {
      totalInQueue += queues[key].length;
    }
  }
  
  // Envoyer à tous les utilisateurs connectés à la page ranked de ce mode
  io.to(`ranked-mode-${mode}`).emit('rankedGlobalQueueCount', {
    count: totalInQueue,
    mode
  });
};

/**
 * Obtient toutes les files d'attente (pour debug/admin)
 */
export const getAllQueues = () => {
  const result = {};
  for (const key in queues) {
    const queue = queues[key];
    result[key] = {
      count: queue.length,
      players: queue.map(p => ({
        username: p.username,
        rank: p.rank,
        joinedAt: p.joinedAt
      })),
      timerActive: !!queueTimers[key],
      timerEndTime: queueTimers[key]?.endTime || null
    };
  }
  return result;
};

/**
 * Force la création d'un match (admin)
 */
export const forceCreateMatch = async (gameMode, mode) => {
  cancelMatchmakingTimer(gameMode, mode);
  await createMatchFromQueue(gameMode, mode);
};

/**
 * Ajoute des faux joueurs à la file d'attente (staff/admin only)
 * Pour tester le matchmaking
 */
export const addFakePlayers = async (gameMode, mode, count = 5) => {
  try {
    const queue = getQueue(gameMode, mode);
    
    // Générer des faux joueurs
    const fakeNames = [
      'TestPlayer_Alpha', 'TestPlayer_Bravo', 'TestPlayer_Charlie', 
      'TestPlayer_Delta', 'TestPlayer_Echo', 'TestPlayer_Foxtrot',
      'TestPlayer_Golf', 'TestPlayer_Hotel', 'TestPlayer_India',
      'TestPlayer_Juliet'
    ];
    
    const fakeRanks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    
    let addedCount = 0;
    for (let i = 0; i < count && queue.length < 10; i++) {
      const fakeId = `fake-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`;
      const randomPoints = Math.floor(Math.random() * 2000);
      
      const playerData = {
        userId: fakeId,
        username: fakeNames[i % fakeNames.length] + '_' + Math.floor(Math.random() * 1000),
        rank: fakeRanks[Math.floor(Math.random() * fakeRanks.length)],
        points: randomPoints,
        platform: 'PC',
        joinedAt: new Date(),
        isFake: true // Marqueur pour identifier les faux joueurs
      };
      
      queue.push(playerData);
      addedCount++;
      console.log(`[Ranked Matchmaking] Added fake player: ${playerData.username}`);
    }
    
    // Notifier tous les joueurs de la file
    broadcastQueueUpdate(gameMode, mode);
    
    // Vérifier si on peut démarrer le matchmaking
    checkMatchmakingStart(gameMode, mode);
    
    return {
      success: true,
      message: `${addedCount} faux joueurs ajoutés.`,
      queueSize: queue.length,
      addedCount
    };
  } catch (error) {
    console.error('[Ranked Matchmaking] Error adding fake players:', error);
    return { success: false, message: 'Erreur lors de l\'ajout des faux joueurs.' };
  }
};

/**
 * Supprime les faux joueurs de la file (cleanup)
 */
export const removeFakePlayers = async (gameMode, mode) => {
  try {
    const queue = getQueue(gameMode, mode);
    const originalLength = queue.length;
    
    // Filtrer pour retirer les faux joueurs
    queues[getQueueKey(gameMode, mode)] = queue.filter(p => !p.isFake);
    
    const newQueue = getQueue(gameMode, mode);
    const removedCount = originalLength - newQueue.length;
    
    console.log(`[Ranked Matchmaking] Removed ${removedCount} fake players from ${gameMode} ${mode}`);
    
    // Notifier les joueurs restants
    broadcastQueueUpdate(gameMode, mode);
    
    return {
      success: true,
      message: `${removedCount} faux joueurs supprimés.`,
      queueSize: newQueue.length,
      removedCount
    };
  } catch (error) {
    console.error('[Ranked Matchmaking] Error removing fake players:', error);
    return { success: false, message: 'Erreur lors de la suppression des faux joueurs.' };
  }
};

/**
 * Crée un match de test pour un membre du staff (matchmaking séparé avec bots)
 * Le staff joue seul et les autres slots sont remplis par des bots
 * @param {string} userId - ID du staff
 * @param {string} gameMode - Mode de jeu (Search & Destroy, etc.)
 * @param {string} mode - Mode (hardcore/cdl)
 * @param {number} teamSize - Taille de l'équipe (4 ou 5)
 */
export const startStaffTestMatch = async (userId, gameMode, mode, teamSize = 4) => {
  try {
    // Récupérer l'utilisateur staff
    const user = await User.findById(userId).select('username platform roles');
    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé.' };
    }
    
    // Vérifier que c'est bien un staff ou admin
    const isStaffOrAdmin = user.roles?.includes('staff') || user.roles?.includes('admin');
    if (!isStaffOrAdmin) {
      return { success: false, message: 'Accès réservé au staff.' };
    }
    
    // Vérifier si le joueur n'est pas déjà dans un match actif
    const activeMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    });
    
    if (activeMatch) {
      return { 
        success: false, 
        message: 'Vous avez déjà un match en cours.',
        activeMatchId: activeMatch._id
      };
    }
    
    // Récupérer ou créer le ranking pour le staff
    let ranking = await Ranking.findOne({ user: userId, mode });
    if (!ranking) {
      ranking = await Ranking.create({
        user: userId,
        mode,
        points: 0,
        wins: 0,
        losses: 0,
        rank: 1
      });
    }
    
    // Déterminer le format en fonction du mode de jeu
    let actualTeamSize;
    let totalPlayers;
    
    if (gameMode === 'Team Deathmatch') {
      // Mêlée générale: 8 joueurs (moi + 7 bots)
      actualTeamSize = 4; // 4v4
      totalPlayers = 8;
      console.log(`[Ranked Matchmaking] Team Deathmatch test: 8 players (4v4 format)`);
    } else if (gameMode === 'Duel') {
      // Duel: 2 joueurs (moi + 1 bot)
      actualTeamSize = 1; // 1v1
      totalPlayers = 2;
      console.log(`[Ranked Matchmaking] Duel test: 2 players (1v1 format)`);
    } else {
      // Autres modes: 4v4 ou 5v5 selon teamSize
      actualTeamSize = teamSize;
      totalPlayers = teamSize * 2;
      console.log(`[Ranked Matchmaking] ${gameMode} test: ${totalPlayers} players (${teamSize}v${teamSize} format)`);
    }
    
    console.log(`[Ranked Matchmaking] Starting staff test match for ${user.username} (${actualTeamSize}v${actualTeamSize}, ${totalPlayers} total players)`);
    
    // Créer les faux joueurs pour remplir le match
    const fakeNames = [
      'Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 
      'Bot_Echo', 'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel', 
      'Bot_India', 'Bot_Juliet', 'Bot_Kilo', 'Bot_Lima',
      'Bot_Mike', 'Bot_November', 'Bot_Oscar', 'Bot_Papa'
    ];
    const fakeRanks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    
    const fakePlayers = [];
    
    // Créer totalPlayers - 1 bots (le staff prend une place)
    for (let i = 0; i < totalPlayers - 1; i++) {
      const fakeId = `fake-test-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`;
      const randomPoints = Math.floor(Math.random() * 2000);
      
      fakePlayers.push({
        userId: fakeId,
        username: fakeNames[i % fakeNames.length] + '_' + Math.floor(Math.random() * 1000),
        rank: fakeRanks[Math.floor(Math.random() * fakeRanks.length)],
        points: randomPoints,
        platform: 'PC',
        joinedAt: new Date(),
        isFake: true
      });
    }
    
    // Le staff player
    const staffPlayer = {
      userId: userId,
      username: user.username,
      rank: await getRankFromPoints(ranking.points),
      points: ranking.points,
      platform: user.platform || 'PC',
      joinedAt: new Date(),
      isFake: false
    };
    
    // Mélanger tous les joueurs avec Fisher-Yates
    const allPlayers = fisherYatesShuffle([staffPlayer, ...fakePlayers]);
    
    // Diviser en 2 équipes
    const team1Players = allPlayers.slice(0, actualTeamSize);
    const team2Players = allPlayers.slice(actualTeamSize);
    
    // Trouver le référent (de préférence le staff non banni référent, sinon le premier de chaque équipe)
    const team1HasStaff = team1Players.some(p => !p.isFake);
    const team2HasStaff = team2Players.some(p => !p.isFake);
    
    // Vérifier si le staff est banni référent
    const staffUser = await User.findById(userId).select('isReferentBanned');
    const isStaffReferentBanned = staffUser?.isReferentBanned || false;
    
    // Si le staff est banni référent, il ne peut pas être référent (mais peut quand même jouer)
    const team1Referent = team1Players.find(p => !p.isFake && !isStaffReferentBanned) || team1Players[0];
    const team2Referent = team2Players.find(p => !p.isFake && !isStaffReferentBanned) || team2Players[0];
    
    // Tirer au sort l'équipe hôte (mettre le staff hôte pour faciliter les tests)
    const staffTeam = team1HasStaff ? 1 : 2;
    const hostTeam = staffTeam; // Le staff est toujours hôte pour les tests
    
    // Pour Duel et Team Deathmatch, pas de sélection de roster ni d'animation de mélange
    const isSpecialMode = gameMode === 'Team Deathmatch' || gameMode === 'Duel';
    
    // Récupérer le format BO1 ou BO3 depuis les paramètres
    const settings = await AppSettings.getSettings();
    const bestOf = settings?.rankedSettings?.bestOf || 3; // Par défaut BO3
    const mapCount = bestOf === 1 ? 1 : 3;
    
    // Sélectionner les maps selon le format - utiliser la nouvelle structure de configuration
    let rankedFormatTest = teamSize === 5 ? '5v5' : '4v4';
    const isHardpoint = gameMode === 'Hardpoint';
    
    // Déterminer le configPath en fonction du mode (hardcore/cdl)
    const configPathTest = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
    
    // Essayer d'abord avec la nouvelle structure de configuration (avec format)
    let mapsTest = await GameMap.find({ 
      isActive: true,
      [`${configPathTest}.ranked.enabled`]: true,
      [`${configPathTest}.ranked.gameModes`]: gameMode,
      [`${configPathTest}.ranked.formats`]: rankedFormatTest
    });
    console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps for ${mode} ranked ${gameMode} ${rankedFormatTest} (new config with format)`);
    
    // Si pas assez de maps avec le format, essayer sans filtrer par format
    if (mapsTest.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Not enough maps with format ${rankedFormatTest}, trying without format filter`);
      mapsTest = await GameMap.find({ 
        isActive: true,
        [`${configPathTest}.ranked.enabled`]: true,
        [`${configPathTest}.ranked.gameModes`]: gameMode
      });
      console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps for ${mode} ranked ${gameMode} (new config without format)`);
    }
    
    // Fallback: Si pas assez de maps avec la nouvelle config, essayer l'ancienne structure
    if (mapsTest.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Not enough maps with new config (${mapsTest.length}/${mapCount}), trying legacy structure`);
      
      if (isHardpoint && teamSize === 4) {
        mapsTest = await GameMap.find({ 
          isActive: true,
          ladders: 'ranked',
          mode: { $in: [mode, 'both'] },
          rankedFormats: 'hardpoint-4v4',
          gameModes: gameMode
        });
        console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps for ${mode} ranked Hardpoint format hardpoint-4v4 (legacy)`);
        
        if (mapsTest.length < mapCount) {
          mapsTest = await GameMap.find({ 
            isActive: true,
            ladders: 'ranked',
            mode: { $in: [mode, 'both'] },
            rankedFormats: '4v4',
            gameModes: gameMode
          });
          console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps for ${mode} ranked Hardpoint format 4v4 (legacy)`);
        }
      } else {
        mapsTest = await GameMap.find({ 
          isActive: true,
          ladders: 'ranked',
          mode: { $in: [mode, 'both'] },
          rankedFormats: rankedFormatTest,
          ...(gameMode ? { gameModes: gameMode } : {})
        });
        console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps for ${mode} ranked ${gameMode || 'any'} format ${rankedFormatTest} (legacy)`);
      }
    }
    
    // Si pas assez de maps avec le format spécifique, essayer sans filtrer par rankedFormats
    if (mapsTest.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Not enough maps with format ${rankedFormatTest} (${mapsTest.length}/${mapCount}), trying without format filter`);
      mapsTest = await GameMap.find({ 
        isActive: true,
        ladders: 'ranked',
        mode: { $in: [mode, 'both'] },
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps without format filter`);
    }
    
    // Si pas assez de maps avec ladder 'ranked', chercher les maps avec ladder 'squad-team' (fallback)
    if (mapsTest.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Not enough ranked maps (${mapsTest.length}/${mapCount}), falling back to squad-team maps`);
      mapsTest = await GameMap.find({ 
        isActive: true,
        ladders: { $in: ['ranked', 'squad-team'] },
        mode: { $in: [mode, 'both'] },
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking Test] Found ${mapsTest.length} maps with fallback (ranked + squad-team)`);
    }
    
    // Si toujours pas assez, prendre toutes les maps actives avec le bon gameMode (sans filtrer par mode)
    let availableMaps = mapsTest;
    if (mapsTest.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Still not enough maps, falling back to all active maps with gameMode (no mode filter)`);
      availableMaps = await GameMap.find({ 
        isActive: true,
        ...(gameMode ? { gameModes: gameMode } : {})
      });
      console.log(`[Ranked Matchmaking Test] Found ${availableMaps.length} maps with second fallback (gameMode only)`);
    }
    
    // Dernier recours : toutes les maps actives
    if (availableMaps.length < mapCount) {
      console.log(`[Ranked Matchmaking Test] Last resort: all active maps`);
      availableMaps = await GameMap.find({ isActive: true });
      console.log(`[Ranked Matchmaking Test] Found ${availableMaps.length} active maps total`);
    }
    
    const selectedMaps = availableMaps.sort(() => Math.random() - 0.5).slice(0, mapCount).map((map, index) => ({
      name: map.name,
      image: map.image || null,
      order: index + 1,
      winner: null
    }));
    
    // Sélectionner 3 maps pour le vote (test match)
    let mapsForVoteTest = availableMaps
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(map => ({
        name: map.name,
        image: map.image || null,
        votes: 0,
        votedBy: []
      }));
    
    // Si pas de maps disponibles, créer des maps par défaut
    if (mapsForVoteTest.length === 0) {
      console.log(`[Ranked Matchmaking Test] No maps found, using default maps`);
      mapsForVoteTest = [
        { name: 'Raid', image: null, votes: 0, votedBy: [] },
        { name: 'Standoff', image: null, votes: 0, votedBy: [] },
        { name: 'Highrise', image: null, votes: 0, votedBy: [] }
      ];
    }
    
    console.log(`[Ranked Matchmaking Test] Maps for vote:`, mapsForVoteTest.map(m => m.name));
    
    // Créer les données des joueurs pour le match
    // MÉLANGE AUTOMATIQUE: Tous les joueurs sont assignés directement à leur équipe (comme en matchmaking normal)
    // - Team 1: staffPlayer + team1Players (sans le staff)
    // - Team 2: team2Players
    
    // Le référent de chaque équipe est:
    // - Team 1: Le staff (s'il n'est pas banni référent)
    // - Team 2: Un bot aléatoire (puisqu'il n'y a pas de vrais joueurs dans l'équipe 2)
    
    // Trouver où est le staff
    const staffInTeam1 = team1Players.some(p => !p.isFake);
    const staffInTeam2 = team2Players.some(p => !p.isFake);
    
    // Créer les joueurs de chaque équipe avec leur team assignée
    const matchPlayers = [
      ...team1Players.map((p, index) => {
        const isStaff = !p.isFake && p.userId?.toString() === userId.toString();
        const isTeam1Ref = isStaff && !isStaffReferentBanned;
        return {
          user: p.isFake ? null : p.userId,
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 1, // Tous les joueurs team1 sont dans l'équipe 1
          isReferent: isTeam1Ref || (!staffInTeam1 && index === 0),
          isFake: p.isFake,
          queueJoinedAt: p.joinedAt
        };
      }),
      ...team2Players.map((p, index) => {
        const isStaff = !p.isFake && p.userId?.toString() === userId.toString();
        const isTeam2Ref = isStaff && !isStaffReferentBanned;
        return {
          user: p.isFake ? null : p.userId,
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 2, // Tous les joueurs team2 sont dans l'équipe 2
          isReferent: isTeam2Ref || (!staffInTeam2 && index === 0),
          isFake: p.isFake,
          queueJoinedAt: p.joinedAt
        };
      })
    ];
    
    // Déterminer les référents (vrais joueurs si possible, sinon premier de l'équipe)
    const team1ReferentId = staffInTeam1 && !isStaffReferentBanned ? userId : null;
    const team2ReferentId = staffInTeam2 && !isStaffReferentBanned ? userId : null;
    
    // Créer le match SANS sélection de roster (mélange automatique comme en matchmaking normal)
    const match = await RankedMatch.create({
      gameMode,
      mode,
      teamSize: actualTeamSize, // Utiliser la taille d'équipe réelle
      players: matchPlayers,
      team1Referent: team1ReferentId,
      team2Referent: team2ReferentId,
      hostTeam,
      status: 'pending', // En attente du vote de map (plus de sélection de roster)
      maps: selectedMaps,
      mapVoteOptions: mapsForVoteTest,
      matchmakingStartedAt: new Date(),
      isTestMatch: true, // Flag pour identifier un match de test
      isSpecialTestMatch: isSpecialMode, // Flag pour Duel/Team Deathmatch (pas de roster selection, pas d'animation)
      rosterSelection: {
        isActive: false, // PAS DE SÉLECTION DE ROSTER - mélange automatique
        currentTurn: 1,
        turnStartedAt: null,
        pickOrder: [],
        totalPicks: 0,
        startedAt: null,
        completedAt: null
      }
    });
    
    // Populate pour envoyer au client
    await match.populate('players.user', 'username avatar discordId discordAvatar platform');
    if (team1ReferentId) await match.populate('team1Referent', 'username');
    if (team2ReferentId) await match.populate('team2Referent', 'username');
    
    console.log(`[Ranked Matchmaking] Staff test match created: ${match._id} (${actualTeamSize}v${actualTeamSize}) - ${isSpecialMode ? 'Mode spécial (pas de mélange)' : 'Mélange automatique activé'}`);
    
    // Ajouter un message système
    const formatLabel = gameMode === 'Team Deathmatch' ? 'Mêlée générale (8 joueurs)' : 
                       gameMode === 'Duel' ? 'Duel (2 joueurs)' : 
                       `${actualTeamSize}v${actualTeamSize}`;
    match.chat.push({
      isSystem: true,
      messageType: 'test_match_created',
      message: `⚡ Match de test ${formatLabel} créé ! Ce match n'affecte pas les statistiques.${isSpecialMode ? ' Pas de sélection de roster ni d\'animation de mélange.' : ''}`
    });
    await match.save();
    
    // Préparer les données des joueurs pour l'animation de shuffle (test match)
    // Tous les joueurs ont déjà leur équipe assignée
    const playersForAnimation = matchPlayers.map((p, index) => {
      const populatedPlayer = match.players.find(mp => mp.username === p.username);
      let avatar = null;
      if (populatedPlayer?.user?.discordId && populatedPlayer?.user?.discordAvatar) {
        avatar = `https://cdn.discordapp.com/avatars/${populatedPlayer.user.discordId}/${populatedPlayer.user.discordAvatar}.png`;
      } else if (populatedPlayer?.user?.avatar) {
        avatar = populatedPlayer.user.avatar;
      }
      
      return {
        id: p.user?.toString() || `fake-${index}`,
        username: p.username,
        avatar: avatar,
        team: p.team, // Équipe déjà assignée (1 ou 2)
        isReferent: p.isReferent,
        isHost: p.team === hostTeam && p.isReferent,
        isFake: p.isFake,
        points: p.points || 0 // Points classés pour afficher le rang
      };
    });
    
    // Trouver l'équipe du staff
    const staffInMatch = matchPlayers.find(p => p.user?.toString() === userId.toString());
    const staffTeamNum = staffInMatch?.team || 1;
    
    // Notifier le staff du match trouvé - SANS sélection de roster (mélange automatique)
    if (io) {
      const testMatchIdStr = match._id.toString();
      io.to(`user-${userId}`).emit('rankedMatchFound', {
        matchId: testMatchIdStr,
        gameMode,
        mode,
        format: `${actualTeamSize}v${actualTeamSize}`,
        teamSize: actualTeamSize,
        totalPlayers: totalPlayers, // Nombre total de joueurs
        yourTeam: staffTeamNum, // Équipe du staff (1 ou 2 selon le mélange)
        isReferent: staffInMatch?.isReferent || false,
        isHost: staffTeamNum === hostTeam && (staffInMatch?.isReferent || false),
        isTestMatch: true,
        isSpecialTestMatch: isSpecialMode, // Indicateur pour Duel/Team Deathmatch
        hasRosterSelection: false, // PAS de sélection de roster - mélange automatique
        players: playersForAnimation, // Tous les joueurs avec leur équipe assignée
        mapVoteOptions: mapsForVoteTest.map(m => ({ name: m.name, image: m.image, votes: 0 }))
      });
    }
    
    // Pour les modes spéciaux (Duel/Team Deathmatch), pas de sélection de roster
    // Pour Team Deathmatch, aller directement au vote de map
    // Pour Duel, démarrer le timer de vote de map normalement
    if (gameMode === 'Team Deathmatch') {
      // Team Deathmatch: aller directement au vote de map sans délai
      console.log(`[Ranked Matchmaking] Team Deathmatch: starting immediate map vote`);
      startMapVoteTimer(match._id, matchPlayers.filter(p => p.user));
    } else if (gameMode === 'Duel') {
      // Duel: pas de sélection de roster mais délai normal pour le vote
      console.log(`[Ranked Matchmaking] Duel: skipping roster selection, going to map vote`);
    } else if (!isSpecialMode) {
      // Modes normaux: démarrer le timer de vote de map
      startMapVoteTimer(match._id, matchPlayers.filter(p => p.user));
    }
    
    return {
      success: true,
      message: `Match de test ${formatLabel} créé avec succès !`,
      matchId: match._id,
      match
    };
    
  } catch (error) {
    console.error('[Ranked Matchmaking] Error starting staff test match:', error);
    return { success: false, message: 'Erreur lors de la création du match de test.' };
  }
};

// Stockage des timers de vote de map
const mapVoteTimers = {};

// Stockage des timers de sélection de roster
const rosterSelectionTimers = {};

// Durée du timer par tour de sélection (10 secondes)
const ROSTER_SELECTION_TURN_TIME = 10000;

/**
 * Timer pour le vote de map
 * Animation côté client: ~12 secondes (shuffle 2s + distributing 1.5s + teams ready 1.5s + countdown 5s + transition delays)
 * + 15 secondes de vote = 27 secondes total + 3s de marge = 30s
 */
const MAP_VOTE_TOTAL_TIME = 30000; // 30 secondes total (animation + vote + marge)

const startMapVoteTimer = (matchId, players) => {
  const matchIdStr = matchId.toString();
  
  // Annuler un timer existant si présent
  if (mapVoteTimers[matchIdStr]) {
    clearTimeout(mapVoteTimers[matchIdStr]);
  }
  
  console.log(`[Ranked Matchmaking] Starting map vote timer for match ${matchIdStr} (${MAP_VOTE_TOTAL_TIME/1000}s)`);
  
  mapVoteTimers[matchIdStr] = setTimeout(async () => {
    console.log(`[Ranked Matchmaking] Map vote timer expired for match ${matchIdStr}, finalizing...`);
    await finalizeMapVote(matchId);
    delete mapVoteTimers[matchIdStr];
  }, MAP_VOTE_TOTAL_TIME);
};

/**
 * Finalise le vote de map et sélectionne la map gagnante
 */
const finalizeMapVote = async (matchId) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match || match.selectedMap?.name) {
      console.log(`[Ranked Matchmaking] Map vote already finalized or match not found: ${matchId}`);
      return;
    }
    
    // Trouver la map avec le plus de votes
    let winningMap = match.mapVoteOptions[0]; // Par défaut, première map
    let maxVotes = 0;
    
    for (const mapOption of match.mapVoteOptions) {
      if (mapOption.votes > maxVotes) {
        maxVotes = mapOption.votes;
        winningMap = mapOption;
      }
    }
    
    // Si égalité ou pas de votes, choisir aléatoirement
    const mapsWithMaxVotes = match.mapVoteOptions.filter(m => m.votes === maxVotes);
    if (mapsWithMaxVotes.length > 1 || maxVotes === 0) {
      const randomIndex = Math.floor(Math.random() * (mapsWithMaxVotes.length > 0 ? mapsWithMaxVotes.length : match.mapVoteOptions.length));
      winningMap = mapsWithMaxVotes.length > 0 ? mapsWithMaxVotes[randomIndex] : match.mapVoteOptions[randomIndex];
    }
    
    // Mettre à jour le match avec la map sélectionnée
    match.selectedMap = {
      name: winningMap.name,
      image: winningMap.image,
      votes: winningMap.votes
    };
    match.status = 'ready';
    
    // Créer les salons vocaux Discord temporaires SEULEMENT s'ils n'existent pas déjà
    // (ils peuvent avoir été créés lors de completeRosterSelection pour les matchs de test)
    // Utiliser || pour être plus défensif: si UN SEUL canal existe, on ne recrée pas
    const hasExistingTeam1Channel = match.team1VoiceChannel && match.team1VoiceChannel.channelId;
    const hasExistingTeam2Channel = match.team2VoiceChannel && match.team2VoiceChannel.channelId;
    console.log(`[Ranked Matchmaking] Voice channel check for ${matchId}: team1=${hasExistingTeam1Channel ? match.team1VoiceChannel.channelId : 'none'}, team2=${hasExistingTeam2Channel ? match.team2VoiceChannel.channelId : 'none'}`);
    
    if (!hasExistingTeam1Channel && !hasExistingTeam2Channel) {
      try {
        // Peupler les joueurs pour obtenir leurs Discord IDs
        await match.populate('players.user', 'discordId username');
        
        // Extraire les Discord IDs par équipe
        const team1DiscordIds = match.players
          .filter(p => p.team === 1 && p.user?.discordId && !p.isFake)
          .map(p => p.user.discordId);
        const team2DiscordIds = match.players
          .filter(p => p.team === 2 && p.user?.discordId && !p.isFake)
          .map(p => p.user.discordId);
        
        console.log(`[Ranked Matchmaking] Creating voice channels with Discord IDs - Team1: ${team1DiscordIds.length}, Team2: ${team2DiscordIds.length}`);
        
        const voiceChannels = await createMatchVoiceChannels(matchId, team1DiscordIds, team2DiscordIds, mode);
        if (voiceChannels) {
          match.team1VoiceChannel = voiceChannels.team1;
          match.team2VoiceChannel = voiceChannels.team2;
          console.log(`[Ranked Matchmaking] ✓ Voice channels created for match ${matchId}:`, JSON.stringify(voiceChannels));
        } else {
          console.warn(`[Ranked Matchmaking] ⚠️ Voice channels NOT created for match ${matchId} - Discord bot may not be ready or configured`);
        }
      } catch (voiceError) {
        console.error(`[Ranked Matchmaking] ❌ Failed to create voice channels:`, voiceError.message);
      }
    } else {
      console.log(`[Ranked Matchmaking] Voice channels already exist for match ${matchId}, skipping duplicate creation`);
    }
    
    await match.save();
    
    console.log(`[Ranked Matchmaking] Map vote finalized for match ${matchId}: ${winningMap.name} (${winningMap.votes} votes)`);
    
    // Notifier tous les joueurs de la map sélectionnée
    if (io) {
      for (const player of match.players) {
        // Après populate, player.user peut être un objet ou un ID
        const playerId = player.user?._id || player.user;
        if (playerId) {
          io.to(`user-${playerId}`).emit('mapSelected', {
            matchId: match._id,
            selectedMap: {
              name: winningMap.name,
              image: winningMap.image,
              votes: winningMap.votes
            },
            // Inclure les infos des salons vocaux
            team1VoiceChannel: match.team1VoiceChannel,
            team2VoiceChannel: match.team2VoiceChannel
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`[Ranked Matchmaking] Error finalizing map vote for ${matchId}:`, error);
  }
};

/**
 * Gère un vote de map d'un joueur
 */
export const handleMapVote = async (userId, matchId, mapIndex) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return { success: false, message: 'Match non trouvé.' };
    }
    
    // Vérifier que le joueur fait partie du match
    const player = match.players.find(p => p.user?.toString() === userId.toString());
    if (!player) {
      return { success: false, message: 'Vous ne faites pas partie de ce match.' };
    }
    
    // Vérifier que l'index de map est valide
    if (mapIndex < 0 || mapIndex >= match.mapVoteOptions.length) {
      return { success: false, message: 'Index de map invalide.' };
    }
    
    // Vérifier si le vote est encore ouvert (pas de map sélectionnée)
    if (match.selectedMap?.name) {
      return { success: false, message: 'Le vote est terminé.' };
    }
    
    // Vérifier si le joueur a déjà voté
    const hasVoted = match.mapVoteOptions.some(m => m.votedBy.includes(userId));
    if (hasVoted) {
      // Retirer le vote précédent
      for (const mapOption of match.mapVoteOptions) {
        const voteIndex = mapOption.votedBy.indexOf(userId);
        if (voteIndex !== -1) {
          mapOption.votedBy.splice(voteIndex, 1);
          mapOption.votes = Math.max(0, mapOption.votes - 1);
          break;
        }
      }
    }
    
    // Ajouter le vote
    match.mapVoteOptions[mapIndex].votedBy.push(userId);
    match.mapVoteOptions[mapIndex].votes += 1;
    await match.save();
    
    console.log(`[Ranked Matchmaking] Player ${userId} voted for map ${match.mapVoteOptions[mapIndex].name} in match ${matchId}`);
    
    // Notifier tous les joueurs de la mise à jour des votes
    if (io) {
      for (const p of match.players) {
        if (p.user) {
          io.to(`user-${p.user}`).emit('mapVoteUpdate', {
            matchId: match._id,
            mapVoteOptions: match.mapVoteOptions.map(m => ({
              name: m.name,
              image: m.image,
              votes: m.votes
            }))
          });
        }
      }
    }
    
    return { success: true, message: 'Vote enregistré.' };
    
  } catch (error) {
    console.error('[Ranked Matchmaking] Error handling map vote:', error);
    return { success: false, message: 'Erreur lors du vote.' };
  }
};

/**
 * Démarre la phase de sélection de roster pour un match de test
 * Les référents choisissent à tour de rôle les joueurs
 */
const startRosterSelection = async (matchId) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      console.error(`[Roster Selection] Match not found: ${matchId}`);
      return;
    }
    
    console.log(`[Roster Selection] Starting roster selection for match ${matchId}`);
    
    // Initialiser la sélection de roster
    match.rosterSelection = {
      isActive: true,
      currentTurn: 1, // Team 1 commence
      turnStartedAt: new Date(),
      pickOrder: [],
      totalPicks: 0,
      startedAt: new Date(),
      completedAt: null
    };
    await match.save();
    
    // Notifier tous les joueurs du début de la sélection
    const availablePlayers = match.players.filter(p => p.team === null && !p.isFake && p.user);
    
    if (io) {
      for (const player of match.players) {
        if (player.user) {
          io.to(`user-${player.user}`).emit('rosterSelectionStart', {
            matchId: match._id,
            currentTurn: 1,
            team1Referent: match.team1Referent?.toString(),
            team2Referent: match.team2Referent?.toString(),
            availablePlayers: availablePlayers.map(p => ({
              id: p.user?.toString(),
              username: p.username,
              points: p.points,
              rank: p.rank
            })),
            timeRemaining: ROSTER_SELECTION_TURN_TIME / 1000,
            totalPlayersToSelect: match.players.filter(p => !p.isFake && p.user).length
          });
        }
      }
    }
    
    // Démarrer le timer pour le premier tour
    startRosterSelectionTurnTimer(matchId, 1);
    
  } catch (error) {
    console.error(`[Roster Selection] Error starting roster selection:`, error);
  }
};

/**
 * Démarre le timer pour un tour de sélection
 * Pour les matchs de test, l'équipe 2 (bot) pick automatiquement après 1.5s
 */
const startRosterSelectionTurnTimer = async (matchId, team) => {
  const matchIdStr = matchId.toString();
  
  // Annuler un timer existant si présent
  if (rosterSelectionTimers[matchIdStr]) {
    clearTimeout(rosterSelectionTimers[matchIdStr]);
  }
  
  // Pour les matchs de test, vérifier si c'est le tour du bot (équipe 2)
  const match = await RankedMatch.findById(matchId);
  const isTestMatch = match?.isTestMatch;
  const isBotTurn = isTestMatch && team === 2 && !match.team2Referent;
  
  // Délai court pour le bot (1.5s), normal pour le joueur (10s)
  const turnTime = isBotTurn ? 1500 : ROSTER_SELECTION_TURN_TIME;
  
  console.log(`[Roster Selection] Starting turn timer for match ${matchIdStr}, team ${team} (${turnTime/1000}s)${isBotTurn ? ' [BOT]' : ''}`);
  
  rosterSelectionTimers[matchIdStr] = setTimeout(async () => {
    console.log(`[Roster Selection] Turn timer expired for match ${matchIdStr}, picking random player for team ${team}${isBotTurn ? ' [BOT]' : ''}`);
    await forceRandomRosterPick(matchId, team);
    delete rosterSelectionTimers[matchIdStr];
  }, turnTime);
};

/**
 * Force une sélection aléatoire quand le timer expire
 */
const forceRandomRosterPick = async (matchId, team) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match || !match.rosterSelection?.isActive) {
      return;
    }
    
    // Trouver les joueurs disponibles (pas encore assignés à une équipe)
    // Exclure les deux référents de la liste
    const team1ReferentId = match.team1Referent?.toString();
    const team2ReferentId = match.team2Referent?.toString();
    const availablePlayers = match.players.filter(p => 
      p.team === null && 
      p.user?.toString() !== team1ReferentId &&
      p.user?.toString() !== team2ReferentId
    );
    
    if (availablePlayers.length === 0) {
      // Tous les joueurs sont assignés
      await completeRosterSelection(matchId);
      return;
    }
    
    // Choisir un joueur au hasard
    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];
    
    // Obtenir l'identifiant du joueur (userId pour vrais joueurs, username pour bots)
    const playerId = selectedPlayer.user?.toString() || selectedPlayer.username;
    
    console.log(`[Roster Selection] Random pick for team ${team}: ${selectedPlayer.username}`);
    
    // Effectuer le pick
    await processRosterPick(matchId, team, playerId, true);
    
  } catch (error) {
    console.error(`[Roster Selection] Error forcing random pick:`, error);
  }
};

/**
 * Traite la sélection d'un joueur par un référent
 */
const processRosterPick = async (matchId, team, playerId, isRandom = false) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match || !match.rosterSelection?.isActive) {
      return { success: false, message: 'Sélection de roster non active.' };
    }
    
    // Vérifier que c'est bien le tour de cette équipe
    if (match.rosterSelection.currentTurn !== team) {
      return { success: false, message: "Ce n'est pas votre tour." };
    }
    
    // Trouver le joueur sélectionné (par userId pour vrais joueurs, par username pour bots)
    let playerIndex = match.players.findIndex(p => p.user?.toString() === playerId);
    
    // Si pas trouvé par userId, chercher par username (pour les bots)
    if (playerIndex === -1) {
      playerIndex = match.players.findIndex(p => p.username === playerId && !p.user);
    }
    
    if (playerIndex === -1) {
      return { success: false, message: 'Joueur non trouvé.' };
    }
    
    const selectedPlayer = match.players[playerIndex];
    
    // Vérifier que le joueur n'est pas déjà assigné
    if (selectedPlayer.team !== null) {
      return { success: false, message: 'Ce joueur est déjà dans une équipe.' };
    }
    
    // Assigner le joueur à l'équipe
    match.players[playerIndex].team = team;
    
    // Enregistrer le pick
    match.rosterSelection.pickOrder.push({
      team,
      playerId: selectedPlayer.user,
      username: selectedPlayer.username,
      pickedAt: new Date()
    });
    match.rosterSelection.totalPicks += 1;
    
    // Vérifier combien de joueurs restent à assigner (exclure les deux référents)
    const team1ReferentId = match.team1Referent?.toString();
    const team2ReferentId = match.team2Referent?.toString();
    const remainingPlayers = match.players.filter(p => 
      p.team === null && 
      p.user?.toString() !== team1ReferentId &&
      p.user?.toString() !== team2ReferentId
    );
    const allPlayersAssigned = remainingPlayers.length === 0;
    
    if (allPlayersAssigned) {
      // Tous les joueurs sont assignés, terminer la sélection
      await match.save();
      await completeRosterSelection(matchId);
      return { success: true };
    }
    
    // Passer au tour suivant (alterner entre les équipes)
    const nextTurn = team === 1 ? 2 : 1;
    match.rosterSelection.currentTurn = nextTurn;
    match.rosterSelection.turnStartedAt = new Date();
    
    await match.save();
    
    // Notifier tous les joueurs de la mise à jour
    // Peupler le match pour avoir les avatars
    await match.populate('players.user', 'username avatar discordId discordAvatar');
    
    // Fonction helper pour obtenir l'avatar d'un joueur
    const getPlayerAvatar = (player) => {
      if (player.user?.discordId && player.user?.discordAvatar) {
        return `https://cdn.discordapp.com/avatars/${player.user.discordId}/${player.user.discordAvatar}.png`;
      } else if (player.user?.avatar) {
        return player.user.avatar;
      }
      return null;
    };
    
    if (io) {
      console.log(`[Roster Selection] Emitting rosterSelectionUpdate to all players...`);
      
      const matchIdStr = match._id.toString();
      const team1RefId = match.team1Referent?.toString() || null;
      const team2RefId = match.team2Referent?.toString() || null;
      
      // Préparer les données communes
      const baseUpdateData = {
        matchId: matchIdStr,
        team1Referent: team1RefId,
        team2Referent: team2RefId,
        pickedPlayer: {
          id: selectedPlayer.user?.toString(),
          username: selectedPlayer.username,
          team: team
        },
        isRandom,
        currentTurn: nextTurn,
        availablePlayers: remainingPlayers
          .map(p => {
            const populatedPlayer = match.players.find(mp => mp.username === p.username);
            return {
              id: p.user?.toString() || p.username,
              username: p.username,
              points: p.points,
              rank: p.rank,
              isFake: p.isFake,
              avatar: populatedPlayer ? getPlayerAvatar(populatedPlayer) : null
            };
          }),
        team1Players: match.players.filter(p => p.team === 1).map(p => ({
          id: p.user?._id?.toString() || p.user?.toString(),
          username: p.username,
          points: p.points,
          rank: p.rank,
          isFake: p.isFake,
          avatar: getPlayerAvatar(p)
        })),
        team2Players: match.players.filter(p => p.team === 2).map(p => ({
          id: p.user?._id?.toString() || p.user?.toString(),
          username: p.username,
          points: p.points,
          rank: p.rank,
          isFake: p.isFake,
          avatar: getPlayerAvatar(p)
        })),
        timeRemaining: ROSTER_SELECTION_TURN_TIME / 1000,
        totalPicks: match.rosterSelection.totalPicks
      };
      
      // Émettre INDIVIDUELLEMENT à chaque joueur avec son flag isYourTurn personnalisé
      for (const player of match.players) {
        if (player.user) {
          const playerId = player.user._id?.toString() || player.user.toString();
          
          // Calculer si c'est le tour de ce joueur
          const isTeam1Referent = playerId === team1RefId;
          const isTeam2Referent = playerId === team2RefId;
          const isYourTurn = (nextTurn === 1 && isTeam1Referent) || (nextTurn === 2 && isTeam2Referent);
          
          // Créer les données personnalisées pour ce joueur
          const playerUpdateData = {
            ...baseUpdateData,
            isYourTurn, // Flag personnalisé calculé côté serveur
            isTeam1Referent,
            isTeam2Referent
          };
          
          console.log(`[Roster Selection] Emitting to user-${playerId} (${player.username}), isYourTurn: ${isYourTurn}, nextTurn: ${nextTurn}`);
          io.to(`user-${playerId}`).emit('rosterSelectionUpdate', playerUpdateData);
        }
      }
      
      console.log(`[Roster Selection] Finished emitting to all players, availablePlayers: ${baseUpdateData.availablePlayers.length}, team1: ${baseUpdateData.team1Players.length}, team2: ${baseUpdateData.team2Players.length}`);
    }
    
    // Démarrer le timer pour le prochain tour
    startRosterSelectionTurnTimer(matchId, nextTurn);
    
    return { success: true };
    
  } catch (error) {
    console.error(`[Roster Selection] Error processing pick:`, error);
    return { success: false, message: 'Erreur lors de la sélection.' };
  }
};

/**
 * Termine la sélection de roster et passe au vote de map
 */
const completeRosterSelection = async (matchId) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match) return;
    
    console.log(`[Roster Selection] Completing roster selection for match ${matchId}`);
    
    // Annuler le timer s'il existe encore
    const matchIdStr = matchId.toString();
    if (rosterSelectionTimers[matchIdStr]) {
      clearTimeout(rosterSelectionTimers[matchIdStr]);
      delete rosterSelectionTimers[matchIdStr];
    }
    
    // Marquer la sélection comme terminée
    match.rosterSelection.isActive = false;
    match.rosterSelection.completedAt = new Date();
    
    // Déterminer les référents (premier joueur de chaque équipe)
    const team1Players = match.players.filter(p => p.team === 1 && !p.isFake && p.user);
    const team2Players = match.players.filter(p => p.team === 2 && !p.isFake && p.user);
    
    // Mettre à jour isReferent pour le premier joueur de chaque équipe
    if (team1Players.length > 0) {
      const team1ReferentIndex = match.players.findIndex(p => p.user?.toString() === team1Players[0].user?.toString());
      if (team1ReferentIndex !== -1) {
        match.players[team1ReferentIndex].isReferent = true;
        match.team1Referent = team1Players[0].user;
      }
    }
    
    if (team2Players.length > 0) {
      const team2ReferentIndex = match.players.findIndex(p => p.user?.toString() === team2Players[0].user?.toString());
      if (team2ReferentIndex !== -1) {
        match.players[team2ReferentIndex].isReferent = true;
        match.team2Referent = team2Players[0].user;
      }
    }
    
    // Créer les salons vocaux Discord AVANT le vote de map
    try {
      await match.populate('players.user', 'discordId username');
      
      const team1DiscordIds = match.players
        .filter(p => p.team === 1 && p.user?.discordId && !p.isFake)
        .map(p => p.user.discordId);
      const team2DiscordIds = match.players
        .filter(p => p.team === 2 && p.user?.discordId && !p.isFake)
        .map(p => p.user.discordId);
      
      console.log(`[Roster Selection] Creating voice channels - Team1: ${team1DiscordIds.length}, Team2: ${team2DiscordIds.length}`);
      
      const voiceChannels = await createMatchVoiceChannels(matchId, team1DiscordIds, team2DiscordIds, mode);
      if (voiceChannels) {
        match.team1VoiceChannel = voiceChannels.team1;
        match.team2VoiceChannel = voiceChannels.team2;
        console.log(`[Roster Selection] ✓ Voice channels created for match ${matchId}:`, JSON.stringify(voiceChannels));
      } else {
        console.warn(`[Roster Selection] ⚠️ Voice channels NOT created for match ${matchId}`);
      }
    } catch (voiceError) {
      console.error(`[Roster Selection] ❌ Failed to create voice channels:`, voiceError.message);
    }
    
    await match.save();
    
    // Notifier tous les joueurs que la sélection est terminée (avec les salons vocaux)
    if (io) {
      for (const player of match.players) {
        if (player.user) {
          // L'équipe du joueur est directement sur l'objet player
          const playerTeam = player.team;
          const playerId = player.user._id || player.user;
          
          console.log(`[Roster Selection] Sending rosterSelectionComplete to player ${player.username}, team: ${playerTeam}`);
          
          io.to(`user-${playerId}`).emit('rosterSelectionComplete', {
            matchId: match._id,
            team1Players: match.players.filter(p => p.team === 1).map(p => ({
              id: p.user?.toString(),
              username: p.username,
              points: p.points,
              rank: p.rank,
              isReferent: p.isReferent,
              isFake: p.isFake
            })),
            team2Players: match.players.filter(p => p.team === 2).map(p => ({
              id: p.user?.toString(),
              username: p.username,
              points: p.points,
              rank: p.rank,
              isReferent: p.isReferent,
              isFake: p.isFake
            })),
            mapVoteOptions: match.mapVoteOptions.map(m => ({ name: m.name, image: m.image, votes: 0 })),
            // Envoyer les salons vocaux
            team1VoiceChannel: match.team1VoiceChannel,
            team2VoiceChannel: match.team2VoiceChannel,
            yourTeam: playerTeam
          });
        }
      }
    }
    
    // Démarrer le timer de vote de map
    console.log(`[Roster Selection] Starting map vote timer for match ${matchId}`);
    startMapVoteTimer(matchId, match.players.filter(p => p.user));
    
  } catch (error) {
    console.error(`[Roster Selection] Error completing roster selection:`, error);
  }
};

/**
 * Gère la sélection d'un joueur par un référent (depuis socket)
 */
export const handleRosterPick = async (userId, matchId, playerId) => {
  try {
    const match = await RankedMatch.findById(matchId);
    if (!match) {
      return { success: false, message: 'Match non trouvé.' };
    }
    
    if (!match.rosterSelection?.isActive) {
      return { success: false, message: 'Sélection de roster non active.' };
    }
    
    // Vérifier que l'utilisateur est bien un référent
    const isTeam1Referent = match.team1Referent?.toString() === userId.toString();
    const isTeam2Referent = match.team2Referent?.toString() === userId.toString();
    
    if (!isTeam1Referent && !isTeam2Referent) {
      return { success: false, message: "Vous n'êtes pas référent." };
    }
    
    // Pour les matchs de test, le staff peut être référent des deux équipes
    // On utilise le tour actuel pour déterminer quelle équipe pick
    const currentTurn = match.rosterSelection.currentTurn;
    
    // Vérifier que l'utilisateur peut picker pour cette équipe
    const canPickForCurrentTeam = (currentTurn === 1 && isTeam1Referent) || (currentTurn === 2 && isTeam2Referent);
    if (!canPickForCurrentTeam) {
      return { success: false, message: "Ce n'est pas votre tour." };
    }
    
    // Annuler le timer actuel
    const matchIdStr = matchId.toString();
    if (rosterSelectionTimers[matchIdStr]) {
      clearTimeout(rosterSelectionTimers[matchIdStr]);
      delete rosterSelectionTimers[matchIdStr];
    }
    
    // Traiter le pick avec l'équipe du tour actuel
    return await processRosterPick(matchId, currentTurn, playerId, false);
    
  } catch (error) {
    console.error('[Roster Selection] Error handling roster pick:', error);
    return { success: false, message: 'Erreur lors de la sélection.' };
  }
};

// ==================== STAFF TEST QUEUE ====================

// File d'attente de test staff séparée
// Structure: { 'Search & Destroy_hardcore_staff': [{ userId, username, rank, points, platform, joinedAt, isFake }] }
const staffQueues = {};
const staffQueueTimers = {};

/**
 * Génère la clé pour la file staff
 */
const getStaffQueueKey = (gameMode, mode) => `${gameMode}_${mode}_staff`;

/**
 * Obtient la file d'attente staff pour un mode
 */
const getStaffQueue = (gameMode, mode) => {
  const key = getStaffQueueKey(gameMode, mode);
  if (!staffQueues[key]) {
    staffQueues[key] = [];
  }
  return staffQueues[key];
};

/**
 * Rejoint la file d'attente staff (admin uniquement)
 */
export const joinStaffQueue = async (userId, gameMode, mode) => {
  try {
    const user = await User.findById(userId).select('username platform roles');
    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé.' };
    }
    
    // Vérifier que c'est un admin
    const isAdmin = user.roles?.includes('admin');
    if (!isAdmin) {
      return { success: false, message: 'Accès réservé aux administrateurs.' };
    }
    
    const queue = getStaffQueue(gameMode, mode);
    
    // Vérifier si déjà dans la file staff
    if (queue.some(p => p.userId?.toString() === userId.toString())) {
      return { success: false, message: 'Vous êtes déjà dans la file staff.' };
    }
    
    // Vérifier si pas déjà dans un match actif
    const activeMatch = await RankedMatch.findOne({
      'players.user': userId,
      status: { $in: ['pending', 'ready', 'in_progress'] }
    });
    
    if (activeMatch) {
      return { 
        success: false, 
        message: 'Vous avez déjà un match en cours.',
        activeMatchId: activeMatch._id
      };
    }
    
    // Récupérer ou créer le ranking
    let ranking = await Ranking.findOne({ user: userId, mode });
    if (!ranking) {
      ranking = await Ranking.create({
        user: userId,
        mode,
        points: 0,
        wins: 0,
        losses: 0,
        rank: 1
      });
    }
    
    // Ajouter le joueur à la file staff
    const playerData = {
      userId: userId,
      username: user.username,
      rank: await getRankFromPoints(ranking.points),
      points: ranking.points,
      platform: user.platform || 'PC',
      joinedAt: new Date(),
      isFake: false
    };
    
    queue.push(playerData);
    console.log(`[Staff Queue] ${user.username} joined ${gameMode} ${mode} staff queue. Queue size: ${queue.length}`);
    
    // Broadcast staff queue update
    broadcastStaffQueueUpdate(gameMode, mode);
    
    // Vérifier si on peut démarrer le matchmaking
    checkStaffMatchmakingStart(gameMode, mode);
    
    return { 
      success: true, 
      message: 'Vous avez rejoint la file staff.',
      queueSize: queue.length,
      position: queue.length
    };
  } catch (error) {
    console.error('[Staff Queue] Join error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Quitte la file d'attente staff
 */
export const leaveStaffQueue = async (userId, gameMode, mode) => {
  try {
    const queue = getStaffQueue(gameMode, mode);
    const playerIndex = queue.findIndex(p => p.userId?.toString() === userId.toString());
    
    if (playerIndex === -1) {
      return { success: false, message: 'Vous n\'êtes pas dans la file staff.' };
    }
    
    queue.splice(playerIndex, 1);
    console.log(`[Staff Queue] Player left ${gameMode} ${mode} staff queue. Queue size: ${queue.length}`);
    
    // Vérifier si on doit annuler le timer
    const timerKey = getStaffQueueKey(gameMode, mode);
    if (queue.length < 8 && staffQueueTimers[timerKey]) {
      clearTimeout(staffQueueTimers[timerKey].timer);
      delete staffQueueTimers[timerKey];
      console.log(`[Staff Queue] Timer cancelled for ${gameMode} ${mode}`);
    }
    
    // Broadcast update
    broadcastStaffQueueUpdate(gameMode, mode);
    
    return { success: true, message: 'Vous avez quitté la file staff.' };
  } catch (error) {
    console.error('[Staff Queue] Leave error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Obtient le statut de la file staff
 */
export const getStaffQueueStatus = async (userId, gameMode, mode) => {
  try {
    const queue = getStaffQueue(gameMode, mode);
    const timerKey = getStaffQueueKey(gameMode, mode);
    const timerInfo = staffQueueTimers[timerKey];
    const playerInQueue = queue.find(p => p.userId?.toString() === userId.toString());
    
    return {
      success: true,
      inQueue: !!playerInQueue,
      queueSize: queue.length,
      position: playerInQueue ? queue.findIndex(p => p.userId?.toString() === userId.toString()) + 1 : null,
      timerActive: !!timerInfo,
      timerEndTime: timerInfo?.endTime || null,
      players: queue.map(p => ({
        username: p.username,
        rank: p.rank,
        isFake: p.isFake
      }))
    };
  } catch (error) {
    console.error('[Staff Queue] Get status error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Ajoute des bots à la file staff
 */
export const addBotsToStaffQueue = async (gameMode, mode, count = 1) => {
  try {
    const queue = getStaffQueue(gameMode, mode);
    
    const botNames = [
      'Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 
      'Bot_Echo', 'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel', 
      'Bot_India', 'Bot_Juliet', 'Bot_Kilo', 'Bot_Lima'
    ];
    const botRanks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    
    let addedCount = 0;
    for (let i = 0; i < count && queue.length < 10; i++) {
      const botId = `bot-staff-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`;
      const randomPoints = Math.floor(Math.random() * 2000);
      
      const botData = {
        userId: botId,
        username: botNames[queue.length % botNames.length] + '_' + Math.floor(Math.random() * 1000),
        rank: botRanks[Math.floor(Math.random() * botRanks.length)],
        points: randomPoints,
        platform: 'PC',
        joinedAt: new Date(),
        isFake: true
      };
      
      queue.push(botData);
      addedCount++;
      console.log(`[Staff Queue] Added bot: ${botData.username}`);
    }
    
    // Broadcast update
    broadcastStaffQueueUpdate(gameMode, mode);
    
    // Vérifier si on peut démarrer le matchmaking
    checkStaffMatchmakingStart(gameMode, mode);
    
    return {
      success: true,
      message: `${addedCount} bot(s) ajouté(s).`,
      queueSize: queue.length,
      addedCount
    };
  } catch (error) {
    console.error('[Staff Queue] Add bots error:', error);
    return { success: false, message: 'Erreur lors de l\'ajout des bots.' };
  }
};

/**
 * Supprime tous les bots de la file staff
 */
export const clearStaffQueueBots = async (gameMode, mode) => {
  try {
    const key = getStaffQueueKey(gameMode, mode);
    const queue = getStaffQueue(gameMode, mode);
    const originalLength = queue.length;
    
    staffQueues[key] = queue.filter(p => !p.isFake);
    
    const newQueue = getStaffQueue(gameMode, mode);
    const removedCount = originalLength - newQueue.length;
    
    console.log(`[Staff Queue] Removed ${removedCount} bots from ${gameMode} ${mode}`);
    
    // Broadcast update
    broadcastStaffQueueUpdate(gameMode, mode);
    
    return {
      success: true,
      message: `${removedCount} bot(s) supprimé(s).`,
      queueSize: newQueue.length,
      removedCount
    };
  } catch (error) {
    console.error('[Staff Queue] Clear bots error:', error);
    return { success: false, message: 'Erreur lors de la suppression des bots.' };
  }
};

/**
 * Broadcast la mise à jour de la file staff
 */
const broadcastStaffQueueUpdate = (gameMode, mode) => {
  if (!io) return;
  
  const queue = getStaffQueue(gameMode, mode);
  const timerKey = getStaffQueueKey(gameMode, mode);
  const timerInfo = staffQueueTimers[timerKey];
  
  // Envoyer à tous les joueurs dans la file staff
  for (let i = 0; i < queue.length; i++) {
    const player = queue[i];
    if (!player.isFake) {
      io.to(`user-${player.userId}`).emit('staffQueueUpdate', {
        type: 'queue_status',
        queueSize: queue.length,
        position: i + 1,
        timerActive: !!timerInfo,
        timerEndTime: timerInfo?.endTime || null,
        players: queue.map(p => ({
          username: p.username,
          rank: p.rank,
          isFake: p.isFake
        }))
      });
    }
  }
};

/**
 * Vérifie si on peut démarrer le matchmaking staff
 * CDL: Match immédiat dès 8 joueurs (4v4 uniquement)
 * Hardcore: Timer 2 min à 8 joueurs, match immédiat à 10 joueurs (5v5)
 */
const checkStaffMatchmakingStart = async (gameMode, mode) => {
  const queue = getStaffQueue(gameMode, mode);
  const timerKey = getStaffQueueKey(gameMode, mode);
  
  // CDL: uniquement 4v4 (8 joueurs max), Hardcore: jusqu'à 5v5 (10 joueurs max)
  const maxPlayers = mode === 'cdl' ? 8 : 10;
  const minPlayers = 8;
  
  // CDL: Match immédiat dès qu'on a 8 joueurs (pas de timer)
  if (mode === 'cdl' && queue.length >= minPlayers) {
    console.log(`[Staff Queue] CDL mode: ${queue.length} players reached for ${gameMode}, creating 4v4 match immediately`);
    if (staffQueueTimers[timerKey]) {
      clearTimeout(staffQueueTimers[timerKey].timer);
      delete staffQueueTimers[timerKey];
    }
    await createStaffMatchFromQueue(gameMode, mode);
    return;
  }
  
  // Hardcore: Si on a atteint le max de joueurs (10), match immédiat en 5v5
  if (mode === 'hardcore' && queue.length >= maxPlayers) {
    console.log(`[Staff Queue] Hardcore mode: ${maxPlayers} players reached for ${gameMode}, creating 5v5 match now`);
    if (staffQueueTimers[timerKey]) {
      clearTimeout(staffQueueTimers[timerKey].timer);
      delete staffQueueTimers[timerKey];
    }
    await createStaffMatchFromQueue(gameMode, mode);
    return;
  }
  
  // Hardcore: Si on a 8+ joueurs, démarrer le timer (2 min)
  if (mode === 'hardcore' && queue.length >= minPlayers && !staffQueueTimers[timerKey]) {
    const endTime = Date.now() + (MATCHMAKING_TIMER_SECONDS * 1000);
    
    console.log(`[Staff Queue] Starting ${MATCHMAKING_TIMER_SECONDS}s timer for ${gameMode} ${mode}`);
    
    const timer = setTimeout(async () => {
      await createStaffMatchFromQueue(gameMode, mode);
    }, MATCHMAKING_TIMER_SECONDS * 1000);
    
    staffQueueTimers[timerKey] = { timer, endTime };
    
    // Broadcast update
    broadcastStaffQueueUpdate(gameMode, mode);
  }
};

/**
 * Crée un match à partir de la file staff
 */
const createStaffMatchFromQueue = async (gameMode, mode) => {
  const key = getStaffQueueKey(gameMode, mode);
  const queue = getStaffQueue(gameMode, mode);
  
  // Supprimer le timer
  delete staffQueueTimers[key];
  
  if (queue.length < 8) {
    return { success: false, message: `Pas assez de joueurs (${queue.length}/8 minimum).` };
  }
  
  // Trier par date d'arrivée
  const sortedQueue = [...queue].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  
  // Déterminer le nombre de joueurs (pair)
  let playerCount = sortedQueue.length;
  if (playerCount % 2 !== 0) {
    sortedQueue.pop();
    playerCount--;
  }
  
  // CDL: Max 8 joueurs (4v4), Hardcore: Max 10 joueurs (5v5)
  const maxPlayers = mode === 'cdl' ? 8 : 10;
  if (playerCount > maxPlayers) {
    sortedQueue.splice(maxPlayers);
    playerCount = maxPlayers;
  }
  
  const playersForMatch = sortedQueue.slice(0, playerCount);
  const teamSize = playerCount / 2;
  const format = teamSize === 5 ? '5v5' : '4v4';
  
  // Vider la file staff
  staffQueues[key] = [];
  
  console.log(`[Staff Queue] Creating ${format} staff test match with ${playerCount} players`);
  
  try {
    // Mélanger les joueurs
    const shuffledPlayers = fisherYatesShuffle([...playersForMatch]);
    
    // Diviser en 2 équipes
    const team1Players = shuffledPlayers.slice(0, teamSize);
    const team2Players = shuffledPlayers.slice(teamSize);
    
    // Trouver les référents (préférer les vrais joueurs)
    const team1Referent = team1Players.find(p => !p.isFake) || team1Players[0];
    const team2Referent = team2Players.find(p => !p.isFake) || team2Players[0];
    
    // Récupérer les maps
    const configPath = mode === 'hardcore' ? 'hardcoreConfig' : 'cdlConfig';
    
    let maps = await GameMap.find({ 
      isActive: true,
      [`${configPath}.ranked.enabled`]: true,
      [`${configPath}.ranked.gameModes`]: gameMode
    });
    
    // Fallback: toutes les maps actives si pas assez de maps configurées
    if (maps.length < 3) {
      maps = await GameMap.find({ isActive: true });
    }
    
    // Toujours 3 maps pour le vote (comme le mode normal)
    const shuffledMaps = fisherYatesShuffle([...maps]);
    const selectedMaps = shuffledMaps.slice(0, 3);
    const mapVoteOptions = selectedMaps.map(m => ({
      name: m.name,
      image: m.image,
      votes: 0,
      votedBy: []
    }));
    
    // Fallback si aucune map
    if (mapVoteOptions.length === 0) {
      mapVoteOptions.push({
        name: 'Default Map',
        image: null,
        votes: 0,
        votedBy: []
      });
    }
    
    // Créer les joueurs pour le match
    const matchPlayers = [];
    const hostTeam = 1; // Équipe 1 est toujours hôte pour les matchs de test
    
    for (const player of team1Players) {
      const isReferent = player.userId === team1Referent.userId;
      matchPlayers.push({
        user: player.isFake ? null : player.userId,
        username: player.username,
        team: 1,
        points: player.points,
        rank: player.rank,
        platform: player.platform,
        isFake: player.isFake,
        isReferent
      });
    }
    
    for (const player of team2Players) {
      const isReferent = player.userId === team2Referent.userId;
      matchPlayers.push({
        user: player.isFake ? null : player.userId,
        username: player.username,
        team: 2,
        points: player.points,
        rank: player.rank,
        platform: player.platform,
        isFake: player.isFake,
        isReferent
      });
    }
    
    // Créer le match
    const newMatch = new RankedMatch({
      gameMode,
      mode,
      teamSize, // 4 ou 5
      players: matchPlayers,
      team1Referent: team1Referent.isFake ? null : team1Referent.userId,
      team2Referent: team2Referent.isFake ? null : team2Referent.userId,
      hostTeam: 1,
      mapVoteOptions,
      status: 'pending',
      isTestMatch: true
    });
    
    await newMatch.save();
    console.log(`[Staff Queue] Match created: ${newMatch._id}`);
    
    // Préparer les données des joueurs pour l'animation (format identique au mode normal)
    const playersForAnimation = matchPlayers.map((p, index) => ({
      id: p.user?.toString() || `fake-${index}`,
      username: p.username,
      avatar: null, // Les bots n'ont pas d'avatar
      team: p.team,
      isReferent: p.isReferent,
      isHost: p.team === hostTeam && p.isReferent,
      isFake: p.isFake,
      points: p.points || 0
    }));
    
    const matchIdStr = newMatch._id.toString();
    
    // Notifier les joueurs (identique au mode normal)
    const realPlayers = playersForMatch.filter(p => !p.isFake);
    
    for (const player of realPlayers) {
      if (io) {
        // Trouver le joueur dans matchPlayers pour obtenir son équipe
        const matchPlayer = matchPlayers.find(mp => mp.user?.toString() === player.userId?.toString());
        const playerTeam = matchPlayer?.team || 1;
        const isReferent = matchPlayer?.isReferent || false;
        const isHost = playerTeam === hostTeam && isReferent;
        
        io.to(`user-${player.userId}`).emit('rankedMatchFound', {
          matchId: matchIdStr,
          gameMode,
          mode,
          format,
          teamSize,
          yourTeam: playerTeam,
          isReferent,
          isHost,
          isTestMatch: true,
          hasRosterSelection: false,
          players: playersForAnimation,
          mapVoteOptions
        });
      }
    }
    
    // Démarrer le timer de vote de map (utiliser startMapVoteTimer comme le mode normal)
    startMapVoteTimer(newMatch._id, matchPlayers.filter(p => p.user));
    
    // Broadcast queue update (queue is now empty)
    broadcastStaffQueueUpdate(gameMode, mode);
    
    return { success: true, matchId: newMatch._id };
  } catch (error) {
    console.error('[Staff Queue] Error creating match:', error);
    return { success: false, message: 'Erreur lors de la création du match.' };
  }
};

/**
 * Force le démarrage d'un match staff (admin)
 */
export const forceStartStaffMatch = async (gameMode, mode) => {
  const timerKey = getStaffQueueKey(gameMode, mode);
  if (staffQueueTimers[timerKey]) {
    clearTimeout(staffQueueTimers[timerKey].timer);
    delete staffQueueTimers[timerKey];
  }
  return await createStaffMatchFromQueue(gameMode, mode);
};

export default {
  initMatchmaking,
  joinQueue,
  leaveQueue,
  getQueueStatus,
  getAllQueues,
  forceCreateMatch,
  addFakePlayers,
  removeFakePlayers,
  startStaffTestMatch,
  handleMapVote,
  handleRosterPick,
  // Staff test queue
  joinStaffQueue,
  leaveStaffQueue,
  getStaffQueueStatus,
  addBotsToStaffQueue,
  clearStaffQueueBots,
  forceStartStaffMatch
};

