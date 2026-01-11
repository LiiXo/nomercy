/**
 * GGSecure Monitoring Service
 * 
 * Surveille la connexion GGSecure des joueurs PC dans les matchs actifs
 * et émet des événements socket.io quand le statut change
 */

import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import User from '../models/User.js';

// Stockage du statut de connexion des joueurs par match
// Structure: { 'matchId-userId': { isConnected: boolean, lastCheck: Date, matchType: 'ladder' | 'ranked' } }
const playerConnectionStatus = new Map();

// Socket.io instance
let io = null;

/**
 * Initialise le service avec Socket.io
 */
export const initGGSecureMonitoring = (socketIo) => {
  io = socketIo;
  console.log('[GGSecure Monitoring] Service initialized');
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
    const status = await checkGGSecureStatus(player.userId);
    
    if (!status.required) return;

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
  } catch (error) {
    console.error('[GGSecure Monitoring] Error checking player:', error);
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
      const roomName = matchType === 'ladder' ? `match-${match._id}` : `ranked-match-${match._id}`;
      
      io.to(roomName).emit(eventName, {
        matchId: match._id,
        userId: player.userId,
        username: player.username,
        timestamp: now.toISOString(),
        messageType: messageType,
        ...(matchType === 'ladder' ? { squad: player.squad } : { team: player.team })
      });

      console.log(`[GGSecure Monitoring] ${player.username} ${isConnected ? 'reconnected' : 'disconnected'} - ${matchType === 'ladder' ? 'Match' : 'Ranked Match'} ${match._id}`);
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
    } else {
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
    // Récupérer tous les matchs classés actifs (ready, in_progress)
    const activeMatches = await RankedMatch.find({
      status: { $in: ['ready', 'in_progress'] }
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
 * Fonction principale de surveillance
 */
const monitorAllMatches = async () => {
  await Promise.all([
    monitorLadderMatches(),
    monitorRankedMatches()
  ]);
};

/**
 * Nettoie les anciens statuts (joueurs qui ne sont plus dans des matchs actifs)
 */
const cleanupOldStatuses = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [statusKey, status] of playerConnectionStatus.entries()) {
    if (status.lastCheck < oneHourAgo) {
      playerConnectionStatus.delete(statusKey);
    }
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

  console.log('[GGSecure Monitoring] Started - checking every 30 seconds');
  
  // Première vérification immédiate
  setTimeout(monitorAllMatches, 5000); // Attendre 5 secondes après le démarrage
};

export default {
  initGGSecureMonitoring,
  startGGSecureMonitoring
};

