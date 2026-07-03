import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AvailableRecapPeriods, ProfileRecapResponse, RecapPeriodType } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

interface EpisodeRecapSummaryRow extends RowDataPacket {
  episodes_watched: number;
  total_runtime_minutes: number | null;
  first_watch_date: string | null;
}

interface MovieRecapSummaryRow extends RowDataPacket {
  movies_watched: number;
  total_runtime_minutes: number | null;
  first_watch_date: string | null;
}

interface TopShowRow extends RowDataPacket {
  show_id: number;
  title: string;
  episodes_watched: number;
}

interface TopMovieRow extends RowDataPacket {
  movie_id: number;
  title: string;
}

interface BusiestDayRow extends RowDataPacket {
  watch_date: string;
  episodes_watched: number;
}

interface GenreRow extends RowDataPacket {
  genre: string;
}

interface WatchDateRow extends RowDataPacket {
  watch_date: string;
}

interface AvailablePeriodRow extends RowDataPacket {
  y: number;
  m: number;
}

interface ActivityBucketRow extends RowDataPacket {
  bucket: number;
  episodes_watched: number;
}

/**
 * Get a period-scoped recap ("year/month in review") for a profile.
 * Uses a single query shape driven entirely by startDate/endDate so month and year
 * recaps share the same code path.
 *
 * @param profileId - ID of the profile
 * @param period - Whether the range represents a calendar month or year
 * @param year - Calendar year of the period
 * @param month - Calendar month of the period (1-12), only when period is 'month'
 * @param startDate - Inclusive start of the period (YYYY-MM-DD)
 * @param endDate - Inclusive end of the period (YYYY-MM-DD)
 * @returns The profile's recap for the period
 */
export async function getRecapStats(
  profileId: number,
  period: RecapPeriodType,
  year: number,
  month: number | undefined,
  startDate: string,
  endDate: string,
): Promise<ProfileRecapResponse> {
  return await DbMonitor.getInstance().executeWithTiming('getRecapStats', async () => {
    const pool = getDbPool();
    const rangeParams = [profileId, startDate, endDate];

    const [episodeSummaryRows] = await pool.execute<EpisodeRecapSummaryRow[]>(
      `
      SELECT
        COUNT(*) as episodes_watched,
        SUM(e.runtime) as total_runtime_minutes,
        MIN(DATE(ewh.watched_at)) as first_watch_date
      FROM episode_watch_history ewh
      JOIN episodes e ON e.id = ewh.episode_id
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      `,
      rangeParams,
    );

    const [movieSummaryRows] = await pool.execute<MovieRecapSummaryRow[]>(
      `
      SELECT
        COUNT(*) as movies_watched,
        SUM(m.runtime) as total_runtime_minutes,
        MIN(DATE(mwh.watched_at)) as first_watch_date
      FROM movie_watch_history mwh
      JOIN movies m ON m.id = mwh.movie_id
      WHERE mwh.profile_id = ? AND mwh.is_prior_watch = FALSE
        AND DATE(mwh.watched_at) BETWEEN ? AND ?
      `,
      rangeParams,
    );

    const [topShowRows] = await pool.execute<TopShowRow[]>(
      `
      SELECT s.id as show_id, s.title, COUNT(*) as episodes_watched
      FROM episode_watch_history ewh
      JOIN episodes e ON e.id = ewh.episode_id
      JOIN shows s ON s.id = e.show_id
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      GROUP BY s.id, s.title
      ORDER BY episodes_watched DESC
      LIMIT 1
      `,
      rangeParams,
    );

    const [topMovieRows] = await pool.execute<TopMovieRow[]>(
      `
      SELECT m.id as movie_id, m.title
      FROM movie_watch_history mwh
      JOIN movies m ON m.id = mwh.movie_id
      WHERE mwh.profile_id = ? AND mwh.is_prior_watch = FALSE
        AND DATE(mwh.watched_at) BETWEEN ? AND ?
      ORDER BY m.user_rating DESC, mwh.watched_at ASC
      LIMIT 1
      `,
      rangeParams,
    );

    const [busiestDayRows] = await pool.execute<BusiestDayRow[]>(
      `
      SELECT DATE(ewh.watched_at) as watch_date, COUNT(*) as episodes_watched
      FROM episode_watch_history ewh
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      GROUP BY watch_date
      ORDER BY episodes_watched DESC
      LIMIT 1
      `,
      rangeParams,
    );

    const [showGenreRows] = await pool.execute<GenreRow[]>(
      `
      SELECT g.genre
      FROM episode_watch_history ewh
      JOIN episodes e ON e.id = ewh.episode_id
      JOIN show_genres sg ON sg.show_id = e.show_id
      JOIN genres g ON g.id = sg.genre_id
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      `,
      rangeParams,
    );

    const [movieGenreRows] = await pool.execute<GenreRow[]>(
      `
      SELECT g.genre
      FROM movie_watch_history mwh
      JOIN movies m ON m.id = mwh.movie_id
      JOIN movie_genres mg ON mg.movie_id = m.id
      JOIN genres g ON g.id = mg.genre_id
      WHERE mwh.profile_id = ? AND mwh.is_prior_watch = FALSE
        AND DATE(mwh.watched_at) BETWEEN ? AND ?
      `,
      rangeParams,
    );

    const [watchDateRows] = await pool.execute<WatchDateRow[]>(
      `
      SELECT DISTINCT DATE(ewh.watched_at) as watch_date
      FROM episode_watch_history ewh
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      ORDER BY watch_date
      `,
      rangeParams,
    );

    // Bucket granularity differs by period (day-of-month for a month, calendar-month for a
    // year), so this one query branches on it - unlike the rest of this function, there's no
    // single SQL shape that produces both granularities.
    const bucketExpr = period === 'month' ? 'DAY(ewh.watched_at)' : 'MONTH(ewh.watched_at)';
    const [activityBucketRows] = await pool.execute<ActivityBucketRow[]>(
      `
      SELECT ${bucketExpr} as bucket, COUNT(*) as episodes_watched
      FROM episode_watch_history ewh
      WHERE ewh.profile_id = ? AND ewh.is_prior_watch = FALSE
        AND DATE(ewh.watched_at) BETWEEN ? AND ?
      GROUP BY bucket
      `,
      rangeParams,
    );

    const episodeSummary = episodeSummaryRows[0];
    const movieSummary = movieSummaryRows[0];

    const episodesWatched = Number(episodeSummary?.episodes_watched ?? 0);
    const moviesWatched = Number(movieSummary?.movies_watched ?? 0);
    // SUM() comes back from mysql2 as a DECIMAL string, not a number - Number() avoids `+` silently
    // string-concatenating two SUMs (e.g. "12106" + "1302" = "121061302") instead of adding them.
    const totalMinutes =
      Number(episodeSummary?.total_runtime_minutes ?? 0) + Number(movieSummary?.total_runtime_minutes ?? 0);

    const genreCounts: Record<string, number> = {};
    for (const row of [...showGenreRows, ...movieGenreRows]) {
      genreCounts[row.genre] = (genreCounts[row.genre] ?? 0) + 1;
    }
    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topShow = topShowRows[0]
      ? {
          showId: topShowRows[0].show_id,
          title: topShowRows[0].title,
          episodesWatched: topShowRows[0].episodes_watched,
        }
      : null;

    const topMovie = topMovieRows[0] ? { movieId: topMovieRows[0].movie_id, title: topMovieRows[0].title } : null;

    const busiestBingeDay = busiestDayRows[0]
      ? { date: busiestDayRows[0].watch_date, episodesWatched: busiestDayRows[0].episodes_watched }
      : null;

    const firstWatchDate =
      [episodeSummary?.first_watch_date, movieSummary?.first_watch_date]
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? null;

    return {
      profileId,
      period,
      year,
      month,
      startDate,
      endDate,
      hoursWatched: Math.round(totalMinutes / 60),
      episodesWatched,
      moviesWatched,
      topGenres,
      topShow,
      topMovie,
      longestStreak: calculateLongestStreak(watchDateRows.map((row) => row.watch_date)),
      busiestBingeDay,
      firstWatchDate,
      activityBreakdown: buildActivityBreakdown(period, year, month, activityBucketRows),
    };
  });
}

/**
 * Fill every bucket in the period (every day of the month, or every month of the year) with its
 * episode count, defaulting to 0 for buckets with no activity - so the result is always a
 * fixed-size series a heatmap can render directly, without the caller checking for gaps.
 *
 * @param period - Whether the buckets are days-of-month or months-of-year
 * @param year - Calendar year of the period
 * @param month - Calendar month (1-12) of the period, only when period is 'month'
 * @param rows - Sparse bucket rows returned by the query (only buckets with activity)
 * @returns A fully-populated, ascending series of activity buckets
 */
function buildActivityBreakdown(
  period: RecapPeriodType,
  year: number,
  month: number | undefined,
  rows: ActivityBucketRow[],
): { period: number; episodesWatched: number }[] {
  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.bucket, Number(row.episodes_watched));
  }

  const bucketCount = period === 'month' ? new Date(Date.UTC(year, month ?? 1, 0)).getUTCDate() : 12;

  const breakdown: { period: number; episodesWatched: number }[] = [];
  for (let bucket = 1; bucket <= bucketCount; bucket++) {
    breakdown.push({ period: bucket, episodesWatched: counts.get(bucket) ?? 0 });
  }
  return breakdown;
}

/**
 * Calculate the longest run of consecutive watch dates within an already-scoped date range.
 *
 * @param sortedWatchDates - Distinct watch dates (YYYY-MM-DD), ascending
 * @returns The longest streak found, or null if there were no watch dates
 */
function calculateLongestStreak(
  sortedWatchDates: string[],
): { days: number; startDate: string; endDate: string } | null {
  if (sortedWatchDates.length === 0) {
    return null;
  }

  let bestStart = sortedWatchDates[0];
  let bestEnd = sortedWatchDates[0];
  let bestDays = 1;

  let currentStart = sortedWatchDates[0];
  let currentEnd: string;
  let currentDays = 1;

  for (let i = 1; i < sortedWatchDates.length; i++) {
    const prevDate = new Date(sortedWatchDates[i - 1]);
    const currDate = new Date(sortedWatchDates[i]);
    const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      currentEnd = sortedWatchDates[i];
      currentDays++;
    } else {
      currentStart = sortedWatchDates[i];
      currentEnd = sortedWatchDates[i];
      currentDays = 1;
    }

    if (currentDays > bestDays) {
      bestDays = currentDays;
      bestStart = currentStart;
      bestEnd = currentEnd;
    }
  }

  return { days: bestDays, startDate: bestStart, endDate: bestEnd };
}

/**
 * Get the distinct calendar years and (year, month) pairs that have watch activity
 * for a profile, used to bound recap navigation.
 *
 * @param profileId - ID of the profile
 * @returns Available recap periods
 */
export async function getAvailableRecapPeriods(profileId: number): Promise<AvailableRecapPeriods> {
  return await DbMonitor.getInstance().executeWithTiming('getAvailableRecapPeriods', async () => {
    const pool = getDbPool();

    const [rows] = await pool.execute<AvailablePeriodRow[]>(
      `
      SELECT YEAR(watched_at) as y, MONTH(watched_at) as m
      FROM episode_watch_history
      WHERE profile_id = ? AND is_prior_watch = FALSE
      UNION
      SELECT YEAR(watched_at) as y, MONTH(watched_at) as m
      FROM movie_watch_history
      WHERE profile_id = ? AND is_prior_watch = FALSE
      `,
      [profileId, profileId],
    );

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    // The year's recap is treated as "ready" starting December, matching the home page banner's
    // own December-reveal window - mirrored here so the two surfaces never disagree about whether
    // the current year is available.
    const isCurrentYearReady = currentMonth === 12;

    const years = new Set<number>();
    const months = new Set<string>();
    for (const row of rows) {
      const isCurrentYear = row.y === currentYear;
      // The current year is still in progress (unless it's December), so its recap isn't a
      // finished period yet - exclude it from the navigable list until it closes (or reveals).
      if (!isCurrentYear || isCurrentYearReady) {
        years.add(row.y);
      }
      // The current month is still in progress, so its recap isn't a finished period yet -
      // exclude it from the navigable list until the month closes.
      if (row.y === currentYear && row.m === currentMonth) {
        continue;
      }
      months.add(`${row.y}-${row.m}`);
    }

    return {
      years: Array.from(years).sort((a, b) => a - b),
      months: Array.from(months)
        .map((key) => {
          const [y, m] = key.split('-').map(Number);
          return { year: y, month: m };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month),
    };
  });
}
