import { ADMIN_KEYS } from '../constants/cacheKeys';
import * as moviesDb from '../db/moviesDb';
import { appLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { getUSMPARating } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';

export class AdminMovieService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  public async getAllMovies(page: number, offset: number, limit: number) {
    try {
      const allMoviesResult = this.cache.getOrSet(ADMIN_KEYS.allMovies(page, offset, limit), async () => {
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
      return allMoviesResult;
    } catch (error) {
      throw errorService.handleError(error, `getAllMovies(${page}, ${offset}, ${limit})`);
    }
  }

  public async getMovieDetails(movieId: number) {
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

  public async getMovieProfiles(movieId: number) {
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

  public async updateMovieById(movieId: number, tmdbId: number): Promise<boolean> {
    try {
      const tmdbService = getTMDBService();
      const movieDetails = await tmdbService.getMovieDetails(tmdbId);

      const movie = moviesDb.createMovie(
        movieDetails.id,
        movieDetails.title,
        movieDetails.overview,
        movieDetails.release_date,
        movieDetails.runtime,
        movieDetails.poster_path,
        movieDetails.backdrop_path,
        movieDetails.vote_average,
        getUSMPARating(movieDetails.release_dates),
        movieId,
        getUSWatchProviders(movieDetails, 9998),
        movieDetails.genres.map((genre: { id: any }) => genre.id),
      );

      const updated = await moviesDb.updateMovie(movie);
      return updated;
    } catch (error) {
      appLogger.error(ErrorMessages.MovieChangeFail, { error, movieId });
      throw errorService.handleError(error, `updateMovieById(${movieId})`);
    }
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

export const adminMovieService = new AdminMovieService();
