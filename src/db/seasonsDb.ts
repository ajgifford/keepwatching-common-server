import { DatabaseError } from '../middleware/errorMiddleware';
import { ProfileEpisode, ProfileSeason } from '../types/showTypes';
import { getDbPool } from '../utils/db';
import { TransactionHelper } from '../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Season {
  id?: number;
  show_id: number;
  tmdb_id: number;
  name: string;
  overview: string;
  season_number: number;
  release_date: string;
  poster_image: string;
  number_of_episodes: number;
}

/**
 * Saves a new season to the database
 *
 * @param season - The season data to save
 * @returns The saved season with its new ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function saveSeason(season: Season): Promise<Season> {
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

    return {
      ...season,
      id: result.insertId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error saving season: ${error.message}`
        : 'Unknown database error saving a season';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates an existing season or inserts a new one if it doesn't exist
 *
 * @param season - The season data to update
 * @returns The updated season with its ID
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateSeason(season: Season): Promise<Season> {
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

    return {
      ...season,
      id: result.insertId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error updating season: ${error.message}`
        : 'Unknown database error updating a season';
    throw new DatabaseError(errorMessage, error);
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
    const errorMessage =
      error instanceof Error
        ? `Database error saving season favorite: ${error.message}`
        : 'Unknown database error saving a season as a favorite';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a season for a specific profile
 *
 * @param profileId - ID of the profile to update watch status for
 * @param seasonId - ID of the season to update
 * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
 * @returns True if the watch status was updated, false if no rows affected
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateWatchStatus(profileId: string, seasonId: number, status: string): Promise<boolean> {
  if (!profileId || !seasonId || !status) {
    throw new DatabaseError('Invalid parameters: profileId, seasonId and status are required', null);
  }

  try {
    const query = 'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, seasonId]);

    return result.affectedRows > 0;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error updating season watch status: ${error.message}`
        : 'Unknown database error updating a season watch status';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a season based on its episodes' statuses
 *
 * @param profileId - ID of the profile to update
 * @param seasonId - ID of the season to update
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateWatchStatusByEpisode(profileId: string, seasonId: number): Promise<void> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    const pool = getDbPool();
    const transactionHelper = new TransactionHelper();

    await transactionHelper.executeInTransaction(async (connection) => {
      // Get appropriate status based on episodes
      const episodeWatchStatusQuery = `
        SELECT 
          CASE 
            WHEN COUNT(DISTINCT ews.status) = 1 THEN MAX(ews.status) 
            ELSE 'WATCHING' 
          END AS season_status 
        FROM episodes e 
        JOIN episode_watch_status ews ON e.id = ews.episode_id 
        WHERE e.season_id = ? AND ews.profile_id = ?
      `;

      const [statusResult] = await connection.execute<RowDataPacket[]>(episodeWatchStatusQuery, [seasonId, profileId]);

      if (!statusResult.length) return;

      // Update season status
      const updateSeasonStatusQuery =
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?';

      const seasonStatus = statusResult[0].season_status;
      await connection.execute(updateSeasonStatusQuery, [seasonStatus, profileId, seasonId]);
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error updating season status by episodes: ${error.message}`
        : 'Unknown database error updating a season watch status using episodes';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Updates the watch status of a season and all its episodes
 *
 * @param profileId - ID of the profile to update
 * @param seasonId - ID of the season to update
 * @param status - New watch status
 * @returns True if the update was successful, false otherwise
 * @throws {DatabaseError} If a database error occurs
 */
export async function updateAllWatchStatuses(profileId: string, seasonId: number, status: string): Promise<boolean> {
  if (!profileId || !seasonId || !status) {
    throw new DatabaseError('Invalid parameters: profileId, seasonId and status are required', null);
  }

  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      // Update season
      const seasonQuery = 'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?';
      const [seasonResult] = await connection.execute<ResultSetHeader>(seasonQuery, [status, profileId, seasonId]);

      if (seasonResult.affectedRows === 0) return false;

      // Update episodes
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
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error updating all watch statuses: ${error.message}`
        : 'Unknown database error updating all statuses of a season and episodes';
    throw new DatabaseError(errorMessage, error);
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
export async function getSeasonsForShow(profileId: string, showId: string): Promise<ProfileSeason[]> {
  if (!profileId || !showId) {
    throw new DatabaseError('Invalid parameters: profileId and showId are required', null);
  }

  try {
    const profileIdNum = Number(profileId);
    const showIdNum = Number(showId);

    // First get the seasons
    const seasonQuery = `
      SELECT * FROM profile_seasons 
      WHERE profile_id = ? AND show_id = ? 
      ORDER BY season_number
    `;

    const [seasonRows] = await getDbPool().execute<RowDataPacket[]>(seasonQuery, [profileIdNum, showIdNum]);

    if (seasonRows.length === 0) return [];

    // Then get all episodes for these seasons in a single query
    const seasonIds = seasonRows.map((season) => season.season_id);
    const placeholders = seasonIds.map(() => '?').join(',');

    const episodeQuery = `
      SELECT * FROM profile_episodes 
      WHERE profile_id = ? AND season_id IN (${placeholders}) 
      ORDER BY season_id, episode_number
    `;

    const [episodeRows] = await getDbPool().execute<RowDataPacket[]>(episodeQuery, [profileIdNum, ...seasonIds]);

    // Group episodes by season
    const episodesBySeasonId: Record<number, ProfileEpisode[]> = {};
    episodeRows.forEach((episode) => {
      if (!episodesBySeasonId[episode.season_id]) {
        episodesBySeasonId[episode.season_id] = [];
      }
      episodesBySeasonId[episode.season_id].push(episode as ProfileEpisode);
    });

    // Build the final result
    return seasonRows.map((season) => ({
      ...season,
      episodes: episodesBySeasonId[season.season_id] || [],
    })) as ProfileSeason[];
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error getting seasons for show: ${error.message}`
        : 'Unknown database error getting all seasons for a show';
    throw new DatabaseError(errorMessage, error);
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
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [seasonId]);

    if (rows.length === 0) return null;
    return rows[0].show_id;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error getting show ID for season: ${error.message}`
        : 'Unknown database error getting the show ID for a season';
    throw new DatabaseError(errorMessage, error);
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
export async function getWatchStatus(profileId: string, seasonId: number): Promise<string | null> {
  if (!profileId || !seasonId) {
    throw new DatabaseError('Invalid parameters: profileId and seasonId are required', null);
  }

  try {
    const query = 'SELECT status FROM season_watch_status WHERE profile_id = ? AND season_id = ?';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [profileId, seasonId]);

    if (rows.length === 0) return null;
    return rows[0].status;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Database error getting season watch status: ${error.message}`
        : 'Unknown database error getting the watch status for a season';
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Creates a new Season object with the provided properties
 *
 * @param showId - ID of the show this season belongs to
 * @param tmdbId - TMDB API identifier for the season
 * @param name - Name of the season
 * @param overview - Synopsis/description of the season
 * @param seasonNumber - Season number
 * @param releaseDate - Release date of the season
 * @param posterImage - Path to the season's poster image
 * @param numberOfEpisodes - Number of episodes in the season
 * @param id - Optional database ID for an existing season
 * @returns A new Season object
 */
export function createSeason(
  showId: number,
  tmdbId: number,
  name: string,
  overview: string,
  seasonNumber: number,
  releaseDate: string,
  posterImage: string,
  numberOfEpisodes: number,
  id?: number,
): Season {
  return {
    show_id: showId,
    tmdb_id: tmdbId,
    name: name,
    overview: overview,
    season_number: seasonNumber,
    release_date: releaseDate,
    poster_image: posterImage,
    number_of_episodes: numberOfEpisodes,
    ...(id ? { id } : {}),
  };
}
