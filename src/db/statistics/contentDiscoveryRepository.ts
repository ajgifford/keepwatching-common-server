import { ContentAdditionDataRow, WatchCompletionDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { ContentDiscoveryStats } from '@ajgifford/keepwatching-types';

/**
 * Get content discovery statistics for a profile
 * Analyzes content addition patterns and watch-to-add ratios
 *
 * @param profileId - ID of the profile
 * @returns Content discovery statistics
 */
export async function getContentDiscoveryStats(profileId: number): Promise<ContentDiscoveryStats> {
  return await DbMonitor.getInstance().executeWithTiming('getContentDiscoveryStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get last content added and content added in last 30 days
      const [additionRows] = await connection.execute<ContentAdditionDataRow[]>(
        `
        SELECT
          MAX(GREATEST(
            COALESCE((SELECT MAX(created_at) FROM show_watch_status WHERE profile_id = ?), '1970-01-01'),
            COALESCE((SELECT MAX(created_at) FROM movie_watch_status WHERE profile_id = ?), '1970-01-01')
          )) as last_content_added,
          (SELECT COUNT(*) FROM show_watch_status WHERE profile_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as shows_added_30_days,
          (SELECT COUNT(*) FROM movie_watch_status WHERE profile_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as movies_added_30_days
        `,
        [profileId, profileId, profileId, profileId],
      );

      const additionData = additionRows[0];
      const lastContentAdded = additionData.last_content_added;
      const daysSinceLastContentAdded = lastContentAdded
        ? Math.floor((new Date().getTime() - new Date(lastContentAdded).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Calculate monthly addition rate
      const showsPerMonth = additionData.shows_added_30_days * (30 / 30); // Scale to monthly
      const moviesPerMonth = additionData.movies_added_30_days * (30 / 30);

      // Get watch completion data for last 30 days
      const [completionRows] = await connection.execute<WatchCompletionDataRow[]>(
        `
        SELECT 
          (SELECT COUNT(DISTINCT sws.show_id) 
           FROM show_watch_status sws
           WHERE sws.profile_id = ? 
           AND sws.status = 'WATCHED'
           AND EXISTS (
             SELECT 1 FROM episode_watch_status ews
             JOIN episodes e ON e.id = ews.episode_id
             WHERE e.show_id = sws.show_id 
             AND ews.profile_id = sws.profile_id
             AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           )
          ) as shows_completed_30_days,
          (SELECT COUNT(*) 
           FROM movie_watch_status mws
           WHERE mws.profile_id = ?
           AND mws.status = 'WATCHED'
           AND mws.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          ) as movies_completed_30_days
        `,
        [profileId, profileId],
      );

      const completionData = completionRows[0];

      // Calculate watch-to-add ratio
      const showWatchToAddRatio =
        additionData.shows_added_30_days > 0
          ? completionData.shows_completed_30_days / additionData.shows_added_30_days
          : 0;

      const movieWatchToAddRatio =
        additionData.movies_added_30_days > 0
          ? completionData.movies_completed_30_days / additionData.movies_added_30_days
          : 0;

      return {
        daysSinceLastContentAdded,
        contentAdditionRate: {
          showsPerMonth: Math.round(showsPerMonth * 10) / 10,
          moviesPerMonth: Math.round(moviesPerMonth * 10) / 10,
        },
        watchToAddRatio: {
          shows: Math.round(showWatchToAddRatio * 100) / 100,
          movies: Math.round(movieWatchToAddRatio * 100) / 100,
        },
      };
    } finally {
      connection.release();
    }
  });
}
