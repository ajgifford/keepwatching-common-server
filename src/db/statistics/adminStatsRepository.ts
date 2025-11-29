import { NewAccountsRow, PlatformOverviewRow, PlatformTrendsRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Get platform-wide overview statistics
 *
 * @returns Platform overview metrics
 */
export async function getPlatformOverview(): Promise<PlatformOverviewRow> {
  return await DbMonitor.getInstance().executeWithTiming('getPlatformOverview', async () => {
    const [rows] = await getDbPool().execute<PlatformOverviewRow[]>(
      `
      SELECT
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(DISTINCT ews.profile_id)
         FROM episode_watch_status ews
         WHERE ews.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND ews.status = 'WATCHED') as active_accounts,
        (SELECT COUNT(*) FROM profiles) as total_profiles,
        (SELECT COUNT(DISTINCT ps.show_id) FROM profile_shows ps) as total_shows,
        (SELECT COUNT(DISTINCT pm.movie_id) FROM profile_movies pm) as total_movies,
        (SELECT COUNT(*)
         FROM episode_watch_status ews
         WHERE ews.status = 'WATCHED') as total_episodes_watched,
        (SELECT COUNT(*)
         FROM movie_watch_status mws
         WHERE mws.status = 'WATCHED') as total_movies_watched,
        (
          (SELECT COALESCE(SUM(e.runtime), 0)
           FROM episode_watch_status ews
           JOIN episodes e ON e.id = ews.episode_id
           WHERE ews.status = 'WATCHED') +
          (SELECT COALESCE(SUM(m.runtime), 0)
           FROM movie_watch_status mws
           JOIN movies m ON m.id = mws.movie_id
           WHERE mws.status = 'WATCHED')
        ) / 60 as total_hours_watched
      FROM accounts
      LIMIT 1
      `,
    );

    return rows[0];
  });
}

/**
 * Get platform trends for a specific period
 *
 * @param days - Number of days to analyze
 * @returns Daily activity breakdown
 */
export async function getPlatformTrends(days: number = 30): Promise<PlatformTrendsRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getPlatformTrends', async () => {
    const [rows] = await getDbPool().execute<PlatformTrendsRow[]>(
      `
      SELECT
        activity_date,
        COUNT(DISTINCT profile_id) as active_accounts,
        SUM(episodes_watched) as episodes_watched,
        SUM(movies_watched) as movies_watched
      FROM (
        SELECT
          DATE(ews.updated_at) as activity_date,
          ews.profile_id,
          COUNT(*) as episodes_watched,
          0 as movies_watched
        FROM episode_watch_status ews
        WHERE ews.status = 'WATCHED'
          AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY activity_date, ews.profile_id

        UNION ALL

        SELECT
          DATE(mws.updated_at) as activity_date,
          mws.profile_id,
          0 as episodes_watched,
          COUNT(*) as movies_watched
        FROM movie_watch_status mws
        WHERE mws.status = 'WATCHED'
          AND mws.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY activity_date, mws.profile_id
      ) as combined_activity
      GROUP BY activity_date
      ORDER BY activity_date DESC
      `,
      [days, days],
    );

    return rows;
  });
}

/**
 * Get count of new accounts created in a period
 *
 * @param days - Number of days to analyze
 * @returns Number of new accounts
 */
export async function getNewAccountsCount(days: number = 30): Promise<number> {
  return await DbMonitor.getInstance().executeWithTiming('getNewAccountsCount', async () => {
    const [rows] = await getDbPool().execute<NewAccountsRow[]>(
      `
      SELECT COUNT(*) as new_accounts
      FROM accounts
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `,
      [days],
    );

    return rows[0]?.new_accounts || 0;
  });
}

/**
 * Get previous period comparison data for trend calculation
 *
 * @param days - Number of days to compare against
 * @returns Activity metrics for the previous period
 */
export async function getPreviousPeriodActivity(days: number = 30): Promise<{
  activeAccounts: number;
  episodesWatched: number;
  moviesWatched: number;
}> {
  return await DbMonitor.getInstance().executeWithTiming('getPreviousPeriodActivity', async () => {
    const [rows] = await getDbPool().execute<RowDataPacket[]>(
      `
      SELECT
        COUNT(DISTINCT profile_id) as active_accounts,
        SUM(episodes_watched) as episodes_watched,
        SUM(movies_watched) as movies_watched
      FROM (
        SELECT
          ews.profile_id,
          COUNT(*) as episodes_watched,
          0 as movies_watched
        FROM episode_watch_status ews
        WHERE ews.status = 'WATCHED'
          AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND ews.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY ews.profile_id

        UNION ALL

        SELECT
          mws.profile_id,
          0 as episodes_watched,
          COUNT(*) as movies_watched
        FROM movie_watch_status mws
        WHERE mws.status = 'WATCHED'
          AND mws.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND mws.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY mws.profile_id
      ) as combined_activity
      `,
      [days * 2, days, days * 2, days],
    );

    return {
      activeAccounts: rows[0]?.active_accounts || 0,
      episodesWatched: rows[0]?.episodes_watched || 0,
      moviesWatched: rows[0]?.movies_watched || 0,
    };
  });
}
