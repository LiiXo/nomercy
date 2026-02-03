import User from '../models/User.js';
import { logPlayerUnban, logRankedUnban } from './discordBot.service.js';

/**
 * Auto-Unban Service
 * Automatically unbans users when their ban expiration date has passed.
 * Runs periodically to check for expired bans (both global and ranked).
 */

/**
 * Process expired global bans
 * Finds all users with isBanned=true and banExpiresAt in the past, then unbans them
 */
const processExpiredGlobalBans = async () => {
  try {
    const now = new Date();
    
    // Find users with expired global bans (exclude permanent bans where banExpiresAt is null)
    const expiredBans = await User.find({
      isBanned: true,
      banExpiresAt: { $ne: null, $lte: now }
    });
    
    if (expiredBans.length === 0) {
      return { count: 0, users: [] };
    }
    
    const unbannedUsers = [];
    
    for (const user of expiredBans) {
      // Unban the user
      user.isBanned = false;
      user.banReason = null;
      user.bannedAt = null;
      user.banExpiresAt = null;
      user.bannedBy = null;
      await user.save();
      
      unbannedUsers.push(user.username);
      
      // Log to Discord
      try {
        await logPlayerUnban(user, { username: 'Système (Auto)' });
      } catch (discordErr) {
        console.error(`[AutoUnban] Discord log error for ${user.username}:`, discordErr.message);
      }
    }
    
    if (unbannedUsers.length > 0) {
      console.log(`[AutoUnban] Automatically unbanned ${unbannedUsers.length} user(s): ${unbannedUsers.join(', ')}`);
    }
    
    return { count: unbannedUsers.length, users: unbannedUsers };
  } catch (err) {
    console.error('[AutoUnban] Error processing expired global bans:', err);
    return { count: 0, users: [], error: err.message };
  }
};

/**
 * Process expired ranked bans
 * Finds all users with isRankedBanned=true and rankedBanExpiresAt in the past, then unbans them
 */
const processExpiredRankedBans = async () => {
  try {
    const now = new Date();
    
    // Find users with expired ranked bans (exclude permanent bans where rankedBanExpiresAt is null)
    const expiredRankedBans = await User.find({
      isRankedBanned: true,
      rankedBanExpiresAt: { $ne: null, $lte: now }
    });
    
    if (expiredRankedBans.length === 0) {
      return { count: 0, users: [] };
    }
    
    const unbannedUsers = [];
    
    for (const user of expiredRankedBans) {
      // Unban the user from ranked
      user.isRankedBanned = false;
      user.rankedBanReason = null;
      user.rankedBannedAt = null;
      user.rankedBanExpiresAt = null;
      user.rankedBannedBy = null;
      await user.save();
      
      unbannedUsers.push(user.username);
      
      // Log to Discord
      try {
        await logRankedUnban(user, { username: 'Système (Auto)' });
      } catch (discordErr) {
        console.error(`[AutoUnban] Discord log error for ranked unban ${user.username}:`, discordErr.message);
      }
    }
    
    if (unbannedUsers.length > 0) {
      console.log(`[AutoUnban] Automatically unbanned ${unbannedUsers.length} user(s) from ranked: ${unbannedUsers.join(', ')}`);
    }
    
    return { count: unbannedUsers.length, users: unbannedUsers };
  } catch (err) {
    console.error('[AutoUnban] Error processing expired ranked bans:', err);
    return { count: 0, users: [], error: err.message };
  }
};

/**
 * Run all auto-unban checks
 */
const runAutoUnban = async () => {
  const globalResult = await processExpiredGlobalBans();
  const rankedResult = await processExpiredRankedBans();
  
  return {
    global: globalResult,
    ranked: rankedResult,
    totalUnbanned: globalResult.count + rankedResult.count
  };
};

/**
 * Schedule automatic unban checks
 * Runs every minute to ensure timely unbanning
 */
export const scheduleAutoUnban = () => {
  // Run immediately on startup
  runAutoUnban().then(result => {
    if (result.totalUnbanned > 0) {
      console.log(`[AutoUnban] Initial check: unbanned ${result.totalUnbanned} user(s)`);
    }
  });
  
  // Then run every minute
  setInterval(async () => {
    await runAutoUnban();
  }, 60 * 1000); // Every 1 minute
  
  console.log('[AutoUnban] Auto-unban service scheduled (checks every minute)');
};

export { runAutoUnban, processExpiredGlobalBans, processExpiredRankedBans };
