import { DatabaseError } from '../middleware/errorMiddleware';
import { ProfileEpisodeRow, transformProfileEpisode } from '../types/episodeTypes';
import {
  ProfileSeasonRow,
  SeasonEpisodeCountReferenceRow,
  SeasonShowReferenceRow,
  SeasonStatusReferenceRow,
  transformProfileSeason,
} from '../types/seasonTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import {
  CreateSeasonRequest,
  ProfileEpisode,
  ProfileSeason,
  UpdateSeasonRequest,
  WatchStatus,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Saves a new season to the database
 *
 * @param season - The season data to save
 * @returns The saved season with its new ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function saveSeason(season: CreateSeasonRequest): Promise<number> {
  try {
    const query = `
      INSERT INTO seasons (
        show_id, tmdb_id, name, overview, 
        season_number, release_date, poster_image, number_of_episodes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await getDbPool().execute<ResultSetHeader>(query, [
      season.show_id,
      season.tmdb_id,
      season.name,
      season.overview,
      season.season_number,
      season.release_date,
      season.poster_image,
      season.number_of_episodes,
    ]);

    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'saving a season');
  }
}

/**
 * Updates an existing season or inserts a new one if it doesn't exist
 *
 * @param season - The season data to update
 * @returns The updated season with its ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateSeason(season: UpdateSeasonRequest): Promise<number> {
  try {
    const query = `
      INSERT INTO seasons (
        show_id, tmdb_id, name, overview, 
        season_number, release_date, poster_image, number_of_episodes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        id = LAST_INSERT_ID(id), 
        name = ?, 
        overview = ?, 
        season_number = ?, 
        release_date = ?, 
        poster_image = ?, 
        number_of_episodes = ?
    `;

    const [result] = await getDbPool().execute<ResultSetHeader>(query, [
      // Insert values
      season.show_id,
      season.tmdb_id,
      season.name,
      season.overview,
      season.season_number,
      season.release_date,
      season.poster_image,
      season.number_of_episodes,
      // Update values
      season.name,
      season.overview,
      season.season_number,
      season.release_date,
      season.poster_image,
      season.number_of_episodes,
    ]);

    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'updating a season');
  }
}

/**
 * Adds a season to a user's favorites/watch list
 *
 * @param profileId - ID of the profile to add the season for
 * @param seasonId - ID of the season to add
 * @throws {DatabaseError} If a database error occurs
 */
export async function saveFavorite(profileId: number, seasonId: number): Promise<void> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    const query = 'INSERT IGNORE INTO season_watch_status (profile_id, season_id) VALUES (?, ?)';
    await getDbPool().execute(query, [profileId, seasonId]);
  } catch (error) {
    handleDatabaseError(error, 'saving a season as a favorite');
  }
}

/**
 * Updates the watch status of a season for a specific profile
 *
 * @param profileId - ID of the profile to update watch status for
 * @param seasonId - ID of the season to update
 * @param status - New watch status ('NOT_WATCHED', 'WATCHING', 'WATCHED', or 'UP_TO_DATE')
 * @returns True if the watch status was updated, false if no rows affected
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateWatchStatus(profileId: number, seasonId: number, status: WatchStatus): Promise<boolean> {
  if (!profileId || !seasonId || !status) {
    throw new DatabaseError('Invalid parameters: profileId, seasonId and status are required', null);
  }

  try {
    const query = 'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, seasonId]);

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating the watch status of a season');
  }
}

/**
 * Updates the watch status of a season based on its episodes' statuses
 * Now handles the UP_TO_DATE status as well
 *
 * Season should be:
 * - WATCHED if all aired episodes are watched and there are no future episodes
 * - UP_TO_DATE if all aired episodes are watched and there are future episodes
 * - WATCHING if some aired episodes are watched
 * - NOT_WATCHED if no episodes are watched
 *
 * @param profileId - ID of the profile to update
 * @param seasonId - ID of the season to update
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateWatchStatusByEpisode(profileId: number, seasonId: number): Promise<void> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    const transactionHelper = new TransactionHelper();

    await transactionHelper.executeInTransaction(async (connection) => {
      const episodeStatusQuery = `
        SELECT
          COUNT(*) as total_episodes,
          SUM(CASE WHEN ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_episodes,
          SUM(CASE WHEN e.air_date > CURRENT_DATE() THEN 1 ELSE 0 END) as future_episodes,
          SUM(CASE WHEN e.air_date <= CURRENT_DATE() THEN 1 ELSE 0 END) as aired_episodes,
          SUM(CASE WHEN e.air_date <= CURRENT_DATE() AND ews.status = 'WATCHED' THEN 1 ELSE 0 END) as watched_aired_episodes
        FROM episodes e
        JOIN episode_watch_status ews ON e.id = ews.episode_id
        WHERE e.season_id = ? AND ews.profile_id = ?
      `;

      const [seasonEpisodeCountRows] = await connection.execute<SeasonEpisodeCountReferenceRow[]>(episodeStatusQuery, [
        seasonId,
        profileId,
      ]);
      if (!seasonEpisodeCountRows.length) return;

      const seasonEpisodeCounts = seasonEpisodeCountRows[0];
      if (seasonEpisodeCounts.total_episodes === 0) {
        await connection.execute(
          'UPDATE season_watch_status SET status = UP_TO_DATE WHERE profile_id = ? AND season_id = ?',
          [profileId, seasonId],
        );
        return;
      }

      let seasonStatus = WatchStatus.NOT_WATCHED;

      if (seasonEpisodeCounts.watched_aired_episodes === seasonEpisodeCounts.aired_episodes) {
        if (seasonEpisodeCounts.future_episodes > 0) {
          seasonStatus = WatchStatus.UP_TO_DATE;
        } else {
          seasonStatus = WatchStatus.WATCHED;
        }
      } else if (
        seasonEpisodeCounts.watched_episodes > 0 &&
        seasonEpisodeCounts.watched_episodes < seasonEpisodeCounts.total_episodes
      ) {
        seasonStatus = WatchStatus.WATCHING;
      }

      await connection.execute('UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?', [
        seasonStatus,
        profileId,
        seasonId,
      ]);
    });
  } catch (error) {
    handleDatabaseError(error, 'updating season watch status using episode status');
  }
}

/**
 * Updates the watch status of a season and all its applicable episodes
 *
 * When status is UP_TO_DATE:
 * - Only episodes that have already aired are marked as WATCHED
 * - Future episodes remain NOT_WATCHED
 *
 * For all other statuses, all episodes get the same status
 *
 * @param profileId - ID of the profile to update
 * @param seasonId - ID of the season to update
 * @param status - New watch status ('NOT_WATCHED', 'WATCHING', 'WATCHED', or 'UP_TO_DATE')
 * @returns True if the update was successful, false otherwise
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateAllWatchStatuses(
  profileId: number,
  seasonId: number,
  status: WatchStatus,
): Promise<boolean> {
  if (!profileId || !seasonId || !status) {
    throw new DatabaseError('Invalid parameters: profileId, seasonId and status are required', null);
  }

  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      // Update season status
      const seasonQuery = 'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?';
      const [seasonResult] = await connection.execute<ResultSetHeader>(seasonQuery, [status, profileId, seasonId]);

      if (seasonResult.affectedRows === 0) return false;

      // Different behavior based on status
      if (status === 'UP_TO_DATE') {
        // For UP_TO_DATE, we need to mark aired episodes as WATCHED and keep future episodes as NOT_WATCHED
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Update aired episodes to WATCHED
        const airedEpisodesQuery = `
          UPDATE episode_watch_status ews
          JOIN episodes e ON ews.episode_id = e.id
          SET ews.status = 'WATCHED'
          WHERE ews.profile_id = ? 
          AND e.season_id = ?
          AND (e.air_date IS NULL OR e.air_date <= ?)
        `;
        await connection.execute<ResultSetHeader>(airedEpisodesQuery, [profileId, seasonId, currentDate]);

        // Update future episodes to NOT_WATCHED
        const futureEpisodesQuery = `
          UPDATE episode_watch_status ews
          JOIN episodes e ON ews.episode_id = e.id
          SET ews.status = 'NOT_WATCHED'
          WHERE ews.profile_id = ? 
          AND e.season_id = ?
          AND e.air_date > ?
        `;
        await connection.execute<ResultSetHeader>(futureEpisodesQuery, [profileId, seasonId, currentDate]);

        // Success if we're able to run both queries (even if no rows affected)
        return true;
      } else {
        // For regular statuses, update all episodes to the same status
        const episodeQuery = `
          UPDATE episode_watch_status 
          SET status = ? 
          WHERE profile_id = ? 
          AND episode_id IN (
            SELECT id from episodes where season_id = ?
          )
        `;

        const [episodeResult] = await connection.execute<ResultSetHeader>(episodeQuery, [status, profileId, seasonId]);

        return episodeResult.affectedRows > 0;
      }
    });
  } catch (error) {
    handleDatabaseError(error, 'updating a season watch status and its episodes');
  }
}

/**
 * Gets all seasons with episodes for a show
 *
 * @param profileId - ID of the profile to get seasons for
 * @param showId - ID of the show to get seasons for
 * @returns Array of seasons with their episodes
 * @throws {DatabaseError} If a database error occurs
 */
export async function getSeasonsForShow(profileId: number, showId: number): Promise<ProfileSeason[]> {
  if (!profileId || !showId) {
    throw new DatabaseError('Invalid parameters: profileId and showId are required', null);
  }

  try {
    const profileIdNum = profileId;
    const showIdNum = showId;

    // First get the seasons
    const seasonQuery = `
      SELECT * FROM profile_seasons 
      WHERE profile_id = ? AND show_id = ? 
      ORDER BY season_number
    `;

    const [seasonRows] = await getDbPool().execute<ProfileSeasonRow[]>(seasonQuery, [profileIdNum, showIdNum]);

    if (seasonRows.length === 0) return [];

    // Then get all episodes for these seasons in a single query
    const seasonIds = seasonRows.map((season) => season.season_id);
    const placeholders = seasonIds.map(() => '?').join(',');

    const episodeQuery = `
      SELECT * FROM profile_episodes 
      WHERE profile_id = ? AND season_id IN (${placeholders}) 
      ORDER BY season_id, episode_number
    `;

    const [episodeRows] = await getDbPool().execute<ProfileEpisodeRow[]>(episodeQuery, [profileIdNum, ...seasonIds]);

    // Group episodes by season
    const episodesBySeasonId: Record<number, ProfileEpisode[]> = {};
    episodeRows.forEach((episodeRow) => {
      if (!episodesBySeasonId[episodeRow.season_id]) {
        episodesBySeasonId[episodeRow.season_id] = [];
      }
      episodesBySeasonId[episodeRow.season_id].push(transformProfileEpisode(episodeRow));
    });

    // Build the final result
    return seasonRows.map((seasonRow) =>
      transformProfileSeason(seasonRow, episodesBySeasonId[seasonRow.season_id] || []),
    );
  } catch (error) {
    handleDatabaseError(error, 'getting all seasons for a show');
  }
}

/**
 * Gets the show ID that a season belongs to
 *
 * @param seasonId - ID of the season
 * @returns Show ID or null if not found
 * @throws {DatabaseError} If a database error occurs
 */
export async function getShowIdForSeason(seasonId: number): Promise<number | null> {
  if (!seasonId) {
    throw new DatabaseError('Invalid parameter: seasonId is required', null);
  }

  try {
    const query = 'SELECT show_id FROM seasons WHERE id = ?';
    const [rows] = await getDbPool().execute<SeasonShowReferenceRow[]>(query, [seasonId]);
    if (rows.length === 0) return null;
    return rows[0].show_id;
  } catch (error) {
    handleDatabaseError(error, 'getting the show id for a season');
  }
}

/**
 * Gets the current watch status of a season for a profile
 *
 * @param profileId - ID of the profile
 * @param seasonId - ID of the season
 * @returns Current watch status or null if not found
 * @throws {DatabaseError} If a database error occurs
 */
export async function getWatchStatus(profileId: number, seasonId: number): Promise<WatchStatus | null> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    const query = 'SELECT status FROM season_watch_status WHERE profile_id = ? AND season_id = ?';
    const [rows] = await getDbPool().execute<SeasonStatusReferenceRow[]>(query, [profileId, seasonId]);

    if (rows.length === 0) return null;
    return rows[0].status as WatchStatus;
  } catch (error) {
    handleDatabaseError(error, 'getting a seasons watch status');
  }
}
