import { ContentUpdates } from '../types/contentTypes';
import { AdminMovie, AdminMovieRow, ProfileMovie, RecentMovie, UpcomingMovie } from '../types/movieTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

export interface Movie {
  id?: number;
  tmdb_id: number;
  title: string;
  description: string;
  release_date: string;
  runtime: number;
  poster_image: string;
  backdrop_image: string;
  user_rating: number;
  mpa_rating: string;
  streaming_services?: number[];
  genreIds?: number[];
}

/**
 * Saves a new movie to the database
 *
 * This function inserts a new movie record in the database along with its
 * associated genres and streaming services.
 *
 * @param movie - The movie data to save
 * @returns `True` if the movie was successfully saved, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function saveMovie(movie: Movie): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'INSERT into movies (tmdb_id, title, description, release_date, runtime, poster_image, backdrop_image, user_rating, mpa_rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        movie.tmdb_id,
        movie.title,
        movie.description,
        movie.release_date,
        movie.runtime,
        movie.poster_image,
        movie.backdrop_image,
        movie.user_rating,
        movie.mpa_rating,
      ]);
      const movieId = result.insertId;

      if (movie.genreIds && movie.genreIds.length > 0) {
        const genrePromises = movie.genreIds.map((genreId) => saveMovieGenre(movieId, genreId, connection));
        await Promise.all(genrePromises);
      }

      if (movie.streaming_services && movie.streaming_services.length > 0) {
        const servicePromises = movie.streaming_services.map((serviceId) =>
          saveMovieStreamingService(movieId, serviceId, connection),
        );
        await Promise.all(servicePromises);
      }

      return true;
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
 * @param movie - The movie data to update
 * @returns `True` if the movie was successfully updated, `false` if no rows were affected
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function updateMovie(movie: Movie): Promise<boolean> {
  const transactionHelper = new TransactionHelper();

  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const query =
        'UPDATE movies SET title = ?, description = ?, release_date = ?, runtime = ?, poster_image = ?, backdrop_image = ?, user_rating = ?, mpa_rating = ? WHERE tmdb_id = ?';
      const [result] = await connection.execute<ResultSetHeader>(query, [
        movie.title,
        movie.description,
        movie.release_date,
        movie.runtime,
        movie.poster_image,
        movie.backdrop_image,
        movie.user_rating,
        movie.mpa_rating,
        movie.tmdb_id,
      ]);

      const success = result.affectedRows !== undefined;
      if (success && movie.id) {
        if (movie.genreIds && movie.genreIds.length > 0) {
          const genrePromises = movie.genreIds.map((genreId) => saveMovieGenre(movie.id!, genreId, connection));
          await Promise.all(genrePromises);
        }

        if (movie.streaming_services && movie.streaming_services.length > 0) {
          const servicePromises = movie.streaming_services.map((serviceId) =>
            saveMovieStreamingService(movie.id!, serviceId, connection),
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
export async function saveFavorite(profileId: string, movieId: number): Promise<void> {
  try {
    const query = 'INSERT IGNORE INTO movie_watch_status (profile_id, movie_id) VALUES (?,?)';
    await getDbPool().execute(query, [Number(profileId), movieId]);
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
export async function removeFavorite(profileId: string, movieId: number): Promise<void> {
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
export async function updateWatchStatus(profileId: string, movieId: number, status: string): Promise<boolean> {
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
 * Gets the TMDB id of a movie.
 *
 * @param movieId The id of the movie
 * @returns The TMDB id of a movie
 * @throws {DatabaseError} If a database error occurs during the operation
 */
export async function getTMDBIdForMovie(movieId: number): Promise<number | null> {
  try {
    const query = `SELECT tmdb_id from movies where id = ?`;
    const [movies] = await getDbPool().execute<RowDataPacket[]>(query, [movieId]);
    if (movies.length === 0) return null;
    return movies[0].tmdb_id;
  } catch (error) {
    handleDatabaseError(error, 'getting the TMDB id for a movie');
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
export async function findMovieById(id: number): Promise<Movie | null> {
  try {
    const query = `SELECT * FROM movies WHERE id = ?`;
    const [movies] = await getDbPool().execute<RowDataPacket[]>(query, [id]);
    if (movies.length === 0) return null;
    return transformMovie(movies[0]);
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
export async function findMovieByTMDBId(tmdbId: number): Promise<Movie | null> {
  try {
    const query = `SELECT * FROM movies WHERE tmdb_id = ?`;
    const [movies] = await getDbPool().execute<RowDataPacket[]>(query, [tmdbId]);
    if (movies.length === 0) return null;
    return transformMovie(movies[0]);
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
export async function getAllMoviesForProfile(profileId: string): Promise<ProfileMovie[]> {
  try {
    const query = 'SELECT * FROM profile_movies where profile_id = ?';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId)]);
    return rows.map((row) => ({
      profile_id: row.profile_id,
      movie_id: row.movie_id,
      tmdb_id: row.tmdb_id,
      title: row.title,
      description: row.description,
      release_date: row.release_date,
      poster_image: row.poster_image,
      backdrop_image: row.backdrop_image,
      runtime: row.runtime,
      user_rating: row.user_rating,
      mpa_rating: row.mpa_rating,
      watch_status: row.watch_status,
      genres: row.genres,
      streaming_services: row.streaming_services,
    })) as ProfileMovie[];
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
export async function getMovieForProfile(profileId: string, movieId: number): Promise<ProfileMovie> {
  try {
    const query = 'SELECT * FROM profile_movies where profile_id = ? AND movie_id = ?';
    const [movies] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId), movieId]);
    return movies[0] as ProfileMovie;
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
export async function getRecentMovieReleasesForProfile(profileId: string): Promise<RecentMovie[]> {
  try {
    const query =
      'SELECT movie_id from profile_movies WHERE profile_id = ? AND release_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) AND CURRENT_DATE() ORDER BY release_date DESC LIMIT 6';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId)]);
    return rows as RecentMovie[];
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
export async function getUpcomingMovieReleasesForProfile(profileId: string): Promise<UpcomingMovie[]> {
  try {
    const query =
      'SELECT movie_id from profile_movies WHERE profile_id = ? AND release_date BETWEEN DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY) AND DATE_ADD(CURRENT_DATE(), INTERVAL 60 DAY) ORDER BY release_date LIMIT 6';
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [Number(profileId)]);
    return rows as UpcomingMovie[];
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
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query);
    const movies = rows.map((row) => {
      return {
        id: row.id,
        title: row.title,
        tmdb_id: row.tmdb_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
    return movies;
  } catch (error) {
    handleDatabaseError(error, 'getting movies for updates');
  }
}

export async function getMoviesCount() {
  try {
    const query = `SELECT COUNT(DISTINCT m.id) AS total FROM movies m`;
    const [result] = await getDbPool().query<(RowDataPacket & { total: number })[]>(query);
    return result[0].total;
  } catch (error) {
    handleDatabaseError(error, 'getting the count of movies');
  }
}

export async function getAllMovies(limit: number = 50, offset: number = 0) {
  try {
    const query = `SELECT 
      m.id,
      m.tmdb_id,
      m.title,
      m.description,
      m.release_date,
      m.runtime,
      m.poster_image,
      m.backdrop_image,
      m.user_rating,
      m.mpa_rating,
      m.created_at,
      m.updated_at,
    GROUP_CONCAT(DISTINCT g.genre SEPARATOR ', ') AS genres,
	  GROUP_CONCAT(DISTINCT ss.name SEPARATOR ', ') AS streaming_services
    FROM 
      movies m
    LEFT JOIN 
      movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN 
      genres g ON mg.genre_id = g.id
    LEFT JOIN
      movie_services ms ON m.id = ms.movie_id
    LEFT JOIN
      streaming_services ss on ms.streaming_service_id = ss.id
    GROUP BY 
      m.id
    ORDER BY
        m.title
    LIMIT ${limit}
    OFFSET ${offset}`;

    const [movies] = await getDbPool().execute<AdminMovieRow[]>(query);
    return movies.map((movie) => transformAdminMovie(movie));
  } catch (error) {
    handleDatabaseError(error, 'getting all movies');
  }
}

/**
 * Transforms a raw database row into a Movie object
 *
 * @param movie - Raw database row containing movie data
 * @returns Properly structured `Movie` object
 * @private
 */
function transformMovie(movie: any): Movie {
  return {
    id: movie.id,
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    description: movie.description,
    release_date: movie.release_date,
    runtime: movie.runtime,
    poster_image: movie.poster_image,
    backdrop_image: movie.backdrop_image,
    user_rating: movie.user_rating,
    mpa_rating: movie.mpa_rating,
  };
}

function transformAdminMovie(movie: AdminMovieRow): AdminMovie {
  return {
    id: movie.id,
    tmdbId: movie.tmdb_id,
    title: movie.title,
    description: movie.description,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    posterImage: movie.poster_image,
    backdropImage: movie.backdrop_image,
    streamingServices: movie.streaming_services,
    genres: movie.genres,
    lastUpdated: movie.updated_at.toISOString(),
  };
}

/**
 * Creates a new Movie object with the given properties
 *
 * This is a helper function to create a new movie object with the given properties.
 *
 * @param tmdbId - TMDB API identifier for the movie
 * @param title - Title of the movie
 * @param description - Synopsis/description of the movie
 * @param releaseDate - Release date of the movie (YYYY-MM-DD format)
 * @param runtime - Runtime of the movie in minutes
 * @param posterImage - Path to the movie's poster image
 * @param backdropImage - Path to the movie's backdrop image
 * @param userRating - User/critical rating of the movie (typically on a scale of 0-10)
 * @param mpaRating - MPAA rating or equivalent content rating
 * @param id - Optional database ID for an existing movie
 * @param streamingServices - Optional array of streaming service IDs
 * @param genreIds - Optional array of genre IDs
 * @returns A new Movie object
 */
export function createMovie(
  tmdbId: number,
  title: string,
  description: string,
  releaseDate: string,
  runtime: number,
  posterImage: string,
  backdropImage: string,
  userRating: number,
  mpaRating: string,
  id?: number,
  streamingServices?: number[],
  genreIds?: number[],
): Movie {
  return {
    tmdb_id: tmdbId,
    title: title,
    description: description,
    release_date: releaseDate,
    runtime: runtime,
    poster_image: posterImage,
    backdrop_image: backdropImage,
    user_rating: userRating,
    mpa_rating: mpaRating,
    ...(id ? { id } : {}),
    ...(streamingServices ? { streaming_services: streamingServices } : {}),
    ...(genreIds ? { genreIds } : {}),
  };
}
