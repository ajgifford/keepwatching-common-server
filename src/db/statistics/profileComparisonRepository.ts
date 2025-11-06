import {
  AccountSummaryRow,
  ProfileComparisonRow,
  ProfileGenreRow,
  ProfileServiceRow,
  ProfileVelocityRow,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';

/**
 * Get profile comparison data for an account
 *
 * @param accountId - Account ID
 * @returns Profile comparison data
 */
export async function getProfileComparisonData(accountId: number): Promise<{
  profiles: ProfileComparisonRow[];
  genres: ProfileGenreRow[];
  services: ProfileServiceRow[];
  velocity: ProfileVelocityRow[];
  accountSummary: AccountSummaryRow;
}> {
  return await DbMonitor.getInstance().executeWithTiming('getProfileComparisonData', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Get basic profile metrics
      const [profileRows] = await connection.query<ProfileComparisonRow[]>(
        `
        SELECT
          p.profile_id as profile_id,
          p.name as profile_name,
          COALESCE(show_counts.total_shows, 0) as total_shows,
          COALESCE(movie_counts.total_movies, 0) as total_movies,
          COALESCE(episodes_watched.count, 0) as episodes_watched,
          COALESCE(movies_watched.count, 0) as movies_watched,
          (
            COALESCE(episodes_watched.total_runtime, 0) +
            COALESCE(movies_watched.total_runtime, 0)
          ) / 60 as total_hours_watched,
          CASE
            WHEN COALESCE(show_counts.total_shows, 0) > 0
            THEN ROUND((COALESCE(shows_watched.count, 0) / show_counts.total_shows) * 100, 2)
            ELSE 0
          END as show_watch_progress,
          CASE
            WHEN COALESCE(movie_counts.total_movies, 0) > 0
            THEN ROUND((COALESCE(movies_watched.count, 0) / movie_counts.total_movies) * 100, 2)
            ELSE 0
          END as movie_watch_progress,
          GREATEST(
            COALESCE(last_episode_watch.last_updated, '1970-01-01'),
            COALESCE(last_movie_watch.last_updated, '1970-01-01')
          ) as last_activity_date,
          COALESCE(watching_count.count, 0) as currently_watching_count,
          COALESCE(completed_count.count, 0) as completed_shows_count
        FROM profiles p
        LEFT JOIN (
          SELECT profile_id, COUNT(DISTINCT show_id) as total_shows
          FROM profile_shows
          WHERE profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY profile_id
        ) as show_counts ON show_counts.profile_id = p.profile_id
        LEFT JOIN (
          SELECT profile_id, COUNT(DISTINCT movie_id) as total_movies
          FROM profile_movies
          WHERE profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY profile_id
        ) as movie_counts ON movie_counts.profile_id = p.profile_id
        LEFT JOIN (
          SELECT ews.profile_id, COUNT(*) as count, SUM(e.runtime) as total_runtime
          FROM episode_watch_status ews
          JOIN episodes e ON e.id = ews.episode_id
          WHERE ews.status = 'WATCHED'
            AND ews.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY ews.profile_id
        ) as episodes_watched ON episodes_watched.profile_id = p.profile_id
        LEFT JOIN (
          SELECT pm.profile_id, COUNT(*) as count, SUM(m.runtime) as total_runtime
          FROM movie_watch_status mws
          JOIN profile_movies pm ON pm.profile_id = mws.profile_id
          JOIN movies m ON m.id = pm.movie_id
          WHERE mws.status = 'WATCHED'
            AND pm.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY pm.profile_id
        ) as movies_watched ON movies_watched.profile_id = p.profile_id
        LEFT JOIN (
          SELECT ps.profile_id, COUNT(*) as count
          FROM show_watch_status sws
          JOIN profile_shows ps ON ps.profile_id = sws.profile_id
          WHERE sws.status = 'WATCHED'
            AND ps.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY ps.profile_id
        ) as shows_watched ON shows_watched.profile_id = p.profile_id
        LEFT JOIN (
          SELECT ps.profile_id, COUNT(*) as count
          FROM show_watch_status sws
          JOIN profile_shows ps ON ps.profile_id = sws.profile_id
          WHERE sws.status = 'WATCHING'
            AND ps.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY ps.profile_id
        ) as watching_count ON watching_count.profile_id = p.profile_id
        LEFT JOIN (
          SELECT ps.profile_id, COUNT(*) as count
          FROM show_watch_status sws
          JOIN profile_shows ps ON ps.profile_id = sws.profile_id
          WHERE sws.status = 'WATCHED'
            AND ps.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY ps.profile_id
        ) as completed_count ON completed_count.profile_id = p.profile_id
        LEFT JOIN (
          SELECT profile_id, MAX(updated_at) as last_updated
          FROM episode_watch_status
          WHERE status = 'WATCHED'
            AND profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY profile_id
        ) as last_episode_watch ON last_episode_watch.profile_id = p.profile_id
        LEFT JOIN (
          SELECT pm.profile_id, MAX(mws.updated_at) as last_updated
          FROM movie_watch_status mws
          JOIN profile_movies pm ON pm.id = mws.profile_movie_id
          WHERE mws.status = 'WATCHED'
            AND pm.profile_id IN (SELECT profile_id FROM profiles WHERE account_id = ?)
          GROUP BY pm.profile_id
        ) as last_movie_watch ON last_movie_watch.profile_id = p.profile_id
        WHERE p.account_id = ?
        ORDER BY p.name
        `,
        [accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId, accountId],
      );

      // Get top genres per profile
      const [genreRows] = await connection.query<ProfileGenreRow[]>(
        `
        SELECT 
          profile_id,
          genre_name,
          genre_count
        FROM (
          SELECT 
            ps.profile_id,
            g.name as genre_name,
            COUNT(*) as genre_count,
            ROW_NUMBER() OVER (PARTITION BY ps.profile_id ORDER BY COUNT(*) DESC) as rn
          FROM profile_shows ps
          JOIN show_genres sg ON sg.show_id = ps.show_id
          JOIN genres g ON g.id = sg.genre_id
          JOIN profiles p ON p.id = ps.profile_id
          WHERE p.account_id = ?
          GROUP BY ps.profile_id, g.name
        ) as ranked_genres
        WHERE rn <= 3
        ORDER BY profile_id, genre_count DESC
        `,
        [accountId],
      );

      // Get top services per profile
      const [serviceRows] = await connection.query<ProfileServiceRow[]>(
        `
        SELECT 
          profile_id,
          service_name,
          service_count
        FROM (
          SELECT 
            ps.profile_id,
            ss.name as service_name,
            COUNT(*) as service_count,
            ROW_NUMBER() OVER (PARTITION BY ps.profile_id ORDER BY COUNT(*) DESC) as rn
          FROM profile_shows ps
          JOIN show_services srv ON srv.show_id = ps.show_id
          JOIN streaming_services ss ON ss.id = srv.service_id
          JOIN profiles p ON p.id = ps.profile_id
          WHERE p.account_id = ?
          GROUP BY ps.profile_id, ss.name
        ) as ranked_services
        WHERE rn <= 3
        ORDER BY profile_id, service_count DESC
        `,
        [accountId],
      );

      // Get velocity data per profile
      const [velocityRows] = await connection.query<ProfileVelocityRow[]>(
        `
        SELECT
          p.profile_id as profile_id,
          COALESCE(ROUND(COUNT(DISTINCT ews.episode_id) /
            NULLIF(DATEDIFF(MAX(ews.updated_at), MIN(ews.updated_at)), 0) * 7, 2), 0) as episodes_per_week,
          COALESCE(
            DAYNAME(
              (SELECT DATE(updated_at)
               FROM episode_watch_status
               WHERE profile_id = p.profile_id AND status = 'WATCHED'
               GROUP BY DATE(updated_at)
               ORDER BY COUNT(*) DESC
               LIMIT 1)
            ),
            'Monday'
          ) as most_active_day
        FROM profiles p
        LEFT JOIN episode_watch_status ews ON ews.profile_id = p.profile_id AND ews.status = 'WATCHED'
        WHERE p.account_id = ?
        GROUP BY p.profile_id
        `,
        [accountId],
      );

      // Get account-wide summary
      const [summaryRows] = await connection.query<AccountSummaryRow[]>(
        `
        SELECT 
          COUNT(DISTINCT ps.show_id) as total_unique_shows,
          COUNT(DISTINCT pm.movie_id) as total_unique_movies,
          (
            SELECT s.id
            FROM profile_shows ps2
            JOIN shows s ON s.id = ps2.show_id
            JOIN profiles p2 ON p2.id = ps2.profile_id
            WHERE p2.account_id = ?
            GROUP BY s.id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_show_id,
          (
            SELECT s.title
            FROM profile_shows ps2
            JOIN shows s ON s.id = ps2.show_id
            JOIN profiles p2 ON p2.id = ps2.profile_id
            WHERE p2.account_id = ?
            GROUP BY s.id, s.title
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_show_title,
          (
            SELECT COUNT(*)
            FROM profile_shows ps2
            JOIN shows s ON s.id = ps2.show_id
            JOIN profiles p2 ON p2.id = ps2.profile_id
            WHERE p2.account_id = ?
            GROUP BY s.id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_show_count,
          (
            SELECT m.id
            FROM profile_movies pm2
            JOIN movies m ON m.id = pm2.movie_id
            JOIN profiles p2 ON p2.id = pm2.profile_id
            WHERE p2.account_id = ?
            GROUP BY m.id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_movie_id,
          (
            SELECT m.title
            FROM profile_movies pm2
            JOIN movies m ON m.id = pm2.movie_id
            JOIN profiles p2 ON p2.id = pm2.profile_id
            WHERE p2.account_id = ?
            GROUP BY m.id, m.title
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_movie_title,
          (
            SELECT COUNT(*)
            FROM profile_movies pm2
            JOIN movies m ON m.id = pm2.movie_id
            JOIN profiles p2 ON p2.id = pm2.profile_id
            WHERE p2.account_id = ?
            GROUP BY m.id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_watched_movie_count
        FROM profiles p
        LEFT JOIN profile_shows ps ON ps.profile_id = p.profile_id
        LEFT JOIN profile_movies pm ON pm.profile_id = p.profile_id
        WHERE p.account_id = ?
        `,
        [accountId, accountId, accountId, accountId, accountId, accountId, accountId],
      );

      return {
        profiles: profileRows,
        genres: genreRows,
        services: serviceRows,
        velocity: velocityRows,
        accountSummary: summaryRows[0] || {
          total_unique_shows: 0,
          total_unique_movies: 0,
          most_watched_show_id: null,
          most_watched_show_title: null,
          most_watched_show_count: null,
          most_watched_movie_id: null,
          most_watched_movie_title: null,
          most_watched_movie_count: null,
        },
      };
    } finally {
      connection.release();
    }
  });
}
