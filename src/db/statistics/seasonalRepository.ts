import { MonthlyViewingData } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { SeasonalViewingStats } from '@ajgifford/keepwatching-types';

/**
 * Get seasonal viewing pattern statistics for a profile
 * Analyzes viewing patterns by month and season
 *
 * @param profileId - ID of the profile
 * @returns Seasonal viewing statistics
 */
export async function getSeasonalViewingStats(profileId: number): Promise<SeasonalViewingStats> {
  return await DbMonitor.getInstance().executeWithTiming('getSeasonalViewingStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get episode counts by month
      const [rows] = await connection.query<MonthlyViewingData[]>(
        `
        SELECT 
          MONTH(ews.updated_at) as month,
          DATE_FORMAT(ews.updated_at, '%M') as month_name,
          COUNT(*) as episode_count
        FROM episode_watch_status ews
        WHERE ews.profile_id = ?
          AND ews.status = 'WATCHED'
        GROUP BY month, month_name
        ORDER BY month
        `,
        [profileId],
      );

      if (rows.length === 0) {
        return createEmptySeasonalStats();
      }

      // Build viewing by month map
      const viewingByMonth: Record<string, number> = {};
      rows.forEach((row) => {
        viewingByMonth[row.month_name] = row.episode_count;
      });

      // Calculate viewing by season
      const viewingBySeason = {
        spring: 0, // March (3), April (4), May (5)
        summer: 0, // June (6), July (7), August (8)
        fall: 0, // September (9), October (10), November (11)
        winter: 0, // December (12), January (1), February (2)
      };

      rows.forEach((row) => {
        const month = row.month;
        if (month === 3 || month === 4 || month === 5) {
          viewingBySeason.spring += row.episode_count;
        } else if (month === 6 || month === 7 || month === 8) {
          viewingBySeason.summer += row.episode_count;
        } else if (month === 9 || month === 10 || month === 11) {
          viewingBySeason.fall += row.episode_count;
        } else if (month === 12 || month === 1 || month === 2) {
          viewingBySeason.winter += row.episode_count;
        }
      });

      // Find peak and slowest months
      let peakViewingMonth = '';
      let peakCount = 0;
      let slowestViewingMonth = '';
      let slowestCount = Infinity;

      rows.forEach((row) => {
        if (row.episode_count > peakCount) {
          peakCount = row.episode_count;
          peakViewingMonth = row.month_name;
        }
        if (row.episode_count < slowestCount) {
          slowestCount = row.episode_count;
          slowestViewingMonth = row.month_name;
        }
      });

      return {
        viewingByMonth,
        viewingBySeason,
        peakViewingMonth: peakViewingMonth || 'N/A',
        slowestViewingMonth: slowestViewingMonth || 'N/A',
      };
    } finally {
      connection.release();
    }
  });
}

/**
 * Create empty seasonal viewing stats when no data is available
 */
function createEmptySeasonalStats(): SeasonalViewingStats {
  return {
    viewingByMonth: {},
    viewingBySeason: {
      spring: 0,
      summer: 0,
      fall: 0,
      winter: 0,
    },
    peakViewingMonth: 'N/A',
    slowestViewingMonth: 'N/A',
  };
}
