import { VelocityDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { DailyActivity, MonthlyActivity, WeeklyActivity } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Get daily activity timeline for a profile
 *
 * @param profileId - ID of the profile
 * @param days - Number of days to retrieve (default: 30)
 * @returns Array of daily activity entries
 */
export async function getDailyActivityTimeline(profileId: number, days: number = 30): Promise<DailyActivity[]> {
  return await DbMonitor.getInstance().executeWithTiming('getDailyActivityTimeline', async () => {
    const [rows] = await getDbPool().execute<VelocityDataRow[]>(
      `
      SELECT
        DATE(ews.updated_at) as watch_date,
        COUNT(*) as episode_count,
        COUNT(DISTINCT e.show_id) as show_count
      FROM episode_watch_status ews
      JOIN episodes e ON e.id = ews.episode_id
      WHERE ews.profile_id = ?
        AND ews.status = 'WATCHED'
        AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY watch_date
      ORDER BY watch_date DESC
      `,
      [profileId, days],
    );

    return rows.map((row) => ({
      date: row.watch_date,
      episodesWatched: row.episode_count,
      showsWatched: row.show_count,
    }));
  });
}

/**
 * Get weekly activity timeline for a profile
 *
 * @param profileId - ID of the profile
 * @param weeks - Number of weeks to retrieve (default: 12)
 * @returns Array of weekly activity entries
 */
export async function getWeeklyActivityTimeline(profileId: number, weeks: number = 12): Promise<WeeklyActivity[]> {
  return await DbMonitor.getInstance().executeWithTiming('getWeeklyActivityTimeline', async () => {
    const [rows] = await getDbPool().execute<RowDataPacket[]>(
      `
      SELECT
        DATE_SUB(DATE(ews.updated_at), INTERVAL WEEKDAY(ews.updated_at) DAY) as week_start,
        COUNT(*) as episode_count
      FROM episode_watch_status ews
      WHERE ews.profile_id = ?
        AND ews.status = 'WATCHED'
        AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? WEEK)
      GROUP BY week_start
      ORDER BY week_start DESC
      `,
      [profileId, weeks],
    );

    return rows.map((row) => ({
      weekStart: row.week_start,
      episodesWatched: row.episode_count,
    }));
  });
}

/**
 * Get monthly activity timeline for a profile
 *
 * @param profileId - ID of the profile
 * @param months - Number of months to retrieve (default: 12)
 * @returns Array of monthly activity entries
 */
export async function getMonthlyActivityTimeline(profileId: number, months: number = 12): Promise<MonthlyActivity[]> {
  return await DbMonitor.getInstance().executeWithTiming('getMonthlyActivityTimeline', async () => {
    const [rows] = await getDbPool().execute<RowDataPacket[]>(
      `
      SELECT
        DATE_FORMAT(ews.updated_at, '%Y-%m') as month,
        COUNT(*) as episode_count,
        0 as movie_count
      FROM episode_watch_status ews
      WHERE ews.profile_id = ?
        AND ews.status = 'WATCHED'
        AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY month

      UNION ALL

      SELECT
        DATE_FORMAT(mws.updated_at, '%Y-%m') as month,
        0 as episode_count,
        COUNT(*) as movie_count
      FROM movie_watch_status mws
      WHERE mws.profile_id = ?
        AND mws.status = 'WATCHED'
        AND mws.updated_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY month

      ORDER BY month DESC
      `,
      [profileId, months, profileId, months],
    );

    // Aggregate episodes and movies by month
    const monthMap = new Map<string, { episodesWatched: number; moviesWatched: number }>();

    rows.forEach((row) => {
      const existing = monthMap.get(row.month) || { episodesWatched: 0, moviesWatched: 0 };
      existing.episodesWatched += row.episode_count;
      existing.moviesWatched += row.movie_count;
      monthMap.set(row.month, existing);
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        episodesWatched: data.episodesWatched,
        moviesWatched: data.moviesWatched,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  });
}
