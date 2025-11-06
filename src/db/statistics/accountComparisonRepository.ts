import { AccountHealthRow, AccountRankingRow } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';

/**
 * Get account rankings by a specific metric
 *
 * @param metric - Metric to rank by
 * @param limit - Maximum number of results
 * @returns Ranked list of accounts
 */
export async function getAccountRankings(
  metric: 'episodesWatched' | 'moviesWatched' | 'hoursWatched' | 'engagement',
  limit: number = 50,
): Promise<AccountRankingRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getAccountRankings', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Determine ORDER BY clause based on metric
      let orderByClause: string;
      switch (metric) {
        case 'episodesWatched':
          orderByClause = 'total_episodes_watched DESC';
          break;
        case 'moviesWatched':
          orderByClause = 'total_movies_watched DESC';
          break;
        case 'hoursWatched':
          orderByClause = 'total_hours_watched DESC';
          break;
        case 'engagement':
          orderByClause = 'engagement_score DESC';
          break;
        default:
          orderByClause = 'engagement_score DESC';
      }

      const [rows] = await connection.query<AccountRankingRow[]>(
        `
        SELECT 
          a.account_id,
          a.email as account_email,
          a.account_name,
          COUNT(DISTINCT p.profile_id) as profile_count,
          COALESCE(SUM(episode_stats.episodes_watched), 0) as total_episodes_watched,
          COALESCE(SUM(movie_stats.movies_watched), 0) as total_movies_watched,
          (
            COALESCE(SUM(episode_stats.total_runtime), 0) + 
            COALESCE(SUM(movie_stats.total_runtime), 0)
          ) / 60 as total_hours_watched,
          CASE 
            WHEN MAX(activity.last_activity) IS NULL THEN 0
            WHEN DATEDIFF(NOW(), MAX(activity.last_activity)) <= 7 THEN 100
            WHEN DATEDIFF(NOW(), MAX(activity.last_activity)) <= 30 THEN 75
            WHEN DATEDIFF(NOW(), MAX(activity.last_activity)) <= 90 THEN 50
            WHEN DATEDIFF(NOW(), MAX(activity.last_activity)) <= 180 THEN 25
            ELSE 10
          END as engagement_score,
          MAX(activity.last_activity) as last_activity_date
        FROM accounts a
        LEFT JOIN profiles p ON p.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as episodes_watched,
            SUM(e.runtime) as total_runtime
          FROM episode_watch_status ews
          JOIN episodes e ON e.id = ews.episode_id
          JOIN profiles p ON p.profile_id = ews.profile_id
          WHERE ews.status = 'WATCHED'
          GROUP BY p.account_id
        ) as episode_stats ON episode_stats.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as movies_watched,
            SUM(m.runtime) as total_runtime
          FROM movie_watch_status mws
          JOIN movies m ON m.id = mws.movie_id
          JOIN profiles p ON p.profile_id = mws.profile_id
          WHERE mws.status = 'WATCHED'
          GROUP BY p.account_id
        ) as movie_stats ON movie_stats.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            GREATEST(
              MAX(ews.updated_at),
              MAX(mws.updated_at)
            ) as last_activity
          FROM profiles p
          LEFT JOIN episode_watch_status ews ON ews.profile_id = p.profile_id AND ews.status = 'WATCHED'
          LEFT JOIN movie_watch_status mws ON mws.profile_id = p.profile_id AND mws.status = 'WATCHED'
          GROUP BY p.account_id
        ) as activity ON activity.account_id = a.account_id
        GROUP BY a.account_id, a.email, a.account_name
        ORDER BY ${orderByClause}
        LIMIT ?
        `,
        [limit],
      );

      return rows;
    } finally {
      connection.release();
    }
  });
}

/**
 * Get health metrics for all accounts
 *
 * @returns Array of account health metrics
 */
export async function getAllAccountHealthMetrics(): Promise<AccountHealthRow[]> {
  return await DbMonitor.getInstance().executeWithTiming('getAllAccountHealthMetrics', async () => {
    const connection = await getDbPool().getConnection();
    try {
      const [rows] = await connection.query<AccountHealthRow[]>(
        `
        SELECT 
          a.account_id as account_id,
          a.email as account_email,
          a.uid as uid,
          FALSE as email_verified,
          a.created_at as account_created_at,
          COUNT(DISTINCT p.profile_id) as profile_count,
          COALESCE(all_episodes.episodes_watched, 0) as total_episodes_watched,
          COALESCE(recent_episodes.episodes_watched, 0) as recent_episodes_watched,
          activity.last_activity as last_activity_date,
          DATEDIFF(NOW(), activity.last_activity) as days_since_last_activity
        FROM accounts a
        LEFT JOIN profiles p ON p.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as episodes_watched
          FROM episode_watch_status ews
          JOIN profiles p ON p.profile_id = ews.profile_id
          WHERE ews.status = 'WATCHED'
          GROUP BY p.account_id
        ) as all_episodes ON all_episodes.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as episodes_watched
          FROM episode_watch_status ews
          JOIN profiles p ON p.profile_id = ews.profile_id
          WHERE ews.status = 'WATCHED'
            AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY p.account_id
        ) as recent_episodes ON recent_episodes.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            GREATEST(
              MAX(ews.updated_at),
              MAX(mws.updated_at)
            ) as last_activity
          FROM profiles p
          LEFT JOIN episode_watch_status ews ON ews.profile_id = p.profile_id AND ews.status = 'WATCHED'
          LEFT JOIN movie_watch_status mws ON mws.profile_id = p.profile_id AND mws.status = 'WATCHED'
          GROUP BY p.account_id
        ) as activity ON activity.account_id = a.account_id
        GROUP BY 
          a.account_id, 
          a.email,
          a.uid,
          a.created_at, 
          all_episodes.episodes_watched, 
          recent_episodes.episodes_watched,
          activity.last_activity
        ORDER BY days_since_last_activity ASC;
        `,
      );

      return rows;
    } finally {
      connection.release();
    }
  });
}

/**
 * Get health metrics for a specific account
 *
 * @param accountId - Account ID
 * @returns Account health metrics
 */
export async function getAccountHealthMetrics(accountId: number): Promise<AccountHealthRow | null> {
  return await DbMonitor.getInstance().executeWithTiming('getAccountHealthMetrics', async () => {
    const connection = await getDbPool().getConnection();
    try {
      const [rows] = await connection.query<AccountHealthRow[]>(
        `
        SELECT 
          a.account_id as account_id,
          a.email as account_email,
          a.uid as uid,
          FALSE as email_verified,
          a.created_at as account_created_at,
          COUNT(DISTINCT p.profile_id) as profile_count,
          COALESCE(all_episodes.episodes_watched, 0) as total_episodes_watched,
          COALESCE(recent_episodes.episodes_watched, 0) as recent_episodes_watched,
          activity.last_activity as last_activity_date,
          DATEDIFF(NOW(), activity.last_activity) as days_since_last_activity
        FROM accounts a
        LEFT JOIN profiles p ON p.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as episodes_watched
          FROM episode_watch_status ews
          JOIN profiles p ON p.profile_id = ews.profile_id
          WHERE ews.status = 'WATCHED'
          GROUP BY p.account_id
        ) as all_episodes ON all_episodes.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            COUNT(*) as episodes_watched
          FROM episode_watch_status ews
          JOIN profiles p ON p.profile_id = ews.profile_id
          WHERE ews.status = 'WATCHED'
            AND ews.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY p.account_id
        ) as recent_episodes ON recent_episodes.account_id = a.account_id
        LEFT JOIN (
          SELECT 
            p.account_id,
            GREATEST(
              MAX(ews.updated_at),
              MAX(mws.updated_at)
            ) as last_activity
          FROM profiles p
          LEFT JOIN episode_watch_status ews ON ews.profile_id = p.profile_id AND ews.status = 'WATCHED'
          LEFT JOIN movie_watch_status mws ON mws.profile_id = p.profile_id AND mws.status = 'WATCHED'
          GROUP BY p.account_id
        ) as activity ON activity.account_id = a.account_id
        WHERE a.account_id = ?
        GROUP BY a.account_id, a.email, a.uid, a.created_at, 
                 all_episodes.episodes_watched, recent_episodes.episodes_watched,
                 activity.last_activity;
        `,
        [accountId],
      );

      return rows[0] || null;
    } finally {
      connection.release();
    }
  });
}
