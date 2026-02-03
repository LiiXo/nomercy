import { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits, Events } from 'discord.js';

// Discord channel IDs
const ADMIN_LOG_CHANNEL_ID = '1463997106204184690';
const BAN_LOG_CHANNEL_ID = '1463997518412255488';
const ARBITRATOR_CHANNEL_ID = '1464005794289815746';

// Discord role IDs to mention in ban notifications
const BAN_MENTION_ROLES = ['1450169699710144644', '1450169557451935784'];
const ROLE_MENTIONS = BAN_MENTION_ROLES.map(id => `<@&${id}>`).join(' ');

// Arbitrator role ID to mention in arbitrator calls
const ARBITRATOR_ROLE_ID = '1461108156913680647';

// Voice channel category for ranked matches
const RANKED_VOICE_CATEGORY_ID = '1460717958656688271';

// Support ticket category for summons
const SUPPORT_TICKET_CATEGORY_ID = '1447349602331398164';

// Discord bot client
let client = null;
let isReady = false;

// Flag to prevent channel deletion during server restart
let isShuttingDown = false;

// Map to track pending summon channel deletions { channelId: { deletionTime: Date, channelName: string } }
// Summon channels are cleaned up every 24 hours automatically

// Cleanup interval for summon channels
let summonCleanupInterval = null;

/**
 * Set the shutting down flag to prevent channel deletion during restart
 */
export const setShuttingDown = (value) => {
  isShuttingDown = value;
  if (value) {
  }
};

/**
 * Check if server is shutting down
 */
export const getShuttingDown = () => isShuttingDown;

/**
 * Initialize the Discord bot
 */
export const initDiscordBot = async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    console.warn('[Discord Bot] DISCORD_BOT_TOKEN not set in .env - Discord logging disabled');
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ]
  });

  client.once(Events.ClientReady, () => {
    isReady = true;
    
    // Start summon channel cleanup interval (runs every 24 hours)
    if (summonCleanupInterval) {
      clearInterval(summonCleanupInterval);
    }
    // Run cleanup once at startup, then every 24 hours
    cleanupSummonChannels();
    summonCleanupInterval = setInterval(cleanupSummonChannels, 24 * 60 * 60 * 1000);
  });

  client.on('error', (error) => {
    console.error('[Discord Bot] Error:', error);
  });

  try {
    await client.login(token);
  } catch (error) {
    console.error('[Discord Bot] Failed to login:', error.message);
  }
};

/**
 * Cleanup expired summon channels
 */
// Cleanup all summon voice channels in the support-ticket category (runs every 24h)
const cleanupSummonChannels = async () => {
  if (!client || !isReady || isShuttingDown) return;
  
  try {
    
    const category = await client.channels.fetch(SUPPORT_TICKET_CATEGORY_ID).catch(() => null);
    if (!category) {
      return;
    }
    
    // Get all voice channels in the category
    const voiceChannels = category.children.cache.filter(ch => ch.type === 2); // 2 = GuildVoice
    
    if (voiceChannels.size === 0) {
      return;
    }
    
    
    let deleted = 0;
    for (const [, channel] of voiceChannels) {
      try {
        // Disconnect all members first
        for (const [, member] of channel.members) {
          try {
            await member.voice.disconnect('Nettoyage automatique des convocations');
          } catch (e) {
            console.warn(`[Discord Bot] Could not disconnect member: ${e.message}`);
          }
        }
        await channel.delete('Nettoyage automatique des convocations (24h)');
        deleted++;
      } catch (deleteError) {
        console.error(`[Discord Bot] Failed to delete channel ${channel.name}:`, deleteError.message);
      }
    }
    
  } catch (error) {
    console.error('[Discord Bot] Error during summon channel cleanup:', error.message);
  }
};

/**
 * Send a message to a specific channel
 */
const sendToChannel = async (channelId, content) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping message');
    return false;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`[Discord Bot] Channel ${channelId} not found`);
      return false;
    }

    await channel.send(content);
    return true;
  } catch (error) {
    console.error(`[Discord Bot] Failed to send message to channel ${channelId}:`, error.message);
    return false;
  }
};

/**
 * Format duration for display
 */
const formatDuration = (startDate, endDate) => {
  if (!endDate) return '🔒 Permanent';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) {
    return `⏱️ ${diffMinutes} minute(s)`;
  }
  if (diffHours < 24) {
    return `⏱️ ${diffHours} heure(s)`;
  }
  return `📅 ${diffDays} jour(s)`;
};

/**
 * Get player avatar URL for Discord embed
 */
const getPlayerAvatarUrl = (player) => {
  // Try Discord CDN avatar first
  if (player.discordId && player.discordAvatar) {
    return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
  }
  // Fallback to custom avatar
  if (player.avatarUrl) return player.avatarUrl;
  if (player.avatar && player.avatar.startsWith('http')) return player.avatar;
  // Default Discord avatar
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
};

/**
 * Log a player ban to Discord
 */
export const logPlayerBan = async (player, bannedBy, reason, startDate, endDate) => {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000) // Red
    .setTitle('🔨 JOUEUR BANNI')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '⏰ Durée', value: formatDuration(startDate, endDate), inline: true },
      { name: '📆 Expiration', value: endDate ? new Date(endDate).toLocaleString('fr-FR') : 'Jamais', inline: true },
      { name: '👮 Banni par', value: bannedBy?.username || 'Système', inline: true },
      { name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  await sendToChannel(BAN_LOG_CHANNEL_ID, { content: ROLE_MENTIONS, embeds: [embed] });
};

/**
 * Log a player unban to Discord
 */
export const logPlayerUnban = async (player, unbannedBy) => {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('✅ JOUEUR DÉBANNI')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '👮 Débanni par', value: unbannedBy?.username || 'Système', inline: true },
      { name: '📆 Date', value: new Date().toLocaleString('fr-FR'), inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  await sendToChannel(BAN_LOG_CHANNEL_ID, { content: ROLE_MENTIONS, embeds: [embed] });
};

/**
 * Log a player warning to Discord (logs to BOTH channels)
 */
export const logPlayerWarn = async (player, warnedBy, reason, warnCount) => {
  const embed = new EmbedBuilder()
    .setColor(0xFFA500) // Orange
    .setTitle('⚠️ AVERTISSEMENT')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '👮 Averti par', value: warnedBy?.username || 'Système', inline: true },
      { name: '📊 Total warns', value: warnCount?.toString() || '1', inline: true },
      { name: '📆 Date', value: new Date().toLocaleString('fr-FR'), inline: true },
      { name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Log to BOTH channels
  await sendToChannel(ADMIN_LOG_CHANNEL_ID, { embeds: [embed] });
  await sendToChannel(BAN_LOG_CHANNEL_ID, { embeds: [embed] });
};

/**
 * Log a ranked ban to Discord (BAN_LOG_CHANNEL only)
 */
export const logRankedBan = async (player, bannedBy, reason, startDate, endDate) => {
  const embed = new EmbedBuilder()
    .setColor(0x9900FF) // Purple
    .setTitle('🎮 BAN RANKED')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '⏰ Durée', value: formatDuration(startDate, endDate), inline: true },
      { name: '📆 Expiration', value: endDate ? new Date(endDate).toLocaleString('fr-FR') : 'Jamais', inline: true },
      { name: '👮 Banni par', value: bannedBy?.username || 'Système', inline: true },
      { name: '📝 Raison', value: reason || 'Aucune raison spécifiée', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Log to BAN_LOG_CHANNEL only
  await sendToChannel(BAN_LOG_CHANNEL_ID, { content: ROLE_MENTIONS, embeds: [embed] });
};

/**
 * Log a ranked unban to Discord (BAN_LOG_CHANNEL only)
 */
export const logRankedUnban = async (player, unbannedBy) => {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('✅ DÉBAN RANKED')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '👮 Débanni par', value: unbannedBy?.username || 'Système', inline: true },
      { name: '📆 Date', value: new Date().toLocaleString('fr-FR'), inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Log to BAN_LOG_CHANNEL only
  await sendToChannel(BAN_LOG_CHANNEL_ID, { content: ROLE_MENTIONS, embeds: [embed] });
};

/**
 * Log a referent ban/unban to Discord (BAN_LOG_CHANNEL only)
 */
export const logReferentBan = async (player, bannedBy, isBanned) => {
  const embed = new EmbedBuilder()
    .setColor(isBanned ? 0xFFAA00 : 0x00FF00) // Orange for ban, Green for unban
    .setTitle(isBanned ? '🛡️ BLOCAGE RÉFÉRENT' : '✅ DÉBLOCAGE RÉFÉRENT')
    .setThumbnail(getPlayerAvatarUrl(player))
    .addFields(
      { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
      { name: '🆔 ID', value: player._id?.toString() || 'N/A', inline: true },
      { name: '🎮 Activision ID', value: player.activisionId || 'N/A', inline: true },
      { name: '👮 Par', value: bannedBy?.username || 'Système', inline: true },
      { name: '📆 Date', value: new Date().toLocaleString('fr-FR'), inline: true },
      { name: '📝 Effet', value: isBanned ? 'Ne peut plus être référent dans les matchs classés' : 'Peut à nouveau être référent', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Log to BAN_LOG_CHANNEL only
  await sendToChannel(BAN_LOG_CHANNEL_ID, { content: ROLE_MENTIONS, embeds: [embed] });
};

/**
 * Log an admin action to Discord
 */
export const logAdminAction = async (admin, action, target, details = {}) => {
  const colorMap = {
    'create': 0x00FF00,    // Green
    'update': 0xFFA500,    // Orange
    'delete': 0xFF0000,    // Red
    'approve': 0x00FF00,   // Green
    'reject': 0xFF0000,    // Red
    'kick': 0xFF6600,      // Orange-Red
    'promote': 0x0099FF,   // Blue
    'demote': 0x666666,    // Gray
    'reset': 0x9900FF,     // Purple
    'add': 0x00FF00,       // Green
    'remove': 0xFF0000,    // Red
    'give': 0xFFD700,      // Gold
    'default': 0x5865F2    // Discord blurple
  };

  const iconMap = {
    'create': '➕',
    'update': '✏️',
    'delete': '🗑️',
    'approve': '✅',
    'reject': '❌',
    'kick': '👢',
    'promote': '⬆️',
    'demote': '⬇️',
    'reset': '🔄',
    'add': '➕',
    'remove': '➖',
    'give': '🎁',
    'ban': '🔨',
    'unban': '✅',
    'default': '📋'
  };

  const actionKey = action.toLowerCase().split(' ')[0];
  const color = colorMap[actionKey] || colorMap.default;
  const icon = iconMap[actionKey] || iconMap.default;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ACTION ADMIN`)
    .addFields(
      { name: '👮 Admin', value: admin?.username || 'Système', inline: true },
      { name: '📋 Action', value: action, inline: true },
      { name: '🎯 Cible', value: target || 'N/A', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage - Admin Panel' });

  // Add extra details if provided
  if (details.description) {
    embed.setDescription(details.description);
  }

  if (details.fields && Array.isArray(details.fields)) {
    for (const field of details.fields) {
      embed.addFields({ name: field.name, value: String(field.value), inline: field.inline ?? true });
    }
  }

  await sendToChannel(ADMIN_LOG_CHANNEL_ID, { embeds: [embed] });
};

/**
 * Log a simple text message to admin channel
 */
export const logAdminMessage = async (message) => {
  await sendToChannel(ADMIN_LOG_CHANNEL_ID, message);
};

/**
 * Log an arbitrator call to Discord (ARBITRATOR_CHANNEL)
 * Sends notification when a player calls for an arbitrator during a ranked match
 */
export const logArbitratorCall = async (match, calledBy) => {
  const matchUrl = `https://nomercy.ggsecure.io/ranked/match/${match._id}`;
  
  // Format team size for display
  const formatLabel = `${match.teamSize}v${match.teamSize}`;
  
  // Get mode display
  const modeLabel = match.mode === 'hardcore' ? 'Hardcore' : 'CDL';
  
  // Get voice channel info
  const team1VoiceChannel = match.team1VoiceChannel?.channelName || 'N/A';
  const team2VoiceChannel = match.team2VoiceChannel?.channelName || 'N/A';
  
  const embed = new EmbedBuilder()
    .setColor(0xFF6600) // Orange
    .setTitle('🚨 APPEL ARBITRE')
    .setDescription(`Un joueur demande l'intervention d'un arbitre !`)
    .addFields(
      { name: '👤 Appelé par', value: calledBy?.username || 'Inconnu', inline: true },
      { name: '🎮 Mode', value: modeLabel, inline: true },
      { name: '📊 Format', value: formatLabel, inline: true },
      { name: '🎯 Mode de jeu', value: match.gameMode || 'N/A', inline: true },
      { name: '🆔 Match ID', value: match._id?.toString() || 'N/A', inline: true },
      { name: '📋 Statut', value: match.status || 'N/A', inline: true },
      { name: '🎙️ Salons vocaux', value: `**E1:** ${team1VoiceChannel}\n**E2:** ${team2VoiceChannel}`, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Add button-like link field
  embed.addFields(
    { name: '\u200B', value: `[Voir le match de cette notif](${matchUrl})`, inline: false }
  );

  await sendToChannel(ARBITRATOR_CHANNEL_ID, { 
    content: `<@&${ARBITRATOR_ROLE_ID}>`, 
    embeds: [embed] 
  });
};

/**
 * Generate a random channel number for voice channels
 */
const generateRandomChannelNumber = () => {
  // Generate a random 4-digit number between 1000 and 9999
  return Math.floor(Math.random() * 9000) + 1000;
};

/**
 * Create voice channels for a ranked match with restricted access
 * @param {string} matchId - The match ID for reference
 * @param {Array} team1DiscordIds - Array of Discord IDs for team 1 players
 * @param {Array} team2DiscordIds - Array of Discord IDs for team 2 players
 * @param {string} mode - The match mode ('cdl' or 'hardcore')
 * @returns {Object} - { team1: { channelId, channelName }, team2: { channelId, channelName } }
 */
export const createMatchVoiceChannels = async (matchId, team1DiscordIds = [], team2DiscordIds = [], mode = 'hardcore') => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping voice channel creation (client:', !!client, ', isReady:', isReady, ')');
    return null;
  }

  // Convert matchId to string in case it's an ObjectId
  const matchIdStr = matchId?.toString() || matchId;

  try {
    
    // Get the category
    const category = await client.channels.fetch(RANKED_VOICE_CATEGORY_ID);
    if (!category) {
      console.error(`[Discord Bot] Category ${RANKED_VOICE_CATEGORY_ID} not found`);
      return null;
    }

    const guild = category.guild;

    // Generate a random number for this match's voice channels
    const channelNumber = generateRandomChannelNumber();
    
    // Use last 4 characters of matchId as unique identifier
    const matchCode = matchIdStr.slice(-4).toUpperCase();
    
    // CDL: 4 users max per channel, Hardcore: 5 users max per channel
    const userLimit = mode === 'cdl' ? 4 : 5;
    
    // Mode prefix for channel names
    const modePrefix = mode === 'cdl' ? '[CDL]' : '[HC]';
    
    // Create team 1 voice channel - No permission restrictions, everyone can join, limited based on mode
    const team1ChannelName = `${modePrefix} 🔵 Blue #${matchCode}`;
    const team1Channel = await guild.channels.create({
      name: team1ChannelName,
      type: ChannelType.GuildVoice,
      parent: RANKED_VOICE_CATEGORY_ID,
      userLimit: userLimit,
      reason: `Match classé ${matchIdStr} (${mode.toUpperCase()})`
    });

    // Create team 2 voice channel - No permission restrictions, everyone can join, limited based on mode
    const team2ChannelName = `${modePrefix} 🔴 Red #${matchCode}`;
    const team2Channel = await guild.channels.create({
      name: team2ChannelName,
      type: ChannelType.GuildVoice,
      parent: RANKED_VOICE_CATEGORY_ID,
      userLimit: userLimit,
      reason: `Match classé ${matchIdStr} (${mode.toUpperCase()})`
    });


    return {
      team1: { channelId: team1Channel.id, channelName: team1ChannelName },
      team2: { channelId: team2Channel.id, channelName: team2ChannelName }
    };
  } catch (error) {
    console.error(`[Discord Bot] Failed to create voice channels for match ${matchIdStr}:`, error.message);
    return null;
  }
};

/**
 * Delete voice channels for a ranked match (disconnect users first)
 * @param {string} team1ChannelId - The team 1 voice channel ID
 * @param {string} team2ChannelId - The team 2 voice channel ID
 */
export const deleteMatchVoiceChannels = async (team1ChannelId, team2ChannelId, options = {}) => {
  // Skip deletion during server shutdown/restart unless explicitly forced
  if (isShuttingDown && !options.force) {
    return { skipped: true, reason: 'server_restart' };
  }

  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping voice channel deletion');
    return { skipped: true, reason: 'bot_not_ready' };
  }

  try {
    // Delete team 1 channel
    if (team1ChannelId) {
      try {
        const channel1 = await client.channels.fetch(team1ChannelId);
        if (channel1) {
          // Disconnect all members first
          for (const [, member] of channel1.members) {
            try {
              await member.voice.disconnect('Match terminé');
            } catch (e) {
              console.warn(`[Discord Bot] Could not disconnect member from channel: ${e.message}`);
            }
          }
          await channel1.delete('Match terminé');
        }
      } catch (e) {
        console.warn(`[Discord Bot] Could not delete team 1 channel: ${e.message}`);
      }
    }

    // Delete team 2 channel
    if (team2ChannelId) {
      try {
        const channel2 = await client.channels.fetch(team2ChannelId);
        if (channel2) {
          // Disconnect all members first
          for (const [, member] of channel2.members) {
            try {
              await member.voice.disconnect('Match terminé');
            } catch (e) {
              console.warn(`[Discord Bot] Could not disconnect member from channel: ${e.message}`);
            }
          }
          await channel2.delete('Match terminé');
        }
      } catch (e) {
        console.warn(`[Discord Bot] Could not delete team 2 channel: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('[Discord Bot] Error deleting voice channels:', error.message);
  }
};

/**
 * Send a summon notification to a player via Discord DM and create a voice channel
 * @param {Object} player - The player to summon (must have discordId)
 * @param {Object} summonedBy - The admin/staff who is summoning
 * @param {Object} summonData - { date, timeStart, timeEnd, reason }
 * @returns {Object} - { success, voiceChannel, error }
 */
export const sendPlayerSummon = async (player, summonedBy, summonData) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping summon notification');
    return { success: false, error: 'Bot not ready' };
  }

  if (!player.discordId) {
    console.warn('[Discord Bot] Player has no Discord ID, cannot send summon');
    return { success: false, error: 'Player has no Discord ID' };
  }

  const { date, timeStart, timeEnd, reason } = summonData;
  const summonerName = summonedBy?.username || summonedBy?.discordUsername || 'Admin';

  try {
    // Format date for display
    const dateObj = new Date(date + 'T00:00:00'); // Force local timezone
    const dateFR = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const dateEN = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Calculate deletion time (date + timeEnd + 30 seconds)
    const [endHour, endMinute] = timeEnd.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    const deletionTime = new Date(year, month - 1, day, endHour, endMinute, 30, 0); // 30 seconds after end time
    
    const now = new Date();
    const msUntilDeletion = deletionTime.getTime() - now.getTime();
    

    // Create voice channel in Support-Ticket category
    let voiceChannel = null;
    try {
      const category = await client.channels.fetch(SUPPORT_TICKET_CATEGORY_ID);
      if (category) {
        const guild = category.guild;
        const channelName = `\uD83D\uDCDE ${player.username || player.discordUsername}`;
        
        
        // Build permission overwrites
        const permissionOverwrites = [
          {
            // Deny everyone from joining
            id: guild.id,
            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
          },
          {
            // Allow the summoned player to join and see (using Discord ID directly)
            id: player.discordId,
            type: 1, // 1 = member
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak]
          },
          {
            // Allow admins (role ID for admin)
            id: '1450169699710144644',
            type: 0, // 0 = role
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers]
          },
          {
            // Allow staff (role ID for staff)
            id: '1450169557451935784',
            type: 0, // 0 = role
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers]
          },
          {
            // Allow arbitres (role ID for arbitre)
            id: '1461108156913680647',
            type: 0, // 0 = role
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers]
          }
        ];
        
        // Create channel with restricted permissions
        voiceChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: category,
          userLimit: 2,
          reason: `Convocation de ${player.username || player.discordUsername} par ${summonerName}`,
          permissionOverwrites: permissionOverwrites
        });
        

        // Voice channel will be cleaned up automatically every 24h
      }
    } catch (channelError) {
      console.error('[Discord Bot] Failed to create summon voice channel:', channelError.message);
    }

    // Get Discord user and send DM
    try {
      const discordUser = await client.users.fetch(player.discordId);
      
      if (discordUser) {
        // Create the embed for the DM
        const embed = new EmbedBuilder()
          .setColor(0x3498DB) // Blue
          .setTitle('\uD83D\uDCE2 CONVOCATION / SUMMON')
          .setDescription('Vous \u00eates convoqu\u00e9(e) par l\'\u00e9quipe NoMercy.\nYou have been summoned by the NoMercy team.')
          .addFields(
            { name: '\uD83C\uDDEB\uD83C\uDDF7 Message', value: `Vous \u00eates convoqu\u00e9(e) par **${summonerName}** le **${dateFR}** entre **${timeStart}** et **${timeEnd}**.\n\n**Raison:** ${reason}`, inline: false },
            { name: '\uD83C\uDDEC\uD83C\uDDE7 Message', value: `You are summoned by **${summonerName}** on **${dateEN}** between **${timeStart}** and **${timeEnd}**.\n\n**Reason:** ${reason}`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'NoMercy - Arbitrage' });

        // Add voice channel info and instructions
        if (voiceChannel) {
          embed.addFields(
            { name: '\uD83D\uDCCD O\u00f9 se rendre / Where to go', value: `**Serveur Discord NoMercy** \u2192 Cat\u00e9gorie **Support-Ticket**\n**NoMercy Discord Server** \u2192 **Support-Ticket** category`, inline: false },
            { name: '\uD83C\uDFA4 Salon vocal / Voice channel', value: `Un salon vocal privé a été créé pour vous: **${voiceChannel.name}**
A private voice channel has been created for you: **${voiceChannel.name}**`, inline: false }
          );
        } else {
          embed.addFields(
            { name: '\uD83D\uDCCD O\u00f9 se rendre / Where to go', value: `**Serveur Discord NoMercy** \u2192 Cat\u00e9gorie **Support-Ticket**\n**NoMercy Discord Server** \u2192 **Support-Ticket** category`, inline: false }
          );
        }

        // Send the DM
        await discordUser.send({ embeds: [embed] });

        // Log to admin channel
        const adminEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('\uD83D\uDCE2 CONVOCATION ENVOY\u00c9E')
          .setThumbnail(getPlayerAvatarUrl(player))
          .addFields(
            { name: '\uD83D\uDC64 Joueur', value: player.username || player.discordUsername || 'N/A', inline: true },
            { name: '\uD83D\uDC6E Convoqu\u00e9 par', value: summonerName, inline: true },
            { name: '\uD83D\uDCC5 Date', value: dateFR, inline: true },
            { name: '\u23F0 Horaire', value: `${timeStart} - ${timeEnd}`, inline: true },
            { name: '\uD83D\uDCDD Raison', value: reason, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'NoMercy Arbitrage' });

        if (voiceChannel) {
          adminEmbed.addFields(
            { name: '\uD83C\uDFA4 Salon vocal', value: `${voiceChannel.name} (suppression auto: ${deletionTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`, inline: true }
          );
        }

        await sendToChannel(ADMIN_LOG_CHANNEL_ID, { embeds: [adminEmbed] });

        return {
          success: true,
          voiceChannel: voiceChannel ? { channelId: voiceChannel.id, channelName: voiceChannel.name } : null
        };
      }
    } catch (dmError) {
      console.error('[Discord Bot] Failed to send summon DM:', dmError.message);
      
      // Still log to admin channel even if DM failed
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('\u26A0\uFE0F CONVOCATION - DM \u00c9CHOU\u00c9')
        .setDescription(`Impossible d'envoyer le DM \u00e0 **${player.username || player.discordUsername}** (DMs ferm\u00e9s ou utilisateur introuvable)`)
        .addFields(
          { name: '\uD83D\uDC6E Convoqu\u00e9 par', value: summonerName, inline: true },
          { name: '\uD83D\uDCC5 Date', value: dateFR, inline: true },
          { name: '\u23F0 Horaire', value: `${timeStart} - ${timeEnd}`, inline: true }
        )
        .setTimestamp();

      if (voiceChannel) {
        errorEmbed.addFields(
          { name: '\uD83C\uDFA4 Salon vocal', value: `${voiceChannel.name} (cr\u00e9\u00e9 malgr\u00e9 l'\u00e9chec du DM)`, inline: true }
        );
      }

      await sendToChannel(ADMIN_LOG_CHANNEL_ID, { embeds: [errorEmbed] });

      return {
        success: false,
        error: 'Failed to send DM (user may have DMs disabled)',
        voiceChannel: voiceChannel ? { channelId: voiceChannel.id, channelName: voiceChannel.name } : null
      };
    }

    return { success: false, error: 'Could not fetch Discord user' };
  } catch (error) {
    console.error('[Discord Bot] Error sending summon:', error.message);
    return { success: false, error: error.message };
  }
};

export default {
  initDiscordBot,
  logPlayerBan,
  logPlayerUnban,
  logPlayerWarn,
  logRankedBan,
  logRankedUnban,
  logReferentBan,
  logAdminAction,
  logAdminMessage,
  logArbitratorCall,
  createMatchVoiceChannels,
  deleteMatchVoiceChannels,
  setShuttingDown,
  getShuttingDown,
  sendPlayerSummon
};
