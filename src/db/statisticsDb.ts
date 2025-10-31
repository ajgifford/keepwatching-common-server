import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { DailyActivity, MonthlyActivity, WatchingVelocityStats, WeeklyActivity } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Raw database row structure for velocity data
 */
interface VelocityDataRow extends RowDataPacket {
  watch_date: string;
  episode_count: number;
  show_count: number;
  watch_hour: number;
  day_of_week: number;
}

/**
 * Get watching velocity data for a profile
 * Analyzes episode watch patterns over the specified number of days
 *
 * @param profileId - ID of the profile
 * @param days - Number of days to analyze (default: 30)
 * @returns Watching velocity statistics
 */
export async function getWatchingVelocityData(profileId: number, days: number = 30): Promise<WatchingVelocityStats> {
  return await DbMonitor.getInstance().executeWithTiming('getWatchingVelocityData', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get episode counts per day for the specified period
      const [dailyRows] = await connection.query<VelocityDataRow[]>(
        `
      SELECT 
        DATE(ews.updated_at) as watch_date,
        COUNT(*) as episode_count,
        COUNT(DISTINCT e.show_id) as show_count,
        HOUR(ews.updated_at) as watch_hour,
        DAYOFWEEK(ews.updated_at) as day_of_week
      FROM episode_watch_status ews
      JOIN episodes e ON e.id = ews.episode_id
      WHERE ews.profile_id = ?
        AND ews.status = 'WATCHED'
        AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY watch_date, watch_hour, day_of_week
      ORDER BY watch_date DESC
      `,
        [profileId, days],
      );

      if (dailyRows.length === 0) {
        return createEmptyVelocityStats();
      }

      // Calculate episodes per time period
      const totalEpisodes = dailyRows.reduce((sum, row) => sum + row.episode_count, 0);
      const uniqueDays = new Set(dailyRows.map((row) => row.watch_date)).size;

      const averageEpisodesPerDay = uniqueDays > 0 ? totalEpisodes / uniqueDays : 0;
      const episodesPerWeek = averageEpisodesPerDay * 7;
      const episodesPerMonth = averageEpisodesPerDay * 30;

      // Get most active hour
      const hourDistribution = new Map<number, number>();
      dailyRows.forEach((row) => {
        const count = hourDistribution.get(row.watch_hour) || 0;
        hourDistribution.set(row.watch_hour, count + row.episode_count);
      });

      let mostActiveHour = 0;
      let maxHourCount = 0;
      hourDistribution.forEach((count, hour) => {
        if (count > maxHourCount) {
          maxHourCount = count;
          mostActiveHour = hour;
        }
      });

      // Get most active day of week
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayDistribution = new Map<number, number>();
      dailyRows.forEach((row) => {
        const count = dayDistribution.get(row.day_of_week) || 0;
        dayDistribution.set(row.day_of_week, count + row.episode_count);
      });

      let mostActiveDayNum = 1;
      let maxDayCount = 0;
      dayDistribution.forEach((count, day) => {
        if (count > maxDayCount) {
          maxDayCount = count;
          mostActiveDayNum = day;
        }
      });

      const mostActiveDay = dayNames[mostActiveDayNum - 1] || 'Sunday';

      // Calculate velocity trend (compare first half vs second half of period)
      const velocityTrend = calculateVelocityTrend(dailyRows, uniqueDays);

      return {
        episodesPerWeek: Math.round(episodesPerWeek * 10) / 10,
        episodesPerMonth: Math.round(episodesPerMonth),
        averageEpisodesPerDay: Math.round(averageEpisodesPerDay * 10) / 10,
        mostActiveDay,
        mostActiveHour,
        velocityTrend,
      };
    } finally {
      connection.release();
    }
  });
}

/**
 * Get daily activity timeline for a profile
 *
 * @param profileId - ID of the profile
 * @param days - Number of days to retrieve (default: 30)
 * @returns Array of daily activity entries
 */
export async function getDailyActivityTimeline(profileId: number, days: number = 30): Promise<DailyActivity[]> {
  return await DbMonitor.getInstance().executeWithTiming('getDailyActivityTimeline', async () => {
    const connection = await getDbPool().getConnection();
    try {
      const [rows] = await connection.query<VelocityDataRow[]>(
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
    } finally {
      connection.release();
    }
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
    const connection = await getDbPool().getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
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
    } finally {
      connection.release();
    }
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
    const connection = await getDbPool().getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
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
    } finally {
      connection.release();
    }
  });
}

/**
 * Calculate velocity trend by comparing recent activity to previous period
 *
 * @param dailyRows - Daily activity data
 * @param uniqueDays - Number of unique days with activity
 * @returns Trend indicator: 'increasing', 'decreasing', or 'stable'
 */
function calculateVelocityTrend(
  dailyRows: VelocityDataRow[],
  uniqueDays: number,
): 'increasing' | 'decreasing' | 'stable' {
  if (uniqueDays < 14) {
    return 'stable'; // Not enough data for trend analysis
  }

  // Split data into two halves
  const midpoint = Math.floor(dailyRows.length / 2);
  const recentHalf = dailyRows.slice(0, midpoint);
  const olderHalf = dailyRows.slice(midpoint);

  const recentTotal = recentHalf.reduce((sum, row) => sum + row.episode_count, 0);
  const olderTotal = olderHalf.reduce((sum, row) => sum + row.episode_count, 0);

  const recentDays = new Set(recentHalf.map((r) => r.watch_date)).size;
  const olderDays = new Set(olderHalf.map((r) => r.watch_date)).size;

  const recentAvg = recentDays > 0 ? recentTotal / recentDays : 0;
  const olderAvg = olderDays > 0 ? olderTotal / olderDays : 0;

  const percentChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  if (percentChange > 10) {
    return 'increasing';
  } else if (percentChange < -10) {
    return 'decreasing';
  }
  return 'stable';
}

/**
 * Create empty velocity stats when no data is available
 */
function createEmptyVelocityStats(): WatchingVelocityStats {
  return {
    episodesPerWeek: 0,
    episodesPerMonth: 0,
    averageEpisodesPerDay: 0,
    mostActiveDay: 'N/A',
    mostActiveHour: 0,
    velocityTrend: 'stable',
  };
}
