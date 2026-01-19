import { RowDataPacket } from 'mysql2';
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
import {
  AdminMovie,
  AdminMovieDetails,
  ContentProfiles,
  MovieFilters,
  MovieReference,
} from '@ajgifford/keepwatching-types';

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

export interface MovieFilterOptions {
  streamingServices: string[];
  years: string[];
}

interface DistinctValueRow extends RowDataPacket {
  value: string | null;
}

/**
 * Get all distinct filter values available for movies
 * Used to populate filter dropdowns in the admin UI
 *
 * @returns Object containing arrays of distinct values for each filter type
 */
export async function getMovieFilterOptions(): Promise<MovieFilterOptions> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMovieFilterOptions', async () => {
      const [streamingServices] = await getDbPool().execute<DistinctValueRow[]>(
        `SELECT DISTINCT ss.name as value
         FROM movie_services ms
         JOIN streaming_services ss ON ms.streaming_service_id = ss.id
         WHERE ss.name IS NOT NULL AND ss.name != ""
         ORDER BY ss.name`,
      );
      const [years] = await getDbPool().execute<DistinctValueRow[]>(
        `SELECT DISTINCT YEAR(STR_TO_DATE(release_date, '%Y-%m-%d')) as value
         FROM movies
         WHERE release_date IS NOT NULL AND release_date != ""
         ORDER BY value DESC`,
      );

      return {
        streamingServices: streamingServices.map((r) => r.value).filter((v): v is string => v !== null && v !== ''),
        years: years.map((r) => String(r.value)).filter((v) => v !== 'null' && v !== ''),
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'get movie filter options');
  }
}

/**
 * Build WHERE clause and params array from filter object
 * @internal
 */
function buildMovieFilterClause(filters: MovieFilters): { whereClause: string; params: string[] } {
  const whereClauses: string[] = [];
  const params: string[] = [];

  if (filters.streamingService) {
    whereClauses.push('streaming_services LIKE ?');
    params.push(`%${filters.streamingService}%`);
  }

  if (filters.year) {
    whereClauses.push('YEAR(STR_TO_DATE(release_date, "%Y-%m-%d")) = ?');
    params.push(filters.year);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * Get count of movies matching the provided filters
 *
 * @param filters - Optional filters to apply
 * @returns Count of movies matching the filter criteria
 */
export async function getMoviesCountFiltered(filters: MovieFilters): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMoviesCountFiltered', async () => {
      const { whereClause, params } = buildMovieFilterClause(filters);
      const query = `SELECT COUNT(*) AS total FROM admin_movies ${whereClause}`;
      const [result] = await getDbPool().execute<ContentCountRow[]>(query, params);
      return result[0].total;
    });
  } catch (error) {
    handleDatabaseError(error, 'get filtered movies count');
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

/**
 * Get all movies with optional filtering by streaming service or release year
 *
 * This method extends `getAllMovies` by allowing optional filters to narrow down results.
 * Filters are combined with AND logic - movies must match all provided filter criteria.
 *
 * @param filters - Optional filters to apply (see MovieFilters interface from @ajgifford/keepwatching-types)
 * @param limit - Maximum number of movies to return (default: 50)
 * @param offset - Number of movies to skip for pagination (default: 0)
 * @returns Array of AdminMovie objects matching the filter criteria
 * @throws {DatabaseError} If a database error occurs
 *
 * @example
 * ```typescript
 * // Get movies from 2023
 * const recentMovies = await getAllMoviesFiltered({
 *   year: '2023'
 * }, 100, 0);
 *
 * // Get all movies available on HBO Max
 * const hboMovies = await getAllMoviesFiltered({
 *   streamingService: 'HBO Max'
 * }, 50, 0);
 *
 * // Get Netflix movies from 2023 (2nd page)
 * const netflixMovies = await getAllMoviesFiltered(
 *   { streamingService: 'Netflix', year: '2023' },
 *   50,
 *   50
 * );
 * ```
 */
export async function getAllMoviesFiltered(
  filters: MovieFilters,
  limit: number = 50,
  offset: number = 0,
): Promise<AdminMovie[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getAllMoviesFiltered', async () => {
      const { whereClause, params } = buildMovieFilterClause(filters);
      const query = `SELECT * FROM admin_movies ${whereClause} LIMIT ${limit} OFFSET ${offset}`;

      const [movieRows] = await getDbPool().execute<AdminMovieRow[]>(query, params);
      return movieRows.map(transformAdminMovie);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting filtered movies');
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
    return await DbMonitor.getInstance().executeWithTiming(
      'getMovieDetails',
      async () => {
        const query = `SELECT * FROM admin_movie_details WHERE id = ?`;
        const [movieRows] = await getDbPool().execute<AdminMovieDetailsRow[]>(query, [movieId]);
        if (movieRows.length === 0) {
          throw new NotFoundError(`Movie with ID ${movieId} not found`);
        }

        return transformAdminMovieDetails(movieRows[0]);
      },
      1000,
      { content: { id: movieId, type: 'movie' } },
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    handleDatabaseError(error, `getMovieDetails(${movieId})`);
  }
}

export async function getMovieProfiles(movieId: number): Promise<ContentProfiles[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getMovieProfiles',
      async () => {
        const query = `SELECT * FROM admin_movie_profiles WHERE movie_id = ?`;
        const [profileRows] = await getDbPool().execute<ContentProfilesRow[]>(query, [movieId]);
        return profileRows.map(transformContentProfiles);
      },
      1000,
      { content: { id: movieId, type: 'movie' } },
    );
  } catch (error) {
    handleDatabaseError(error, `getMovieProfiles(${movieId})`);
  }
}
