import { ADMIN_KEYS } from '../constants/cacheKeys';
import * as moviesDb from '../db/moviesDb';
import { appLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBGenre } from '../types/tmdbTypes';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '../utils/contentUtility';
import { getUSWatchProviders } from '../utils/watchProvidersUtility';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';
import { AdminMovieDetails, ContentProfiles, UpdateMovieRequest } from '@ajgifford/keepwatching-types';

export class AdminMovieService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
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
        streaming_service_ids: getUSWatchProviders(movieDetails, 9998),
        genre_ids: movieDetails.genres.map((genre: TMDBGenre) => genre.id),
      };

      const updated = await moviesDb.updateMovie(updateMovieRequest);
      if (updated) {
        this.invalidateAllMovies();
        this.invalidateMovieCache(movieId);
      }
      return updated;
    } catch (error) {
      appLogger.error(ErrorMessages.MovieChangeFail, { error, movieId });
      throw errorService.handleError(error, `updateMovieById(${movieId})`);
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

export const adminMovieService = new AdminMovieService();
