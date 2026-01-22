import { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

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

// Discord bot client
let client = null;
let isReady = false;

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

  client.once('ready', () => {
    console.log(`[Discord Bot] ✓ Arbitrage bot connected as ${client.user.tag}`);
    isReady = true;
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
 * @returns {Object} - { team1: { channelId, channelName }, team2: { channelId, channelName } }
 */
export const createMatchVoiceChannels = async (matchId, team1DiscordIds = [], team2DiscordIds = []) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping voice channel creation (client:', !!client, ', isReady:', isReady, ')');
    return null;
  }

  try {
    console.log(`[Discord Bot] Attempting to create voice channels for match ${matchId} in category ${RANKED_VOICE_CATEGORY_ID}`);
    
    // Get the category
    const category = await client.channels.fetch(RANKED_VOICE_CATEGORY_ID);
    if (!category) {
      console.error(`[Discord Bot] Category ${RANKED_VOICE_CATEGORY_ID} not found`);
      return null;
    }

    const guild = category.guild;

    // Generate a random number for this match's voice channels
    const channelNumber = generateRandomChannelNumber();
    
    // Helper function to validate Discord IDs and get valid members
    const getValidMemberIds = async (discordIds) => {
      const validIds = [];
      for (const discordId of discordIds) {
        if (!discordId) continue;
        try {
          // Try to fetch the member to verify they exist in the guild
          const member = await guild.members.fetch(discordId).catch(() => null);
          if (member) {
            validIds.push(discordId);
          } else {
            console.warn(`[Discord Bot] Member ${discordId} not found in guild, skipping permission`);
          }
        } catch (e) {
          console.warn(`[Discord Bot] Could not fetch member ${discordId}: ${e.message}`);
        }
      }
      return validIds;
    };
    
    // Validate Discord IDs for both teams
    const validTeam1Ids = await getValidMemberIds(team1DiscordIds);
    const validTeam2Ids = await getValidMemberIds(team2DiscordIds);
    
    console.log(`[Discord Bot] Valid members - Team1: ${validTeam1Ids.length}/${team1DiscordIds.length}, Team2: ${validTeam2Ids.length}/${team2DiscordIds.length}`);
    
    // Build permission overwrites for team 1 channel
    // Everyone can VIEW but only roster players can CONNECT
    const team1Permissions = [
      {
        id: guild.id, // @everyone role
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect]
      }
    ];
    
    // Allow each validated team 1 player
    for (const discordId of validTeam1Ids) {
      team1Permissions.push({
        id: discordId,
        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak]
      });
    }
    
    // Build permission overwrites for team 2 channel
    // Everyone can VIEW but only roster players can CONNECT
    const team2Permissions = [
      {
        id: guild.id, // @everyone role
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect]
      }
    ];
    
    // Allow each validated team 2 player
    for (const discordId of validTeam2Ids) {
      team2Permissions.push({
        id: discordId,
        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak]
      });
    }
    
    // Use last 4 characters of matchId as unique identifier
    const matchCode = matchId.slice(-4).toUpperCase();
    
    // Create team 1 voice channel with restricted permissions
    const team1ChannelName = `🔵 Blue #${matchCode}`;
    const team1Channel = await guild.channels.create({
      name: team1ChannelName,
      type: ChannelType.GuildVoice,
      parent: RANKED_VOICE_CATEGORY_ID,
      permissionOverwrites: team1Permissions,
      reason: `Match classé ${matchId}`
    });

    // Create team 2 voice channel with restricted permissions
    const team2ChannelName = `🔴 Red #${matchCode}`;
    const team2Channel = await guild.channels.create({
      name: team2ChannelName,
      type: ChannelType.GuildVoice,
      parent: RANKED_VOICE_CATEGORY_ID,
      permissionOverwrites: team2Permissions,
      reason: `Match classé ${matchId}`
    });

    console.log(`[Discord Bot] Created voice channels for match ${matchId}: #${matchCode} (Blue: ${validTeam1Ids.length} players, Red: ${validTeam2Ids.length} players)`);

    return {
      team1: { channelId: team1Channel.id, channelName: team1ChannelName },
      team2: { channelId: team2Channel.id, channelName: team2ChannelName }
    };
  } catch (error) {
    console.error(`[Discord Bot] Failed to create voice channels for match ${matchId}:`, error.message);
    return null;
  }
};

/**
 * Delete voice channels for a ranked match (disconnect users first)
 * @param {string} team1ChannelId - The team 1 voice channel ID
 * @param {string} team2ChannelId - The team 2 voice channel ID
 */
export const deleteMatchVoiceChannels = async (team1ChannelId, team2ChannelId) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping voice channel deletion');
    return;
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
          console.log(`[Discord Bot] Deleted voice channel ${team1ChannelId}`);
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
          console.log(`[Discord Bot] Deleted voice channel ${team2ChannelId}`);
        }
      } catch (e) {
        console.warn(`[Discord Bot] Could not delete team 2 channel: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('[Discord Bot] Error deleting voice channels:', error.message);
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
  deleteMatchVoiceChannels
};
