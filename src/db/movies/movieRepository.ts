import { ContentUpdates, ContentUpdatesRow, transformContentUpdates } from '../../types/contentTypes';
import {
  MovieReferenceRow,
  ProfileMovieReferenceRow,
  ProfileMovieRow,
  transformMovieReferenceRow,
  transformProfileMovie,
  transformProfileMovieReferenceRow,
} from '../../types/movieTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { TransactionHelper } from '../../utils/transactionHelper';
import { CreateMovieRequest, MovieReference, ProfileMovie, UpdateMovieRequest } from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

/**
 * Saves a new movie to the database
 *
 * This function inserts a new movie record in the database along with its
 * associated genres and streaming services.
 *
 * @param createRequest - The movie data to save
 * @returns the id of the saved movie
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveMovie(createRequest: CreateMovieRequest): Promise<number> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'INSERT into movies (tmdb_id, title, description, release_date, runtime, poster_image, backdrop_image, user_rating, mpa_rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        createRequest.tmdb_id,
        createRequest.title,
        createRequest.description,
        createRequest.release_date,
        createRequest.runtime,
        createRequest.poster_image,
        createRequest.backdrop_image,
        createRequest.user_rating,
        createRequest.mpa_rating,
      ]);
      const newId = result.insertId;

      if (createRequest.genre_ids && createRequest.genre_ids.length > 0) {
        const genrePromises = createRequest.genre_ids.map((genreId) => saveMovieGenre(newId, genreId, connection));
        await Promise.all(genrePromises);
      }

      if (createRequest.streaming_service_ids && createRequest.streaming_service_ids.length > 0) {
        const servicePromises = createRequest.streaming_service_ids.map((serviceId) =>
          saveMovieStreamingService(newId, serviceId, connection),
        );
        await Promise.all(servicePromises);
      }

      return newId;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a movie');
  }
}

/**
 * Updates an existing movie in the database
 *
 * This function updates a movie's metadata, genres, and streaming services.
 *
 * @param updateRequest - The movie data to update
 * @returns `True` if the movie was successfully updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateMovie(updateRequest: UpdateMovieRequest): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'UPDATE movies SET title = ?, description = ?, release_date = ?, runtime = ?, poster_image = ?, backdrop_image = ?, user_rating = ?, mpa_rating = ? WHERE tmdb_id = ?';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        updateRequest.title,
        updateRequest.description,
        updateRequest.release_date,
        updateRequest.runtime,
        updateRequest.poster_image,
        updateRequest.backdrop_image,
        updateRequest.user_rating,
        updateRequest.mpa_rating,
        updateRequest.tmdb_id,
      ]);

      const success = result.affectedRows !== undefined;
      if (success && updateRequest.id) {
        if (updateRequest.genre_ids && updateRequest.genre_ids.length > 0) {
          const genrePromises = updateRequest.genre_ids.map((genreId) =>
            saveMovieGenre(updateRequest.id, genreId, connection),
          );
          await Promise.all(genrePromises);
        }

        if (updateRequest.streaming_service_ids && updateRequest.streaming_service_ids.length > 0) {
          const servicePromises = updateRequest.streaming_service_ids.map((serviceId) =>
            saveMovieStreamingService(updateRequest.id, serviceId, connection),
          );
          await Promise.all(servicePromises);
        }
      }

      return success;
    });
  } catch (error) {
    handleDatabaseError(error, 'updating a movie');
  }
}

/**
 * Associates a genre with a movie
 *
 * @param movieId - ID of the movie
 * @param genreId - ID of the genre to associate
 * @param connection - Existing connection for transaction support
 * @returns A promise that resolves when the genre is associated
 * @throws {DatabaseError} If a database error occurs during the operation
 */
async function saveMovieGenre(movieId: number, genreId: number, connection: PoolConnection): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?,?)';
    await connection.execute(query, [movieId, genreId]);
  } catch (error) {
    handleDatabaseError(error, 'saving a genre for a movie');
  }
}

/**
 * Associates a streaming service with a movie
 *
 * @param movieId - ID of the movie
 * @param streamingServiceId - ID of the streaming service to associate
 * @param connection - Existing connection for transaction support
 * @returns A promise that resolves when the streaming service is associated
 * @throws {DatabaseError} If a database error occurs during the operation
 */
async function saveMovieStreamingService(
  movieId: number,
  streamingServiceId: number,
  connection: PoolConnection,
): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO movie_services (movie_id, streaming_service_id) VALUES (?, ?)';
    await connection.execute(query, [movieId, streamingServiceId]);
  } catch (error) {
    handleDatabaseError(error, 'saving a streaming service for a movie');
  }
}

/**
 * Adds a movie to a user's favorites/watchlist
 *
 * This function inserts a record in the movie_watch_status table to associate
 * the movie with a user profile, enabling tracking of watch status.
 *
 * @param profileId - ID of the profile to add this movie to
 * @param movieId - ID of the movie to add
 * @returns A promise that resolves when the favorite has been added
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveFavorite(profileId: number, movieId: number): Promise<boolean> {
  try {
    const query = 'INSERT IGNORE INTO movie_watch_status (profile_id, movie_id) VALUES (?,?)';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [profileId, movieId]);

    // Return true if a row was inserted, false if the row already existed (IGNORE)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'saving a movie as a favorite');
  }
}

/**
 * Removes a movie from a user's favorites/watchlist
 *
 * This function deletes the record in the movie_watch_status table that
 * associates the movie with a user profile.
 *
 * @param profileId - ID of the profile to remove this movie from
 * @param movieId - ID of the movie to remove
 * @returns A promise that resolves when the favorite has been removed
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function removeFavorite(profileId: number, movieId: number): Promise<void> {
  try {
    const query = 'DELETE FROM movie_watch_status WHERE profile_id = ? AND movie_id = ?';
    await getDbPool().execute(query, [profileId, movieId]);
  } catch (error) {
    handleDatabaseError(error, 'removing a movie as a favorite');
  }
}

/**
 * Updates the watch status of a movie for a specific profile
 *
 * This function marks a movie as watched, watching, or not watched
 * for a specific user profile.
 *
 * @param profileId - ID of the profile to update the status for
 * @param movieId - ID of the movie to update
 * @param status - New watch status ('WATCHED', 'WATCHING', or 'NOT_WATCHED')
 * @returns `True` if the status was updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateWatchStatus(profileId: number, movieId: number, status: string): Promise<boolean> {
  try {
    const query = 'UPDATE movie_watch_status SET status = ? WHERE profile_id = ? AND movie_id = ?';
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, movieId]);

    // Return true if at least one row was affected (watch status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating a movie watch status');
  }
}

/**
 * Finds a movie by its database ID
 *
 * This function retrieves a movie with the specified ID, including
 * its basic metadata (but not genres or streaming services).
 *
 * @param id - ID of the movie to find
 * @returns `Movie` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findMovieById(id: number): Promise<MovieReference | null> {
  try {
    const query = `SELECT id, title, tmdb_id FROM movies WHERE id = ?`;
    const [movies] = await getDbPool().execute<MovieReferenceRow[]>(query, [id]);
    if (movies.length === 0) return null;
    return transformMovieReferenceRow(movies[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a movie by id');
  }
}

/**
 * Finds a movie by its TMDB ID
 *
 * This function retrieves a movie with the specified TMDB ID, including
 * its basic metadata (but not genres or streaming services).
 *
 * @param tmdbId - TMDB ID of the movie to find
 * @returns `Movie` object if found, `null` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function findMovieByTMDBId(tmdbId: number): Promise<MovieReferenceRow | null> {
  try {
    const query = `SELECT id, title, tmdb_id FROM movies WHERE tmdb_id = ?`;
    const [movies] = await getDbPool().execute<MovieReferenceRow[]>(query, [tmdbId]);
    if (movies.length === 0) return null;
    return movies[0];
  } catch (error) {
    handleDatabaseError(error, 'finding a movie by TMDB id');
  }
}

/**
 * Retrieves all movies for a specific profile with their watch status
 *
 * This function returns all movies that a profile has added to their
 * favorites/watchlist, including watch status information.
 *
 * @param profileId - ID of the profile to get movies for
 * @returns Array of movies with their details and watch status
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getAllMoviesForProfile(profileId: number): Promise<ProfileMovie[]> {
  try {
    const query = 'SELECT * FROM profile_movies where profile_id = ?';
    const [movies] = await getDbPool().execute<ProfileMovieRow[]>(query, [profileId]);
    return movies.map((movie) => transformProfileMovie(movie));
  } catch (error) {
    handleDatabaseError(error, 'getting all movies for a profile');
  }
}

/**
 * Gets a specific movie for a profile with watch status information
 *
 * This function retrieves a single movie from a profile's watchlist
 * along with its watch status.
 *
 * @param profileId - ID of the profile
 * @param movieId - ID of the movie to retrieve
 * @returns Movie with watch status information
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getMovieForProfile(profileId: number, movieId: number): Promise<ProfileMovie> {
  try {
    const query = 'SELECT * FROM profile_movies where profile_id = ? AND movie_id = ?';
    const [movies] = await getDbPool().execute<ProfileMovieRow[]>(query, [profileId, movieId]);
    return transformProfileMovie(movies[0]);
  } catch (error) {
    handleDatabaseError(error, 'getting a movie for a profile');
  }
}

/**
 * Gets recently released movies from a profile's watchlist
 *
 * This function retrieves movies from a profile's watchlist that have
 * been released within the last 60 days, ordered by release date.
 *
 * @param profileId - ID of the profile to get recent movies for
 * @returns Array of recently released movies
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getRecentMovieReleasesForProfile(profileId: number): Promise<MovieReference[]> {
  try {
    const query =
      'SELECT movie_id, title, tmdb_id from profile_movies WHERE profile_id = ? AND release_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) AND CURRENT_DATE() ORDER BY release_date DESC LIMIT 6';
    const [movies] = await getDbPool().execute<ProfileMovieReferenceRow[]>(query, [profileId]);
    return movies.map((movie) => transformProfileMovieReferenceRow(movie));
  } catch (error) {
    handleDatabaseError(error, 'getting recent movie releases for a profile');
  }
}

/**
 * Gets upcoming movie releases from a profile's watchlist
 *
 * This function retrieves movies from a profile's watchlist that are
 * scheduled to be released within the next 60 days, ordered by release date.
 *
 * @param profileId - ID of the profile to get upcoming movies for
 * @returns Array of upcoming movie releases
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getUpcomingMovieReleasesForProfile(profileId: number): Promise<MovieReference[]> {
  try {
    const query =
      'SELECT movie_id, title, tmdb_id from profile_movies WHERE profile_id = ? AND release_date BETWEEN DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY) AND DATE_ADD(CURRENT_DATE(), INTERVAL 60 DAY) ORDER BY release_date LIMIT 6';
    const [movies] = await getDbPool().execute<ProfileMovieReferenceRow[]>(query, [profileId]);
    return movies.map((movie) => transformProfileMovieReferenceRow(movie));
  } catch (error) {
    handleDatabaseError(error, 'getting upcoming movie releases for a profile');
  }
}

/**
 * Gets a list of movies that may need metadata updates
 *
 * This function retrieves recently added or released movies that may
 * need their metadata refreshed from external APIs. Useful for scheduled
 * background update tasks.
 *
 * @returns Array of movies needing updates
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getMoviesForUpdates(): Promise<ContentUpdates[]> {
  try {
    const query = `SELECT id, title, tmdb_id, created_at, updated_at FROM movies WHERE release_date > NOW() - INTERVAL 30 DAY`;
    const [updateRows] = await getDbPool().execute<ContentUpdatesRow[]>(query);
    return updateRows.map(transformContentUpdates);
  } catch (error) {
    handleDatabaseError(error, 'getting movies for updates');
  }
}
