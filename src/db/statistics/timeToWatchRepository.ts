import { ShowTimeData } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { TimeToWatchStats } from '@ajgifford/keepwatching-types';

/**
 * Get time-to-watch statistics for a profile
 * Analyzes how long content sits before being watched and completion rates
 *
 * @param profileId - ID of the profile
 * @returns Time-to-watch statistics
 */
export async function getTimeToWatchStats(profileId: number): Promise<TimeToWatchStats> {
  return await DbMonitor.getInstance().executeWithTiming('getTimeToWatchStats', async () => {
    // Get show data with creation date and first/last watch dates
    const [rows] = await getDbPool().execute<ShowTimeData[]>(
      `
      SELECT
        sws.show_id,
        s.title as show_title,
        sws.created_at,
        MIN(CASE WHEN ews.status = 'WATCHED' THEN ews.updated_at END) as first_watched,
        MAX(CASE WHEN ews.status = 'WATCHED' THEN ews.updated_at END) as last_watched,
        DATEDIFF(MIN(CASE WHEN ews.status = 'WATCHED' THEN ews.updated_at END), sws.created_at) as days_to_start,
        DATEDIFF(
          MAX(CASE WHEN ews.status = 'WATCHED' THEN ews.updated_at END),
          MIN(CASE WHEN ews.status = 'WATCHED' THEN ews.updated_at END)
        ) as days_to_complete
      FROM show_watch_status sws
      JOIN shows s ON s.id = sws.show_id
      LEFT JOIN episodes e ON e.show_id = sws.show_id
      LEFT JOIN episode_watch_status ews ON ews.episode_id = e.id AND ews.profile_id = sws.profile_id
      WHERE sws.profile_id = ?
      GROUP BY sws.show_id, s.title, sws.created_at
      `,
      [profileId],
    );

    if (rows.length === 0) {
      return createEmptyTimeToWatchStats();
    }

    // Calculate average days to start
    const showsWithStart = rows.filter((row) => row.days_to_start !== null && row.days_to_start >= 0);
    const averageDaysToStartShow =
      showsWithStart.length > 0
        ? showsWithStart.reduce((sum, row) => sum + (row.days_to_start || 0), 0) / showsWithStart.length
        : 0;

    // Calculate average days to complete (for completed shows)
    const completedShows = rows.filter(
      (row) => row.days_to_complete !== null && row.days_to_complete > 0 && row.first_watched && row.last_watched,
    );
    const averageDaysToCompleteShow =
      completedShows.length > 0
        ? completedShows.reduce((sum, row) => sum + (row.days_to_complete || 0), 0) / completedShows.length
        : 0;

    // Get fastest completions (top 5)
    const fastestCompletions = completedShows
      .sort((a, b) => (a.days_to_complete || 0) - (b.days_to_complete || 0))
      .slice(0, 5)
      .map((row) => ({
        showId: row.show_id,
        showTitle: row.show_title,
        daysToComplete: row.days_to_complete || 0,
      }));

    // Get backlog aging data
    const now = new Date();
    const unwatchedShows = rows.filter((row) => !row.first_watched);

    const backlogAging = {
      unwatchedOver30Days: unwatchedShows.filter((row) => {
        const daysSinceAdded = Math.floor((now.getTime() - row.created_at.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceAdded > 30;
      }).length,
      unwatchedOver90Days: unwatchedShows.filter((row) => {
        const daysSinceAdded = Math.floor((now.getTime() - row.created_at.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceAdded > 90;
      }).length,
      unwatchedOver365Days: unwatchedShows.filter((row) => {
        const daysSinceAdded = Math.floor((now.getTime() - row.created_at.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceAdded > 365;
      }).length,
    };

    return {
      averageDaysToStartShow: Math.round(averageDaysToStartShow * 10) / 10,
      averageDaysToCompleteShow: Math.round(averageDaysToCompleteShow * 10) / 10,
      fastestCompletions,
      backlogAging,
    };
  });
}

/**
 * Create empty time-to-watch stats when no data is available
 */
function createEmptyTimeToWatchStats(): TimeToWatchStats {
  return {
    averageDaysToStartShow: 0,
    averageDaysToCompleteShow: 0,
    fastestCompletions: [],
    backlogAging: {
      unwatchedOver30Days: 0,
      unwatchedOver90Days: 0,
      unwatchedOver365Days: 0,
    },
  };
}
