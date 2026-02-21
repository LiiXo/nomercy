/**
 * Casual Matchmaking Service
 * 
 * Gère les files d'attente pour les modes de jeu casual:
 * - Duel 1v1: 2 joueurs solo (1 vs 1)
 * - Search & Destroy 2v2: 4 joueurs (2 vs 2)
 * - Search & Destroy 3v3: 6 joueurs (3 vs 3)
 * - Search & Destroy 4v4: 8 joueurs (4 vs 4)
 * - Search & Destroy 5v5: 10 joueurs (5 vs 5)
 * 
 * Support des groupes: le leader rejoint avec tous les membres
 */

import AppSettings from '../models/AppSettings.js';
import User from '../models/User.js';
import Group from '../models/Group.js';

// Socket.io instance
let io = null;

// Files d'attente par mode de jeu
// Structure: { 'duel-1v1_simple': [{ groupId, members: [{ odId, username }], joinedAt }] }
const queues = {};

// Mapping socket -> queue entry pour retrouver rapidement un joueur
const socketToQueue = new Map();

/**
 * Initialise le service avec Socket.io
 */
export const initCasualMatchmaking = (socketIo) => {
  io = socketIo;
  console.log('✓ Casual Matchmaking service initialized');
};

/**
 * Obtient la clé unique pour une file d'attente
 * @param {string} modeId - ID du mode (ex: 'duel-1v1', 'snd-2v2')
 * @param {string} type - Type (simple ou hardcore)
 */
const getQueueKey = (modeId, type) => `${modeId}_${type}`;

/**
 * Obtient ou crée une file d'attente
 */
const getQueue = (modeId, type) => {
  const key = getQueueKey(modeId, type);
  if (!queues[key]) {
    queues[key] = [];
  }
  return queues[key];
};

/**
 * Compte le nombre total de joueurs dans la file
 */
const getTotalPlayersInQueue = (queue) => {
  return queue.reduce((total, entry) => total + entry.members.length, 0);
};

/**
 * Obtient la config du mode depuis AppSettings
 */
const getModeConfig = async (modeId) => {
  try {
    const settings = await AppSettings.findOne();
    if (!settings?.lobbyGameModes) return null;
    return settings.lobbyGameModes.find(m => m.id === modeId);
  } catch (err) {
    console.error('Error fetching mode config:', err);
    return null;
  }
};

/**
 * Broadcast l'état de la file à tous les joueurs dans la file
 */
const broadcastQueueStatus = (modeId, type) => {
  const queue = getQueue(modeId, type);
  const totalPlayers = getTotalPlayersInQueue(queue);
  
  // Envoyer le statut à tous les joueurs dans cette file
  for (const entry of queue) {
    for (const member of entry.members) {
      if (member.socketId && io) {
        io.to(member.socketId).emit('casualQueueStatus', {
          modeId,
          type,
          playersInQueue: totalPlayers,
          position: queue.indexOf(entry) + 1
        });
      }
    }
  }
};

/**
 * Vérifie si un match peut être lancé et le crée si oui
 */
const tryCreateMatch = async (modeId, type) => {
  const queue = getQueue(modeId, type);
  const modeConfig = await getModeConfig(modeId);
  
  if (!modeConfig) {
    console.error(`Mode config not found for ${modeId}`);
    return false;
  }
  
  const teamSize = modeConfig.maxPlayers; // maxPlayers = taille d'équipe requise
  const playersNeeded = teamSize * 2; // 2 équipes
  const totalPlayers = getTotalPlayersInQueue(queue);
  
  console.log(`[CasualMM] ${modeId}_${type}: ${totalPlayers}/${playersNeeded} joueurs`);
  
  if (totalPlayers < playersNeeded) {
    return false;
  }
  
  // On a assez de joueurs - créer le match
  // Sélectionner les joueurs pour remplir les 2 équipes
  const team1 = [];
  const team2 = [];
  const usedEntries = [];
  
  for (const entry of queue) {
    if (team1.length < teamSize) {
      // Ajouter à l'équipe 1
      for (const member of entry.members) {
        team1.push(member);
      }
      usedEntries.push(entry);
    } else if (team2.length < teamSize) {
      // Ajouter à l'équipe 2
      for (const member of entry.members) {
        team2.push(member);
      }
      usedEntries.push(entry);
    }
    
    if (team1.length >= teamSize && team2.length >= teamSize) {
      break;
    }
  }
  
  // Vérifier qu'on a bien les bonnes tailles
  if (team1.length !== teamSize || team2.length !== teamSize) {
    console.log(`[CasualMM] Teams incomplete: ${team1.length}v${team2.length}, need ${teamSize}v${teamSize}`);
    return false;
  }
  
  // Retirer les entrées utilisées de la file
  for (const entry of usedEntries) {
    const index = queue.indexOf(entry);
    if (index > -1) {
      queue.splice(index, 1);
    }
    // Nettoyer le mapping socket
    for (const member of entry.members) {
      socketToQueue.delete(member.socketId);
    }
  }
  
  // Créer l'ID unique du match
  const matchId = `casual_${modeId}_${Date.now()}`;
  const modeName = modeConfig.name?.en || modeId;
  
  console.log(`[CasualMM] Match created: ${matchId}`);
  console.log(`[CasualMM] Team 1: ${team1.map(p => p.username).join(', ')}`);
  console.log(`[CasualMM] Team 2: ${team2.map(p => p.username).join(', ')}`);
  
  // Notifier tous les joueurs que le match est trouvé
  const countdownEndTime = Date.now() + 10000; // 10 seconds from now
  const matchData = {
    matchId,
    modeId,
    modeName,
    type,
    countdownEndTime,
    team1: team1.map(p => ({ odId: p.odId, username: p.username })),
    team2: team2.map(p => ({ odId: p.odId, username: p.username }))
  };
  
  for (const player of [...team1, ...team2]) {
    if (player.socketId && io) {
      io.to(player.socketId).emit('casualMatchFound', matchData);
    }
  }
  
  // Broadcast le nouveau statut de la file
  broadcastQueueStatus(modeId, type);
  
  return true;
};

/**
 * Vérifie si un joueur est déjà dans une file d'attente (par discordId)
 */
const isUserInAnyQueue = (discordId) => {
  for (const [key, queue] of Object.entries(queues)) {
    for (const entry of queue) {
      for (const member of entry.members) {
        if (member.odId === discordId) {
          return { inQueue: true, queueKey: key, entry };
        }
      }
    }
  }
  return { inQueue: false };
};

/**
 * Retire un joueur de toutes les files d'attente (par discordId)
 */
const removeUserFromAllQueues = (discordId) => {
  for (const [key, queue] of Object.entries(queues)) {
    for (let i = queue.length - 1; i >= 0; i--) {
      const entry = queue[i];
      const memberIndex = entry.members.findIndex(m => m.odId === discordId);
      if (memberIndex > -1) {
        // Nettoyer le mapping socket
        for (const member of entry.members) {
          if (member.socketId) {
            socketToQueue.delete(member.socketId);
          }
        }
        // Retirer l'entrée entière (on ne peut pas jouer sans le membre)
        queue.splice(i, 1);
        console.log(`[CasualMM] Removed user ${discordId} from ${key} queue`);
      }
    }
  }
};

/**
 * Rejoindre une file d'attente
 * @param {Object} socket - Socket du joueur
 * @param {string} odId - Discord ID du joueur
 * @param {string} modeId - ID du mode de jeu
 * @param {string} type - Type (simple/hardcore)
 */
export const joinCasualQueue = async (socket, odId, modeId, type) => {
  try {
    // Vérifier si le joueur est déjà dans une file (par discordId)
    const existingQueue = isUserInAnyQueue(odId);
    if (existingQueue.inQueue) {
      // Nettoyer l'ancienne entrée et continuer
      console.log(`[CasualMM] User ${odId} was in ${existingQueue.queueKey}, cleaning up...`);
      removeUserFromAllQueues(odId);
    }
    
    // Récupérer le mode config
    const modeConfig = await getModeConfig(modeId);
    if (!modeConfig || !modeConfig.enabled) {
      socket.emit('casualQueueError', { message: 'Ce mode de jeu n\'est pas disponible' });
      return;
    }
    
    // Récupérer l'utilisateur par discordId
    const user = await User.findOne({ discordId: odId });
    if (!user) {
      socket.emit('casualQueueError', { message: 'Utilisateur non trouvé' });
      return;
    }
    
    // Vérifier si le joueur est dans un groupe
    const group = await Group.findOne({
      $or: [
        { leader: user._id },
        { 'members.user': user._id }
      ]
    }).populate('leader', '_id discordId username')
      .populate('members.user', '_id discordId username');
    
    let members = [];
    let groupId = null;
    
    // Compter les vrais membres du groupe (leader + autres membres)
    const hasOtherMembers = group && group.members && group.members.length > 0;
    
    if (group && hasOtherMembers) {
      // Le joueur est dans un groupe avec d'autres membres
      // Seul le leader peut lancer la recherche
      if (group.leader.discordId !== odId) {
        socket.emit('casualQueueError', { message: 'Seul le leader peut lancer la recherche' });
        return;
      }
      
      // Récupérer tous les membres du groupe
      groupId = group._id.toString();
      const leaderId = group.leader._id.toString();
      
      members.push({
        odId: group.leader.discordId,
        username: group.leader.username,
        socketId: socket.id, // Le leader est le socket actuel
        isLeader: true
      });
      
      // Ajouter les autres membres (sans le leader s'il est aussi dans members)
      for (const member of group.members) {
        if (member.user && member.user._id.toString() !== leaderId) {
          members.push({
            odId: member.user.discordId,
            username: member.user.username,
            socketId: null, // On ne connaît pas leur socket ici
            isLeader: false
          });
        }
      }
      
      // Vérifier que la taille du groupe correspond au mode
      const groupSize = members.length;
      console.log(`[CasualMM] Group ${groupId}: ${groupSize} members, mode requires ${modeConfig.minPlayers}-${modeConfig.maxPlayers}`);
      
      if (groupSize < modeConfig.minPlayers || groupSize > modeConfig.maxPlayers) {
        socket.emit('casualQueueError', { 
          message: `Ce mode requiert ${modeConfig.minPlayers === modeConfig.maxPlayers ? modeConfig.minPlayers : `${modeConfig.minPlayers}-${modeConfig.maxPlayers}`} joueur(s)`,
          minPlayers: modeConfig.minPlayers,
          maxPlayers: modeConfig.maxPlayers,
          currentPlayers: groupSize
        });
        return;
      }
    } else {
      // Joueur solo
      // Vérifier qu'il peut jouer solo (minPlayers = 1)
      if (modeConfig.minPlayers > 1) {
        socket.emit('casualQueueError', { 
          message: `Ce mode requiert un groupe de ${modeConfig.minPlayers} joueur(s) minimum`,
          minPlayers: modeConfig.minPlayers,
          maxPlayers: modeConfig.maxPlayers,
          currentPlayers: 1
        });
        return;
      }
      
      groupId = `solo_${user._id}`;
      members.push({
        odId: user.discordId,
        username: user.username,
        socketId: socket.id,
        isLeader: true
      });
    }
    
    // Ajouter à la file d'attente
    const queue = getQueue(modeId, type);
    const entry = {
      groupId,
      members,
      joinedAt: new Date()
    };
    
    queue.push(entry);
    socketToQueue.set(socket.id, { modeId, type, groupId });
    
    console.log(`[CasualMM] ${user.username} joined ${modeId}_${type} queue (${members.length} players)`);
    
    // Confirmer au joueur
    socket.emit('casualQueueJoined', {
      modeId,
      type,
      modeName: modeConfig.name?.en || modeId,
      playersInQueue: getTotalPlayersInQueue(queue),
      teamSize: modeConfig.maxPlayers
    });
    
    // Broadcast le statut mis à jour
    broadcastQueueStatus(modeId, type);
    
    // Vérifier si un match peut être créé
    await tryCreateMatch(modeId, type);
    
  } catch (err) {
    console.error('[CasualMM] Error joining queue:', err);
    socket.emit('casualQueueError', { message: 'Erreur lors de la recherche de match' });
  }
};

/**
 * Quitter une file d'attente
 */
export const leaveCasualQueue = (socket) => {
  const queueInfo = socketToQueue.get(socket.id);
  if (!queueInfo) return false;
  
  const { modeId, type, groupId } = queueInfo;
  const queue = getQueue(modeId, type);
  
  // Trouver et retirer l'entrée
  const entryIndex = queue.findIndex(e => e.groupId === groupId);
  if (entryIndex > -1) {
    const entry = queue[entryIndex];
    
    // Nettoyer les mappings socket pour tous les membres
    for (const member of entry.members) {
      socketToQueue.delete(member.socketId);
    }
    
    queue.splice(entryIndex, 1);
    console.log(`[CasualMM] Group ${groupId} left ${modeId}_${type} queue`);
    
    // Notifier les autres membres du groupe
    for (const member of entry.members) {
      if (member.socketId && member.socketId !== socket.id && io) {
        io.to(member.socketId).emit('casualQueueLeft', { modeId, type, reason: 'leader_cancelled' });
      }
    }
    
    // Broadcast le statut mis à jour
    broadcastQueueStatus(modeId, type);
    
    return true;
  }
  
  socketToQueue.delete(socket.id);
  return false;
};

/**
 * Gérer la déconnexion d'un socket
 */
export const handleDisconnect = (socket) => {
  leaveCasualQueue(socket);
};

/**
 * Obtenir le nombre de joueurs dans une file
 */
export const getQueueCount = (modeId, type) => {
  const queue = getQueue(modeId, type);
  return getTotalPlayersInQueue(queue);
};

/**
 * Obtenir le statut global des files
 */
export const getAllQueueCounts = () => {
  const counts = {};
  for (const [key, queue] of Object.entries(queues)) {
    counts[key] = getTotalPlayersInQueue(queue);
  }
  return counts;
};

/**
 * Vider toutes les files d'attente (admin only)
 */
export const clearAllQueues = () => {
  let totalCleared = 0;
  
  for (const [key, queue] of Object.entries(queues)) {
    // Notifier tous les joueurs dans la file
    for (const entry of queue) {
      for (const member of entry.members) {
        if (member.socketId && io) {
          io.to(member.socketId).emit('casualQueueLeft', { 
            reason: 'admin_cleared',
            message: 'Les files d\'attente ont été vidées par un administrateur'
          });
        }
        socketToQueue.delete(member.socketId);
      }
      totalCleared += entry.members.length;
    }
    // Vider la file
    queues[key] = [];
  }
  
  console.log(`[CasualMM] Admin cleared all queues - ${totalCleared} players removed`);
  return totalCleared;
};
