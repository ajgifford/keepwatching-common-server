import { DatabaseError } from '../middleware/errorMiddleware';
import { ProfileEpisode, ProfileSeason } from '../types/showTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
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
export async function updateWatchStatus(profileId: string, seasonId: number, status: string): Promise<boolean> {
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
export async function updateWatchStatusByEpisode(profileId: string, seasonId: number): Promise<void> {
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

      const [episodeStatus] = await connection.execute<RowDataPacket[]>(episodeStatusQuery, [seasonId, profileId]);
      if (!episodeStatus.length) return;

      if (episodeStatus[0].total_episodes === 0) {
        await connection.execute('UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id = ?', [
          'NOT_WATCHED',
          profileId,
          seasonId,
        ]);
        return;
      }

      const status = episodeStatus[0];
      let seasonStatus = 'NOT_WATCHED';

      if (status.watched_aired_episodes === status.aired_episodes) {
        if (status.future_episodes > 0) {
          seasonStatus = 'UP_TO_DATE';
        } else {
          seasonStatus = 'WATCHED';
        }
      } else if (status.watched_episodes > 0 && status.watched_episodes < status.total_episodes) {
        seasonStatus = 'WATCHING';
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
export async function updateAllWatchStatuses(profileId: string, seasonId: number, status: string): Promise<boolean> {
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
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [seasonId]);

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
    handleDatabaseError(error, 'getting a seasons watch status');
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
