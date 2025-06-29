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

    const [movieRows] = await getDbPool().execute<AdminMovieRow[]>(query);
    return movieRows.map(transformAdminMovie);
  } catch (error) {
    handleDatabaseError(error, 'getting all movies');
  }
}

export async function getMovieDetails(movieId: number): Promise<AdminMovieDetails> {
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
      m.director,
      m.production_companies,
      m.budget,
      m.revenue,
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
    WHERE
      m.id = ?
    GROUP BY 
      m.id`;

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
    const query = `
      SELECT 
        p.profile_id,
        p.name,
        p.image,
        p.account_id,
        a.account_name,
        mws.status as watch_status,
        mws.created_at as added_date,
        mws.updated_at as status_updated_date
      FROM 
        movie_watch_status mws
      JOIN
        profiles p ON mws.profile_id = p.profile_id
      JOIN
        accounts a ON p.account_id = a.account_id
      WHERE 
        mws.movie_id = ?
      ORDER BY 
        a.account_name, p.name`;

    const [profileRows] = await getDbPool().execute<ContentProfilesRow[]>(query, [movieId]);
    return profileRows.map(transformContentProfiles);
  } catch (error) {
    handleDatabaseError(error, `getMovieProfiles(${movieId})`);
  }
}
