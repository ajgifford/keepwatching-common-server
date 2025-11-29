import {
  LatestEpisodeRow,
  LatestMovieRow,
  LatestWatchRow,
  MilestoneAchievementRow,
  WatchCountRow,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AchievementType } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * Structured achievement data for application use
 */
export interface AchievementRecord {
  id: number;
  profileId: number;
  achievementType: AchievementType;
  thresholdValue: number;
  achievedAt: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
  metadata?: Record<string, unknown>;
}

/**
 * Get all achievements for a profile
 *
 * @param profileId - ID of the profile
 * @returns Array of achievement records
 */
export async function getAchievementsByProfile(profileId: number): Promise<AchievementRecord[]> {
  return await DbMonitor.getInstance().executeWithTiming('getAchievementsByProfile', async () => {
    const [rows] = await getDbPool().execute<MilestoneAchievementRow[]>(
      `SELECT
        id,
        profile_id,
        achievement_type,
        threshold_value,
        achieved_at,
        created_at,
        metadata
      FROM milestone_achievements
      WHERE profile_id = ?
      ORDER BY achieved_at DESC`,
      [profileId],
    );

    return rows.map(mapRowToAchievementRecord);
  });
}

/**
 * Get recent achievements for a profile within specified days
 *
 * @param profileId - ID of the profile
 * @param days - Number of days to look back (default: 30)
 * @returns Array of recent achievement records
 */
export async function getRecentAchievements(profileId: number, days: number = 30): Promise<AchievementRecord[]> {
  return await DbMonitor.getInstance().executeWithTiming('getRecentAchievements', async () => {
    const [rows] = await getDbPool().execute<MilestoneAchievementRow[]>(
      `SELECT
        id,
        profile_id,
        achievement_type,
        threshold_value,
        achieved_at,
        created_at,
        metadata
      FROM milestone_achievements
      WHERE profile_id = ?
        AND achieved_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY achieved_at DESC`,
      [profileId, days],
    );

    return rows.map(mapRowToAchievementRecord);
  });
}

/**
 * Check if an achievement already exists for a profile
 *
 * @param profileId - ID of the profile
 * @param achievementType - Type of achievement
 * @param thresholdValue - Threshold value for the achievement
 * @returns True if achievement exists, false otherwise
 */
export async function checkAchievementExists(
  profileId: number,
  achievementType: AchievementType,
  thresholdValue: number,
): Promise<boolean> {
  return await DbMonitor.getInstance().executeWithTiming('checkAchievementExists', async () => {
    const [rows] = await getDbPool().execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count
      FROM milestone_achievements
      WHERE profile_id = ?
        AND achievement_type = ?
        AND threshold_value = ?`,
      [profileId, achievementType, thresholdValue],
    );

    return rows[0]?.count > 0;
  });
}

/**
 * Record a new achievement for a profile
 *
 * @param profileId - ID of the profile
 * @param achievementType - Type of achievement
 * @param thresholdValue - Threshold value achieved
 * @param achievedAt - Date when achievement was accomplished
 * @param metadata - Optional metadata about the achievement
 * @returns ID of the newly created achievement record
 */
export async function recordAchievement(
  profileId: number,
  achievementType: AchievementType,
  thresholdValue: number,
  achievedAt: Date,
  metadata?: Record<string, unknown>,
): Promise<number> {
  return await DbMonitor.getInstance().executeWithTiming('recordAchievement', async () => {
    const connection = await getDbPool().getConnection();
    try {
      // Check if achievement already exists to prevent duplicates
      const exists = await checkAchievementExists(profileId, achievementType, thresholdValue);
      if (exists) {
        // Return 0 to indicate no new record was created
        return 0;
      }

      const metadataJson = metadata ? JSON.stringify(metadata) : null;

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO milestone_achievements
        (profile_id, achievement_type, threshold_value, achieved_at, metadata)
        VALUES (?, ?, ?, ?, ?)`,
        [profileId, achievementType, thresholdValue, achievedAt, metadataJson],
      );

      return result.insertId;
    } finally {
      connection.release();
    }
  });
}

/**
 * Get achievements by type for a profile
 *
 * @param profileId - ID of the profile
 * @param achievementType - Type of achievement to filter by
 * @returns Array of achievement records of the specified type
 */
export async function getAchievementsByType(
  profileId: number,
  achievementType: AchievementType,
): Promise<AchievementRecord[]> {
  return await DbMonitor.getInstance().executeWithTiming('getAchievementsByType', async () => {
    const [rows] = await getDbPool().execute<MilestoneAchievementRow[]>(
      `SELECT
        id,
        profile_id,
        achievement_type,
        threshold_value,
        achieved_at,
        created_at,
        metadata
      FROM milestone_achievements
      WHERE profile_id = ?
        AND achievement_type = ?
      ORDER BY threshold_value ASC`,
      [profileId, achievementType],
    );

    return rows.map(mapRowToAchievementRecord);
  });
}

/**
 * Map database row to achievement record
 *
 * @param row - Database row
 * @returns Structured achievement record
 */
function mapRowToAchievementRecord(row: MilestoneAchievementRow): AchievementRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    achievementType: row.achievement_type as AchievementType,
    thresholdValue: row.threshold_value,
    achievedAt: new Date(row.achieved_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
  };
}

/**
 * Get the most recent watched episode with metadata
 *
 * @param profileId - ID of the profile
 * @returns Episode metadata or null if no watched episodes found
 */
export async function getLatestWatchedEpisode(profileId: number): Promise<{
  episodeId: number;
  showName: string;
  episodeName: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: Date;
} | null> {
  return await DbMonitor.getInstance().executeWithTiming('getLatestWatchedEpisode', async () => {
    const [rows] = await getDbPool().execute<LatestEpisodeRow[]>(
      `SELECT
        e.id as episode_id,
        s.title as show_name,
        e.title as episode_name,
        se.season_number,
        e.episode_number,
        ews.updated_at
       FROM episode_watch_status ews
       JOIN episodes e ON e.id = ews.episode_id
       JOIN seasons se ON se.id = e.season_id
       JOIN shows s ON s.id = se.show_id
       WHERE ews.profile_id = ? AND ews.status = 'WATCHED'
       ORDER BY ews.updated_at DESC
       LIMIT 1`,
      [profileId],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      episodeId: row.episode_id,
      showName: row.show_name,
      episodeName: row.episode_name,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      watchedAt: row.updated_at,
    };
  });
}

/**
 * Get the most recent watched movie with metadata
 *
 * @param profileId - ID of the profile
 * @returns Movie metadata or null if no watched movies found
 */
export async function getLatestWatchedMovie(profileId: number): Promise<{
  movieId: number;
  movieTitle: string;
  watchedAt: Date;
} | null> {
  return await DbMonitor.getInstance().executeWithTiming('getLatestWatchedMovie', async () => {
    const [rows] = await getDbPool().execute<LatestMovieRow[]>(
      `SELECT
        m.id as movie_id,
        m.title as movie_title,
        mws.updated_at
       FROM movie_watch_status mws
       JOIN movies m ON m.id = mws.movie_id
       WHERE mws.profile_id = ? AND mws.status = 'WATCHED'
       ORDER BY mws.updated_at DESC
       LIMIT 1`,
      [profileId],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      movieId: row.movie_id,
      movieTitle: row.movie_title,
      watchedAt: row.updated_at,
    };
  });
}

/**
 * Get current watch counts for a profile
 */
export async function getWatchCounts(profileId: number): Promise<{
  episodes: number;
  movies: number;
  hours: number;
}> {
  const [rows] = await getDbPool().execute<WatchCountRow[]>(
    `SELECT
      COALESCE(
        (SELECT COUNT(*)
         FROM episode_watch_status
         WHERE profile_id = ? AND status = 'WATCHED'),
        0
      ) as total_episodes_watched,
      COALESCE(
        (SELECT COUNT(*)
         FROM movie_watch_status
         WHERE profile_id = ? AND status = 'WATCHED'),
        0
      ) as total_movies_watched,
      COALESCE(
        (SELECT SUM(e.runtime)
         FROM episode_watch_status ews
         JOIN episodes e ON e.id = ews.episode_id
         WHERE ews.profile_id = ? AND ews.status = 'WATCHED'),
        0
      ) +
      COALESCE(
        (SELECT SUM(m.runtime)
         FROM movie_watch_status mws
         JOIN movies m ON m.id = mws.movie_id
         WHERE mws.profile_id = ? AND mws.status = 'WATCHED'),
        0
      ) as total_runtime_minutes`,
    [profileId, profileId, profileId, profileId],
  );

  const row = rows[0];
  return {
    episodes: row.total_episodes_watched,
    movies: row.total_movies_watched,
    hours: Math.round(row.total_runtime_minutes / 60),
  };
}

/**
 * Get the most recent watch date (either episode or movie)
 */
export async function getLatestWatchDate(profileId: number): Promise<Date> {
  const [rows] = await getDbPool().execute<LatestWatchRow[]>(
    `SELECT MAX(updated_at) as latest_watch_date
     FROM (
       SELECT updated_at FROM episode_watch_status
       WHERE profile_id = ? AND status = 'WATCHED'
       UNION ALL
       SELECT updated_at FROM movie_watch_status
       WHERE profile_id = ? AND status = 'WATCHED'
     ) combined`,
    [profileId, profileId],
  );

  return rows[0]?.latest_watch_date || new Date();
}
