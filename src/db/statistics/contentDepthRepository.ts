import { ContentDepthDataRow, ContentRatingDataRow, ReleaseYearDataRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { ContentDepthStats } from '@ajgifford/keepwatching-types';

/**
 * Get content depth statistics for a profile
 * Analyzes preferences for content length, release years, and maturity ratings
 *
 * @param profileId - ID of the profile
 * @returns Content depth statistics
 */
export async function getContentDepthStats(profileId: number): Promise<ContentDepthStats> {
  return await DbMonitor.getInstance().executeWithTiming('getContentDepthStats', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get average episode count per show
      const [showDepthRows] = await connection.query<ContentDepthDataRow[]>(
        `
        SELECT 
          COUNT(DISTINCT sws.show_id) as total_shows,
          COUNT(DISTINCT e.id) as total_episodes
        FROM show_watch_status sws
        LEFT JOIN episodes e ON e.show_id = sws.show_id
        WHERE sws.profile_id = ?
        `,
        [profileId],
      );

      // Get average movie runtime (separate query to avoid cross join)
      const [movieDepthRows] = await connection.query<ContentDepthDataRow[]>(
        `
        SELECT 
          COUNT(DISTINCT mws.movie_id) as total_movies,
          COALESCE(SUM(m.runtime), 0) as total_movie_runtime
        FROM movie_watch_status mws
        LEFT JOIN movies m ON m.id = mws.movie_id
        WHERE mws.profile_id = ?
        `,
        [profileId],
      );

      const showDepthData = showDepthRows[0];
      const movieDepthData = movieDepthRows[0];

      const averageEpisodeCountPerShow =
        showDepthData.total_shows > 0 ? showDepthData.total_episodes / showDepthData.total_shows : 0;
      const averageMovieRuntime =
        movieDepthData.total_movies > 0 ? movieDepthData.total_movie_runtime / movieDepthData.total_movies : 0;

      // Get release year distribution for shows
      const [showYearRows] = await connection.query<ReleaseYearDataRow[]>(
        `
        SELECT 
          YEAR(s.release_date) as release_year,
          COUNT(*) as content_count
        FROM show_watch_status sws
        JOIN shows s ON s.id = sws.show_id
        WHERE sws.profile_id = ? AND s.release_date IS NOT NULL
        GROUP BY release_year
        `,
        [profileId],
      );

      // Get release year distribution for movies
      const [movieYearRows] = await connection.query<ReleaseYearDataRow[]>(
        `
        SELECT 
          YEAR(m.release_date) as release_year,
          COUNT(*) as content_count
        FROM movie_watch_status mws
        JOIN movies m ON m.id = mws.movie_id
        WHERE mws.profile_id = ? AND m.release_date IS NOT NULL
        GROUP BY release_year
        `,
        [profileId],
      );

      // Combine and categorize release years
      const releaseYearDistribution = categorizeReleaseYears([...showYearRows, ...movieYearRows]);

      // Get content rating distribution for shows
      const [showRatingRows] = await connection.query<ContentRatingDataRow[]>(
        `
        SELECT 
          s.content_rating,
          COUNT(*) as content_count
        FROM show_watch_status sws
        JOIN shows s ON s.id = sws.show_id
        WHERE sws.profile_id = ?
        GROUP BY s.content_rating
        `,
        [profileId],
      );

      // Get content rating distribution for movies
      const [movieRatingRows] = await connection.query<ContentRatingDataRow[]>(
        `
        SELECT 
          m.mpa_rating as content_rating,
          COUNT(*) as content_count
        FROM movie_watch_status mws
        JOIN movies m ON m.id = mws.movie_id
        WHERE mws.profile_id = ?
        GROUP BY m.mpa_rating
        `,
        [profileId],
      );

      // Combine content ratings
      const contentMaturityDistribution = combineContentRatings([...showRatingRows, ...movieRatingRows]);

      return {
        averageEpisodeCountPerShow: Math.round(averageEpisodeCountPerShow * 10) / 10,
        averageMovieRuntime: Math.round(averageMovieRuntime),
        releaseYearDistribution,
        contentMaturityDistribution,
      };
    } finally {
      connection.release();
    }
  });
}

/**
 * Categorize release years into ranges
 */
function categorizeReleaseYears(rows: ReleaseYearDataRow[]): Record<string, number> {
  const currentYear = new Date().getFullYear();
  const distribution: Record<string, number> = {
    [`${currentYear - 4}-${currentYear}`]: 0,
    [`${currentYear - 9}-${currentYear - 5}`]: 0,
    [`${currentYear - 14}-${currentYear - 10}`]: 0,
    [`${currentYear - 24}-${currentYear - 15}`]: 0,
    [`Before ${currentYear - 24}`]: 0,
  };

  rows.forEach((row) => {
    const year = row.release_year;
    const count = row.content_count;

    if (year >= currentYear - 4) {
      distribution[`${currentYear - 4}-${currentYear}`] += count;
    } else if (year >= currentYear - 9) {
      distribution[`${currentYear - 9}-${currentYear - 5}`] += count;
    } else if (year >= currentYear - 14) {
      distribution[`${currentYear - 14}-${currentYear - 10}`] += count;
    } else if (year >= currentYear - 24) {
      distribution[`${currentYear - 24}-${currentYear - 15}`] += count;
    } else {
      distribution[`Before ${currentYear - 24}`] += count;
    }
  });

  return distribution;
}

/**
 * Combine content ratings from shows and movies
 */
function combineContentRatings(rows: ContentRatingDataRow[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  rows.forEach((row) => {
    const rating = row.content_rating || 'Not Rated';
    distribution[rating] = (distribution[rating] || 0) + row.content_count;
  });

  return distribution;
}
