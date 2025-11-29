import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { WatchStreakStats } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Get watch streak statistics for a profile
 * Tracks consecutive days with watching activity
 *
 * @param profileId - ID of the profile
 * @returns Watch streak statistics
 */
export async function getWatchStreakStats(profileId: number): Promise<WatchStreakStats> {
  return await DbMonitor.getInstance().executeWithTiming('getWatchStreakStats', async () => {
    // Get distinct dates where episodes were watched
    const [rows] = await getDbPool().execute<RowDataPacket[]>(
      `
      SELECT DISTINCT DATE(updated_at) as watch_date
      FROM episode_watch_status
      WHERE profile_id = ?
        AND status = 'WATCHED'
      ORDER BY watch_date
      `,
      [profileId],
    );

    if (rows.length === 0) {
      return createEmptyStreakStats();
    }

    const watchDates = rows.map((row) => new Date(row.watch_date));

    interface Streak {
      startDate: Date;
      endDate: Date;
      days: number;
    }

    const streaks: Streak[] = [];
    let currentStreakStart = watchDates[0];
    let currentStreakEnd = watchDates[0];
    let currentStreakDays = 1;

    for (let i = 1; i < watchDates.length; i++) {
      const prevDate = watchDates[i - 1];
      const currDate = watchDates[i];
      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day
        currentStreakEnd = currDate;
        currentStreakDays++;
      } else {
        // Streak broken
        streaks.push({
          startDate: currentStreakStart,
          endDate: currentStreakEnd,
          days: currentStreakDays,
        });
        currentStreakStart = currDate;
        currentStreakEnd = currDate;
        currentStreakDays = 1;
      }
    }

    // Add final streak
    streaks.push({
      startDate: currentStreakStart,
      endDate: currentStreakEnd,
      days: currentStreakDays,
    });

    // Find longest streak
    const longestStreak =
      streaks.length > 0 ? streaks.reduce((max, streak) => (streak.days > max.days ? streak : max)) : streaks[0];

    // Calculate current streak (check if the last streak extends to today or yesterday)
    // Use UTC dates to match how the database DATE() strings are parsed
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const lastStreak = streaks[streaks.length - 1];
    const lastStreakEnd = new Date(lastStreak.endDate);
    lastStreakEnd.setUTCHours(0, 0, 0, 0);

    const isCurrentStreak =
      lastStreakEnd.getTime() === today.getTime() || lastStreakEnd.getTime() === yesterday.getTime();

    const currentStreak = isCurrentStreak ? lastStreak.days : 0;
    const currentStreakStartDate = isCurrentStreak ? lastStreak.startDate.toISOString().split('T')[0] : '';

    // Count streaks over 7 days
    const streaksOver7Days = streaks.filter((streak) => streak.days >= 7).length;

    // Calculate average streak length
    const totalStreakDays = streaks.reduce((sum, streak) => sum + streak.days, 0);
    const averageStreakLength = streaks.length > 0 ? totalStreakDays / streaks.length : 0;

    return {
      currentStreak,
      longestStreak: longestStreak.days,
      currentStreakStartDate,
      longestStreakPeriod: {
        startDate: longestStreak.startDate.toISOString().split('T')[0],
        endDate: longestStreak.endDate.toISOString().split('T')[0],
        days: longestStreak.days,
      },
      streaksOver7Days,
      averageStreakLength: Math.round(averageStreakLength * 10) / 10,
    };
  });
}

/**
 * Create empty streak stats when no data is available
 */
function createEmptyStreakStats(): WatchStreakStats {
  return {
    currentStreak: 0,
    longestStreak: 0,
    currentStreakStartDate: '',
    longestStreakPeriod: {
      startDate: '',
      endDate: '',
      days: 0,
    },
    streaksOver7Days: 0,
    averageStreakLength: 0,
  };
}
