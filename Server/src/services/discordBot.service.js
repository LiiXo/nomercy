import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

// Discord channel IDs
const ADMIN_LOG_CHANNEL_ID = '1463997106204184690';
const BAN_LOG_CHANNEL_ID = '1463997518412255488';
const ARBITRATOR_CHANNEL_ID = '1464005794289815746';

// Discord role IDs to mention in ban notifications
const BAN_MENTION_ROLES = ['1450169699710144644', '1450169557451935784'];
const ROLE_MENTIONS = BAN_MENTION_ROLES.map(id => `<@&${id}>`).join(' ');

// Arbitrator role ID to mention in arbitrator calls
const ARBITRATOR_ROLE_ID = '1461108156913680647';

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
      { name: '📋 Statut', value: match.status || 'N/A', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage' });

  // Add button-like link field
  embed.addFields(
    { name: '🔗 Accéder à la feuille de match', value: `[Cliquez ici pour voir le match](${matchUrl})`, inline: false }
  );

  await sendToChannel(ARBITRATOR_CHANNEL_ID, { 
    content: `<@&${ARBITRATOR_ROLE_ID}>`, 
    embeds: [embed] 
  });
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
  logArbitratorCall
};
