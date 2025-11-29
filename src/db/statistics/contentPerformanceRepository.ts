import { ContentEngagementRow, ContentPopularityRow, TrendingContentRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';

/**
 * Get popular shows across the platform
 *
 * @param limit - Maximum number of results
 * @returns Popular shows
 */
export async function getPopularShows(limit: number = 20): Promise<ContentPopularityRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getPopularShows', async () => {
    const [rows] = await getDbPool().execute<ContentPopularityRow[]>(
      `
      SELECT
        s.id as content_id,
        s.title,
        'show' as content_type,
        COUNT(DISTINCT p.account_id) as account_count,
        COUNT(DISTINCT ps.profile_id) as profile_count,
        COALESCE(SUM(watched_count.episode_count), 0) as total_watch_count,
        CASE
          WHEN COALESCE(total_episodes.episode_count, 0) > 0
          THEN ROUND((COALESCE(SUM(watched_count.episode_count), 0) /
                     (COALESCE(total_episodes.episode_count, 1) * COUNT(DISTINCT ps.profile_id))) * 100, 2)
          ELSE 0
        END as completion_rate,
        YEAR(s.release_date) as release_year
      FROM shows s
      INNER JOIN profile_shows ps ON ps.show_id = s.id
      INNER JOIN profiles p ON p.profile_id = ps.profile_id
      LEFT JOIN (
        SELECT
          ps.show_id,
          ps.profile_id,
          COUNT(DISTINCT ews.episode_id) as episode_count
        FROM profile_shows ps
        JOIN show_watch_status sws ON sws.profile_id = ps.profile_id
        JOIN episode_watch_status ews ON ews.profile_id = ps.profile_id
        JOIN episodes e ON e.id = ews.episode_id AND e.show_id = ps.show_id
        WHERE ews.status = 'WATCHED'
        GROUP BY ps.show_id, ps.profile_id
      ) as watched_count ON watched_count.show_id = s.id AND watched_count.profile_id = ps.profile_id
      LEFT JOIN (
        SELECT show_id, COUNT(*) as episode_count
        FROM episodes
        WHERE air_date IS NOT NULL AND air_date <= CURDATE()
        GROUP BY show_id
      ) as total_episodes ON total_episodes.show_id = s.id
      GROUP BY s.id, s.title, YEAR(s.release_date), total_episodes.episode_count
      ORDER BY profile_count DESC, total_watch_count DESC
      LIMIT ${limit}
      `,
    );

    return rows;
  });
}

/**
 * Get popular movies across the platform
 *
 * @param limit - Maximum number of results
 * @returns Popular movies
 */
export async function getPopularMovies(limit: number = 20): Promise<ContentPopularityRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getPopularMovies', async () => {
    const [rows] = await getDbPool().execute<ContentPopularityRow[]>(
      `
      SELECT
        m.id as content_id,
        m.title,
        'movie' as content_type,
        COUNT(DISTINCT p.account_id) as account_count,
        COUNT(DISTINCT pm.profile_id) as profile_count,
        COALESCE(SUM(CASE WHEN mws.status = 'WATCHED' THEN 1 ELSE 0 END), 0) as total_watch_count,
        ROUND((COALESCE(SUM(CASE WHEN mws.status = 'WATCHED' THEN 1 ELSE 0 END), 0) /
               COUNT(DISTINCT pm.profile_id)) * 100, 2) as completion_rate,
        YEAR(m.release_date) as release_year
      FROM movies m
      INNER JOIN profile_movies pm ON pm.movie_id = m.id
      INNER JOIN profiles p ON p.profile_id = pm.profile_id
      LEFT JOIN movie_watch_status mws ON mws.profile_id = pm.profile_id
      GROUP BY m.id, m.title, YEAR(m.release_date)
      ORDER BY profile_count DESC, total_watch_count DESC
      LIMIT ${limit}
      `,
    );

    return rows;
  });
}

/**
 * Get trending shows (recently added or watched)
 *
 * @param days - Number of days to analyze
 * @param limit - Maximum number of results
 * @returns Trending shows
 */
export async function getTrendingShows(days: number = 30, limit: number = 20): Promise<TrendingContentRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getTrendingShows', async () => {
    const [rows] = await getDbPool().execute<TrendingContentRow[]>(
      `
      SELECT
        s.id as content_id,
        s.title,
        'show' as content_type,
        COUNT(DISTINCT CASE
          WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          THEN ps.profile_id
        END) as new_additions,
        COUNT(DISTINCT CASE
          WHEN ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND ews.status = 'WATCHED'
          THEN ews.episode_id
        END) as recent_watch_count,
        COUNT(DISTINCT CASE
          WHEN ews.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND ews.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            AND ews.status = 'WATCHED'
          THEN ews.episode_id
        END) as previous_watch_count
      FROM shows s
      INNER JOIN profile_shows ps ON ps.show_id = s.id
      LEFT JOIN episodes e ON e.show_id = s.id
      LEFT JOIN episode_watch_status ews ON ews.episode_id = e.id AND ews.profile_id = ps.profile_id
      GROUP BY s.id, s.title
      HAVING new_additions > 0 OR recent_watch_count > 0
      ORDER BY recent_watch_count DESC, new_additions DESC
      LIMIT ${limit}
      `,
      [days, days, days * 2, days],
    );

    return rows;
  });
}

/**
 * Get trending movies
 *
 * @param days - Number of days to analyze
 * @param limit - Maximum number of results
 * @returns Trending movies
 */
export async function getTrendingMovies(days: number = 30, limit: number = 20): Promise<TrendingContentRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getTrendingMovies', async () => {
    const [rows] = await getDbPool().execute<TrendingContentRow[]>(
      `
      SELECT
        m.id as content_id,
        m.title,
        'movie' as content_type,
        COUNT(DISTINCT CASE
          WHEN m.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          THEN pm.profile_id
        END) as new_additions,
        COUNT(DISTINCT CASE
          WHEN mws.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND mws.status = 'WATCHED'
          THEN mws.profile_id
        END) as recent_watch_count,
        COUNT(DISTINCT CASE
          WHEN mws.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND mws.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            AND mws.status = 'WATCHED'
          THEN mws.profile_id
        END) as previous_watch_count
      FROM movies m
      INNER JOIN profile_movies pm ON pm.movie_id = m.id
      LEFT JOIN movie_watch_status mws ON mws.profile_id = pm.profile_id
      GROUP BY m.id, m.title
      HAVING new_additions > 0 OR recent_watch_count > 0
      ORDER BY recent_watch_count DESC, new_additions DESC
      LIMIT ${limit}
      `,
      [days, days, days * 2, days],
    );

    return rows;
  });
}

/**
 * Get engagement metrics for a specific show
 *
 * @param showId - Show ID
 * @returns Show engagement metrics
 */
export async function getShowEngagement(showId: number): Promise<ContentEngagementRow | null> {
  return await DbMonitor.getInstance().executeWithTiming('getShowEngagement', async () => {
    const [rows] = await getDbPool().execute<ContentEngagementRow[]>(
      `
      SELECT
        s.id as content_id,
        s.title,
        COUNT(DISTINCT ps.profile_id) as total_profiles,
        COUNT(DISTINCT CASE WHEN sws.status = 'WATCHED' THEN ps.profile_id END) as completed_profiles,
        COUNT(DISTINCT CASE WHEN sws.status = 'WATCHING' THEN ps.profile_id END) as watching_profiles,
        COUNT(DISTINCT CASE WHEN sws.status = 'NOT_WATCHED' THEN ps.profile_id END) as not_started_profiles,
        COUNT(DISTINCT CASE
          WHEN sws.status = 'WATCHING'
            AND sws.updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
          THEN ps.profile_id
        END) as abandoned_profiles,
        COALESCE(AVG(DATEDIFF(complete_dates.last_watch, complete_dates.first_watch)), 0) as avg_days_to_complete,
        COALESCE(AVG((watched_episodes.episode_count / total_episodes.episode_count) * 100), 0) as avg_progress
      FROM shows s
      LEFT JOIN profile_shows ps ON ps.show_id = s.id
      LEFT JOIN show_watch_status sws ON sws.profile_id = ps.profile_id
      LEFT JOIN (
        SELECT
          ps.profile_id,
          ps.show_id,
          MIN(ews.updated_at) as first_watch,
          MAX(ews.updated_at) as last_watch
        FROM profile_shows ps
        JOIN episode_watch_status ews ON ews.profile_id = ps.profile_id
        JOIN episodes e ON e.id = ews.episode_id AND e.show_id = ps.show_id
        WHERE ews.status = 'WATCHED'
        GROUP BY ps.profile_id, ps.show_id
      ) as complete_dates ON complete_dates.profile_id = ps.profile_id AND complete_dates.show_id = ps.show_id
      LEFT JOIN (
        SELECT
          ps.show_id,
          ps.profile_id,
          COUNT(DISTINCT ews.episode_id) as episode_count
        FROM profile_shows ps
        JOIN episode_watch_status ews ON ews.profile_id = ps.profile_id
        JOIN episodes e ON e.id = ews.episode_id AND e.show_id = ps.show_id
        WHERE ews.status = 'WATCHED'
        GROUP BY ps.show_id, ps.profile_id
      ) as watched_episodes ON watched_episodes.show_id = ps.show_id AND watched_episodes.profile_id = ps.profile_id
      LEFT JOIN (
        SELECT show_id, COUNT(*) as episode_count
        FROM episodes
        WHERE air_date IS NOT NULL AND air_date <= CURDATE()
        GROUP BY show_id
      ) as total_episodes ON total_episodes.show_id = s.id
      WHERE s.id = ?
      GROUP BY s.id, s.title
      `,
      [showId],
    );

    return rows[0] || null;
  });
}

/**
 * Get engagement metrics for a specific movie
 *
 * @param movieId - Movie ID
 * @returns Movie engagement metrics
 */
export async function getMovieEngagement(movieId: number): Promise<ContentEngagementRow | null> {
  return await DbMonitor.getInstance().executeWithTiming('getMovieEngagement', async () => {
    const [rows] = await getDbPool().execute<ContentEngagementRow[]>(
      `
      SELECT
        m.id as content_id,
        m.title,
        COUNT(DISTINCT pm.profile_id) as total_profiles,
        COUNT(DISTINCT CASE WHEN mws.status = 'WATCHED' THEN pm.profile_id END) as completed_profiles,
        0 as watching_profiles,
        COUNT(DISTINCT CASE WHEN mws.status = 'NOT_WATCHED' THEN pm.profile_id END) as not_started_profiles,
        0 as abandoned_profiles,
        0 as avg_days_to_complete,
        ROUND((COUNT(DISTINCT CASE WHEN mws.status = 'WATCHED' THEN pm.profile_id END) /
              COUNT(DISTINCT pm.profile_id)) * 100, 2) as avg_progress
      FROM movies m
      LEFT JOIN profile_movies pm ON pm.movie_id = m.id
      LEFT JOIN movie_watch_status mws ON mws.profile_id = pm.profile_id
      WHERE m.id = ?
      GROUP BY m.id, m.title
      `,
      [movieId],
    );

    return rows[0] || null;
  });
}
