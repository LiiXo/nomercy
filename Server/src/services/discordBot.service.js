import { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

// Discord channel IDs
const ADMIN_LOG_CHANNEL_ID = '1463997106204184690';
const BAN_LOG_CHANNEL_ID = '1463997518412255488';
const ARBITRATOR_CHANNEL_ID = '1464005794289815746';
const IRIS_LOGS_CHANNEL_ID = '1468864868634460202';

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

// Socket.io instance for emitting events
let io = null;

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
export const initDiscordBot = async (socketIo) => {
  // Store socket.io instance
  io = socketIo;
  
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

  // Handle button interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Handle cancel stricker match button
    if (customId.startsWith('cancel_stricker_match_')) {
      const matchId = customId.replace('cancel_stricker_match_', '');
      
      try {
        // Dynamically import StrickerMatch model to avoid circular dependencies
        const { default: StrickerMatch } = await import('../models/StrickerMatch.js');
        
        const match = await StrickerMatch.findById(matchId)
          .populate('team1Squad', 'name')
          .populate('team2Squad', 'name');
        
        if (!match) {
          await interaction.reply({ content: '❌ Match non trouvé.', ephemeral: true });
          return;
        }
        
        if (match.status === 'completed' || match.status === 'cancelled') {
          await interaction.reply({ content: '❌ Ce match est déjà terminé ou annulé.', ephemeral: true });
          return;
        }
        
        // Cancel the match
        match.status = 'cancelled';
        match.cancelledAt = new Date();
        match.cancelledBy = 'discord_arbitrator';
        match.cancelReason = 'Annulé par arbitre via Discord (équipe AFK)';
        await match.save();
        
        // Emit socket event to notify all players in the match
        if (io) {
          io.to(`stricker-match-${matchId}`).emit('strickerMatchCancelled', {
            matchId: matchId,
            reason: 'Annulé par arbitre (équipe AFK)'
          });
        }
        
        // Update the original message to show it's been cancelled
        const cancelledEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green
          .setTitle('✅ MATCH ANNULÉ')
          .setDescription(`Le match a été annulé avec succès par un arbitre.`)
          .addFields(
            { name: '🎮 Match', value: `${match.team1Squad?.name || 'Équipe 1'} vs ${match.team2Squad?.name || 'Équipe 2'}`, inline: false },
            { name: '📋 Match ID', value: `\`${matchId}\``, inline: true },
            { name: '👮 Annulé par', value: interaction.user.tag, inline: true },
            { name: '⏰ Date', value: new Date().toLocaleString('fr-FR'), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'NoMercy Stricker' });
        
        await interaction.update({ embeds: [cancelledEmbed], components: [] });
        
      } catch (error) {
        console.error('[Discord Bot] Error cancelling stricker match:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'annulation du match.', ephemeral: true });
      }
    }
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
    .setTitle('\u{1F6A8} APPEL ARBITRE')
    .setDescription(`Un joueur demande l'intervention d'un arbitre !`)
    .addFields(
      { name: '\u{1F464} Appel\u00e9 par', value: calledBy?.username || 'Inconnu', inline: true },
      { name: '\u{1F3AE} Mode', value: modeLabel, inline: true },
      { name: '\u{1F4CA} Format', value: formatLabel, inline: true },
      { name: '\u{1F3AF} Mode de jeu', value: match.gameMode || 'N/A', inline: true },
      { name: '\u{1F194} Match ID', value: match._id?.toString() || 'N/A', inline: true },
      { name: '\u{1F4CB} Statut', value: match.status || 'N/A', inline: true },
      { name: '\u{1F399}\u{FE0F} Salons vocaux', value: `**E1:** ${team1VoiceChannel}\n**E2:** ${team2VoiceChannel}`, inline: false }
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
 * Log a Stricker arbitrator call to Discord (ARBITRATOR_CHANNEL)
 * Sends notification when a player calls for an arbitrator during a Stricker match
 */
export const logStrickerArbitratorCall = async (match, calledBy) => {
  // Use the match mode (hardcore or cdl) for the URL
  const mode = match.mode || 'hardcore';
  const matchUrl = `https://nomercy.ggsecure.io/${mode}/stricker/match/${match._id}`;
  
  // Get team names
  const team1Name = match.team1Squad?.name || 'Equipe 1';
  const team2Name = match.team2Squad?.name || 'Equipe 2';
  
  // Get voice channel info
  const team1VoiceChannel = match.team1VoiceChannel?.channelName || 'N/A';
  const team2VoiceChannel = match.team2VoiceChannel?.channelName || 'N/A';
  
  const embed = new EmbedBuilder()
    .setColor(0x7ED321) // Lime green for Stricker
    .setTitle('\u{1F6A8} APPEL ARBITRE - MODE STRICKER')
    .setDescription(`Un joueur demande l'intervention d'un arbitre !`)
    .addFields(
      { name: '\u{1F464} Appel\u00e9 par', value: calledBy?.username || 'Inconnu', inline: true },
      { name: '\u{1F3AE} Mode', value: 'Stricker (5v5)', inline: true },
      { name: '\u{1F3AF} Mode de jeu', value: 'Search & Destroy', inline: true },
      { name: '\u{1F6E1}\u{FE0F} Equipe 1', value: team1Name, inline: true },
      { name: '\u{1F6E1}\u{FE0F} Equipe 2', value: team2Name, inline: true },
      { name: '\u{1F4CB} Statut', value: match.status || 'N/A', inline: true },
      { name: '\u{1F194} Match ID', value: match._id?.toString() || 'N/A', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage - Stricker' });

  // Add voice channels if they exist
  if (team1VoiceChannel !== 'N/A' || team2VoiceChannel !== 'N/A') {
    embed.addFields(
      { name: '\u{1F399}\u{FE0F} Salons vocaux', value: `**${team1Name}:** ${team1VoiceChannel}\n**${team2Name}:** ${team2VoiceChannel}`, inline: false }
    );
  }

  // Add button-like link field
  embed.addFields(
    { name: '\u200B', value: `[Voir le match](${matchUrl})`, inline: false }
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

// Iris Scan category ID
const IRIS_SCAN_CATEGORY_ID = '1468857562446303305';

/**
 * Create an Iris Scan text channel for a suspicious player
 * @param {Object} player - Player data (username, discordId, discordUsername, etc.)
 * @param {Object} securityStatus - Player's Iris security status
 * @param {Object} admin - Admin who initiated the scan
 * @returns {Object} - { success, channelId, channelUrl, error }
 */
export const createIrisScanChannel = async (player, securityStatus, admin) => {
  if (!client || !isReady) {
    return { success: false, error: 'Discord bot not ready' };
  }

  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      return { success: false, error: 'No guild found' };
    }

    // Fetch the category to sync permissions
    const category = await client.channels.fetch(IRIS_SCAN_CATEGORY_ID).catch(() => null);
    if (!category) {
      return { success: false, error: 'Iris Scan category not found' };
    }

    // Create channel name from player username (sanitize for Discord)
    const channelName = `scan-${(player.username || player.discordUsername || 'inconnu').toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30)}`;

    // Check if a channel with this name already exists in the category
    const existingChannel = category.children?.cache?.find(ch => ch.name === channelName);
    if (existingChannel) {
      return { 
        success: true, 
        channelId: existingChannel.id, 
        channelUrl: `https://discord.com/channels/${guild.id}/${existingChannel.id}`,
        alreadyExists: true
      };
    }

    // Create the text channel with synced permissions from category
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: IRIS_SCAN_CATEGORY_ID,
      reason: `Iris Scan pour ${player.username || player.discordUsername} par ${admin.username}`
    });

    // Sync permissions with the category
    await channel.lockPermissions();

    // Build security status fields
    const securityFields = [];
    
    if (securityStatus) {
      // TPM Status
      const tpmStatus = securityStatus.tpm?.enabled ? '✅ Actif' : '❌ Désactivé';
      const tpmVersion = securityStatus.tpm?.version || 'N/A';
      securityFields.push({ name: '🔐 TPM 2.0', value: `${tpmStatus}\nVersion: ${tpmVersion}`, inline: true });
      
      // Secure Boot
      securityFields.push({ 
        name: '🛡️ Secure Boot', 
        value: securityStatus.secureBoot ? '✅ Actif' : '❌ Désactivé', 
        inline: true 
      });
      
      // Virtualization
      securityFields.push({ 
        name: '💻 Virtualisation', 
        value: securityStatus.virtualization ? '✅ Actif' : '❌ Désactivé', 
        inline: true 
      });
      
      // IOMMU
      securityFields.push({ 
        name: '🔄 IOMMU', 
        value: securityStatus.iommu ? '✅ Actif' : '❌ Désactivé', 
        inline: true 
      });
      
      // HVCI
      securityFields.push({ 
        name: '🔒 HVCI', 
        value: securityStatus.hvci ? '✅ Actif' : '❌ Désactivé', 
        inline: true 
      });
      
      // VBS
      securityFields.push({ 
        name: '🛡️ VBS', 
        value: securityStatus.vbs ? '✅ Actif' : '❌ Désactivé', 
        inline: true 
      });
      
      // Windows Defender
      const defenderRealtime = securityStatus.defenderRealtime ? ' (Temps réel)' : '';
      securityFields.push({ 
        name: '🦠 Defender', 
        value: securityStatus.defender ? `✅ Actif${defenderRealtime}` : '❌ Désactivé', 
        inline: true 
      });
      
      // Integrity check
      if (securityStatus.tamperDetected) {
        securityFields.push({ 
          name: '⚠️ ALERTE INTÉGRITÉ', 
          value: `Falsification détectée!\n${securityStatus.verificationIssues?.join(', ') || 'Problèmes détectés'}`, 
          inline: false 
        });
      } else if (securityStatus.verified) {
        securityFields.push({ 
          name: '✅ Intégrité', 
          value: 'Données vérifiées', 
          inline: true 
        });
      }
    } else {
      securityFields.push({ 
        name: '❓ Statut', 
        value: 'Aucune donnée de sécurité disponible', 
        inline: false 
      });
    }

    // Create the player info embed
    const playerEmbed = new EmbedBuilder()
      .setColor(securityStatus?.tamperDetected ? 0xFF6B2C : 0x9333EA) // Orange if tamper, Purple otherwise
      .setTitle(`🔍 IRIS SCAN - ${player.username || player.discordUsername}`)
      .setThumbnail(player.avatarUrl || `https://cdn.discordapp.com/embed/avatars/0.png`)
      .addFields(
        { name: '👤 Joueur', value: player.username || 'Non défini', inline: true },
        { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
        { name: '🆔 Discord ID', value: player.discordId || 'N/A', inline: true },
        { name: '🖥️ Plateforme', value: player.platform || 'N/A', inline: true },
        { name: '🎯 Activision ID', value: player.activisionId || 'Non renseigné', inline: true },
        { name: '📅 Inscription', value: player.createdAt ? new Date(player.createdAt).toLocaleDateString('fr-FR') : 'N/A', inline: true },
        ...securityFields
      )
      .setTimestamp()
      .setFooter({ text: `Scan initié par ${admin.username}` });

    // Send the embed to the channel
    await channel.send({ embeds: [playerEmbed] });

    // If player has hardware ID, add it as a separate message
    if (player.hardwareId) {
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle('🔧 Hardware ID')
          .setDescription(`\`\`\`${player.hardwareId}\`\`\``)
        ]
      });
    }

    // Send cheat detection embed if cheats were found
    if (securityStatus?.cheatDetection?.found) {
      // Risk level colors
      const riskColors = {
        'critical': 0xFF0000, // Red
        'high': 0xFF6B2C,     // Orange
        'medium': 0xFFA500,   // Yellow-Orange
        'low': 0x10B981       // Green
      };
      
      const riskLevel = securityStatus.cheatDetection.riskLevel || 'critical';
      const riskScore = securityStatus.cheatDetection.riskScore || 100;
      
      // Risk Assessment Summary Embed
      const riskEmbed = new EmbedBuilder()
        .setColor(riskColors[riskLevel] || 0xFF0000)
        .setTitle(`🚨 ALERTE SÉCURITÉ - NIVEAU ${riskLevel.toUpperCase()}`)
        .setDescription(`**Score de risque: ${riskScore}/100**\n\n${riskLevel === 'critical' ? '🔴 **Périphérique de triche confirmé!**' : riskLevel === 'high' ? '🟠 **Forte suspicion de triche**' : '🟡 **Activité suspecte détectée**'}`);
      
      // Add games running
      if (securityStatus.cheatDetection.gamesRunning?.length > 0) {
        riskEmbed.addFields({ 
          name: '🎮 Jeux en cours', 
          value: securityStatus.cheatDetection.gamesRunning.map(g => `• **${g.display}** (${g.processName})`).join('\n').substring(0, 1024), 
          inline: true 
        });
      }
      
      // Quick stats
      riskEmbed.addFields(
        { name: '🔌 Périphériques triche', value: `${securityStatus.cheatDetection.devices?.length || 0}`, inline: true },
        { name: '💻 Logiciels suspects', value: `${securityStatus.cheatDetection.processes?.length || 0}`, inline: true }
      );
      
      await channel.send({ embeds: [riskEmbed] });
      
      // Detailed cheat detection embed
      const cheatEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔍 DÉTAILS DE DÉTECTION');

      // Add detected devices with severity
      if (securityStatus.cheatDetection.devices?.length > 0) {
        const criticalDevices = securityStatus.cheatDetection.devices.filter(d => d.severity === 'critical');
        const otherDevices = securityStatus.cheatDetection.devices.filter(d => d.severity !== 'critical');
        
        if (criticalDevices.length > 0) {
          const devicesList = criticalDevices
            .map(d => `🔴 **${d.type}**: ${d.name || 'N/A'} (VID:${d.vid || 'N/A'} PID:${d.pid || 'N/A'})`)
            .join('\n');
          cheatEmbed.addFields({ name: '⚠️ Périphériques CRITIQUES', value: devicesList.substring(0, 1024), inline: false });
        }
        
        if (otherDevices.length > 0) {
          const devicesList = otherDevices
            .map(d => `🟡 **${d.type}**: ${d.name || 'N/A'}`)
            .join('\n');
          cheatEmbed.addFields({ name: '🟠 Adaptateurs suspects', value: devicesList.substring(0, 1024), inline: false });
        }
      }

      // Add detected processes
      if (securityStatus.cheatDetection.processes?.length > 0) {
        const processesList = securityStatus.cheatDetection.processes
          .map(p => `• **${p.name}** (PID: ${p.pid}) - Détecté: *${p.matchedCheat || 'suspect'}*`)
          .join('\n');
        cheatEmbed.addFields({ name: '💻 Logiciels de triche/macro', value: processesList.substring(0, 1024), inline: false });
      }
      
      // Add suspicious USB devices (microcontrollers)
      if (securityStatus.cheatDetection.suspiciousUsb?.length > 0) {
        const suspiciousList = securityStatus.cheatDetection.suspiciousUsb
          .map(u => `• ${u.name} - *${u.reason || 'Suspect'}*`)
          .join('\n');
        cheatEmbed.addFields({ name: '🔌 USB Suspects (Microcontrôleurs)', value: suspiciousList.substring(0, 1024), inline: false });
      }

      // Add all warnings
      if (securityStatus.cheatDetection.warnings?.length > 0) {
        cheatEmbed.addFields({ 
          name: '📝 Résumé', 
          value: securityStatus.cheatDetection.warnings.join('\n').substring(0, 1024), 
          inline: false 
        });
      }

      await channel.send({ embeds: [cheatEmbed] });
    }

    // Send USB devices embed
    if (securityStatus?.usbDevices?.length > 0) {
      const usbEmbed = new EmbedBuilder()
        .setColor(0x10B981) // Green
        .setTitle('🔌 Périphériques USB')
        .setDescription(`${securityStatus.usbDevices.length} périphérique(s) USB détecté(s)`);

      // Group USB devices in chunks of 10 for readability
      const usbList = securityStatus.usbDevices.slice(0, 25).map(device => {
        const vidPid = device.vid && device.pid ? ` (VID:${device.vid} PID:${device.pid})` : '';
        return `• ${device.name || 'Inconnu'}${vidPid}`;
      }).join('\n');

      usbEmbed.addFields({ name: 'Liste des périphériques', value: usbList.substring(0, 1024) || 'Aucun', inline: false });

      if (securityStatus.usbDevices.length > 25) {
        usbEmbed.setFooter({ text: `Et ${securityStatus.usbDevices.length - 25} autres périphériques...` });
      }

      await channel.send({ embeds: [usbEmbed] });
    }

    // Send processes embed
    if (securityStatus?.processes?.length > 0) {
      // Sort processes and show top ones by relevance
      const processEmbed = new EmbedBuilder()
        .setColor(0x6366F1) // Indigo
        .setTitle('⚙️ Liste des Processus')
        .setDescription(`${securityStatus.processes.length} processus en cours d'exécution`);

      // Show first 30 processes
      const processList = securityStatus.processes.slice(0, 30).map(p => {
        const path = p.path ? ` - ${p.path.substring(0, 40)}...` : '';
        return `• ${p.name} (PID: ${p.pid})`;
      }).join('\n');

      processEmbed.addFields({ name: 'Processus actifs', value: processList.substring(0, 1024) || 'Aucun', inline: false });

      if (securityStatus.processes.length > 30) {
        processEmbed.setFooter({ text: `Et ${securityStatus.processes.length - 30} autres processus...` });
      }

      await channel.send({ embeds: [processEmbed] });
    }

    console.log(`[Discord Bot] Iris Scan channel created for ${player.username || player.discordUsername}`);
    if (securityStatus?.cheatDetection?.found) {
      console.warn(`[Discord Bot] CHEAT DETECTED for ${player.username || player.discordUsername}`);
    }

    return { 
      success: true, 
      channelId: channel.id, 
      channelUrl: `https://discord.com/channels/${guild.id}/${channel.id}`,
      alreadyExists: false
    };
  } catch (error) {
    console.error('[Discord Bot] Error creating Iris Scan channel:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send connection/disconnection notification to a player's Iris scan channel
 * @param {string} channelId - The Discord channel ID
 * @param {Object} player - Player info (username, discordUsername)
 * @param {string} status - 'connected' or 'disconnected'
 * @param {Object} securityData - Optional security data to include on connection
 * @returns {Object} - { success, error }
 */
export const sendIrisConnectionStatus = async (channelId, player, status, securityData = null) => {
  if (!client || !isReady) {
    return { success: false, error: 'Discord bot not ready' };
  }

  if (!channelId) {
    return { success: false, error: 'No channel ID provided' };
  }

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    const now = new Date().toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    });

    if (status === 'connected') {
      // Connected notification
      const connectEmbed = new EmbedBuilder()
        .setColor(0x22C55E) // Green
        .setTitle('🟢 CONNECTÉ À IRIS')
        .setDescription(`**${player.username || player.discordUsername}** vient de se connecter.`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true }
        )
        .setTimestamp();
      
      // Add cheat detection alert if found
      if (securityData?.cheatDetection?.found) {
        const riskLevel = securityData.cheatDetection.riskLevel || 'unknown';
        const riskScore = securityData.cheatDetection.riskScore || 0;
        
        connectEmbed.setColor(riskLevel === 'critical' ? 0xFF0000 : riskLevel === 'high' ? 0xFF6B2C : 0xFFA500);
        connectEmbed.addFields(
          { name: '🚨 Alerte', value: `Niveau: **${riskLevel.toUpperCase()}** (Score: ${riskScore})`, inline: true }
        );
        
        if (securityData.cheatDetection.devices?.length > 0) {
          connectEmbed.addFields({
            name: '🔌 Périphériques détectés',
            value: securityData.cheatDetection.devices.map(d => `• ${d.type || d.name}`).join('\n').substring(0, 500),
            inline: false
          });
        }
        
        if (securityData.cheatDetection.processes?.length > 0) {
          connectEmbed.addFields({
            name: '💻 Logiciels suspects',
            value: securityData.cheatDetection.processes.map(p => `• ${p.name}`).join('\n').substring(0, 500),
            inline: false
          });
        }
        
        if (securityData.cheatDetection.gamesRunning?.length > 0) {
          connectEmbed.addFields({
            name: '🎮 Jeux en cours',
            value: securityData.cheatDetection.gamesRunning.map(g => g.display).join(', '),
            inline: true
          });
        }
      }
      
      await channel.send({ embeds: [connectEmbed] });
      
    } else if (status === 'disconnected') {
      // Disconnected notification
      const disconnectEmbed = new EmbedBuilder()
        .setColor(0xEF4444) // Red
        .setTitle('🔴 DÉCONNECTÉ D\'IRIS')
        .setDescription(`**${player.username || player.discordUsername}** s'est déconnecté.`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true }
        )
        .setTimestamp();
      
      await channel.send({ embeds: [disconnectEmbed] });
    }

    return { success: true };
  } catch (error) {
    console.error('[Discord Bot] Error sending Iris connection status:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send Iris connection/disconnection log to the global logs channel
 * @param {Object} player - Player info
 * @param {string} status - 'connected' or 'disconnected'
 * @param {Object} extraData - Optional extra data (cheatDetection, etc.)
 */
export const logIrisConnectionStatus = async (player, status, extraData = null) => {
  if (!client || !isReady) return;

  try {
    const now = new Date().toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    });

    let embed;
    
    if (status === 'connected') {
      embed = new EmbedBuilder()
        .setColor(extraData?.cheatDetection?.found ? 0xFF6B2C : 0x22C55E)
        .setTitle('🟢 Connexion Iris')
        .setDescription(`**${player.username || player.discordUsername}** s'est connecté à Iris`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true }
        )
        .setTimestamp();
      
      // Add cheat alert if detected
      if (extraData?.cheatDetection?.found) {
        embed.addFields(
          { name: '🚨 Alerte', value: `Niveau: **${extraData.cheatDetection.riskLevel?.toUpperCase() || 'SUSPECT'}**`, inline: true }
        );
        if (extraData.cheatDetection.devices?.length > 0) {
          embed.addFields({
            name: '🔌 Détection',
            value: extraData.cheatDetection.devices.slice(0, 3).map(d => d.type || d.name).join(', '),
            inline: true
          });
        }
      }
    } else {
      embed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('🔴 Déconnexion Iris')
        .setDescription(`**${player.username || player.discordUsername}** s'est déconnecté d'Iris`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true }
        )
        .setTimestamp();
    }

    await sendToChannel(IRIS_LOGS_CHANNEL_ID, { embeds: [embed] });
  } catch (error) {
    console.error('[Discord Bot] Error logging Iris status:', error.message);
  }
};

/**
 * Alert when a player is in a match but not connected to Iris
 * @param {Object} player - Player info
 * @param {Object} matchInfo - Match information
 */
export const alertIrisMatchDisconnected = async (player, matchInfo) => {
  if (!client || !isReady) return;

  try {
    const now = new Date().toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    });

    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // Orange warning
      .setTitle('⚠️ ALERTE: Joueur en match sans Iris')
      .setDescription(`**${player.username || player.discordUsername}** est en match mais n'est pas connecté à Iris!`)
      .addFields(
        { name: '🎮 Mode', value: matchInfo.mode || 'N/A', inline: true },
        { name: '📋 Match', value: matchInfo.matchId ? `\`${matchInfo.matchId}\`` : 'N/A', inline: true },
        { name: '⏰ Détecté à', value: now, inline: true }
      )
      .setTimestamp();
    
    if (matchInfo.team1 && matchInfo.team2) {
      embed.addFields({
        name: '🎯 Match',
        value: `${matchInfo.team1} vs ${matchInfo.team2}`,
        inline: false
      });
    }

    await sendToChannel(IRIS_LOGS_CHANNEL_ID, { embeds: [embed] });
    
    // Also send to the player's scan channel if they have one
    if (player.irisScanChannelId) {
      await sendToChannel(player.irisScanChannelId, { embeds: [embed] });
    }
  } catch (error) {
    console.error('[Discord Bot] Error alerting Iris match disconnected:', error.message);
  }
};

/**
 * Delete an Iris scan channel when a player account is deleted
 * @param {string} channelId - The Discord channel ID to delete
 * @param {string} playerUsername - The player's username (for logging)
 * @returns {Object} - { success, error }
 */
export const deleteIrisChannel = async (channelId, playerUsername) => {
  if (!client || !isReady) {
    return { success: false, error: 'Discord bot not ready' };
  }

  if (!channelId) {
    return { success: false, error: 'No channel ID provided' };
  }

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    
    if (!channel) {
      console.log(`[Discord Bot] Iris channel ${channelId} not found (may already be deleted)`);
      return { success: true, alreadyDeleted: true };
    }

    // Send a final message before deleting
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ COMPTE SUPPRIMÉ')
        .setDescription(`Le compte de **${playerUsername}** a été supprimé.\nCe salon va être supprimé.`)
        .setTimestamp()
      ]
    }).catch(() => {});

    // Wait a moment before deleting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete the channel
    await channel.delete(`Compte ${playerUsername} supprimé`);
    console.log(`[Discord Bot] Deleted Iris scan channel for ${playerUsername}`);

    return { success: true };
  } catch (error) {
    console.error(`[Discord Bot] Error deleting Iris channel ${channelId}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Channel for Iris shadow bans and security warnings
const IRIS_SHADOW_BAN_CHANNEL_ID = '1468867097504251914';

/**
 * Send notification when a player is shadow banned for cheat detection
 * @param {Object} player - Player data
 * @param {string} reason - What was detected (Cronus, DS4Windows, etc.)
 * @param {number} durationHours - Ban duration in hours
 * @param {Object} detectionDetails - Full detection details
 */
export const sendIrisShadowBan = async (player, reason, durationHours = 24, detectionDetails = null) => {
  if (!client || !isReady) return;

  try {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // Red
      .setTitle('🚨 SHADOW BAN - IRIS DÉTECTION')
      .setDescription(`Un joueur a été automatiquement banni suite à une détection Iris.`)
      .addFields(
        { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
        { name: '🎮 Discord', value: player.discordUsername ? `<@${player.discordId}>` : 'N/A', inline: true },
        { name: '⏰ Durée', value: `${durationHours}h`, inline: true },
        { name: '📋 Raison', value: `Shadow ban pour ${reason}`, inline: false },
        { name: '📅 Expiration', value: expiresAt.toLocaleString('fr-FR'), inline: true }
      );

    // Add detection details if available
    if (detectionDetails) {
      if (detectionDetails.devices && detectionDetails.devices.length > 0) {
        const devicesList = detectionDetails.devices.map(d => `• **${d.type}** - ${d.name}`).join('\n').substring(0, 1024);
        embed.addFields({ name: '🔌 Périphériques détectés', value: devicesList, inline: false });
      }
      if (detectionDetails.processes && detectionDetails.processes.length > 0) {
        const processList = detectionDetails.processes.map(p => `• **${p.name}** (${p.matchedCheat})`).join('\n').substring(0, 1024);
        embed.addFields({ name: '💻 Logiciels détectés', value: processList, inline: false });
      }
      if (detectionDetails.riskScore) {
        embed.addFields({ name: '⚠️ Score de risque', value: `${detectionDetails.riskScore}/100 (${detectionDetails.riskLevel})`, inline: true });
      }
    }

    embed.setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Détection automatique' });

    await sendToChannel(IRIS_SHADOW_BAN_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Shadow ban notification sent for ${player.username}`);
  } catch (error) {
    console.error('[Discord Bot] Error sending shadow ban notification:', error.message);
  }
};

/**
 * Send warning notification when a player has missing security modules
 * @param {Object} player - Player data
 * @param {Array} missingModules - List of missing/disabled security modules
 */
export const sendIrisSecurityWarning = async (player, missingModules) => {
  if (!client || !isReady) return;

  try {
    const modulesList = missingModules.map(m => {
      const icons = {
        'TPM': '🔐',
        'Secure Boot': '🛡️',
        'Virtualization': '💻',
        'IOMMU': '🔄',
        'HVCI': '🔒',
        'VBS': '🛡️',
        'Defender': '🦠'
      };
      return `${icons[m.name] || '⚠️'} **${m.name}**: ${m.status}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // Orange
      .setTitle('⚠️ ALERTE SÉCURITÉ - MODULES MANQUANTS')
      .setDescription(`${player.discordId ? `<@${player.discordId}>` : player.username}, des modules de sécurité sont désactivés sur votre PC.`)
      .addFields(
        { name: '👤 Joueur', value: player.username || 'N/A', inline: true },
        { name: '🎮 Discord', value: player.discordUsername ? `<@${player.discordId}>` : 'N/A', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🔧 Modules à activer', value: modulesList, inline: false },
        { name: '📋 Action requise', value: 'Veuillez activer ces modules dans les paramètres BIOS/UEFI de votre PC.\n**Des sanctions peuvent suivre si ces modules restent désactivés.**', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Avertissement automatique' });

    await sendToChannel(IRIS_SHADOW_BAN_CHANNEL_ID, { 
      content: player.discordId ? `<@${player.discordId}>` : '', 
      embeds: [embed] 
    });
    console.log(`[Discord Bot] Security warning sent for ${player.username}`);
  } catch (error) {
    console.error('[Discord Bot] Error sending security warning:', error.message);
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
  logStrickerArbitratorCall,
  createMatchVoiceChannels,
  deleteMatchVoiceChannels,
  setShuttingDown,
  getShuttingDown,
  sendPlayerSummon,
  sendToChannel,
  createIrisScanChannel,
  sendIrisConnectionStatus,
  logIrisConnectionStatus,
  alertIrisMatchDisconnected,
  deleteIrisChannel,
  sendIrisShadowBan,
  sendIrisSecurityWarning
};
