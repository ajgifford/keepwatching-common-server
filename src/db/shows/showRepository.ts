import { ContentUpdates } from '../../types/contentTypes';
import { AdminShow, AdminShowRow, Show } from '../../types/showTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

/**
 * Saves a new show to the database
 *
 * This function inserts a new show record in the database along with its
 * associated genres and streaming services.
 *
 * @param show - The show data to save
 * @returns `True` if the show was successfully saved, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveShow(show: Show): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'INSERT INTO shows (tmdb_id, title, description, release_date, poster_image, backdrop_image, user_rating, content_rating, season_count, episode_count, status, type, in_production, last_air_date, last_episode_to_air, next_episode_to_air, network) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        show.tmdb_id,
        show.title,
        show.description,
        show.release_date,
        show.poster_image,
        show.backdrop_image,
        show.user_rating,
        show.content_rating,
        show.season_count,
        show.episode_count,
        show.status,
        show.type,
        show.in_production,
        show.last_air_date,
        show.last_episode_to_air,
        show.next_episode_to_air,
        show.network,
      ]);
      show.id = result.insertId;

      const success = result.affectedRows > 0 && result.insertId > 0;
      if (success && show.id) {
        if (show.genreIds && show.genreIds.length > 0) {
          const genrePromises = show.genreIds.map((genreId) => saveShowGenre(show.id!, genreId, connection));
          await Promise.all(genrePromises);
        }

        if (show.streaming_services && show.streaming_services.length > 0) {
          const servicePromises = show.streaming_services.map((serviceId) =>
            saveShowStreamingService(show.id!, serviceId, connection),
          );
          await Promise.all(servicePromises);
        }
      }

      return success;
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
 * @param show - The show data to update
 * @returns `True` if the show was successfully updated, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateShow(show: Show): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'UPDATE shows SET title = ?, description = ?, release_date = ?, poster_image = ?, backdrop_image = ?, user_rating = ?, content_rating = ?, season_count = ?, episode_count = ?, status = ?, type = ?, in_production = ?, last_air_date = ?, last_episode_to_air = ?, next_episode_to_air = ?, network = ? WHERE tmdb_id = ?';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        show.title,
        show.description,
        show.release_date,
        show.poster_image,
        show.backdrop_image,
        show.user_rating,
        show.content_rating,
        show.season_count,
        show.episode_count,
        show.status,
        show.type,
        show.in_production,
        show.last_air_date,
        show.last_episode_to_air,
        show.next_episode_to_air,
        show.network,
        show.tmdb_id,
      ]);

      const success = result.affectedRows > 0;
      if (success && show.id) {
        if (show.genreIds && show.genreIds.length > 0) {
          const genrePromises = show.genreIds.map((genreId) => saveShowGenre(show.id!, genreId, connection));
          await Promise.all(genrePromises);
        }

        if (show.streaming_services && show.streaming_services.length > 0) {
          const servicePromises = show.streaming_services.map((serviceId) =>
            saveShowStreamingService(show.id!, serviceId, connection),
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
 * This function retrieves a show with the specified ID, including
 * its basic metadata (but not genres or streaming services).
 *
 * @param id - ID of the show to find
 * @returns `Show` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findShowById(id: number): Promise<Show | null> {
  try {
    const query = `SELECT * FROM shows WHERE id = ?`;
    const [shows] = await getDbPool().execute<RowDataPacket[]>(query, [id]);
    if (shows.length === 0) return null;

    return transformShow(shows[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a show by its id');
  }
}

/**
 * Finds a show by its TMDB ID
 *
 * This function retrieves a show with the specified TMDB ID, including
 * its basic metadata (but not genres or streaming services).
 *
 * @param tmdbId - TMDB ID of the show to find
 * @returns `Show` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findShowByTMDBId(tmdbId: number): Promise<Show | null> {
  try {
    const query = `SELECT * FROM shows WHERE tmdb_id = ?`;
    const [shows] = await getDbPool().execute<RowDataPacket[]>(query, [tmdbId]);
    if (shows.length === 0) return null;

    return transformShow(shows[0]);
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
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query);
    const shows = rows.map(transformContentUpdate);
    return shows;
  } catch (error) {
    handleDatabaseError(error, 'getting shows for updates');
  }
}

export async function getAllShows(limit: number = 50, offset: number = 0) {
  try {
    const query = `SELECT 
      s.id,
      s.tmdb_id,
      s.title,
      s.description,
      s.release_date,
      s.poster_image,
      s.backdrop_image,
      s.network,
      s.season_count,
      s.episode_count,
      s.user_rating,
      s.content_rating,
      s.status,
      s.type,
      s.in_production,
      s.last_air_date,
      s.created_at,
      s.updated_at,
    GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
    GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services
    FROM 
      shows s
    LEFT JOIN 
      show_genres sg ON s.id = sg.show_id
    LEFT JOIN 
      genres g ON sg.genre_id = g.id
    LEFT JOIN
      show_services shs ON s.id = shs.show_id
    LEFT JOIN
      streaming_services ss on shs.streaming_service_id = ss.id
    GROUP BY 
      s.id
    ORDER BY
        s.title
    LIMIT ${limit} 
    OFFSET ${offset}`;

    const [shows] = await getDbPool().execute<AdminShowRow[]>(query);
    return shows.map((show) => transformAdminShow(show));
  } catch (error) {
    handleDatabaseError(error, 'get all shows');
  }
}

export async function getShowsCount() {
  try {
    const query = `SELECT COUNT(DISTINCT s.id) AS total FROM shows s`;
    const [result] = await getDbPool().execute<(RowDataPacket & { total: number })[]>(query);
    return result[0].total;
  } catch (error) {
    handleDatabaseError(error, 'get a count of all shows');
  }
}

function transformContentUpdate(row: any): ContentUpdates {
  return {
    id: row.id,
    title: row.title,
    tmdb_id: row.tmdb_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function transformShow(row: any): Show {
  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    title: row.title,
    description: row.description,
    release_date: row.release_date,
    poster_image: row.poster_image,
    backdrop_image: row.backdrop_path,
    user_rating: row.user_rating,
    content_rating: row.content_rating,
    season_count: row.season_count,
    episode_count: row.episode_count,
    status: row.status,
    type: row.type,
    in_production: row.in_production,
    last_air_date: row.last_air_date,
    last_episode_to_air: row.last_episode_to_air,
    next_episode_to_air: row.next_episode_to_air,
    network: row.network,
  };
}

function transformAdminShow(show: AdminShowRow): AdminShow {
  return {
    id: show.id,
    tmdbId: show.tmdb_id,
    title: show.title,
    description: show.description,
    releaseDate: show.release_date,
    posterImage: show.poster_image,
    backdropImage: show.backdrop_image,
    network: show.network,
    seasonCount: show.season_count,
    episodeCount: show.episode_count,
    status: show.status,
    type: show.type,
    inProduction: Boolean(show.in_production),
    lastAirDate: show.last_air_date,
    lastUpdated: show.updated_at.toISOString(),
    streamingServices: show.streaming_services,
    genres: show.genres,
  };
}

export function createShow(
  tmdbId: number,
  title: string,
  description: string,
  releaseDate: string,
  posterImage: string,
  backdropImage: string,
  userRating: number,
  contentRating: string,
  id?: number,
  streamingServices?: number[],
  seasonCount?: number,
  episodeCount?: number,
  genreIds?: number[],
  status?: string,
  type?: string,
  inProduction?: 0 | 1,
  lastAirDate?: string | null,
  lastEpisodeToAir?: number | null,
  nextEpisodeToAir?: number | null,
  network?: string | null,
): Show {
  return {
    tmdb_id: tmdbId,
    title: title,
    description: description,
    release_date: releaseDate,
    poster_image: posterImage,
    backdrop_image: backdropImage,
    user_rating: userRating,
    content_rating: contentRating,
    ...(id !== undefined ? { id } : {}),
    ...(streamingServices !== undefined ? { streaming_services: streamingServices } : {}),
    ...(seasonCount !== undefined ? { season_count: seasonCount } : {}),
    ...(episodeCount !== undefined ? { episode_count: episodeCount } : {}),
    ...(genreIds !== undefined ? { genreIds } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(inProduction !== undefined ? { in_production: inProduction } : {}),
    ...(lastAirDate !== undefined ? { last_air_date: lastAirDate } : {}),
    ...(lastEpisodeToAir !== undefined ? { last_episode_to_air: lastEpisodeToAir } : {}),
    ...(nextEpisodeToAir !== undefined ? { next_episode_to_air: nextEpisodeToAir } : {}),
    ...(network !== undefined ? { network } : {}),
  };
}
