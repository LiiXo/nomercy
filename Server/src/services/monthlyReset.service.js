import cron from 'node-cron';
import { resetAllLadderSeasons } from './ladderSeasonReset.service.js';

/**
 * Schedule monthly ladder season reset
 * Runs at 00:00 on the 1st day of every month (Paris timezone)
 */
export const scheduleMonthlyLadderReset = () => {
  // Cron expression: minute hour day-of-month month day-of-week
  // '0 0 1 * *' = At 00:00 on day 1 of every month
  cron.schedule('0 0 1 * *', async () => {
    
    try {
      const result = await resetAllLadderSeasons(null); // null = automatic system reset
      
      
      // Log the winners
      result.duoTrio.winners.forEach(w => {
      });
      
      result.squadTeam.winners.forEach(w => {
      });
      
    } catch (error) {
      console.error('[Monthly Reset] Error during automatic ladder reset:', error);
    }
  }, {
    timezone: 'Europe/Paris'
  });
  
};

export default {
  scheduleMonthlyLadderReset
};
