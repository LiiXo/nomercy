import { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionFlagsBits, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

// Discord channel IDs
const ADMIN_LOG_CHANNEL_ID = '1463997106204184690';
const BAN_LOG_CHANNEL_ID = '1463997518412255488';
const ARBITRATOR_CHANNEL_ID = '1464005794289815746';
const IRIS_LOGS_CHANNEL_ID = '1468864868634460202';
const IRIS_UPDATE_CHANNEL_ID = '1472100045972312076';

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
 * Log a Stricker dispute to Discord (ARBITRATOR_CHANNEL)
 * Sends notification when both referents voted for different winners
 */
export const logStrickerDispute = async (match) => {
  // Use the match mode (hardcore or cdl) for the URL
  const mode = match.mode || 'hardcore';
  const matchUrl = `https://nomercy.ggsecure.io/${mode}/stricker/match/${match._id}`;
  
  // Get team names
  const team1Name = match.team1Squad?.name || 'Equipe 1';
  const team2Name = match.team2Squad?.name || 'Equipe 2';
  
  // Get vote info
  const team1Vote = match.result?.team1Report?.winner;
  const team2Vote = match.result?.team2Report?.winner;
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000) // Red for dispute
    .setTitle('\u{26A0}\u{FE0F} DÉSACCORD DÉTECTÉ - MODE STRICKER')
    .setDescription(`Les deux référents ont voté pour des gagnants différents !`)
    .addFields(
      { name: '\u{1F6E1}\u{FE0F} Equipe 1', value: team1Name, inline: true },
      { name: '\u{1F5F3}\u{FE0F} Vote E1', value: team1Vote === 1 ? team1Name : team2Name, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '\u{1F6E1}\u{FE0F} Equipe 2', value: team2Name, inline: true },
      { name: '\u{1F5F3}\u{FE0F} Vote E2', value: team2Vote === 1 ? team1Name : team2Name, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '\u{1F3AE} Mode', value: 'Stricker (5v5)', inline: true },
      { name: '\u{1F3AF} Mode de jeu', value: 'Search & Destroy', inline: true },
      { name: '\u{1F194} Match ID', value: match._id?.toString() || 'N/A', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'NoMercy Arbitrage - Stricker' });

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

    // Note: USB devices, processes, and detailed cheat info are visible in admin panel
    // Only screenshots will be sent to this channel during scan mode

    console.log(`[Discord Bot] Iris Scan channel created for ${player.username || player.discordUsername}`);
    if (securityStatus?.cheatDetection?.found) {
      console.warn(`[Discord Bot] CHEAT DETECTED for ${player.username || player.discordUsername}`);
      
      // Send a simple cheat alert
      const alertEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 ALERTE - Détection de triche')
        .setDescription(`Logiciel ou périphérique suspect détecté.\nConsultez le panel admin pour plus de détails.`)
        .setTimestamp();
      
      await channel.send({ embeds: [alertEmbed] });
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
    } else if (status === 'security_change') {
      // Security state change notification
      const changeEmbed = new EmbedBuilder()
        .setColor(0xFF6B2C) // Orange-Red
        .setTitle('🔄 CHANGEMENT SÉCURITÉ')
        .setDescription(`L'état de sécurité de **${player.username || player.discordUsername}** a changé.`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true }
        )
        .setTimestamp();
      
      // Add changes list if available
      if (securityData?.changes && securityData.changes.length > 0) {
        const changesList = securityData.changes.map(c => `• ${c}`).join('\n');
        changeEmbed.addFields({
          name: '🔄 Changements',
          value: changesList.substring(0, 1024),
          inline: false
        });
      }
      
      await channel.send({ embeds: [changeEmbed] });
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
 * @param {string} status - 'connected', 'disconnected', or 'shadowbanned'
 * @param {Object} extraData - Optional extra data (cheatDetection, reason, duration, etc.)
 */
export const logIrisConnectionStatus = async (player, status, extraData = null) => {
  if (!client || !isReady) return;

  try {
    const now = new Date().toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    });

    let embed;
    
    if (status === 'shadowbanned') {
      // Shadow ban notification for logs channel
      embed = new EmbedBuilder()
        .setColor(0xFF0000) // Red
        .setTitle('🚫 SHADOW BAN APPLIQUÉ')
        .setDescription(`**${player.username || player.discordUsername}** a été shadow ban automatiquement.`)
        .addFields(
          { name: '⏰ Heure', value: now, inline: true },
          { name: '⏱️ Durée', value: extraData?.duration || '24h', inline: true },
          { name: '📋 Raison interne', value: extraData?.reason || 'logiciel/périphérique suspect', inline: false }
        )
        .setTimestamp();
    } else {
      // Unknown status, ignore
      return;
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
    
    // Note: No longer sending to scan channel - only screenshots go there
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

/**
 * Delete an Iris scan channel when scan mode is disabled by admin
 * @param {string} channelId - The Discord channel ID to delete
 * @param {string} playerUsername - The player's username (for logging)
 * @returns {Object} - { success, error }
 */
export const deleteIrisScanModeChannel = async (channelId, playerUsername) => {
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
        .setColor(0x808080) // Gray
        .setTitle('🔴 SURVEILLANCE TERMINÉE')
        .setDescription(`La surveillance de **${playerUsername}** a été désactivée par un administrateur.\nCe salon va être supprimé.`)
        .setTimestamp()
        .setFooter({ text: 'Iris Anticheat - Surveillance terminée' })
      ]
    }).catch(() => {});

    // Wait a moment before deleting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete the channel
    await channel.delete(`Surveillance de ${playerUsername} terminée`);
    console.log(`[Discord Bot] Deleted Iris scan channel for ${playerUsername} (scan mode disabled)`);

    return { success: true };
  } catch (error) {
    console.error(`[Discord Bot] Error deleting Iris channel ${channelId}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Channel for Iris shadow bans notifications
const IRIS_SHADOW_BAN_CHANNEL_ID = '1463997518412255488';
// Channel for ALL Iris detection alerts (cheats, overlays, DLLs, VMs, etc.)
const IRIS_DETECTION_ALERTS_CHANNEL_ID = '1471469883941195917';

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
 * Send warning notification when a player has missing security modules on connection
 * @param {Object} player - Player data
 * @param {Array} missingModules - List of missing/disabled security modules
 */
export const sendIrisSecurityWarning = async (player, missingModules) => {
  if (!client || !isReady) return;
  if (!missingModules || missingModules.length === 0) return;

  try {
    const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const playerInfo = player.discordId ? `<@${player.discordId}>` : player.username;

    const modulesList = missingModules.map(m => `• **${m.name}**: ${m.status}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Orange - warning
      .setTitle('⚠️ MODULES DE SÉCURITÉ MANQUANTS')
      .setDescription(`Le joueur **${player.username}** s'est connecté avec des modules de sécurité désactivés.`)
      .addFields(
        { name: '👤 Joueur', value: playerInfo, inline: true },
        { name: '⏰ Heure', value: timestamp, inline: true },
        { name: '🛡️ Modules manquants', value: modulesList, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Connexion' });

    await sendToChannel(IRIS_DETECTION_ALERTS_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Security warning sent for ${player.username}: ${missingModules.map(m => m.name).join(', ')}`);
  } catch (error) {
    console.error('[Discord Bot] Error sending security warning:', error.message);
  }
};

/**
 * Send notification when a player's security status changes between heartbeats
 * @param {Object} player - Player data
 * @param {Array} changes - List of security changes detected (e.g., "HVCI: true → false")
 */
export const sendIrisSecurityChange = async (player, changes) => {
  if (!client || !isReady) return;
  if (!changes || changes.length === 0) return;

  try {
    const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const playerInfo = player.discordId ? `<@${player.discordId}>` : player.username;

    const changesList = changes.map(c => `• ${c}`).join('\n');

    // Check if any change is a disable (→ false, → ❌, or "Désactivé")
    const hasDisable = changes.some(c => 
      c.includes('→ false') || 
      c.includes('→ ❌') || 
      (c.includes('true →') && c.includes('false'))
    );

    const embed = new EmbedBuilder()
      .setColor(hasDisable ? 0xEF4444 : 0x10B981) // Red if disabled, green if enabled
      .setTitle(hasDisable ? '🚨 CHANGEMENT DE SÉCURITÉ DÉTECTÉ' : '✅ MODULE DE SÉCURITÉ RÉACTIVÉ')
      .setDescription(hasDisable 
        ? `Le joueur **${player.username}** a **désactivé** un module de sécurité pendant sa session !`
        : `Le joueur **${player.username}** a réactivé un module de sécurité.`)
      .addFields(
        { name: '👤 Joueur', value: playerInfo, inline: true },
        { name: '⏰ Heure', value: timestamp, inline: true },
        { name: '🔄 Changements', value: changesList, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Surveillance en session' });

    await sendToChannel(IRIS_DETECTION_ALERTS_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Security change alert sent for ${player.username}: ${changes.join(', ')}`);
  } catch (error) {
    console.error('[Discord Bot] Error sending security change alert:', error.message);
  }
};

/**
 * Send screenshots, processes, USB devices, and security status to a player's Iris scan channel
 * @param {string} channelId - The Discord channel ID
 * @param {Object} player - Player info
 * @param {Array} screenshots - Array of screenshot objects with base64 data
 * @param {Array} processes - Array of running processes (optional)
 * @param {Array} usbDevices - Array of USB devices (optional)
 * @param {Object} securityStatus - Security module status (optional)
 */
export const sendIrisScreenshots = async (channelId, player, screenshots, processes = [], usbDevices = [], securityStatus = null) => {
  if (!client || !isReady) return { success: false, error: 'Bot not ready' };
  if (!channelId) return { success: false, error: 'No channel ID' };
  if (!screenshots || screenshots.length === 0) return { success: false, error: 'No screenshots' };

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    const now = new Date().toLocaleString('fr-FR', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    });

    // Send header embed
    const headerEmbed = new EmbedBuilder()
      .setColor(0x9333EA) // Purple
      .setTitle('📸 CAPTURE D\'ÉCRAN - MODE SCAN')
      .setDescription(`Capture d'écran automatique de **${player.username || player.discordUsername}**`)
      .addFields(
        { name: '⏰ Heure', value: now, inline: true },
        { name: '🖥️ Écrans', value: `${screenshots.length}`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [headerEmbed] });

    // Send security status embed if available
    if (securityStatus) {
      const getStatusIcon = (value) => value ? '✅' : '❌';
      
      const securityEmbed = new EmbedBuilder()
        .setColor(0x6366F1) // Indigo
        .setTitle('🛡️ ÉTAT DES MODULES DE SÉCURITÉ')
        .addFields(
          { name: '🔐 TPM 2.0', value: getStatusIcon(securityStatus.tpm?.present || securityStatus.tpm?.enabled), inline: true },
          { name: '🛡️ Secure Boot', value: getStatusIcon(securityStatus.secureBoot), inline: true },
          { name: '💻 VT-x/AMD-V', value: getStatusIcon(securityStatus.virtualization), inline: true },
          { name: '🔄 IOMMU', value: getStatusIcon(securityStatus.iommu), inline: true },
          { name: '🔒 VBS', value: getStatusIcon(securityStatus.vbs), inline: true },
          { name: '🔒 HVCI', value: getStatusIcon(securityStatus.hvci), inline: true },
          { name: '🦠 Defender', value: getStatusIcon(securityStatus.defender), inline: true },
          { name: '⏱️ Temps Réel', value: getStatusIcon(securityStatus.defenderRealtime), inline: true }
        )
        .setTimestamp();
      
      await channel.send({ embeds: [securityEmbed] });
      console.log(`[Discord Bot] Security status sent for ${player.username}`);
    }

    // Send each screenshot as an attachment
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      
      try {
        // Convert base64 to buffer (camelCase from Rust serde)
        const imageBuffer = Buffer.from(screenshot.dataBase64 || screenshot.data_base64, 'base64');
        
        // Create attachment - use .jpg if it's JPEG compressed
        const extension = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 ? 'jpg' : 'png';
        const attachment = {
          attachment: imageBuffer,
          name: `screenshot_${i + 1}_${Date.now()}.${extension}`
        };

        const embed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle(`🖥️ Écran ${i + 1}`)
          .setDescription(`Résolution: ${screenshot.width}x${screenshot.height}`)
          .setImage(`attachment://${attachment.name}`)
          .setTimestamp();

        await channel.send({ 
          embeds: [embed],
          files: [attachment]
        });

        console.log(`[Discord Bot] Screenshot ${i + 1} sent for ${player.username}`);
      } catch (imgError) {
        console.error(`[Discord Bot] Error sending screenshot ${i + 1}:`, imgError.message);
      }
    }

    // Send processes list if available
    if (processes && processes.length > 0) {
      // Sort processes alphabetically and remove duplicates
      const uniqueProcesses = [...new Set(processes.map(p => p.name || p))].sort();
      
      // Split into chunks if too long (Discord has 4096 char limit for embed description)
      const processList = uniqueProcesses.join('\n');
      const chunks = [];
      let currentChunk = '';
      
      for (const proc of uniqueProcesses) {
        if ((currentChunk + proc + '\n').length > 3900) {
          chunks.push(currentChunk);
          currentChunk = proc + '\n';
        } else {
          currentChunk += proc + '\n';
        }
      }
      if (currentChunk) chunks.push(currentChunk);
      
      for (let i = 0; i < chunks.length; i++) {
        const processEmbed = new EmbedBuilder()
          .setColor(0xF59E0B) // Orange
          .setTitle(`📋 PROCESSUS EN COURS ${chunks.length > 1 ? `(${i + 1}/${chunks.length})` : ''}`)
          .setDescription('```\n' + chunks[i] + '```')
          .addFields({ name: 'Total', value: `${uniqueProcesses.length} processus`, inline: true })
          .setTimestamp();
        
        await channel.send({ embeds: [processEmbed] });
      }
      
      console.log(`[Discord Bot] Process list (${uniqueProcesses.length}) sent for ${player.username}`);
    }

    // Send USB devices list if available
    if (usbDevices && usbDevices.length > 0) {
      // Format USB devices
      const deviceList = usbDevices.map(d => {
        const name = d.name || 'Périphérique inconnu';
        const id = d.device_id || d.deviceId || '';
        const manufacturer = d.manufacturer || '';
        return `• ${name}${manufacturer ? ` (${manufacturer})` : ''}`;
      }).join('\n');
      
      // Split if too long
      const chunks = [];
      let currentChunk = '';
      const deviceLines = deviceList.split('\n');
      
      for (const line of deviceLines) {
        if ((currentChunk + line + '\n').length > 3900) {
          chunks.push(currentChunk);
          currentChunk = line + '\n';
        } else {
          currentChunk += line + '\n';
        }
      }
      if (currentChunk) chunks.push(currentChunk);
      
      for (let i = 0; i < chunks.length; i++) {
        const usbEmbed = new EmbedBuilder()
          .setColor(0x10B981) // Green
          .setTitle(`🔌 PÉRIPHÉRIQUES USB ${chunks.length > 1 ? `(${i + 1}/${chunks.length})` : ''}`)
          .setDescription(chunks[i])
          .addFields({ name: 'Total', value: `${usbDevices.length} périphériques`, inline: true })
          .setTimestamp();
        
        await channel.send({ embeds: [usbEmbed] });
      }
      
      console.log(`[Discord Bot] USB devices list (${usbDevices.length}) sent for ${player.username}`);
    }

    console.log(`[Discord Bot] All scan data sent for ${player.username}`);
    return { success: true };
  } catch (error) {
    console.error('[Discord Bot] Error sending screenshots:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send DM notification to console players (PlayStation/Xbox) when their ranked match starts
 * @param {Array} players - Array of match players with user info
 * @param {Object} matchInfo - { matchId, gameMode, mode, teamSize }
 * @returns {Object} - { success, notifiedCount, errors }
 */
export const sendRankedMatchStartDM = async (players, matchInfo) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping ranked match start DM');
    return { success: false, error: 'Bot not ready', notifiedCount: 0 };
  }

  const { matchId, gameMode, mode, teamSize } = matchInfo;
  const format = `${teamSize}v${teamSize}`;
  const modeDisplay = mode === 'cdl' ? 'CDL' : 'Hardcore';
  
  let notifiedCount = 0;
  const errors = [];

  for (const player of players) {
    try {
      // Skip if player has no user data or discordId
      if (!player.user || player.isFake) continue;
      
      // Get the platform from the populated user data
      const platform = player.user.platform;
      const discordId = player.user.discordId;
      
      // Only send to console players (PlayStation or Xbox)
      if (!platform || platform === 'PC' || !discordId) continue;
      
      // Fetch the Discord user
      const discordUser = await client.users.fetch(discordId).catch(() => null);
      if (!discordUser) {
        console.warn(`[Discord Bot] Could not fetch Discord user for ${player.username}`);
        continue;
      }
      
      // Create the embed for the DM
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Red - urgent notification
        .setTitle('🎮 MATCH RANKED TROUVÉ ! / RANKED MATCH FOUND!')
        .setDescription('Votre match classé va commencer !\nYour ranked match is starting!')
        .addFields(
          { 
            name: '🇫🇷 Français', 
            value: `Votre match **${modeDisplay} ${format}** en **${gameMode}** a été trouvé !\n\n🚀 **Rendez-vous sur le site NoMercy** pour rejoindre la feuille de match et voter pour la map.\n\n⚠️ **Attention:** Ne pas rejoindre peut entraîner des sanctions.`, 
            inline: false 
          },
          { 
            name: '🇬🇧 English', 
            value: `Your **${modeDisplay} ${format}** match in **${gameMode}** has been found!\n\n🚀 **Go to the NoMercy website** to join the match sheet and vote for the map.\n\n⚠️ **Warning:** Not joining may result in penalties.`, 
            inline: false 
          },
          { name: '🎮 Format', value: format, inline: true },
          { name: '📋 Mode', value: `${modeDisplay} - ${gameMode}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'NoMercy Ranked' });

      // Send the DM
      await discordUser.send({ embeds: [embed] });
      notifiedCount++;
      console.log(`[Discord Bot] Ranked match start DM sent to ${player.username} (${platform})`);
      
    } catch (dmError) {
      console.warn(`[Discord Bot] Failed to send ranked match DM to ${player.username}: ${dmError.message}`);
      errors.push({ username: player.username, error: dmError.message });
    }
  }

  console.log(`[Discord Bot] Ranked match start DM: ${notifiedCount} console players notified`);
  return { success: true, notifiedCount, errors };
};

// Channel for extended detection alerts (uses same channel as security changes)
const IRIS_EXTENDED_ALERTS_CHANNEL_ID = '1471469883941195917';

/**
 * Send notification for extended anticheat detection alerts
 * Covers: Network Monitor, Registry Scan, Driver Integrity, Macro Detection
 * @param {Object} player - Player data { username, discordUsername, discordId }
 * @param {string} alertType - 'network' | 'registry' | 'driver' | 'macro'
 * @param {Object} data - Detection data
 */
export const sendIrisExtendedAlert = async (player, alertType, data) => {
  if (!client || !isReady) return;

  try {
    let embed;
    const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const playerInfo = player.discordId ? `<@${player.discordId}>` : player.username;

    switch (alertType) {
      case 'network': {
        const adaptersList = data.vpnAdapters?.length > 0
          ? data.vpnAdapters.map(a => `• ${a}`).join('\n').substring(0, 500)
          : 'Aucun';
        const processesList = data.vpnProcesses?.length > 0
          ? data.vpnProcesses.map(p => `• ${p}`).join('\n').substring(0, 500)
          : 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0x3B82F6) // Blue
          .setTitle('🌐 ALERTE RÉSEAU - VPN/PROXY DÉTECTÉ')
          .setDescription(`Activité réseau suspecte détectée pour **${player.username}**.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '🔒 VPN Détecté', value: data.vpnDetected ? '✅ Oui' : '❌ Non', inline: true },
            { name: '🌍 Proxy Détecté', value: data.proxyDetected ? '✅ Oui' : '❌ Non', inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true }
          );

        if (data.vpnAdapters?.length > 0) {
          embed.addFields({ name: '🔌 Adaptateurs VPN', value: adaptersList, inline: false });
        }
        if (data.vpnProcesses?.length > 0) {
          embed.addFields({ name: '💻 Processus VPN', value: processesList, inline: false });
        }
        if (data.proxySettings) {
          embed.addFields({ name: '🌐 Proxy configuré', value: data.proxySettings.substring(0, 256), inline: false });
        }
        break;
      }

      case 'registry': {
        const tracesList = data.traces?.slice(0, 15).map(t => {
          const typeIcons = { install: '📦', uninstall: '🗑️', spoofer: '🎭', driver: '⚙️' };
          return `${typeIcons[t.traceType] || '❓'} **${t.cheatName}** (${t.traceType})\n  \`${t.path}\``;
        }).join('\n') || 'Aucune trace';

        embed = new EmbedBuilder()
          .setColor(0xEF4444) // Red
          .setTitle('🔍 SCAN REGISTRE - TRACES DE TRICHE DÉTECTÉES')
          .setDescription(`Des traces de logiciels de triche ont été trouvées dans le registre de **${player.username}**.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '📊 Nombre de traces', value: `${data.traces?.length || 0}`, inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🔎 Traces détectées', value: tracesList.substring(0, 1024), inline: false }
          );
        break;
      }

      case 'driver': {
        const driversList = data.suspiciousDrivers?.slice(0, 10).map(d => {
          return `• **${d.displayName || d.name}**\n  Raison: ${d.reason}${d.path ? `\n  Chemin: \`${d.path.substring(0, 60)}\`` : ''}`;
        }).join('\n') || 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0xF97316) // Orange
          .setTitle('⚙️ INTÉGRITÉ DRIVERS - PILOTES SUSPECTS DÉTECTÉS')
          .setDescription(`Des pilotes suspects ont été détectés sur le système de **${player.username}**.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '📊 Pilotes suspects', value: `${data.suspiciousDrivers?.length || 0}`, inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🔧 Détails des pilotes', value: driversList.substring(0, 1024), inline: false }
          );
        break;
      }

      case 'macro': {
        const highRiskList = data.highRiskMacros?.slice(0, 10).map(m => {
          const typeIcons = { ahk: '⌨️', generic: '🖱️', logitech: '🎮', razer: '🐍', corsair: '🏴' };
          return `${typeIcons[m.macroType] || '❓'} **${m.name}** (${m.macroType}) - Source: ${m.source}`;
        }).join('\n') || 'Aucun';

        const allMacrosList = data.detectedSoftware?.slice(0, 10).map(m => {
          return `• ${m.name} (${m.macroType})`;
        }).join('\n') || 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0x8B5CF6) // Purple
          .setTitle('⌨️ DÉTECTION MACROS - LOGICIELS SUSPECTS')
          .setDescription(`Des logiciels de macros/scripts ont été détectés sur le système de **${player.username}**.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '📊 Total détecté', value: `${data.detectedSoftware?.length || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🚨 Macros à haut risque', value: highRiskList.substring(0, 1024), inline: false }
          );
        
        if (data.detectedSoftware?.length > data.highRiskMacros?.length) {
          embed.addFields({ name: '📋 Tous les logiciels détectés', value: allMacrosList.substring(0, 1024), inline: false });
        }
        break;
      }

      case 'overlay': {
        const highRiskList = data.highRiskOverlays?.slice(0, 10).map(o => {
          const reasonIcons = { cheat_process: '🎯', suspicious_class: '⚠️', transparent_topmost: '👁️', layered_topmost: '🖼️' };
          return `${reasonIcons[o.reason] || '❓'} **${o.processName || 'Inconnu'}** - ${o.windowTitle || 'Sans titre'}\n  └ Classe: ${o.className || 'N/A'} | Raison: ${o.reason}`;
        }).join('\n') || 'Aucun';

        const allOverlaysList = data.suspiciousOverlays?.slice(0, 10).map(o => {
          return `• ${o.processName || o.windowTitle || 'Inconnu'} (${o.reason})`;
        }).join('\n') || 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0xEC4899) // Pink
          .setTitle('🖼️ OVERLAY SUSPECT DÉTECTÉ')
          .setDescription(`Des fenêtres overlay suspectes ont été détectées sur le système de **${player.username}**.\n\nCes overlays peuvent être utilisés pour afficher des ESP, aimbot visuels, ou autres triches.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '📊 Total détecté', value: `${data.suspiciousOverlays?.length || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🚨 Overlays à haut risque', value: highRiskList.substring(0, 1024), inline: false }
          );
        
        if (data.suspiciousOverlays?.length > data.highRiskOverlays?.length) {
          embed.addFields({ name: '📋 Tous les overlays détectés', value: allOverlaysList.substring(0, 1024), inline: false });
        }
        break;
      }

      case 'dll_injection': {
        const suspiciousDllsList = data.suspiciousDlls?.slice(0, 10).map(d => {
          const isHighRisk = d.reason.toLowerCase().includes('cheat') || d.reason.toLowerCase().includes('inject') || d.reason.toLowerCase().includes('hook');
          return `${isHighRisk ? '🚨' : '⚠️'} **${d.name}**\n  └ ${d.reason}\n  └ Chemin: ${d.path ? d.path.substring(0, 80) : 'N/A'}`;
        }).join('\n\n') || 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0xDC2626) // Deep red
          .setTitle('💉 INJECTION DLL DÉTECTÉE')
          .setDescription(`Des DLLs suspectes ou des outils d'injection ont été détectés sur le système de **${player.username}**.\n\n⚠️ **Alerte critique** - L'injection de DLL est souvent utilisée pour charger des cheats.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '📊 Total détecté', value: `${data.suspiciousDlls?.length || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🔍 DLLs suspectes', value: suspiciousDllsList.substring(0, 1024), inline: false }
          );
        break;
      }

      case 'vm': {
        const indicatorsList = data.vmIndicators?.slice(0, 10).map(indicator => {
          return `• ${indicator}`;
        }).join('\n') || 'Aucun';

        embed = new EmbedBuilder()
          .setColor(0x6366F1) // Indigo
          .setTitle('🖥️ MACHINE VIRTUELLE DÉTECTÉE')
          .setDescription(`Le joueur **${player.username}** semble jouer depuis une machine virtuelle.\n\n⚠️ Les VMs peuvent être utilisées pour tester des cheats ou contourner des bans.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '🖥️ Type de VM', value: data.vmType || 'Inconnu', inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '📊 Indicateurs', value: `${data.vmIndicators?.length || 0}`, inline: true },
            { name: '🔍 Détails de détection', value: indicatorsList.substring(0, 1024), inline: false }
          );
        break;
      }

      case 'cloud_pc': {
        const indicatorsList = data.cloudIndicators?.slice(0, 10).map(indicator => {
          return `• ${indicator}`;
        }).join('\n') || 'Aucun';

        const isGamingEmoji = data.isGamingCloud ? '🎮' : '☁️';
        const gamingLabel = data.isGamingCloud ? 'Cloud Gaming' : 'Cloud PC Général';

        embed = new EmbedBuilder()
          .setColor(data.isGamingCloud ? 0x10B981 : 0xF59E0B) // Green for gaming, Orange for general
          .setTitle(`${isGamingEmoji} ${data.isGamingCloud ? 'CLOUD GAMING' : 'CLOUD PC'} DÉTECTÉ`)
          .setDescription(`Le joueur **${player.username}** semble jouer depuis un **${gamingLabel}**.\n\n${data.isGamingCloud ? 'ℹ️ Les services de cloud gaming (Shadow, GeForce NOW, etc.) sont détectés.' : '⚠️ Les cloud PCs peuvent être utilisés pour masquer l\'identité ou tester des cheats.'}`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '☁️ Fournisseur', value: data.cloudProvider || 'Inconnu', inline: true },
            { name: '🎮 Cloud Gaming', value: data.isGamingCloud ? 'Oui' : 'Non', inline: true },
            { name: '⚠️ Score de risque', value: `${data.riskScore || 0}`, inline: true },
            { name: '🔍 Détails de détection', value: indicatorsList.substring(0, 1024), inline: false }
          );
        break;
      }

      case 'cheat': {
        // Cheat devices (Cronus, XIM, etc.) and processes (DS4Windows, etc.)
        const devicesList = data.devices?.slice(0, 10).map(d => {
          return `🎮 **${d.deviceType || d.name}** ${d.vid ? `(VID: ${d.vid}${d.pid ? `, PID: ${d.pid}` : ''})` : ''}`;
        }).join('\n') || 'Aucun';

        const processesList = data.processes?.slice(0, 10).map(p => {
          return `💻 **${p.name}** (détecté: ${p.matchedCheat}) - PID: ${p.pid}`;
        }).join('\n') || 'Aucun';

        const riskColors = { critical: 0xFF0000, high: 0xFF6B2C, medium: 0xFFA500, low: 0x10B981 };
        const riskEmojis = { critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' };
        const riskLevel = data.riskLevel || 'low';

        embed = new EmbedBuilder()
          .setColor(riskColors[riskLevel] || 0xFF0000)
          .setTitle(`${riskEmojis[riskLevel] || '🎮'} DÉTECTION CHEAT - ${riskLevel.toUpperCase()}`)
          .setDescription(`Des périphériques ou logiciels suspects ont été détectés sur le système de **${player.username}**.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '⚠️ Niveau de risque', value: riskLevel.toUpperCase(), inline: true },
            { name: '📊 Score', value: `${data.riskScore || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }
          );

        if (data.devices?.length > 0) {
          embed.addFields({ name: '🎮 Périphériques détectés', value: devicesList.substring(0, 1024), inline: false });
        }
        if (data.processes?.length > 0) {
          embed.addFields({ name: '💻 Processus détectés', value: processesList.substring(0, 1024), inline: false });
        }
        break;
      }

      case 'cheat_window': {
        // Cheat window/panel detection (CoD specific)
        const windowsList = data.detectedWindows?.slice(0, 15).map(w => {
          const riskIcons = { critical: '🚨', high: '⚠️', medium: '⚡' };
          return `${riskIcons[w.riskLevel] || '❓'} **${w.matchedCheat}**\n  └ Fenêtre: ${w.windowTitle.substring(0, 50)}\n  └ Processus: ${w.processName || 'N/A'}`;
        }).join('\n\n') || 'Aucun';

        // Count by risk level
        const criticalCount = data.detectedWindows?.filter(w => w.riskLevel === 'critical').length || 0;
        const highCount = data.detectedWindows?.filter(w => w.riskLevel === 'high').length || 0;
        const mediumCount = data.detectedWindows?.filter(w => w.riskLevel === 'medium').length || 0;

        // Color based on highest risk
        const embedColor = criticalCount > 0 ? 0xFF0000 : highCount > 0 ? 0xFF6B2C : 0xFFA500;

        embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`🔍 CHEAT PANEL/WINDOW DÉTECTÉ - CoD`)
          .setDescription(`Des fenêtres ou panels de cheats connus ont été détectés sur le système de **${player.username}**.\n\n⚠️ **Alerte sérieuse** - Ces panels sont généralement associés à des logiciels de triche actifs.`)
          .addFields(
            { name: '👤 Joueur', value: playerInfo, inline: true },
            { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
            { name: '⏰ Détecté à', value: timestamp, inline: true },
            { name: '🚨 Critique', value: `${criticalCount}`, inline: true },
            { name: '⚠️ Haut risque', value: `${highCount}`, inline: true },
            { name: '⚡ Moyen', value: `${mediumCount}`, inline: true },
            { name: '📊 Score total', value: `${data.riskScore || 0}`, inline: true },
            { name: '📄 Total détecté', value: `${data.detectedWindows?.length || 0}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🔍 Détails des détections', value: windowsList.substring(0, 1024), inline: false }
          );
        break;
      }

      default:
        console.warn(`[Discord Bot] Unknown extended alert type: ${alertType}`);
        return;
    }

    embed.setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Détection étendue' });

    await sendToChannel(IRIS_EXTENDED_ALERTS_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Extended alert (${alertType}) sent for ${player.username}`);
  } catch (error) {
    console.error(`[Discord Bot] Error sending extended alert (${alertType}):`, error.message);
  }
};

// Channel for game mismatch alerts (uses same channel as detection alerts)
const IRIS_GAME_MISMATCH_CHANNEL_ID = '1471469883941195917';

/**
 * Alert when player is in match but game not detected on Iris machine
 * This indicates potential bypass attempt (Iris running on a different PC than the game)
 * @param {Object} player - Player data { username, discordUsername, discordId }
 * @param {Object} data - Mismatch data { matchType, matchId, irisConnected, gameDetected, hardwareId, mismatchCount }
 */
export const sendIrisGameMismatchAlert = async (player, data) => {
  if (!client || !isReady) return;

  try {
    const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const playerInfo = player.discordId ? `<@${player.discordId}>` : player.username;
    
    // Build match URL based on match type
    let matchUrl;
    if (data.matchType === 'ranked') {
      matchUrl = `https://nomercy.ggsecure.io/ranked/match/${data.matchId}`;
    } else {
      // Stricker - default to hardcore mode
      matchUrl = `https://nomercy.ggsecure.io/hardcore/stricker/match/${data.matchId}`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF4500) // Orange-Red (warning)
      .setTitle('🚨 ALERTE: JEU NON DÉTECTÉ EN MATCH')
      .setDescription(
        `**${player.username}** est en match mais le jeu n'est **PAS détecté** sur sa machine Iris!\n\n` +
        `⚠️ **Possible tentative de contournement** - Iris pourrait tourner sur un PC différent du jeu.`
      )
      .addFields(
        { name: '👤 Joueur', value: playerInfo, inline: true },
        { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
        { name: '⏰ Détecté à', value: timestamp, inline: true },
        { name: '🎯 Type de match', value: data.matchType?.toUpperCase() || 'N/A', inline: true },
        { name: '✅ Iris connecté', value: data.irisConnected ? 'Oui' : 'Non', inline: true },
        { name: '❌ Jeu détecté', value: data.gameDetected ? 'Oui' : 'Non', inline: true },
        { name: '🔢 Détections consécutives', value: `${data.mismatchCount || 0}`, inline: true },
        { name: '🔗 Match', value: `[Voir le match](${matchUrl})`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Détection de contournement' });

    // Add hardware ID if available (for pattern tracking)
    if (data.hardwareId) {
      embed.addFields({
        name: '🖥️ Hardware ID',
        value: `\`${data.hardwareId.substring(0, 16)}...\``,
        inline: false
      });
    }

    await sendToChannel(IRIS_GAME_MISMATCH_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Game mismatch alert sent for ${player.username}`);
  } catch (error) {
    console.error('[Discord Bot] Error sending game mismatch alert:', error.message);
  }
};

/**
 * Send alert when a player has suspiciously low window activity during a match
 * This indicates the game is running but player isn't actually playing (possible bypass)
 * @param {Object} player - Player data { username, discordUsername, discordId }
 * @param {Object} data - Activity data { matchType, matchId, activityPercentage, totalSamples, activeSamples, consecutiveInactive, hardwareId }
 */
export const sendIrisLowActivityAlert = async (player, data) => {
  if (!client || !isReady) return;

  try {
    const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const playerInfo = player.discordId ? `<@${player.discordId}>` : player.username;
    
    // Build match URL based on match type
    let matchUrl;
    if (data.matchType === 'ranked') {
      matchUrl = `https://nomercy.ggsecure.io/ranked/match/${data.matchId}`;
    } else {
      // Stricker - default to hardcore mode
      matchUrl = `https://nomercy.ggsecure.io/hardcore/stricker/match/${data.matchId}`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // Orange (warning)
      .setTitle('⚠️ ALERTE: FAIBLE ACTIVITÉ JEU DÉTECTÉE')
      .setDescription(
        `**${player.username}** a le jeu lancé mais la fenêtre est rarement active!\n\n` +
        `🎮 Le jeu tourne sur la machine Iris mais le joueur ne semble **PAS vraiment jouer**.\n` +
        `⚠️ **Possible contournement** - Le jeu pourrait être lancé en arrière-plan pendant que le joueur joue sur un autre PC.`
      )
      .addFields(
        { name: '👤 Joueur', value: playerInfo, inline: true },
        { name: '🎮 Discord', value: player.discordUsername || 'N/A', inline: true },
        { name: '⏰ Détecté à', value: timestamp, inline: true },
        { name: '🎯 Type de match', value: data.matchType?.toUpperCase() || 'N/A', inline: true },
        { name: '📊 Activité fenêtre', value: `**${data.activityPercentage}%**`, inline: true },
        { name: '📈 Échantillons', value: `${data.activeSamples}/${data.totalSamples} actifs`, inline: true },
        { name: '⏸️ Inactivité consécutive', value: `${data.consecutiveInactive} cycles`, inline: true },
        { name: '🔗 Match', value: `[Voir le match](${matchUrl})`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Iris Anticheat - Détection d\'activité suspecte' });

    // Add hardware ID if available (for pattern tracking)
    if (data.hardwareId) {
      embed.addFields({
        name: '🖥️ Hardware ID',
        value: `\`${data.hardwareId.substring(0, 16)}...\``,
        inline: false
      });
    }

    await sendToChannel(IRIS_GAME_MISMATCH_CHANNEL_ID, { embeds: [embed] });
    console.log(`[Discord Bot] Low activity alert sent for ${player.username} (${data.activityPercentage}% activity)`);
  } catch (error) {
    console.error('[Discord Bot] Error sending low activity alert:', error.message);
  }
};

/**
 * Send notification when a new Iris update is published
 * @param {Object} updateData - { version, changelog }
 */
export const sendIrisUpdateNotification = async (updateData) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping Iris update notification');
    return false;
  }

  try {
    const { version, changelog } = updateData;
    
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6) // Purple for Iris
      .setTitle('🔄 MISE À JOUR IRIS / IRIS UPDATE')
      .setDescription(
        `**🇫🇷 Français:**\n` +
        `Une nouvelle version d'Iris est disponible ! Veuillez redémarrer Iris pour mettre à jour automatiquement.\n\n` +
        `**🇬🇧 English:**\n` +
        `A new Iris version is available! Please restart Iris to update automatically.`
      )
      .addFields(
        { name: '📦 Version', value: `\`${version}\``, inline: true },
        { name: '🔗 Site', value: '[nomercy.ggsecure.io](https://nomercy.ggsecure.io)', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'NoMercy - Iris Anticheat' });

    // Add changelog if available
    if (changelog && changelog.trim()) {
      embed.addFields({
        name: '📝 Notes / Changelog',
        value: changelog.substring(0, 1024),
        inline: false
      });
    }

    // Send with @everyone mention
    await sendToChannel(IRIS_UPDATE_CHANNEL_ID, {
      content: '@everyone',
      embeds: [embed]
    });
    
    console.log(`[Discord Bot] Iris update notification sent for version ${version}`);
    return true;
  } catch (error) {
    console.error('[Discord Bot] Error sending Iris update notification:', error.message);
    return false;
  }
};

// Channel for tournament notifications
const TOURNAMENT_CHANNEL_ID = '1472273208169332906';

/**
 * Send notification when a tournament is launched
 * @param {Object} tournament - Tournament data
 */
export const sendTournamentLaunchNotification = async (tournament) => {
  if (!client || !isReady) {
    console.warn('[Discord Bot] Bot not ready, skipping tournament launch notification');
    return false;
  }

  try {
    const tournamentUrl = `https://nomercy.ggsecure.io/${tournament.mode}/tournaments/${tournament._id}`;
    
    // Format prizes
    let prizesText = 'Aucun prix';
    if (tournament.prizes?.gold || tournament.prizes?.cashPrize) {
      const prizes = [];
      if (tournament.prizes.gold) prizes.push(`${tournament.prizes.gold} Gold`);
      if (tournament.prizes.cashPrize) prizes.push(`${tournament.prizes.cashPrize}€`);
      prizesText = prizes.join(' + ');
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6) // Purple for tournaments
      .setTitle(`🏆 TOURNOI LANCÉ - ${tournament.name}`)
      .setDescription(`@everyone\n\nLe tournoi **${tournament.name}** vient de commencer !`)
      .addFields(
        { name: '🎮 Mode', value: tournament.mode === 'hardcore' ? 'Hardcore' : 'CDL', inline: true },
        { name: '👥 Participants', value: `${tournament.participants?.length || 0}`, inline: true },
        { name: '📋 Format', value: tournament.format === 'bo3' ? 'BO3' : 'BO1', inline: true },
        { name: '🏅 Prix', value: prizesText, inline: true },
        { name: '🔗 Lien', value: `[Voir le tournoi](${tournamentUrl})`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NoMercy Tournaments' });

    await sendToChannel(TOURNAMENT_CHANNEL_ID, { 
      content: '@everyone',
      embeds: [embed] 
    });
    
    console.log(`[Discord Bot] Tournament launch notification sent for ${tournament.name}`);
    return true;
  } catch (error) {
    console.error('[Discord Bot] Error sending tournament launch notification:', error.message);
    return false;
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
  logStrickerDispute,
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
  deleteIrisScanModeChannel,
  sendIrisShadowBan,
  sendIrisSecurityWarning,
  sendIrisSecurityChange,
  sendIrisScreenshots,
  sendIrisExtendedAlert,
  sendIrisGameMismatchAlert,
  sendIrisLowActivityAlert,
  sendRankedMatchStartDM,
  sendIrisUpdateNotification,
  sendTournamentLaunchNotification
};
