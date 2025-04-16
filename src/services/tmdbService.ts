import { cliLogger } from '../logger/logger';
import { TransientApiError } from '../middleware/errorMiddleware';
import { axiosTMDBAPIInstance } from '../utils/axiosInstance';
import { errorService } from './errorService';
import { AxiosError } from 'axios';
import NodeCache from 'node-cache';

// Cache with 5 minute TTL for common requests
const tmdbCache = new NodeCache({ stdTTL: 300 });

/**
 * Interface for TMDB service operations
 * This service encapsulates all interactions with the TMDB API
 */
export interface TMDBService {
  /**
   * Search for TV shows matching the provided query
   * @param query - Search term
   * @param page - Page number of results (default: 1)
   * @param year - Optional year filter
   * @returns Search results from TMDB
   */
  searchShows(query: string, page?: number, year?: string): Promise<any>;

  /**
   * Search for movies matching the provided query
   * @param query - Search term
   * @param page - Page number of results (default: 1)
   * @param year - Optional year filter
   * @returns Search results from TMDB
   */
  searchMovies(query: string, page?: number, year?: string): Promise<any>;

  /**
   * Get detailed information about a TV show
   * @param id - TMDB ID of the show
   * @returns Show details with content ratings and watch providers
   */
  getShowDetails(id: number): Promise<any>;

  /**
   * Get detailed information about a movie
   * @param id - TMDB ID of the movie
   * @returns Movie details with release dates and watch providers
   */
  getMovieDetails(id: number): Promise<any>;

  /**
   * Get detailed information about a specific season of a TV show
   * @param showId - TMDB ID of the show
   * @param seasonNumber - Season number
   * @returns Season details including episodes
   */
  getSeasonDetails(showId: number, seasonNumber: number): Promise<any>;

  /**
   * Get trending shows or movies for the week
   * @param mediaType - Type of media ('tv' or 'movie')
   * @param page - Page number of results
   * @returns Trending content
   */
  getTrending(mediaType: 'tv' | 'movie', page?: string): Promise<any>;

  /**
   * Get recommendations for a TV show
   * @param showId - TMDB ID of the show
   * @returns Show recommendations
   */
  getShowRecommendations(showId: number): Promise<any>;

  /**
   * Get recommendations for a movie
   * @param movieId - TMDB ID of the movie
   * @returns Movie recommendations
   */
  getMovieRecommendations(movieId: number): Promise<any>;

  /**
   * Get similar shows for a given TV show
   * @param showId - TMDB ID of the show
   * @returns Similar shows
   */
  getSimilarShows(showId: number): Promise<any>;

  /**
   * Get similar movies for a given movie
   * @param movieId - TMDB ID of the movie
   * @returns Similar movies
   */
  getSimilarMovies(movieId: number): Promise<any>;

  /**
   * Get changes for a specific show
   * @param showId - TMDB ID of the show
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the show
   */
  getShowChanges(showId: number, startDate: string, endDate: string): Promise<any>;

  /**
   * Get changes for a specific movie
   * @param movieId - TMDB ID of the movie
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the movie
   */
  getMovieChanges(movieId: number, startDate: string, endDate: string): Promise<any>;

  /**
   * Get changes for a specific season
   * @param seasonId - TMDB ID of the season
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the season
   */
  getSeasonChanges(seasonId: number, startDate: string, endDate: string): Promise<any>;

  /**
   * Clear cache for specific items or all items if no key provided
   * @param key - Optional cache key to clear specific item
   */
  clearCache(key?: string): void;
}

/**
 * Implementation of TMDBService using Axios
 */
export class DefaultTMDBService implements TMDBService {
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (
          !(error instanceof TransientApiError) &&
          !(error instanceof AxiosError && this.isRetriableStatus(error.response?.status))
        ) {
          throw errorService.handleError(error, context);
        }

        if (retry === maxRetries) {
          throw errorService.handleError(error, `${context} (after ${maxRetries} retries)`);
        }

        const delay = this.calculateRetryDelay(error, retry, baseDelay);
        cliLogger.info(`Retrying ${context} after error. Attempt ${retry + 1}/${maxRetries} in ${delay}ms`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw errorService.handleError(lastError || new Error('Unknown error'), context);
  }

  private isRetriableStatus(status?: number): boolean {
    return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
  }

  private calculateRetryDelay(error: any, retry: number, baseDelay: number): number {
    const retryAfter = error.response?.headers?.['retry-after']
      ? parseInt(error.response.headers['retry-after']) * 1000
      : null;

    if (retryAfter) return retryAfter;

    return Math.min(
      baseDelay * Math.pow(2, retry) * (0.8 + Math.random() * 0.4), // Add 20% jitter
      60000, // Cap at 1 minute
    );
  }

  async searchShows(query: string, page: number = 1, year?: string): Promise<any> {
    return await this.withRetry(
      async () => {
        const params: Record<string, any> = {
          query,
          page,
          include_adult: false,
          language: 'en-US',
        };

        if (year) {
          params.first_air_date_year = year;
        }

        const response = await axiosTMDBAPIInstance.get('/search/tv', { params });
        return response.data;
      },
      3,
      1000,
      `searchShows(${query})`,
    );
  }

  async searchMovies(query: string, page: number = 1, year?: string): Promise<any> {
    return await this.withRetry(
      async () => {
        const params: Record<string, any> = {
          query,
          page,
          include_adult: false,
          region: 'US',
          language: 'en-US',
        };

        if (year) {
          params.primary_release_year = year;
        }

        const response = await axiosTMDBAPIInstance.get('/search/movie', { params });
        return response.data;
      },
      3,
      1000,
      `searchMovies(${query})`,
    );
  }

  async getShowDetails(id: number): Promise<any> {
    const cacheKey = `show_details_${id}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/tv/${id}?append_to_response=content_ratings,watch/providers`);
        return response.data;
      },
      3,
      1000,
      `getShowDetails(${id})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getMovieDetails(id: number): Promise<any> {
    const cacheKey = `movie_details_${id}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(
          `/movie/${id}?append_to_response=release_dates%2Cwatch%2Fproviders&language=en-US`,
        );
        return response.data;
      },
      3,
      1000,
      `getMovieDetails(${id})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getSeasonDetails(showId: number, seasonNumber: number): Promise<any> {
    const cacheKey = `season_details_${showId}_${seasonNumber}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/tv/${showId}/season/${seasonNumber}`);
        return response.data;
      },
      3,
      1000,
      `getSeasonDetails(${showId}, ${seasonNumber})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getTrending(mediaType: 'tv' | 'movie', page: string = '1'): Promise<any> {
    const cacheKey = `trending_${mediaType}_${page}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/trending/${mediaType}/week`, {
          params: {
            page,
            language: 'en-US',
          },
        });
        return response.data;
      },
      3,
      1000,
      `getTrending(${mediaType}, ${page})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getShowRecommendations(showId: number): Promise<any> {
    const cacheKey = `show_recommendations_${showId}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/tv/${showId}/recommendations`, {
          params: {
            language: 'en-US',
          },
        });
        return response.data;
      },
      3,
      1000,
      `getShowRecommendations(${showId})`,
    );

    tmdbCache.set(cacheKey, data, 43200); // Cache for 12 hours
    return data;
  }

  async getSimilarShows(showId: number): Promise<any> {
    const cacheKey = `similar_shows_${showId}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/tv/${showId}/similar`, {
          params: {
            language: 'en-US',
          },
        });
        return response.data;
      },
      3,
      1000,
      `getSimilarShows(${showId})`,
    );

    tmdbCache.set(cacheKey, data, 43200); // Cache for 12 hours
    return data;
  }

  async getMovieRecommendations(movieId: number): Promise<any> {
    const cacheKey = `movie_recommendations_${movieId}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/movie/${movieId}/recommendations`, {
          params: {
            language: 'en-US',
          },
        });
        return response.data;
      },
      3,
      1000,
      `getMovieRecommendations(${movieId})`,
    );

    tmdbCache.set(cacheKey, data, 43200); // Cache for 12 hours
    return data;
  }

  async getSimilarMovies(movieId: number): Promise<any> {
    const cacheKey = `similar_movies_${movieId}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(`/movie/${movieId}/similar`, {
          params: {
            language: 'en-US',
          },
        });
        return response.data;
      },
      3,
      1000,
      `getSimilarMovies(${movieId})`,
    );

    tmdbCache.set(cacheKey, data, 43200); // Cache for 12 hours
    return data;
  }

  async getShowChanges(showId: number, startDate: string, endDate: string): Promise<any> {
    const cacheKey = `show_changes_${showId}_${startDate}_${endDate}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(
          `tv/${showId}/changes?end_date=${endDate}&start_date=${startDate}`,
        );
        return response.data;
      },
      3,
      1000,
      `getShowChanges(${showId})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getMovieChanges(movieId: number, startDate: string, endDate: string): Promise<any> {
    const cacheKey = `movie_changes_${movieId}_${startDate}_${endDate}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(
          `movie/${movieId}/changes?end_date=${endDate}&start_date=${startDate}`,
        );
        return response.data;
      },
      3,
      1000,
      `getMovieChanges(${movieId})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  async getSeasonChanges(seasonId: number, startDate: string, endDate: string): Promise<any> {
    const cacheKey = `season_changes_${seasonId}_${startDate}_${endDate}`;
    const cachedResult = tmdbCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const data = await this.withRetry(
      async () => {
        const response = await axiosTMDBAPIInstance.get(
          `tv/season/${seasonId}/changes?end_date=${endDate}&start_date=${startDate}`,
        );
        return response.data;
      },
      3,
      1000,
      `getSeasonChanges(${seasonId})`,
    );

    tmdbCache.set(cacheKey, data);
    return data;
  }

  clearCache(key?: string): void {
    if (key) {
      tmdbCache.del(key);
    } else {
      tmdbCache.flushAll();
    }
  }
}

// Singleton instance for the application
let tmdbServiceInstance: TMDBService | null = null;

/**
 * Get the TMDBService instance
 * @returns TMDBService instance
 */
export const getTMDBService = (): TMDBService => {
  if (!tmdbServiceInstance) {
    tmdbServiceInstance = new DefaultTMDBService();
  }
  return tmdbServiceInstance;
};

// For testing
export const setTMDBService = (service: TMDBService): void => {
  tmdbServiceInstance = service;
};

export const resetTMDBService = (): void => {
  tmdbServiceInstance = null;
};
