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

// Files d'attente par mode de jeu et mode (hardcore/cdl) - UNE SEULE FILE PAR MODE
// Structure: { 'Search & Destroy_hardcore': [{ userId, username, rank, points, platform, joinedAt }] }
const queues = {};

// Configuration des seuils de joueurs pour S&D (format dynamique)
// Le format est déterminé par le nombre de joueurs dans la file
// Minimum 8 joueurs pour un 4v4
const PLAYER_THRESHOLDS = [
  { players: 8, format: '4v4', teamSize: 4 },
  { players: 10, format: '5v5', teamSize: 5 }
];

// Timer de 120 secondes (2 minutes) pour lancer le match
const MATCHMAKING_TIMER_SECONDS = 120;

// Timers actifs pour chaque file d'attente
const queueTimers = {};

// Socket.io instance (set from index.js)
let io = null;

/**
 * Initialise le service avec Socket.io
 */
export const initMatchmaking = (socketIo) => {
  io = socketIo;
  console.log('[Ranked Matchmaking] Service initialized');
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
 * Détermine le format optimal basé sur le nombre de joueurs
 */
const getOptimalFormat = (playerCount) => {
  // Trouver le plus grand format possible avec le nombre de joueurs
  for (let i = PLAYER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (playerCount >= PLAYER_THRESHOLDS[i].players) {
      return PLAYER_THRESHOLDS[i];
    }
  }
  return null; // Pas assez de joueurs
};

/**
 * Détermine le prochain seuil de joueurs
 */
const getNextThreshold = (currentCount) => {
  for (const threshold of PLAYER_THRESHOLDS) {
    if (currentCount < threshold.players) {
      return threshold;
    }
  }
  return PLAYER_THRESHOLDS[PLAYER_THRESHOLDS.length - 1]; // Max atteint
};

/**
 * Calcule le rang à partir des points
 */
const getRankFromPoints = (points) => {
  if (points >= 3500) return 'Champion';
  if (points >= 3000) return 'Grandmaster';
  if (points >= 2500) return 'Master';
  if (points >= 2000) return 'Diamond';
  if (points >= 1500) return 'Platinum';
  if (points >= 1000) return 'Gold';
  if (points >= 500) return 'Silver';
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
    
    // Définir les settings par défaut si rankedSettings n'existe pas
    const defaultSettings = {
      searchAndDestroy: {
        enabled: true,
        rewards: { pointsWin: 25, pointsLose: -15, goldWin: 50 },
        matchmaking: { minPlayers: 8, maxPlayers: 10, waitTimer: 120 }
      }
    };
    
    const rankedSettings = settings.rankedSettings || defaultSettings;
    const gameModeKey = gameMode.replace(/\s+/g, '').replace('&', 'And').toLowerCase();
    const gameModeSettings = rankedSettings[
      gameModeKey === 'searchanddestroy' ? 'searchAndDestroy' : gameModeKey
    ] || (gameModeKey === 'searchanddestroy' ? defaultSettings.searchAndDestroy : null);
    
    // Pour S&D, on autorise par défaut si pas de config
    if (!gameModeSettings) {
      return { success: false, message: 'Ce mode de jeu n\'est pas disponible actuellement.' };
    }
    
    if (gameModeSettings.enabled === false) {
      return { success: false, message: 'Ce mode de jeu est temporairement désactivé.' };
    }
    
    // Récupérer l'utilisateur
    const user = await User.findById(userId).select('username platform');
    if (!user) {
      return { success: false, message: 'Utilisateur non trouvé.' };
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
    
    // Ajouter le joueur à la file
    const playerData = {
      userId: userId,
      username: user.username,
      rank: getRankFromPoints(ranking.points),
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
    
    // Déterminer le format actuel basé sur le nombre de joueurs
    const optimalFormat = getOptimalFormat(queue.length);
    const nextThreshold = getNextThreshold(queue.length);
    
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
      maxPlayers: 10
    };
  } catch (error) {
    console.error('[Ranked Matchmaking] Get queue status error:', error);
    return { success: false, message: 'Erreur serveur.' };
  }
};

/**
 * Vérifie si on peut démarrer le matchmaking (timer de 2 min)
 * Logique: À 8 joueurs, on lance un timer de 2 min pour un 4v4
 * Si 10 joueurs, match immédiat en 5v5
 */
const checkMatchmakingStart = async (gameMode, mode) => {
  const queue = getQueue(gameMode, mode);
  const timerKey = getQueueKey(gameMode, mode);
  
  // Si 10 joueurs ou plus, match immédiat en 5v5
  if (queue.length >= 10) {
    console.log(`[Ranked Matchmaking] 10 players reached for ${gameMode} ${mode}, creating 5v5 match now`);
    cancelMatchmakingTimer(gameMode, mode);
    createMatchFromQueue(gameMode, mode);
    return;
  }
  
  // Trouver le format optimal pour le nombre actuel de joueurs
  const optimalFormat = getOptimalFormat(queue.length);
  
  // Si on a assez de joueurs pour au moins un format (4+)
  if (optimalFormat && !queueTimers[timerKey]) {
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
 * Le format est déterminé dynamiquement selon le nombre de joueurs
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
  
  // Maintenant on a un nombre pair, trouver le format optimal
  const optimalFormat = getOptimalFormat(playerCount);
  if (!optimalFormat) {
    console.log(`[Ranked Matchmaking] No valid format for ${playerCount} players`);
    return;
  }
  
  // Si on a plus de joueurs que le format max (10), on prend les 10 premiers
  if (playerCount > 10) {
    const excess = sortedQueue.splice(10);
    ejectedPlayers.push(...excess);
    playerCount = 10;
    console.log(`[Ranked Matchmaking] Capping to 10 players, ${excess.length} players stay in queue`);
  }
  
  const playersForMatch = sortedQueue.slice(0, playerCount);
  const format = getOptimalFormat(playerCount).format;
  const teamSize = playerCount / 2;
  
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
    
    // Mélanger aléatoirement les joueurs
    const shuffled = [...playersForMatch].sort(() => Math.random() - 0.5);
    
    // Diviser en 2 équipes
    const team1Players = shuffled.slice(0, teamSize);
    const team2Players = shuffled.slice(teamSize);
    
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
    
    // Sélectionner 3 maps aléatoires pour le BO3 selon le nombre de joueurs
    // 3v3 et 4v4 → ladder duo-trio
    // 5v5 → ladder squad-team
    const ladderType = teamSize === 5 ? 'squad-team' : 'duo-trio';
    const maps = await GameMap.find({ 
      isActive: true,
      ladders: ladderType
    });
    
    // Si pas assez de maps dans ce ladder, prendre toutes les maps actives
    const availableMaps = maps.length >= 3 ? maps : await GameMap.find({ isActive: true });
    const selectedMaps = availableMaps.sort(() => Math.random() - 0.5).slice(0, 3).map((map, index) => ({
      name: map.name,
      image: map.image || null,
      order: index + 1,
      winner: null
    }));
    
    console.log(`[Ranked Matchmaking] Selected maps for match:`, selectedMaps);
    
    // Créer les données des joueurs pour le match
    const matchPlayers = [
      ...team1Players.map(p => {
        const fake = isFakePlayer(p);
        return {
          user: fake ? null : p.userId, // null pour les faux joueurs
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 1,
          isReferent: p.userId.toString() === team1Referent.userId.toString(),
          isFake: fake,
          queueJoinedAt: p.joinedAt
        };
      }),
      ...team2Players.map(p => {
        const fake = isFakePlayer(p);
        return {
          user: fake ? null : p.userId, // null pour les faux joueurs
          username: p.username,
          rank: p.rank,
          points: p.points,
          team: 2,
          isReferent: p.userId.toString() === team2Referent.userId.toString(),
          isFake: fake,
          queueJoinedAt: p.joinedAt
        };
      })
    ];
    
    // Pour les référents, seulement définir si c'est un vrai joueur
    const team1ReferentId = !isFakePlayer(team1Referent) ? team1Referent.userId : null;
    const team2ReferentId = !isFakePlayer(team2Referent) ? team2Referent.userId : null;
    
    // Créer le match
    const match = await RankedMatch.create({
      gameMode,
      mode,
      teamSize,
      players: matchPlayers,
      team1Referent: team1ReferentId,
      team2Referent: team2ReferentId,
      hostTeam,
      status: 'ready',
      maps: selectedMaps,
      matchmakingStartedAt: new Date()
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
      message: `Match ${teamSize}v${teamSize} créé ! ${team1Referent.username} et ${team2Referent.username} sont les référents.`
    });
    await match.save();
    
    // Notifier tous les vrais joueurs du match
    for (const player of matchPlayers) {
      if (io && player.user) { // Ne notifier que les vrais joueurs
        io.to(`user-${player.user}`).emit('rankedMatchFound', {
          matchId: match._id,
          gameMode,
          mode,
          format,
          teamSize,
          yourTeam: player.team,
          isReferent: player.isReferent,
          isHost: player.team === hostTeam && player.isReferent
        });
      }
    }
    
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
  const optimalFormat = getOptimalFormat(queue.length);
  const nextThreshold = getNextThreshold(queue.length);
  
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
      maxPlayers: 10
    });
  }
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
    
    console.log(`[Ranked Matchmaking] Starting staff test match for ${user.username} (${teamSize}v${teamSize})`);
    
    // Créer les faux joueurs pour remplir le match
    const fakeNames = [
      'Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 
      'Bot_Echo', 'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel', 
      'Bot_India'
    ];
    const fakeRanks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    
    const totalPlayers = teamSize * 2;
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
      rank: getRankFromPoints(ranking.points),
      points: ranking.points,
      platform: user.platform || 'PC',
      joinedAt: new Date(),
      isFake: false
    };
    
    // Mélanger tous les joueurs
    const allPlayers = [staffPlayer, ...fakePlayers].sort(() => Math.random() - 0.5);
    
    // Diviser en 2 équipes
    const team1Players = allPlayers.slice(0, teamSize);
    const team2Players = allPlayers.slice(teamSize);
    
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
    
    // Sélectionner 3 maps aléatoires pour le BO3
    const ladderType = teamSize === 5 ? 'squad-team' : 'duo-trio';
    const maps = await GameMap.find({ 
      isActive: true,
      ladders: ladderType
    });
    
    const availableMaps = maps.length >= 3 ? maps : await GameMap.find({ isActive: true });
    const selectedMaps = availableMaps.sort(() => Math.random() - 0.5).slice(0, 3).map((map, index) => ({
      name: map.name,
      image: map.image || null,
      order: index + 1,
      winner: null
    }));
    
    // Créer les données des joueurs pour le match
    const matchPlayers = [
      ...team1Players.map(p => ({
        user: p.isFake ? null : p.userId,
        username: p.username,
        rank: p.rank,
        points: p.points,
        team: 1,
        isReferent: p.userId.toString() === team1Referent.userId.toString(),
        isFake: p.isFake,
        queueJoinedAt: p.joinedAt
      })),
      ...team2Players.map(p => ({
        user: p.isFake ? null : p.userId,
        username: p.username,
        rank: p.rank,
        points: p.points,
        team: 2,
        isReferent: p.userId.toString() === team2Referent.userId.toString(),
        isFake: p.isFake,
        queueJoinedAt: p.joinedAt
      }))
    ];
    
    // Pour les référents, seulement définir si c'est un vrai joueur
    const team1ReferentId = !team1Referent.isFake ? team1Referent.userId : null;
    const team2ReferentId = !team2Referent.isFake ? team2Referent.userId : null;
    
    // Créer le match avec le flag isTestMatch
    const match = await RankedMatch.create({
      gameMode,
      mode,
      teamSize,
      players: matchPlayers,
      team1Referent: team1ReferentId,
      team2Referent: team2ReferentId,
      hostTeam,
      status: 'ready',
      maps: selectedMaps,
      matchmakingStartedAt: new Date(),
      isTestMatch: true // Flag pour identifier un match de test
    });
    
    // Populate pour envoyer au client
    await match.populate('players.user', 'username avatar discordId discordAvatar platform');
    if (team1ReferentId) await match.populate('team1Referent', 'username');
    if (team2ReferentId) await match.populate('team2Referent', 'username');
    
    console.log(`[Ranked Matchmaking] Staff test match created: ${match._id} (${teamSize}v${teamSize})`);
    
    // Ajouter un message système
    match.chat.push({
      isSystem: true,
      messageType: 'test_match_created',
      message: `⚡ Match de test ${teamSize}v${teamSize} créé ! Ce match n'affecte pas les statistiques.`
    });
    await match.save();
    
    // Notifier le staff du match trouvé
    if (io) {
      io.to(`user-${userId}`).emit('rankedMatchFound', {
        matchId: match._id,
        gameMode,
        mode,
        format: `${teamSize}v${teamSize}`,
        teamSize,
        yourTeam: staffTeam,
        isReferent: true,
        isHost: true,
        isTestMatch: true
      });
    }
    
    return {
      success: true,
      message: `Match de test ${teamSize}v${teamSize} créé avec succès !`,
      matchId: match._id,
      match
    };
    
  } catch (error) {
    console.error('[Ranked Matchmaking] Error starting staff test match:', error);
    return { success: false, message: 'Erreur lors de la création du match de test.' };
  }
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
  startStaffTestMatch
};

