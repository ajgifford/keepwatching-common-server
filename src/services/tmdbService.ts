import {
  TMDBChangesResponse,
  TMDBMovie,
  TMDBPaginatedResponse,
  TMDBPerson,
  TMDBPersonCredits,
  TMDBRelatedMovie,
  TMDBRelatedShow,
  TMDBSearchMovieParams,
  TMDBSearchMovieResult,
  TMDBSearchPersonParams,
  TMDBSearchPersonResult,
  TMDBSearchShowResult,
  TMDBSearchTVParams,
  TMDBSeasonDetails,
  TMDBShow,
  TMDBTrendingResult,
} from '../types/tmdbTypes';
import { axiosTMDBAPIInstance } from '../utils/axiosInstance';
import { withRetry } from '../utils/retryUtil';
import { CacheService } from './cacheService';

export const TMDB_CACHE_KEYS = {
  showDetails: (id: number) => `tmdb_show_details_${id}`,
  movieDetails: (id: number) => `tmdb_movie_details_${id}`,
  seasonDetails: (showId: number, seasonNumber: number) => `tmdb_season_details_${showId}_${seasonNumber}`,
  personDetails: (personId: number) => `tmdb_person_details_${personId}`,
  personCredits: (personId: number) => `tmdb_person_credits_${personId}`,
  trending: (mediaType: 'tv' | 'movie', page: string = '1') => `tmdb_trending_${mediaType}_${page}`,
  showRecommendations: (showId: number) => `tmdb_show_recommendations_${showId}`,
  movieRecommendations: (movieId: number) => `tmdb_movie_recommendations_${movieId}`,
  similarShows: (showId: number) => `tmdb_similar_shows_${showId}`,
  similarMovies: (movieId: number) => `tmdb_similar_movies_${movieId}`,
  showChanges: (showId: number, startDate: string, endDate: string) =>
    `tmdb_show_changes_${showId}_${startDate}_${endDate}`,
  movieChanges: (movieId: number, startDate: string, endDate: string) =>
    `tmdb_movie_changes_${movieId}_${startDate}_${endDate}`,
  seasonChanges: (seasonId: number, startDate: string, endDate: string) =>
    `tmdb_season_changes_${seasonId}_${startDate}_${endDate}`,
  search: {
    shows: (query: string, page: number, year?: string) => `tmdb_search_shows_${query}_${page}_${year || ''}`,
    movies: (query: string, page: number, year?: string) => `tmdb_search_movies_${query}_${page}_${year || ''}`,
    people: (query: string, page: number) => `tmdb_search_people_${query}_${page}`,
  },
};

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
  searchShows(query: string, page?: number, year?: string): Promise<TMDBPaginatedResponse<TMDBSearchShowResult>>;

  /**
   * Search for movies matching the provided query
   * @param query - Search term
   * @param page - Page number of results (default: 1)
   * @param year - Optional year filter
   * @returns Search results from TMDB
   */
  searchMovies(query: string, page?: number, year?: string): Promise<TMDBPaginatedResponse<TMDBSearchMovieResult>>;

  /**
   * Search for people matching the provided query
   * @param query - Search term
   * @param page - Page number of results (default: 1)
   * @returns Search results from TMDB
   */
  searchPeople(query: string, page?: number): Promise<TMDBPaginatedResponse<TMDBSearchPersonResult>>;

  /**
   * Get detailed information about a TV show
   * @param id - TMDB ID of the show
   * @returns Show details with content ratings and watch providers
   */
  getShowDetails(id: number): Promise<TMDBShow>;

  /**
   * Get detailed information about a movie
   * @param id - TMDB ID of the movie
   * @returns Movie details with release dates and watch providers
   */
  getMovieDetails(id: number): Promise<TMDBMovie>;

  /**
   * Get detailed information about a specific season of a TV show
   * @param showId - TMDB ID of the show
   * @param seasonNumber - Season number
   * @returns Season details including episodes
   */
  getSeasonDetails(showId: number, seasonNumber: number): Promise<TMDBSeasonDetails>;

  /**
   * Get detailed information about a specific person
   * @param personId - TMDB ID of the person
   * @returns Person details
   */
  getPersonDetails(personId: number): Promise<TMDBPerson>;

  /**
   * Get credits for a specific person
   * @param personId - TMDB ID of the person
   * @returns Person credits
   */
  getPersonCredits(personId: number): Promise<TMDBPersonCredits>;

  /**
   * Get trending shows or movies for the week
   * @param mediaType - Type of media ('tv' or 'movie')
   * @param page - Page number of results
   * @returns Trending content
   */
  getTrending(mediaType: 'tv' | 'movie', page?: string): Promise<TMDBPaginatedResponse<TMDBTrendingResult>>;

  /**
   * Get recommendations for a TV show
   * @param showId - TMDB ID of the show
   * @returns Show recommendations
   */
  getShowRecommendations(showId: number): Promise<TMDBPaginatedResponse<TMDBRelatedShow>>;

  /**
   * Get recommendations for a movie
   * @param movieId - TMDB ID of the movie
   * @returns Movie recommendations
   */
  getMovieRecommendations(movieId: number): Promise<TMDBPaginatedResponse<TMDBRelatedMovie>>;

  /**
   * Get similar shows for a given TV show
   * @param showId - TMDB ID of the show
   * @returns Similar shows
   */
  getSimilarShows(showId: number): Promise<TMDBPaginatedResponse<TMDBRelatedShow>>;

  /**
   * Get similar movies for a given movie
   * @param movieId - TMDB ID of the movie
   * @returns Similar movies
   */
  getSimilarMovies(movieId: number): Promise<TMDBPaginatedResponse<TMDBRelatedMovie>>;

  /**
   * Get changes for a specific show
   * @param showId - TMDB ID of the show
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the show
   */
  getShowChanges(showId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse>;

  /**
   * Get changes for a specific movie
   * @param movieId - TMDB ID of the movie
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the movie
   */
  getMovieChanges(movieId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse>;

  /**
   * Get changes for a specific season
   * @param seasonId - TMDB ID of the season
   * @param startDate - Start date for changes in YYYY-MM-DD format
   * @param endDate - End date for changes in YYYY-MM-DD format
   * @returns Changes for the season
   */
  getSeasonChanges(seasonId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse>;

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
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  async searchShows(
    query: string,
    page: number = 1,
    year?: string,
  ): Promise<TMDBPaginatedResponse<TMDBSearchShowResult>> {
    const cacheKey = TMDB_CACHE_KEYS.search.shows(query, page, year);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const params: TMDBSearchTVParams = {
              query,
              page,
              include_adult: false,
              language: 'en-US',
            };

            if (year) {
              params.first_air_date_year = year;
            }

            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBSearchShowResult>>('/search/tv', {
              params,
            });
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `searchShows(${query})`,
        );
      },
      600, // 10 minute TTL for search results
    );
  }

  async searchMovies(
    query: string,
    page: number = 1,
    year?: string,
  ): Promise<TMDBPaginatedResponse<TMDBSearchMovieResult>> {
    const cacheKey = TMDB_CACHE_KEYS.search.movies(query, page, year);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const params: TMDBSearchMovieParams = {
              query,
              page,
              include_adult: false,
              region: 'US',
              language: 'en-US',
            };

            if (year) {
              params.primary_release_year = year;
            }

            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBSearchMovieResult>>(
              '/search/movie',
              { params },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `searchMovies(${query})`,
        );
      },
      600, // 10 minute TTL for search results
    );
  }

  async searchPeople(query: string, page: number = 1): Promise<TMDBPaginatedResponse<TMDBSearchPersonResult>> {
    const cacheKey = TMDB_CACHE_KEYS.search.people(query, page);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const params: TMDBSearchPersonParams = {
              query,
              page,
              include_adult: false,
              language: 'en-US',
            };

            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBSearchPersonResult>>(
              '/search/person',
              { params },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `searchPeople(${query})`,
        );
      },
      600, // 10 minute TTL for search results
    );
  }

  async getShowDetails(id: number): Promise<TMDBShow> {
    const cacheKey = TMDB_CACHE_KEYS.showDetails(id);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBShow>(
              `/tv/${id}?append_to_response=credits,aggregate_credits,content_ratings,watch/providers`,
              { timeout: 10000 },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getShowDetails(${id})`,
        );
      },
      3600, // 1 hour TTL
    );
  }

  async getMovieDetails(id: number): Promise<TMDBMovie> {
    const cacheKey = TMDB_CACHE_KEYS.movieDetails(id);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBMovie>(
              `/movie/${id}?append_to_response=credits,release_dates,watch/providers&language=en-US`,
              { timeout: 10000 },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getMovieDetails(${id})`,
        );
      },
      3600, // 1 hour TTL
    );
  }

  async getSeasonDetails(showId: number, seasonNumber: number): Promise<TMDBSeasonDetails> {
    const cacheKey = TMDB_CACHE_KEYS.seasonDetails(showId, seasonNumber);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBSeasonDetails>(`/tv/${showId}/season/${seasonNumber}`, {
              timeout: 10000,
            });
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getSeasonDetails(${showId}, ${seasonNumber})`,
        );
      },
      3600, // 1 hour TTL
    );
  }

  async getPersonDetails(personId: number): Promise<TMDBPerson> {
    const cacheKey = TMDB_CACHE_KEYS.personDetails(personId);
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPerson>(`/person/${personId}`, {
              timeout: 10000,
            });
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getPersonDetails(${personId})`,
        );
      },
      3600, // 1 hour TTL
    );
  }

  async getPersonCredits(personId: number): Promise<TMDBPersonCredits> {
    const cacheKey = TMDB_CACHE_KEYS.personCredits(personId);
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPersonCredits>(`/person/${personId}/combined_credits`, {
              timeout: 10000,
            });
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getPersonCredits(${personId})`,
        );
      },
      3600, // 1 hour TTL
    );
  }

  async getTrending(mediaType: 'tv' | 'movie', page: string = '1'): Promise<TMDBPaginatedResponse<TMDBTrendingResult>> {
    const cacheKey = TMDB_CACHE_KEYS.trending(mediaType, page);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get(`/trending/${mediaType}/week`, {
              params: {
                page,
                language: 'en-US',
              },
            });

            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getTrending(${mediaType}, ${page})`,
        );
      },
      1800,
    );
  }

  async getShowRecommendations(showId: number): Promise<TMDBPaginatedResponse<TMDBRelatedShow>> {
    const cacheKey = TMDB_CACHE_KEYS.showRecommendations(showId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBRelatedShow>>(
              `/tv/${showId}/recommendations`,
              {
                params: {
                  language: 'en-US',
                },
              },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getShowRecommendations(${showId})`,
        );
      },
      43200, // 12 hours TTL
    );
  }

  async getSimilarShows(showId: number): Promise<TMDBPaginatedResponse<TMDBRelatedShow>> {
    const cacheKey = TMDB_CACHE_KEYS.similarShows(showId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBRelatedShow>>(
              `/tv/${showId}/similar`,
              {
                params: {
                  language: 'en-US',
                },
              },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getSimilarShows(${showId})`,
        );
      },
      43200, // 12 hours TTL
    );
  }

  async getMovieRecommendations(movieId: number): Promise<TMDBPaginatedResponse<TMDBRelatedMovie>> {
    const cacheKey = TMDB_CACHE_KEYS.movieRecommendations(movieId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBRelatedMovie>>(
              `/movie/${movieId}/recommendations`,
              {
                params: {
                  language: 'en-US',
                },
              },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getMovieRecommendations(${movieId})`,
        );
      },
      43200, // 12 hours TTL
    );
  }

  async getSimilarMovies(movieId: number): Promise<TMDBPaginatedResponse<TMDBRelatedMovie>> {
    const cacheKey = TMDB_CACHE_KEYS.similarMovies(movieId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBPaginatedResponse<TMDBRelatedMovie>>(
              `/movie/${movieId}/similar`,
              {
                params: {
                  language: 'en-US',
                },
              },
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getSimilarMovies(${movieId})`,
        );
      },
      43200, // 12 hours TTL
    );
  }

  async getShowChanges(showId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse> {
    const cacheKey = TMDB_CACHE_KEYS.showChanges(showId, startDate, endDate);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBChangesResponse>(
              `tv/${showId}/changes?end_date=${endDate}&start_date=${startDate}`,
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getShowChanges(${showId})`,
        );
      },
      600, // 10 minutes TTL for changes data
    );
  }

  async getMovieChanges(movieId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse> {
    const cacheKey = TMDB_CACHE_KEYS.movieChanges(movieId, startDate, endDate);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBChangesResponse>(
              `movie/${movieId}/changes?end_date=${endDate}&start_date=${startDate}`,
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getMovieChanges(${movieId})`,
        );
      },
      600, // 10 minutes TTL for changes data
    );
  }

  async getSeasonChanges(seasonId: number, startDate: string, endDate: string): Promise<TMDBChangesResponse> {
    const cacheKey = TMDB_CACHE_KEYS.seasonChanges(seasonId, startDate, endDate);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await withRetry(
          async () => {
            const response = await axiosTMDBAPIInstance.get<TMDBChangesResponse>(
              `tv/season/${seasonId}/changes?end_date=${endDate}&start_date=${startDate}`,
            );
            return response.data;
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
          },
          `getSeasonChanges(${seasonId})`,
        );
      },
      600, // 10 minutes TTL for changes data
    );
  }

  clearCache(key?: string): void {
    if (key) {
      this.cache.invalidate(key);
    } else {
      // Invalidate all TMDB-related cache keys using pattern matching
      this.cache.invalidatePattern('tmdb_');
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
