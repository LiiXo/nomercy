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
    console.log('[Monthly Reset] Starting automatic ladder season reset...');
    
    try {
      const result = await resetAllLadderSeasons(null); // null = automatic system reset
      
      console.log('[Monthly Reset] Ladder season reset completed successfully!');
      console.log(`[Monthly Reset] Duo/Trio: ${result.duoTrio.seasonName} - ${result.duoTrio.winners.length} winners`);
      console.log(`[Monthly Reset] Squad/Team: ${result.squadTeam.seasonName} - ${result.squadTeam.winners.length} winners`);
      
      // Log the winners
      result.duoTrio.winners.forEach(w => {
        console.log(`  [Duo/Trio] #${w.rank}: ${w.squadName} (+${w.points} pts)`);
      });
      
      result.squadTeam.winners.forEach(w => {
        console.log(`  [Squad/Team] #${w.rank}: ${w.squadName} (+${w.points} pts)`);
      });
      
    } catch (error) {
      console.error('[Monthly Reset] Error during automatic ladder reset:', error);
    }
  }, {
    timezone: 'Europe/Paris'
  });
  
  console.log('[Monthly Reset] Ladder season reset scheduled for 00:00 on the 1st of each month (Paris time)');
};

export default {
  scheduleMonthlyLadderReset
};
