/**
 * GGSecure Monitoring Service
 * 
 * Surveille la connexion GGSecure des joueurs PC dans les matchs actifs
 * et émet des événements socket.io quand le statut change
 */

import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import StrickerMatch from '../models/StrickerMatch.js';
import User from '../models/User.js';
import { alertIrisMatchDisconnected } from './discordBot.service.js';

// Stockage du statut de connexion des joueurs par match
// Structure: { 'matchId-userId': { isConnected: boolean, lastCheck: Date, matchType: 'ladder' | 'ranked' } }
const playerConnectionStatus = new Map();

// Stockage du statut Iris des joueurs par match
// Pour éviter de spammer les alertes Discord
const irisAlertSent = new Map();

// Socket.io instance
let io = null;

/**
 * Initialise le service avec Socket.io
 */
export const initGGSecureMonitoring = (socketIo) => {
  io = socketIo;
};

/**
 * Vérifie si un joueur PC est connecté à Iris (heartbeat récent)
 */
const checkIrisStatus = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('platform irisLastSeen irisWasConnected username discordUsername irisScanChannelId')
      .lean();
    
    if (!user || user.platform !== 'PC') {
      return { required: false, connected: true };
    }
    
    // Vérifier si le joueur a envoyé un heartbeat dans les 6 dernières minutes
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const isConnected = user.irisLastSeen && new Date(user.irisLastSeen) > sixMinutesAgo;
    
    return { 
      required: true, 
      connected: isConnected,
      user: user
    };
  } catch (error) {
    console.error('[GGSecure Monitoring] Iris check error:', error);
    return { required: true, connected: true }; // En cas d'erreur, on laisse passer
  }
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
      console.warn('[GGSecure Monitoring] API key missing');
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
    console.error('[GGSecure Monitoring] Check error:', error);
    return { required: true, connected: true }; // En cas d'erreur, on laisse passer
  }
};

/**
 * Vérifie un joueur PC dans un match et envoie des notifications si le statut change
 */
const checkPlayerInMatch = async (player, match, matchType) => {
  try {
    // Vérifier GGSecure
    const status = await checkGGSecureStatus(player.userId);
    
    if (status.required) {
      const statusKey = `${match._id}-${player.userId}`;
      const previousStatus = playerConnectionStatus.get(statusKey);
      const currentlyConnected = status.connected;

      // Si le statut a changé OU si c'est la première vérification
      if (!previousStatus) {
        // Première vérification - initialiser sans envoyer de message
        playerConnectionStatus.set(statusKey, {
          isConnected: currentlyConnected,
          lastCheck: new Date(),
          matchType
        });
        
        // Si déconnecté dès le début, envoyer un message
        if (!currentlyConnected) {
          await sendConnectionMessage(player, match, matchType, false);
        }
      } else if (previousStatus.isConnected !== currentlyConnected) {
        // Le statut a changé - envoyer un message
        playerConnectionStatus.set(statusKey, {
          isConnected: currentlyConnected,
          lastCheck: new Date(),
          matchType
        });

        await sendConnectionMessage(player, match, matchType, currentlyConnected);
      } else {
        // Pas de changement - juste mettre à jour la date de vérification
        playerConnectionStatus.set(statusKey, {
          isConnected: currentlyConnected,
          lastCheck: new Date(),
          matchType
        });
      }
    }
    
    // Vérifier Iris (indépendamment de GGSecure)
    await checkPlayerIrisInMatch(player, match, matchType);
    
  } catch (error) {
    console.error('[GGSecure Monitoring] Error checking player:', error);
  }
};

/**
 * Vérifie si un joueur PC est connecté à Iris pendant un match
 * et envoie une alerte Discord si ce n'est pas le cas
 */
const checkPlayerIrisInMatch = async (player, match, matchType) => {
  try {
    const irisStatus = await checkIrisStatus(player.userId);
    
    if (!irisStatus.required) return; // Pas un joueur PC
    
    const irisKey = `iris-${match._id}-${player.userId}`;
    const alreadyAlerted = irisAlertSent.get(irisKey);
    
    if (!irisStatus.connected && !alreadyAlerted) {
      // Joueur PC en match mais pas connecté à Iris - envoyer l'alerte
      const matchInfo = {
        matchId: match._id.toString(),
        matchType: matchType,
        status: match.status
      };
      
      await alertIrisMatchDisconnected(
        {
          username: irisStatus.user?.username || player.username,
          discordUsername: irisStatus.user?.discordUsername,
          irisScanChannelId: irisStatus.user?.irisScanChannelId
        },
        matchInfo
      );
      
      // Marquer comme alerté pour éviter le spam
      irisAlertSent.set(irisKey, {
        alertedAt: new Date(),
        matchType
      });
      
      console.log(`[Iris Monitoring] Player ${player.username} in ${matchType} match ${match._id} not connected to Iris - alerted`);
    } else if (irisStatus.connected && alreadyAlerted) {
      // Le joueur s'est reconnecté, on peut supprimer l'alerte
      irisAlertSent.delete(irisKey);
    }
  } catch (error) {
    console.error('[Iris Monitoring] Error checking player Iris status:', error);
  }
};

/**
 * Envoie un message de connexion/déconnexion
 */
const sendConnectionMessage = async (player, match, matchType, isConnected) => {
  try {
    const now = new Date();
    const messageType = isConnected ? 'ggsecure_reconnect' : 'ggsecure_disconnect';

    // Émettre l'événement socket.io
    if (io) {
      const eventName = isConnected ? 'playerGGSecureReconnect' : 'playerGGSecureDisconnect';
      const roomName = matchType === 'ladder' ? `match-${match._id}` : 
                     matchType === 'ranked' ? `ranked-match-${match._id}` : 
                     `stricker-match-${match._id}`;
      
      io.to(roomName).emit(eventName, {
        matchId: match._id,
        userId: player.userId,
        username: player.username,
        timestamp: now.toISOString(),
        messageType: messageType,
        ...(matchType === 'ladder' ? { squad: player.squad } : { team: player.team })
      });

    }

    // Ajouter un message dans le chat du match (sans formatage, le frontend s'en chargera)
    if (matchType === 'ladder') {
      await Match.findByIdAndUpdate(match._id, {
        $push: {
          chat: {
            isSystem: true,
            messageType: messageType,
            username: player.username,
            squad: player.squad === 'challenger' ? match.challenger : match.opponent,
            createdAt: now
          }
        }
      });
    } else if (matchType === 'ranked') {
      await RankedMatch.findByIdAndUpdate(match._id, {
        $push: {
          chat: {
            isSystem: true,
            messageType: messageType,
            username: player.username,
            team: player.team,
            createdAt: now
          }
        }
      });
    } else {
      // matchType === 'stricker'
      await StrickerMatch.findByIdAndUpdate(match._id, {
        $push: {
          chat: {
            isSystem: true,
            messageType: messageType,
            username: player.username,
            team: player.team,
            createdAt: now
          }
        }
      });
    }
  } catch (error) {
    console.error('[GGSecure Monitoring] Error sending connection message:', error);
  }
};

/**
 * Surveille les joueurs PC dans les matchs ladder actifs
 */
const monitorLadderMatches = async () => {
  try {
    // Récupérer tous les matchs actifs (accepted, in_progress)
    const activeMatches = await Match.find({
      status: { $in: ['accepted', 'in_progress'] }
    })
      .populate('challengerRoster.user', 'username platform _id')
      .populate('opponentRoster.user', 'username platform _id')
      .lean();

    for (const match of activeMatches) {
      // Collecter tous les joueurs PC du match
      const pcPlayers = [];
      
      if (match.challengerRoster) {
        for (const roster of match.challengerRoster) {
          if (roster.user && roster.user.platform === 'PC') {
            pcPlayers.push({
              userId: roster.user._id.toString(),
              username: roster.user.username,
              squad: 'challenger'
            });
          }
        }
      }
      
      if (match.opponentRoster) {
        for (const roster of match.opponentRoster) {
          if (roster.user && roster.user.platform === 'PC') {
            pcPlayers.push({
              userId: roster.user._id.toString(),
              username: roster.user.username,
              squad: 'opponent'
            });
          }
        }
      }

      // Vérifier le statut de chaque joueur PC
      for (const player of pcPlayers) {
        await checkPlayerInMatch(player, match, 'ladder');
      }
    }
  } catch (error) {
    console.error('[GGSecure Monitoring] Error monitoring ladder matches:', error);
  }
};

/**
 * Surveille les joueurs PC dans les matchs classés actifs
 */
const monitorRankedMatches = async () => {
  try {
    // Récupérer tous les matchs classés actifs (pending, ready, in_progress)
    // Note: On inclut 'pending' pour détecter les joueurs sans GGSecure dès la création du match
    const activeMatches = await RankedMatch.find({
      status: { $in: ['pending', 'ready', 'in_progress'] }
    })
      .populate('players.user', 'username platform _id')
      .lean();

    for (const match of activeMatches) {
      // Collecter tous les joueurs PC du match
      const pcPlayers = [];
      
      if (match.players) {
        for (const player of match.players) {
          if (player.user && player.user.platform === 'PC' && !player.isFake) {
            pcPlayers.push({
              userId: player.user._id.toString(),
              username: player.user.username,
              team: player.team
            });
          }
        }
      }

      // Vérifier le statut de chaque joueur PC
      for (const player of pcPlayers) {
        await checkPlayerInMatch(player, match, 'ranked');
      }
    }
  } catch (error) {
    console.error('[GGSecure Monitoring] Error monitoring ranked matches:', error);
  }
};

/**
 * Surveille les joueurs PC dans les matchs Stricker actifs
 */
const monitorStrickerMatches = async () => {
  try {
    // Récupérer tous les matchs Stricker actifs (pending, ready, in_progress)
    const activeMatches = await StrickerMatch.find({
      status: { $in: ['pending', 'ready', 'in_progress'] }
    })
      .populate('players.user', 'username platform _id')
      .lean();

    for (const match of activeMatches) {
      // Collecter tous les joueurs PC du match
      const pcPlayers = [];
      
      if (match.players) {
        for (const player of match.players) {
          if (player.user && player.user.platform === 'PC' && !player.isFake) {
            pcPlayers.push({
              userId: player.user._id.toString(),
              username: player.user.username,
              team: player.team
            });
          }
        }
      }

      // Vérifier le statut de chaque joueur PC
      for (const player of pcPlayers) {
        await checkPlayerInMatch(player, match, 'stricker');
      }
    }
  } catch (error) {
    console.error('[GGSecure Monitoring] Error monitoring Stricker matches:', error);
  }
};

/**
 * Fonction principale de surveillance
 */
const monitorAllMatches = async () => {
  await Promise.all([
    monitorLadderMatches(),
    monitorRankedMatches(),
    monitorStrickerMatches()
  ]);
};

/**
 * Nettoie les anciens statuts (joueurs qui ne sont plus dans des matchs actifs)
 */
const cleanupOldStatuses = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Nettoyer les statuts GGSecure
  for (const [statusKey, status] of playerConnectionStatus.entries()) {
    if (status.lastCheck < oneHourAgo) {
      playerConnectionStatus.delete(statusKey);
    }
  }
  
  // Nettoyer les alertes Iris
  for (const [irisKey, alert] of irisAlertSent.entries()) {
    if (alert.alertedAt < oneHourAgo) {
      irisAlertSent.delete(irisKey);
    }
  }
};

/**
 * Vérifie immédiatement le statut GGSecure pour un match classé spécifique
 * Appelé lors de la création d'un match pour notifier les joueurs sans GGSecure
 * @param {Object} match - Le document match avec players populés
 */
export const checkRankedMatchGGSecureStatus = async (match) => {
  if (!io) {
    console.warn('[GGSecure Monitoring] Cannot check - Socket.io not initialized');
    return;
  }
  
  try {
    
    // Collecter tous les joueurs réels du match (non-fake)
    // La vérification de la plateforme PC est faite dans checkGGSecureStatus
    const realPlayers = [];
    
    if (match.players) {
      for (const player of match.players) {
        // Gérer les deux cas: match populé ou non populé
        const userObj = player.user;
        const userId = userObj?._id || userObj;
        const username = player.username || userObj?.username;
        
        // Ne vérifier que les vrais joueurs (non fake)
        if (userId && !player.isFake && !userId.toString().startsWith('fake-')) {
          realPlayers.push({
            userId: userId.toString(),
            username: username,
            team: player.team
          });
        }
      }
    }
    
    
    // Vérifier le statut de chaque joueur réel
    // checkPlayerInMatch vérifiera si c'est un joueur PC via checkGGSecureStatus
    for (const player of realPlayers) {
      await checkPlayerInMatch(player, match, 'ranked');
    }
    
  } catch (error) {
    console.error('[GGSecure Monitoring] Error in immediate ranked match check:', error);
  }
};

/**
 * Vérifie immédiatement le statut GGSecure pour un match Stricker spécifique
 * Appelé lors de la création d'un match pour notifier les joueurs sans GGSecure
 * @param {Object} match - Le document match avec players populés
 */
export const checkStrickerMatchGGSecureStatus = async (match) => {
  if (!io) {
    console.warn('[GGSecure Monitoring] Cannot check - Socket.io not initialized');
    return;
  }
  
  try {
    
    // Collecter tous les joueurs réels du match (non-fake)
    // La vérification de la plateforme PC est faite dans checkGGSecureStatus
    const realPlayers = [];
    
    if (match.players) {
      for (const player of match.players) {
        // Gérer les deux cas: match populé ou non populé
        const userObj = player.user;
        const userId = userObj?._id || userObj;
        const username = player.username || userObj?.username;
        
        // Ne vérifier que les vrais joueurs (non fake)
        if (userId && !player.isFake && !userId.toString().startsWith('fake-')) {
          realPlayers.push({
            userId: userId.toString(),
            username: username,
            team: player.team
          });
        }
      }
    }
    
    
    // Vérifier le statut de chaque joueur réel
    // checkPlayerInMatch vérifiera si c'est un joueur PC via checkGGSecureStatus
    for (const player of realPlayers) {
      await checkPlayerInMatch(player, match, 'stricker');
    }
    
  } catch (error) {
    console.error('[GGSecure Monitoring] Error in immediate Stricker match check:', error);
  }
};

/**
 * Démarre la surveillance
 */
export const startGGSecureMonitoring = () => {
  if (!io) {
    console.error('[GGSecure Monitoring] Cannot start - Socket.io not initialized');
    return;
  }

  // Vérifier toutes les 30 secondes
  const monitoringInterval = 30 * 1000;
  setInterval(monitorAllMatches, monitoringInterval);

  // Nettoyer les anciens statuts toutes les 10 minutes
  setInterval(cleanupOldStatuses, 10 * 60 * 1000);

  
  // Première vérification immédiate
  setTimeout(monitorAllMatches, 5000); // Attendre 5 secondes après le démarrage
};

/**
 * Vérifie le statut GGSecure d'un joueur spécifique quand il rejoint la room du match
 * Appelé depuis le handler socket 'joinRankedMatch'
 * @param {string} matchId - L'ID du match
 * @param {string} userId - L'ID du joueur
 */
export const checkPlayerGGSecureOnJoin = async (matchId, userId, matchType = 'ranked') => {
  if (!io) {
    console.warn('[GGSecure Monitoring] Cannot check - Socket.io not initialized');
    return;
  }
  
  try {
    let match;
    let MatchModel;
    
    // Select the appropriate model based on matchType
    if (matchType === 'stricker') {
      MatchModel = StrickerMatch;
    } else if (matchType === 'ranked') {
      MatchModel = RankedMatch;
    } else {
      // Default to ranked for backward compatibility
      MatchModel = RankedMatch;
    }
    
    // Récupérer le match pour avoir les infos du joueur
    match = await MatchModel.findById(matchId)
      .populate('players.user', 'username platform _id')
      .lean();
    
    if (!match || !['pending', 'ready', 'in_progress'].includes(match.status)) {
      return;
    }
    
    // Trouver le joueur dans le match
    const playerInfo = match.players?.find(p => {
      const playerId = (p.user?._id || p.user)?.toString();
      return playerId === userId.toString();
    });
    
    if (!playerInfo || playerInfo.isFake) {
      return; // Joueur non trouvé ou fake player
    }
    
    const userObj = playerInfo.user;
    const username = playerInfo.username || userObj?.username;
    const team = playerInfo.team;
    
    // Vérifier le statut GGSecure (cette fonction vérifie déjà si c'est un joueur PC)
    const status = await checkGGSecureStatus(userId);
    
    if (!status.required) {
      return; // Pas un joueur PC, pas besoin de vérifier
    }
    
    const statusKey = `${matchId}-${userId}`;
    const previousStatus = playerConnectionStatus.get(statusKey);
    
    // Si déconnecté et pas encore notifié (ou première vérification)
    if (!status.connected) {
      // Initialiser ou mettre à jour le statut
      playerConnectionStatus.set(statusKey, {
        isConnected: false,
        lastCheck: new Date(),
        matchType: matchType
      });
      
      // Envoyer le message seulement si c'est un changement ou première détection
      if (!previousStatus || previousStatus.isConnected !== false) {
        const player = {
          userId: userId.toString(),
          username: username,
          team: team
        };
        
        await sendConnectionMessage(player, match, matchType, false);
        console.log(`[GGSecure Monitoring] Player ${username} joined ${matchType} match ${matchId} without GGSecure - notified`);
      }
    } else {
      // Joueur connecté, initialiser le statut
      playerConnectionStatus.set(statusKey, {
        isConnected: true,
        lastCheck: new Date(),
        matchType: matchType
      });
    }
  } catch (error) {
    console.error('[GGSecure Monitoring] Error checking player on join:', error);
  }
};

export default {
  initGGSecureMonitoring,
  startGGSecureMonitoring,
  checkRankedMatchGGSecureStatus,
  checkStrickerMatchGGSecureStatus,
  checkPlayerGGSecureOnJoin,
  monitorStrickerMatches
};

