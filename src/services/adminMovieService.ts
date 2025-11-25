import { ADMIN_KEYS } from '../constants/cacheKeys';
import * as moviesDb from '../db/moviesDb';
import * as personsDb from '../db/personsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBGenre, TMDBMovie } from '../types/tmdbTypes';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '../utils/contentUtility';
import { getUSWatchProvidersMovie } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';
import { AdminMovieDetails, ContentProfiles, UpdateMovieRequest } from '@ajgifford/keepwatching-types';

/**
 * Service for handling admin-specific movie operations
 * Provides caching and error handling on top of the repository layer
 */
export class AdminMovieService {
  private cache: CacheService;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  public async getAllMovies(page: number, offset: number, limit: number) {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.allMovies(page, offset, limit), async () => {
        const [totalCount, movies] = await Promise.all([
          moviesDb.getMoviesCount(),
          moviesDb.getAllMovies(limit, offset),
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
          movies,
          pagination: {
            totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      });
    } catch (error) {
      throw errorService.handleError(error, `getAllMovies(${page}, ${offset}, ${limit})`);
    }
  }

  public async getAllMoviesByProfile(profileId: number, page: number, offset: number, limit: number) {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.allMoviesByProfile(profileId, page, offset, limit), async () => {
        const [totalCount, movies] = await Promise.all([
          moviesDb.getMoviesCountByProfile(profileId),
          moviesDb.getAllMoviesByProfile(profileId, limit, offset),
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
          movies,
          pagination: {
            totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      });
    } catch (error) {
      throw errorService.handleError(error, `getAllMoviesByProfile(${profileId}, ${page}, ${offset}, ${limit})`);
    }
  }

  public async getAllMovieReferences() {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.allMovieReferences(), async () => {
        return await moviesDb.getAllMoviesReferences();
      });
    } catch (error) {
      throw errorService.handleError(error, `getAllMovieReferences()`);
    }
  }

  public async getMovieDetails(movieId: number): Promise<AdminMovieDetails> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.movieDetails(movieId),
        () => moviesDb.getMovieDetails(movieId),
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getMovieDetails(${movieId})`);
    }
  }

  public async getMovieProfiles(movieId: number): Promise<ContentProfiles[]> {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.movieProfiles(movieId),
        () => moviesDb.getMovieProfiles(movieId),
        300, // 5 minutes TTL (shorter since this can change more frequently)
      );
    } catch (error) {
      throw errorService.handleError(error, `getMovieProfiles(${movieId})`);
    }
  }

  public async getCompleteMovieInfo(movieId: number) {
    try {
      return await this.cache.getOrSet(
        ADMIN_KEYS.movieComplete(movieId),
        async () => {
          const [details, profiles] = await Promise.all([
            moviesDb.getMovieDetails(movieId),
            moviesDb.getMovieProfiles(movieId),
          ]);

          return {
            details,
            profiles,
          };
        },
        300, // 5 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getCompleteMovieInfo(${movieId})`);
    }
  }

  public async updateAllMovies() {
    try {
      appLogger.info('updateAllMovies -- Started');
      cliLogger.info('updateAllMovies -- Started');
      const movieReferences = await this.getAllMovieReferences();
      for (const reference of movieReferences) {
        this.updateMovieById(reference.id, reference.tmdbId);
      }
      appLogger.info('updateAllMovies -- Ended');
      cliLogger.info('updateAllMovies -- Ended');
    } catch (error) {
      appLogger.info('updateAllMovies -- Error');
      cliLogger.info('updateAllMovies -- Error');
      throw errorService.handleError(error, `updateAllMovies()`);
    }
  }

  public async updateMovieById(movieId: number, tmdbId: number): Promise<boolean> {
    try {
      const tmdbService = getTMDBService();
      const movieDetails = await tmdbService.getMovieDetails(tmdbId);

      const updateMovieRequest: UpdateMovieRequest = {
        id: movieId,
        tmdb_id: movieDetails.id,
        title: movieDetails.title,
        description: movieDetails.overview,
        release_date: movieDetails.release_date,
        runtime: movieDetails.runtime,
        poster_image: movieDetails.poster_path,
        backdrop_image: movieDetails.backdrop_path,
        user_rating: movieDetails.vote_average,
        mpa_rating: getUSMPARating(movieDetails.release_dates),
        director: getDirectors(movieDetails),
        production_companies: getUSProductionCompanies(movieDetails.production_companies),
        budget: movieDetails.budget,
        revenue: movieDetails.revenue,
        streaming_service_ids: await getUSWatchProvidersMovie(movieDetails),
        genre_ids: movieDetails.genres.map((genre: TMDBGenre) => genre.id),
      };

      const updated = await moviesDb.updateMovie(updateMovieRequest);
      if (updated) {
        this.invalidateAllMovies();
        this.invalidateMovieCache(movieId);
      }

      this.processMovieCast(movieDetails, movieId);

      return updated;
    } catch (error) {
      appLogger.error(ErrorMessages.MovieChangeFail, { error, movieId });
      throw errorService.handleError(error, `updateMovieById(${movieId})`);
    }
  }

  private async processMovieCast(movie: TMDBMovie, movieId: number) {
    try {
      const cast = movie.credits.cast ?? [];
      for (const castMember of cast) {
        const person = await personsDb.findPersonByTMDBId(castMember.id);
        let personId = null;
        if (person) {
          personId = person.id;
        } else {
          const tmdbPerson = await getTMDBService().getPersonDetails(castMember.id);
          personId = await personsDb.savePerson({
            tmdb_id: tmdbPerson.id,
            name: tmdbPerson.name,
            gender: tmdbPerson.gender,
            biography: tmdbPerson.biography,
            profile_image: tmdbPerson.profile_path,
            birthdate: tmdbPerson.birthday,
            deathdate: tmdbPerson.deathday,
            place_of_birth: tmdbPerson.place_of_birth,
          });
        }
        personsDb.saveMovieCast({
          content_id: movieId,
          person_id: personId,
          credit_id: castMember.credit_id,
          character_name: castMember.character,
          cast_order: castMember.order,
        });
      }
    } catch (error) {
      cliLogger.error('Error fetching movie cast:', error);
    }
  }

  public invalidateAllMovies(): void {
    this.cache.invalidatePattern('allMovies_');
  }

  /**
   * Invalidate all cache entries related to a specific movie
   *
   * @param movieId - ID of the movie to invalidate cache for
   */
  public invalidateMovieCache(movieId: number): void {
    this.cache.invalidate(ADMIN_KEYS.movieDetails(movieId));
    this.cache.invalidate(ADMIN_KEYS.movieProfiles(movieId));
    this.cache.invalidate(ADMIN_KEYS.movieComplete(movieId));
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createAdminMovieService(dependencies?: { cacheService?: CacheService }): AdminMovieService {
  return new AdminMovieService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: AdminMovieService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getAdminMovieService(): AdminMovieService {
  if (!instance) {
    instance = createAdminMovieService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetAdminMovieService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { adminMovieService }` continues to work
 */
export const adminMovieService = getAdminMovieService();
