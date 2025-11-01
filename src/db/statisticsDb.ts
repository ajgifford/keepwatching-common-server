import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import {
  BingeWatchingStats,
  DailyActivity,
  MonthlyActivity,
  SeasonalViewingStats,
  TimeToWatchStats,
  WatchStreakStats,
  WatchingVelocityStats,
  WeeklyActivity,
} from '@ajgifford/keepwatching-types';
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

/**
 * Interface for episode watch events used in binge detection
 */
interface EpisodeWatchEvent extends RowDataPacket {
  show_id: number;
  show_title: string;
  episode_id: number;
  watched_at: Date;
}

/**
 * Get binge-watching statistics for a profile
 * Identifies sessions where 3+ episodes of the same show were watched within 24 hours
 *
 * @param profileId - ID of the profile
 * @returns Binge-watching statistics
 */
export async function getBingeWatchingStats(profileId: number): Promise<BingeWatchingStats> {
  return await DbMonitor.getInstance().executeWithTiming('getBingeWatchingStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get all watched episodes with show information
      const [episodes] = await connection.query<EpisodeWatchEvent[]>(
        `
        SELECT 
          e.show_id,
          s.title as show_title,
          ews.episode_id,
          ews.updated_at as watched_at
        FROM episode_watch_status ews
        JOIN episodes e ON e.id = ews.episode_id
        JOIN shows s ON s.id = e.show_id
        WHERE ews.profile_id = ?
          AND ews.status = 'WATCHED'
        ORDER BY e.show_id, ews.updated_at
        `,
        [profileId],
      );

      if (episodes.length === 0) {
        return createEmptyBingeStats();
      }

      // Detect binge sessions
      interface BingeSession {
        showId: number;
        showTitle: string;
        episodeCount: number;
        startDate: Date;
      }

      const bingeSessions: BingeSession[] = [];
      const showBingeCount = new Map<number, { title: string; count: number }>();

      let currentSession: EpisodeWatchEvent[] = [];

      episodes.forEach((episode, index) => {
        if (currentSession.length === 0) {
          currentSession.push(episode);
          return;
        }

        const lastEpisode = currentSession[currentSession.length - 1];
        const timeDiff = new Date(episode.watched_at).getTime() - new Date(lastEpisode.watched_at).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If same show and within 24 hours, add to current session
        if (episode.show_id === lastEpisode.show_id && hoursDiff <= 24) {
          currentSession.push(episode);
        } else {
          // Process completed session
          if (currentSession.length >= 3) {
            const session: BingeSession = {
              showId: currentSession[0].show_id,
              showTitle: currentSession[0].show_title,
              episodeCount: currentSession.length,
              startDate: new Date(currentSession[0].watched_at),
            };
            bingeSessions.push(session);

            // Update show binge count
            const existing = showBingeCount.get(session.showId) || { title: session.showTitle, count: 0 };
            existing.count++;
            showBingeCount.set(session.showId, existing);
          }

          // Start new session
          currentSession = [episode];
        }

        // Handle last episode
        if (index === episodes.length - 1 && currentSession.length >= 3) {
          const session: BingeSession = {
            showId: currentSession[0].show_id,
            showTitle: currentSession[0].show_title,
            episodeCount: currentSession.length,
            startDate: new Date(currentSession[0].watched_at),
          };
          bingeSessions.push(session);

          const existing = showBingeCount.get(session.showId) || { title: session.showTitle, count: 0 };
          existing.count++;
          showBingeCount.set(session.showId, existing);
        }
      });

      // Find longest binge session
      const longestSession =
        bingeSessions.length > 0
          ? bingeSessions.reduce((max, session) => (session.episodeCount > max.episodeCount ? session : max))
          : null;

      // Calculate average episodes per binge
      const totalEpisodes = bingeSessions.reduce((sum, session) => sum + session.episodeCount, 0);
      const averageEpisodesPerBinge = bingeSessions.length > 0 ? totalEpisodes / bingeSessions.length : 0;

      // Get top binged shows
      const topBingedShows = Array.from(showBingeCount.entries())
        .map(([showId, data]) => ({
          showId,
          showTitle: data.title,
          bingeSessionCount: data.count,
        }))
        .sort((a, b) => b.bingeSessionCount - a.bingeSessionCount)
        .slice(0, 5);

      return {
        bingeSessionCount: bingeSessions.length,
        averageEpisodesPerBinge: Math.round(averageEpisodesPerBinge * 10) / 10,
        longestBingeSession: longestSession
          ? {
              showTitle: longestSession.showTitle,
              episodeCount: longestSession.episodeCount,
              date: longestSession.startDate.toISOString().split('T')[0],
            }
          : {
              showTitle: '',
              episodeCount: 0,
              date: '',
            },
        topBingedShows,
      };
    } finally {
      connection.release();
    }
  });
}

/**
 * Get watch streak statistics for a profile
 * Tracks consecutive days with watching activity
 *
 * @param profileId - ID of the profile
 * @returns Watch streak statistics
 */
export async function getWatchStreakStats(profileId: number): Promise<WatchStreakStats> {
  return await DbMonitor.getInstance().executeWithTiming('getWatchStreakStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get distinct dates where episodes were watched
      const [rows] = await connection.query<RowDataPacket[]>(
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastStreak = streaks[streaks.length - 1];
      const lastStreakEnd = new Date(lastStreak.endDate);
      lastStreakEnd.setHours(0, 0, 0, 0);

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
    } finally {
      connection.release();
    }
  });
}

/**
 * Create empty binge stats when no data is available
 */
function createEmptyBingeStats(): BingeWatchingStats {
  return {
    bingeSessionCount: 0,
    averageEpisodesPerBinge: 0,
    longestBingeSession: {
      showTitle: '',
      episodeCount: 0,
      date: '',
    },
    topBingedShows: [],
  };
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

/**
 * Interface for show creation and completion data
 */
interface ShowTimeData extends RowDataPacket {
  show_id: number;
  show_title: string;
  created_at: Date;
  first_watched: Date | null;
  last_watched: Date | null;
  days_to_start: number | null;
  days_to_complete: number | null;
}

/**
 * Get time-to-watch statistics for a profile
 * Analyzes how long content sits before being watched and completion rates
 *
 * @param profileId - ID of the profile
 * @returns Time-to-watch statistics
 */
export async function getTimeToWatchStats(profileId: number): Promise<TimeToWatchStats> {
  return await DbMonitor.getInstance().executeWithTiming('getTimeToWatchStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get show data with creation date and first/last watch dates
      const [rows] = await connection.query<ShowTimeData[]>(
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
    } finally {
      connection.release();
    }
  });
}

/**
 * Interface for monthly viewing data
 */
interface MonthlyViewingData extends RowDataPacket {
  month: number;
  month_name: string;
  episode_count: number;
}

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
