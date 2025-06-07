import { MovieReferenceRow, transformMovieReferenceRow } from '../../types/movieTypes';
import { getDbPool } from '../../utils/db';
import { handleDatabaseError } from '../../utils/errorHandlingUtility';
import { MovieReference } from '@ajgifford/keepwatching-types';

/**
 * Get trending movies based on how many users have favorited them recently
 */
export async function getTrendingMovies(limit: number = 10): Promise<MovieReference[]> {
  try {
    const query = `
      SELECT m.id, m.title, m.tmdb_id
      FROM movies m
      JOIN movie_watch_status mws ON m.id = mws.movie_id
      WHERE mws.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY m.id, m.title, m.tmdb_id
      ORDER BY COUNT(mws.profile_id) DESC, m.user_rating DESC
      LIMIT ${limit}
    `;

    const [movies] = await getDbPool().execute<MovieReferenceRow[]>(query);
    return movies.map(transformMovieReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting trending movies');
  }
}

/**
 * Get recently released movies
 */
export async function getRecentlyReleasedMovies(limit: number = 10): Promise<MovieReference[]> {
  try {
    const query = `
      SELECT id, title, tmdb_id
      FROM movies
      WHERE release_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      AND release_date <= NOW()
      ORDER BY release_date DESC, user_rating DESC
      LIMIT ${limit}
    `;

    const [movies] = await getDbPool().execute<MovieReferenceRow[]>(query);
    return movies.map(transformMovieReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting recently released movies');
  }
}

/**
 * Get highest rated movies
 */
export async function getTopRatedMovies(limit: number = 10): Promise<MovieReference[]> {
  try {
    const query = `
      SELECT id, title, tmdb_id
      FROM movies
      WHERE user_rating >= 7.0
      ORDER BY user_rating DESC, release_date DESC
      LIMIT ${limit}
    `;

    const [movies] = await getDbPool().execute<MovieReferenceRow[]>(query);
    return movies.map(transformMovieReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting top rated movies');
  }
}
