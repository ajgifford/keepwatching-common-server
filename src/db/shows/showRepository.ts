import { ContentUpdates, ContentUpdatesRow, transformContentUpdates } from '../../types/contentTypes';
import { ShowReferenceRow, ShowTMDBReferenceRow, transformShowTMDBReferenceRow } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import { CreateShowRequest, ShowReference, ShowTMDBReference, UpdateShowRequest } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

/**
 * Saves a new show to the database
 *
 * This function inserts a new show record in the database along with its
 * associated genres and streaming services.
 *
 * @param showRequest - The show data to save
 * @returns `True` if the show was successfully saved, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveShow(showRequest: CreateShowRequest): Promise<number> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'INSERT INTO shows (tmdb_id, title, description, release_date, poster_image, backdrop_image, user_rating, content_rating, season_count, episode_count, status, type, in_production, last_air_date, last_episode_to_air, next_episode_to_air, network) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        showRequest.tmdb_id,
        showRequest.title,
        showRequest.description,
        showRequest.release_date,
        showRequest.poster_image,
        showRequest.backdrop_image,
        showRequest.user_rating,
        showRequest.content_rating,
        showRequest.season_count,
        showRequest.episode_count,
        showRequest.status,
        showRequest.type,
        showRequest.in_production,
        showRequest.last_air_date,
        showRequest.last_episode_to_air,
        showRequest.next_episode_to_air,
        showRequest.network,
      ]);
      const newId = result.insertId;

      if (showRequest.genre_ids && showRequest.genre_ids.length > 0) {
        const genrePromises = showRequest.genre_ids.map((genreId) => saveShowGenre(newId, genreId, connection));
        await Promise.all(genrePromises);
      }

      if (showRequest.streaming_service_ids && showRequest.streaming_service_ids.length > 0) {
        const servicePromises = showRequest.streaming_service_ids.map((serviceId) =>
          saveShowStreamingService(newId, serviceId, connection),
        );
        await Promise.all(servicePromises);
      }

      return newId;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a show');
  }
}

/**
 * Updates an existing show in the database
 *
 * This function updates a show's metadata, genres, and streaming services.
 *
 * @param showRequest - The show data to update
 * @returns `True` if the show was successfully updated, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateShow(showRequest: UpdateShowRequest): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'UPDATE shows SET title = ?, description = ?, release_date = ?, poster_image = ?, backdrop_image = ?, user_rating = ?, content_rating = ?, season_count = ?, episode_count = ?, status = ?, type = ?, in_production = ?, last_air_date = ?, last_episode_to_air = ?, next_episode_to_air = ?, network = ? WHERE tmdb_id = ?';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        showRequest.title,
        showRequest.description,
        showRequest.release_date,
        showRequest.poster_image,
        showRequest.backdrop_image,
        showRequest.user_rating,
        showRequest.content_rating,
        showRequest.season_count,
        showRequest.episode_count,
        showRequest.status,
        showRequest.type,
        showRequest.in_production,
        showRequest.last_air_date,
        showRequest.last_episode_to_air,
        showRequest.next_episode_to_air,
        showRequest.network,
        showRequest.tmdb_id,
      ]);

      const success = result.affectedRows > 0;
      if (success && showRequest.id) {
        if (showRequest.genre_ids && showRequest.genre_ids.length > 0) {
          const genrePromises = showRequest.genre_ids.map((genreId) =>
            saveShowGenre(showRequest.id!, genreId, connection),
          );
          await Promise.all(genrePromises);
        }

        if (showRequest.streaming_service_ids && showRequest.streaming_service_ids.length > 0) {
          const servicePromises = showRequest.streaming_service_ids.map((serviceId) =>
            saveShowStreamingService(showRequest.id!, serviceId, connection),
          );
          await Promise.all(servicePromises);
        }
      }

      return success;
    });
  } catch (error) {
    handleDatabaseError(error, 'updating a show');
  }
}

/**
 * Associates a genre with a show
 *
 * @param showId - ID of the show
 * @param genreId - ID of the genre to associate
 * @param connection - Existing connection for transaction support
 * @returns A promise that resolves when the genre is associated
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveShowGenre(showId: number, genreId: number, connection: PoolConnection): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO show_genres (show_id, genre_id) VALUES (?,?)';
    await connection.execute(query, [showId, genreId]);
  } catch (error) {
    handleDatabaseError(error, 'saving the genre for a show');
  }
}

/**
 * Associates a streaming service with a show
 *
 * @param showId - ID of the show
 * @param streamingServiceId - ID of the streaming service to associate
 * @param connection - Existing connection for transaction support
 * @returns A promise that resolves when the streaming service is associated
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveShowStreamingService(
  showId: number,
  streamingServiceId: number,
  connection: PoolConnection,
): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO show_services (show_id, streaming_service_id) VALUES (?, ?)';
    await connection.execute(query, [showId, streamingServiceId]);
  } catch (error) {
    handleDatabaseError(error, 'saving the streaming service for a show');
  }
}

/**
 * Finds a show by its database ID
 *
 * This function retrieves the TMDB Id of show with the specified ID
 *
 * @param id - ID of the show to find
 * @returns `ShowTMDBReference` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findShowById(id: number): Promise<ShowTMDBReference | null> {
  try {
    const query = `SELECT id, tmdb_id, title FROM shows WHERE id = ?`;
    const [shows] = await getDbPool().execute<ShowTMDBReferenceRow[]>(query, [id]);
    if (shows.length === 0) return null;

    return transformShowTMDBReferenceRow(shows[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a show by its id');
  }
}

/**
 * Finds a show by its TMDB ID
 *
 * This function retrieves the id of show with the specified TMDB ID
 *
 * @param tmdbId - TMDB ID of the show to find
 * @returns `ShowReference` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findShowByTMDBId(tmdbId: number): Promise<ShowReference | null> {
  try {
    const query = `SELECT id FROM shows WHERE tmdb_id = ?`;
    const [shows] = await getDbPool().execute<ShowReferenceRow[]>(query, [tmdbId]);
    if (shows.length === 0) return null;

    return shows[0];
  } catch (error) {
    handleDatabaseError(error, 'finding a show by its TMDB id');
  }
}

/**
 * Gets a list of shows that may need metadata updates
 *
 * This function retrieves recently shows that are still in production that may
 * need their metadata refreshed from external APIs. Useful for scheduled
 * background update tasks.
 *
 * @returns Array of shows needing updates
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getShowsForUpdates(): Promise<ContentUpdates[]> {
  try {
    const query = `SELECT id, title, tmdb_id, created_at, updated_at from shows where in_production = 1 AND status NOT IN ('Canceled', 'Ended')`;
    const [updateRows] = await getDbPool().execute<ContentUpdatesRow[]>(query);
    return updateRows.map(transformContentUpdates);
  } catch (error) {
    handleDatabaseError(error, 'getting shows for updates');
  }
}
