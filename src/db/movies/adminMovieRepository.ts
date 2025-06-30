import { NotFoundError } from '../../middleware/errorMiddleware';
import { ContentCountRow } from '../../types/contentTypes';
import {
  AdminMovieDetailsRow,
  AdminMovieRow,
  transformAdminMovie,
  transformAdminMovieDetails,
} from '../../types/movieTypes';
import { ContentProfilesRow, transformContentProfiles } from '../../types/profileTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { AdminMovie, AdminMovieDetails, ContentProfiles } from '@ajgifford/keepwatching-types';

export async function getMoviesCount(): Promise<number> {
  try {
    const query = `SELECT COUNT(DISTINCT m.id) AS total FROM movies m`;
    const [result] = await getDbPool().execute<ContentCountRow[]>(query);
    return result[0].total;
  } catch (error) {
    handleDatabaseError(error, 'getting the count of movies');
  }
}

export async function getAllMovies(limit: number = 50, offset: number = 0): Promise<AdminMovie[]> {
  try {
    const query = `SELECT * FROM admin_movies LIMIT ${limit} OFFSET ${offset}`;
    const [movieRows] = await getDbPool().execute<AdminMovieRow[]>(query);
    return movieRows.map(transformAdminMovie);
  } catch (error) {
    handleDatabaseError(error, 'getting all movies');
  }
}

export async function getMovieDetails(movieId: number): Promise<AdminMovieDetails> {
  try {
    const query = `SELECT * FROM admin_movie_details WHERE id = ?`;
    const [movieRows] = await getDbPool().execute<AdminMovieDetailsRow[]>(query, [movieId]);
    if (movieRows.length === 0) {
      throw new NotFoundError(`Movie with ID ${movieId} not found`);
    }

    return transformAdminMovieDetails(movieRows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    handleDatabaseError(error, `getMovieDetails(${movieId})`);
  }
}

export async function getMovieProfiles(movieId: number): Promise<ContentProfiles[]> {
  try {
    const query = `SELECT * FROM admin_movie_profiles WHERE movie_id = ?`;
    const [profileRows] = await getDbPool().execute<ContentProfilesRow[]>(query, [movieId]);
    return profileRows.map(transformContentProfiles);
  } catch (error) {
    handleDatabaseError(error, `getMovieProfiles(${movieId})`);
  }
}
