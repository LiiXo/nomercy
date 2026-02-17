/**
 * GGSecure Monitoring Service
 * 
 * Surveille la connexion GGSecure des joueurs PC dans les matchs actifs
 * et émet des événements socket.io quand le statut change
 * 
 * Shadow Ban System: Players in match but not connected to Iris for 10 minutes
 * get automatically shadow banned for 24 hours.
 */

import Match from '../models/Match.js';
import RankedMatch from '../models/RankedMatch.js';
import StrickerMatch from '../models/StrickerMatch.js';
import User from '../models/User.js';
import ShadowBanTracking from '../models/ShadowBanTracking.js';
import { alertIrisMatchDisconnected, sendIrisMatchWarning, sendIrisMatchShadowBan } from './discordBot.service.js';

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
    
    // Vérifier si le joueur a envoyé un ping dans les 3 dernières minutes (ping is every 2 min)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const isConnected = user.irisLastSeen && new Date(user.irisLastSeen) > threeMinutesAgo;
    
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
 * Note: GGSecure verification disabled for ranked/stricker - Iris status shown on match sheet instead
 */
const checkPlayerInMatch = async (player, match, matchType) => {
  try {
    // GGSecure verification removed for ranked and stricker modes
    // No longer sending chat notifications for GGSecure disconnect/reconnect
    // Iris status will be shown on match sheet instead
    
    // Keep Iris monitoring (for Discord alerts only)
    await checkPlayerIrisInMatch(player, match, matchType);
    
  } catch (error) {
    console.error('[GGSecure Monitoring] Error checking player:', error);
  }
};

/**
 * Vérifie si un joueur PC est connecté à Iris pendant un match
 * et envoie une alerte Discord si ce n'est pas le cas
 * Also creates shadow ban tracking if player not connected
 */
const checkPlayerIrisInMatch = async (player, match, matchType) => {
  try {
    const irisStatus = await checkIrisStatus(player.userId);
    
    if (!irisStatus.required) return; // Pas un joueur PC
    
    const irisKey = `iris-${match._id}-${player.userId}`;
    const alreadyAlerted = irisAlertSent.get(irisKey);
    
    if (!irisStatus.connected && !alreadyAlerted) {
      // Joueur PC en match mais pas connecté à Iris
      
      // Check if tracking already exists for this player/match
      const existingTracking = await ShadowBanTracking.findOne({
        user: player.userId,
        matchId: match._id,
        status: 'pending'
      });
      
      if (!existingTracking) {
        // Create new shadow ban tracking with 10-minute timer
        const checkAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        
        const tracking = new ShadowBanTracking({
          user: player.userId,
          username: irisStatus.user?.username || player.username,
          discordUsername: irisStatus.user?.discordUsername,
          discordId: irisStatus.user?.discordId,
          matchId: match._id,
          matchType: matchType,
          detectedAt: new Date(),
          checkAt: checkAt,
          discordNotificationSent: true,
          discordNotificationSentAt: new Date()
        });
        
        await tracking.save();
        
        // Send initial Discord warning notification
        await sendIrisMatchWarning(
          {
            username: irisStatus.user?.username || player.username,
            discordUsername: irisStatus.user?.discordUsername,
            discordId: irisStatus.user?.discordId
          },
          {
            matchId: match._id.toString(),
            matchType: matchType
          }
        );
        
        console.log(`[Iris Shadow Ban] Tracking created for ${player.username} in ${matchType} match ${match._id} - will check in 10 minutes`);
      }
      
      // Also send the old alert (for logs channel)
      await alertIrisMatchDisconnected(
        {
          username: irisStatus.user?.username || player.username,
          discordUsername: irisStatus.user?.discordUsername,
          irisScanChannelId: irisStatus.user?.irisScanChannelId
        },
        {
          matchId: match._id.toString(),
          matchType: matchType,
          status: match.status
        }
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
      
      // Also mark any pending tracking as cleared
      await ShadowBanTracking.findOneAndUpdate(
        {
          user: player.userId,
          matchId: match._id,
          status: 'pending'
        },
        {
          status: 'cleared',
          resolvedAt: new Date(),
          resolutionReason: 'reconnected'
        }
      );
      
      console.log(`[Iris Shadow Ban] Player ${player.username} reconnected to Iris - tracking cleared`);
    }
  } catch (error) {
    console.error('[Iris Monitoring] Error checking player Iris status:', error);
  }
};

/**
 * Process pending shadow ban trackings that have reached their 10-minute check time
 * This function is called periodically to check and apply shadow bans
 */
const processPendingShadowBans = async () => {
  try {
    const now = new Date();
    
    // Find all pending trackings that have reached their check time
    const pendingTrackings = await ShadowBanTracking.find({
      status: 'pending',
      checkAt: { $lte: now }
    }).populate('user', 'username discordUsername discordId platform irisLastSeen');
    
    for (const tracking of pendingTrackings) {
      try {
        // Check if the match is still active
        let matchStillActive = false;
        let match = null;
        
        if (tracking.matchType === 'ranked') {
          match = await RankedMatch.findOne({
            _id: tracking.matchId,
            status: { $in: ['pending', 'ready', 'in_progress'] }
          });
          matchStillActive = !!match;
        } else if (tracking.matchType === 'stricker') {
          match = await StrickerMatch.findOne({
            _id: tracking.matchId,
            status: { $in: ['pending', 'ready', 'in_progress', 'disputed'] }
          });
          matchStillActive = !!match;
        } else if (tracking.matchType === 'ladder') {
          match = await Match.findOne({
            _id: tracking.matchId,
            status: { $in: ['accepted', 'in_progress'] }
          });
          matchStillActive = !!match;
        }
        
        if (!matchStillActive) {
          // Match ended, mark as expired
          tracking.status = 'expired';
          tracking.resolvedAt = now;
          tracking.resolutionReason = 'match_ended';
          await tracking.save();
          console.log(`[Iris Shadow Ban] Tracking expired for ${tracking.username} - match ${tracking.matchId} ended`);
          continue;
        }
        
        // Re-check if user is connected to Iris
        const irisStatus = await checkIrisStatus(tracking.user._id || tracking.user);
        
        if (irisStatus.connected) {
          // Player reconnected, clear the tracking
          tracking.status = 'cleared';
          tracking.resolvedAt = now;
          tracking.resolutionReason = 'reconnected';
          await tracking.save();
          console.log(`[Iris Shadow Ban] Player ${tracking.username} reconnected to Iris - tracking cleared`);
          continue;
        }
        
        // Player still not connected after 10 minutes - apply 24h shadow ban
        const banExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        const banReason = 'Non connecté à Iris pendant un match actif (10 min sans connexion)';
        
        // Update user with ban
        await User.findByIdAndUpdate(tracking.user._id || tracking.user, {
          isBanned: true,
          banReason: banReason,
          bannedAt: now,
          banExpiresAt: banExpiresAt
        });
        
        // Update tracking record
        tracking.status = 'banned';
        tracking.resolvedAt = now;
        tracking.resolutionReason = 'banned';
        tracking.banApplied = true;
        tracking.banExpiresAt = banExpiresAt;
        tracking.banReason = banReason;
        await tracking.save();
        
        // Send Discord notification
        await sendIrisMatchShadowBan(
          {
            username: tracking.username,
            discordUsername: tracking.discordUsername,
            discordId: tracking.discordId
          },
          {
            matchId: tracking.matchId.toString(),
            matchType: tracking.matchType,
            reason: banReason,
            duration: '24h',
            expiresAt: banExpiresAt
          }
        );
        
        console.log(`[Iris Shadow Ban] Applied 24h shadow ban to ${tracking.username} for not connecting to Iris in match ${tracking.matchId}`);
        
        // Clear the iris alert for this player/match
        const irisKey = `iris-${tracking.matchId}-${tracking.user._id || tracking.user}`;
        irisAlertSent.delete(irisKey);
        
      } catch (trackingError) {
        console.error(`[Iris Shadow Ban] Error processing tracking ${tracking._id}:`, trackingError);
      }
    }
  } catch (error) {
    console.error('[Iris Shadow Ban] Error processing pending shadow bans:', error);
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
    // Récupérer tous les matchs Stricker actifs (pending, ready, in_progress, disputed)
    const activeMatches = await StrickerMatch.find({
      status: { $in: ['pending', 'ready', 'in_progress', 'disputed'] }
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

  // Process pending shadow bans every minute
  const shadowBanInterval = 60 * 1000;
  setInterval(processPendingShadowBans, shadowBanInterval);
  console.log('[Iris Shadow Ban] Shadow ban processing started - checking every minute');

  // Nettoyer les anciens statuts toutes les 10 minutes
  setInterval(cleanupOldStatuses, 10 * 60 * 1000);

  
  // Première vérification immédiate
  setTimeout(monitorAllMatches, 5000); // Attendre 5 secondes après le démarrage
  
  // First shadow ban check after 10 seconds
  setTimeout(processPendingShadowBans, 10000);
};

/**
 * Vérifie le statut GGSecure d'un joueur spécifique quand il rejoint la room du match
 * Appelé depuis le handler socket 'joinRankedMatch'
 * Note: GGSecure verification disabled - Iris status shown on match sheet instead
 * @param {string} matchId - L'ID du match
 * @param {string} userId - L'ID du joueur
 */
export const checkPlayerGGSecureOnJoin = async (matchId, userId, matchType = 'ranked') => {
  // GGSecure verification removed for ranked and stricker modes
  // No longer sending chat notifications for GGSecure disconnect/reconnect
  // Iris status will be shown on match sheet instead
  return;
};

export default {
  initGGSecureMonitoring,
  startGGSecureMonitoring,
  checkRankedMatchGGSecureStatus,
  checkStrickerMatchGGSecureStatus,
  checkPlayerGGSecureOnJoin,
  monitorStrickerMatches
};

