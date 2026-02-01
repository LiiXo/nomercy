import cron from 'node-cron';
import AppSettings from '../models/AppSettings.js';

/**
 * Service de planification des événements (Double XP, Double Gold)
 * Vérifie toutes les minutes si un événement doit être activé ou désactivé
 * Fonctionne en heure française (Europe/Paris)
 */

// Process scheduled events - activate/deactivate based on scheduled times
const processScheduledEvents = async () => {
  try {
    const settings = await AppSettings.findOne();
    if (!settings || !settings.events) {
      return;
    }

    const now = new Date();
    let hasChanges = false;

    // Process Double XP
    if (settings.events.doubleXP) {
      const { scheduledStartAt, scheduledEndAt, enabled } = settings.events.doubleXP;

      // Check if should start (scheduled start time has passed and not yet enabled)
      if (scheduledStartAt && new Date(scheduledStartAt) <= now && !enabled) {
        console.log('[Event Scheduler] Activating Double XP event (scheduled start)');
        settings.events.doubleXP.enabled = true;
        settings.events.doubleXP.enabledAt = now;
        settings.events.doubleXP.enabledBy = settings.events.doubleXP.scheduledBy;
        // Set expiration if scheduledEndAt exists
        if (scheduledEndAt) {
          settings.events.doubleXP.expiresAt = new Date(scheduledEndAt);
        }
        // Clear scheduling after activation
        settings.events.doubleXP.scheduledStartAt = null;
        hasChanges = true;
      }

      // Check if should stop (scheduled end time has passed and currently enabled)
      if (scheduledEndAt && new Date(scheduledEndAt) <= now && enabled) {
        console.log('[Event Scheduler] Deactivating Double XP event (scheduled end)');
        settings.events.doubleXP.enabled = false;
        settings.events.doubleXP.expiresAt = null;
        settings.events.doubleXP.enabledAt = null;
        settings.events.doubleXP.enabledBy = null;
        settings.events.doubleXP.scheduledStartAt = null;
        settings.events.doubleXP.scheduledEndAt = null;
        settings.events.doubleXP.scheduledBy = null;
        hasChanges = true;
      }

      // Check if event has expired (expiresAt)
      if (settings.events.doubleXP.expiresAt && new Date(settings.events.doubleXP.expiresAt) <= now && enabled) {
        console.log('[Event Scheduler] Double XP event expired');
        settings.events.doubleXP.enabled = false;
        settings.events.doubleXP.expiresAt = null;
        settings.events.doubleXP.enabledAt = null;
        settings.events.doubleXP.enabledBy = null;
        settings.events.doubleXP.scheduledStartAt = null;
        settings.events.doubleXP.scheduledEndAt = null;
        settings.events.doubleXP.scheduledBy = null;
        hasChanges = true;
      }
    }

    // Process Double Gold
    if (settings.events.doubleGold) {
      const { scheduledStartAt, scheduledEndAt, enabled } = settings.events.doubleGold;

      // Check if should start
      if (scheduledStartAt && new Date(scheduledStartAt) <= now && !enabled) {
        console.log('[Event Scheduler] Activating Double Gold event (scheduled start)');
        settings.events.doubleGold.enabled = true;
        settings.events.doubleGold.enabledAt = now;
        settings.events.doubleGold.enabledBy = settings.events.doubleGold.scheduledBy;
        if (scheduledEndAt) {
          settings.events.doubleGold.expiresAt = new Date(scheduledEndAt);
        }
        settings.events.doubleGold.scheduledStartAt = null;
        hasChanges = true;
      }

      // Check if should stop
      if (scheduledEndAt && new Date(scheduledEndAt) <= now && enabled) {
        console.log('[Event Scheduler] Deactivating Double Gold event (scheduled end)');
        settings.events.doubleGold.enabled = false;
        settings.events.doubleGold.expiresAt = null;
        settings.events.doubleGold.enabledAt = null;
        settings.events.doubleGold.enabledBy = null;
        settings.events.doubleGold.scheduledStartAt = null;
        settings.events.doubleGold.scheduledEndAt = null;
        settings.events.doubleGold.scheduledBy = null;
        hasChanges = true;
      }

      // Check if event has expired
      if (settings.events.doubleGold.expiresAt && new Date(settings.events.doubleGold.expiresAt) <= now && enabled) {
        console.log('[Event Scheduler] Double Gold event expired');
        settings.events.doubleGold.enabled = false;
        settings.events.doubleGold.expiresAt = null;
        settings.events.doubleGold.enabledAt = null;
        settings.events.doubleGold.enabledBy = null;
        settings.events.doubleGold.scheduledStartAt = null;
        settings.events.doubleGold.scheduledEndAt = null;
        settings.events.doubleGold.scheduledBy = null;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      settings.markModified('events');
      await settings.save();
      console.log('[Event Scheduler] Event changes saved');
    }
  } catch (error) {
    console.error('[Event Scheduler] Error processing scheduled events:', error);
  }
};

// Initialize the event scheduler - runs every minute
export const scheduleEventChecker = () => {
  // Run every minute using cron in Europe/Paris timezone
  cron.schedule('* * * * *', async () => {
    await processScheduledEvents();
  }, {
    timezone: 'Europe/Paris'
  });

  console.log('[Event Scheduler] Event scheduler initialized (checking every minute in Europe/Paris timezone)');

  // Run immediately on startup to process any pending events
  processScheduledEvents();
};

export default { scheduleEventChecker };
