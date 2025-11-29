import { UnairedContentDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { UnairedContentStats } from '@ajgifford/keepwatching-types';

/**
 * Get unaired content statistics for a profile
 * Counts shows, seasons, movies, and episodes awaiting release
 *
 * @param profileId - ID of the profile
 * @returns Unaired content statistics
 */
export async function getUnairedContentStats(profileId: number): Promise<UnairedContentStats> {
  return await DbMonitor.getInstance().executeWithTiming('getUnairedContentStats', async () => {
    const [rows] = await getDbPool().execute<UnairedContentDataRow[]>(
      `
      SELECT
        (SELECT COUNT(DISTINCT s.id)
         FROM show_watch_status sws
         JOIN shows s ON s.id = sws.show_id
         WHERE sws.profile_id = ?
         AND EXISTS (
           SELECT 1 FROM episodes e
           WHERE e.show_id = s.id
           AND e.air_date > NOW()
         )
        ) as unaired_show_count,
        (SELECT COUNT(DISTINCT se.id)
         FROM show_watch_status sws
         JOIN seasons se ON se.show_id = sws.show_id
         WHERE sws.profile_id = ?
         AND se.release_date > NOW()
        ) as unaired_season_count,
        (SELECT COUNT(DISTINCT e.id)
         FROM show_watch_status sws
         JOIN episodes e ON e.show_id = sws.show_id
         WHERE sws.profile_id = ?
         AND e.air_date > NOW()
        ) as unaired_episode_count,
        (SELECT COUNT(DISTINCT m.id)
         FROM movie_watch_status mws
         JOIN movies m ON m.id = mws.movie_id
         WHERE mws.profile_id = ?
         AND m.release_date > NOW()
        ) as unaired_movie_count
      `,
      [profileId, profileId, profileId, profileId],
    );

    if (rows.length === 0) {
      return {
        unairedShowCount: 0,
        unairedSeasonCount: 0,
        unairedEpisodeCount: 0,
        unairedMovieCount: 0,
      };
    }

    const data = rows[0];
    return {
      unairedShowCount: data.unaired_show_count,
      unairedSeasonCount: data.unaired_season_count,
      unairedEpisodeCount: data.unaired_episode_count,
      unairedMovieCount: data.unaired_movie_count,
    };
  });
}
