import { NotFoundError } from '../../middleware/errorMiddleware';
import { ContentCountRow } from '../../types/contentTypes';
import {
  AdminMovieDetailsRow,
  AdminMovieRow,
  MovieReferenceRow,
  transformAdminMovie,
  transformAdminMovieDetails,
  transformMovieReferenceRow,
} from '../../types/movieTypes';
import { ContentProfilesRow, transformContentProfiles } from '../../types/profileTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { AdminMovie, AdminMovieDetails, ContentProfiles, MovieReference } from '@ajgifford/keepwatching-types';

export async function getMoviesCount(): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMoviesCount', async () => {
      const query = `SELECT COUNT(DISTINCT m.id) AS total FROM movies m`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting the count of movies');
  }
}

export async function getMoviesCountByProfile(profileId: number): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMoviesCountByProfile', async () => {
      const query = `SELECT COUNT(DISTINCT m.movie_id) AS total FROM profile_movies m WHERE m.profile_id = ?`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query, [profileId]);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting the count of movies for a profile');
  }
}

export async function getAllMovies(limit: number = 50, offset: number = 0): Promise<AdminMovie[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllMovies', async () => {
      const query = `SELECT * FROM admin_movies LIMIT ${limit} OFFSET ${offset}`;
      const [movieRows] = await getDbPool().execute<AdminMovieRow[]>(query);
      return movieRows.map(transformAdminMovie);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting all movies');
  }
}

export async function getAllMoviesByProfile(
  profileId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<AdminMovie[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllMoviesByProfile', async () => {
      const query = `SELECT * FROM admin_profile_movies WHERE profile_id = ? ORDER BY title asc LIMIT ${limit} OFFSET ${offset}`;
      const [movieRows] = await getDbPool().execute<AdminMovieRow[]>(query, [profileId]);
      return movieRows.map(transformAdminMovie);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting all movies for a profile');
  }
}

export async function getAllMoviesReferences(): Promise<MovieReference[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllMoviesReferences', async () => {
      const query = `SELECT id, tmdb_id, title, release_date FROM movies`;
      const [movieRows] = await getDbPool().execute<MovieReferenceRow[]>(query);
      return movieRows.map(transformMovieReferenceRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting all movies references');
  }
}

export async function getMovieDetails(movieId: number): Promise<AdminMovieDetails> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMovieDetails', async () => {
      const query = `SELECT * FROM admin_movie_details WHERE id = ?`;
      const [movieRows] = await getDbPool().execute<AdminMovieDetailsRow[]>(query, [movieId]);
      if (movieRows.length === 0) {
        throw new NotFoundError(`Movie with ID ${movieId} not found`);
      }

      return transformAdminMovieDetails(movieRows[0]);
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    handleDatabaseError(error, `getMovieDetails(${movieId})`);
  }
}

export async function getMovieProfiles(movieId: number): Promise<ContentProfiles[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMovieProfiles', async () => {
      const query = `SELECT * FROM admin_movie_profiles WHERE movie_id = ?`;
      const [profileRows] = await getDbPool().execute<ContentProfilesRow[]>(query, [movieId]);
      return profileRows.map(transformContentProfiles);
    });
  } catch (error) {
    handleDatabaseError(error, `getMovieProfiles(${movieId})`);
  }
}
