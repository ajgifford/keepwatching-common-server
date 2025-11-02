import { AbandonmentRateDataRow, AbandonmentRiskDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AbandonmentRiskStats } from '@ajgifford/keepwatching-types';

/**
 * Get abandonment risk statistics for a profile
 * Identifies shows at risk of being abandoned and calculates abandonment rates
 *
 * @param profileId - ID of the profile
 * @returns Abandonment risk statistics
 */
export async function getAbandonmentRiskStats(profileId: number): Promise<AbandonmentRiskStats> {
  return await DbMonitor.getInstance().executeWithTiming('getAbandonmentRiskStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get shows marked as WATCHING but haven't progressed in 30+ days
      const [riskRows] = await connection.query<AbandonmentRiskDataRow[]>(
        `
        SELECT 
          sws.show_id,
          s.title as show_title,
          DATEDIFF(NOW(), MAX(ews.updated_at)) as days_since_last_watch,
          COUNT(CASE WHEN ews.status = 'NOT_WATCHED' AND e.air_date <= NOW() THEN 1 END) as unwatched_episodes,
          sws.status
        FROM show_watch_status sws
        JOIN shows s ON s.id = sws.show_id
        LEFT JOIN episodes e ON e.show_id = sws.show_id
        LEFT JOIN episode_watch_status ews ON ews.episode_id = e.id AND ews.profile_id = sws.profile_id
        WHERE sws.profile_id = ?
          AND sws.status = 'WATCHING'
        GROUP BY sws.show_id, s.title, sws.status
        HAVING days_since_last_watch >= 30 AND unwatched_episodes > 0
        ORDER BY days_since_last_watch DESC
        `,
        [profileId],
      );

      // Calculate show abandonment rate
      // Shows started but not finished, excluding currently airing shows unless more than a season behind
      const [rateRows] = await connection.query<AbandonmentRateDataRow[]>(
        `
        SELECT 
          COUNT(DISTINCT CASE 
            WHEN sws.status IN ('WATCHING', 'NOT_WATCHED') 
            AND EXISTS (
              SELECT 1 FROM episode_watch_status ews2
              JOIN episodes e2 ON e2.id = ews2.episode_id
              WHERE e2.show_id = sws.show_id 
              AND ews2.profile_id = sws.profile_id
              AND ews2.status = 'WATCHED'
            )
            THEN sws.show_id 
          END) as total_started_shows,
          COUNT(DISTINCT CASE 
            WHEN sws.status = 'WATCHING'
            AND EXISTS (
              SELECT 1 FROM episode_watch_status ews3
              JOIN episodes e3 ON e3.id = ews3.episode_id
              WHERE e3.show_id = sws.show_id 
              AND ews3.profile_id = sws.profile_id
              AND ews3.status = 'WATCHED'
            )
            AND DATEDIFF(NOW(), (
              SELECT MAX(ews4.updated_at) 
              FROM episode_watch_status ews4
              JOIN episodes e4 ON e4.id = ews4.episode_id
              WHERE e4.show_id = sws.show_id 
              AND ews4.profile_id = sws.profile_id
              AND ews4.status = 'WATCHED'
            )) >= 90
            THEN sws.show_id 
          END) as abandoned_shows
        FROM show_watch_status sws
        WHERE sws.profile_id = ?
        `,
        [profileId],
      );

      const rateData = rateRows[0];
      const showAbandonmentRate =
        rateData.total_started_shows > 0 ? (rateData.abandoned_shows / rateData.total_started_shows) * 100 : 0;

      return {
        showsAtRisk: riskRows.map((row) => ({
          showId: row.show_id,
          showTitle: row.show_title,
          daysSinceLastWatch: row.days_since_last_watch,
          unwatchedEpisodes: row.unwatched_episodes,
          status: row.status,
        })),
        showAbandonmentRate: Math.round(showAbandonmentRate * 10) / 10,
      };
    } finally {
      connection.release();
    }
  });
}
