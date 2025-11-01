import { VelocityDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { WatchingVelocityStats } from '@ajgifford/keepwatching-types';

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
