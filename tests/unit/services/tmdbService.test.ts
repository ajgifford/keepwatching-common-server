import { CacheService } from '@services/cacheService';
import {
  DefaultTMDBService,
  TMDB_CACHE_KEYS,
  getTMDBService,
  resetTMDBService,
  setTMDBService,
} from '@services/tmdbService';
import { axiosTMDBAPIInstance } from '@utils/axiosInstance';

jest.mock('@utils/axiosInstance');
jest.mock('@services/cacheService');

describe('TMDB Service', () => {
  // Mock implementation of cache and axios
  let mockCache: jest.Mocked<CacheService>;
  let mockAxios: jest.Mocked<typeof axiosTMDBAPIInstance>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the singleton instance between tests
    resetTMDBService();

    // Setup mock cache service
    mockCache = {
      getOrSet: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCache);

    // Setup mock axios instance
    mockAxios = {
      get: jest.fn(),
    } as unknown as jest.Mocked<typeof axiosTMDBAPIInstance>;

    (axiosTMDBAPIInstance as jest.Mocked<any>).get.mockImplementation(mockAxios.get);
  });

  describe('getTMDBService', () => {
    it('should return a singleton instance', () => {
      const service1 = getTMDBService();
      const service2 = getTMDBService();

      expect(service1).toBeInstanceOf(DefaultTMDBService);
      expect(service1).toBe(service2); // Same instance
    });

    it('should allow setting a custom service implementation', () => {
      const customService = { getShowDetails: jest.fn() } as any;
      setTMDBService(customService);

      const service = getTMDBService();
      expect(service).toBe(customService);
    });
  });

  describe('getShowDetails', () => {
    it('should fetch and cache show details', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          id: 123,
          name: 'Test Show',
          overview: 'Test overview',
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getShowDetails(123);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(TMDB_CACHE_KEYS.showDetails(123), expect.any(Function), 3600);

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/tv/123?append_to_response=credits,aggregate_credits,content_ratings,watch/providers',
        {
          timeout: 10000,
        },
      );

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });

    it('should return cached data when available', async () => {
      // Mock cached data
      const cachedData = {
        id: 123,
        name: 'Cached Show',
        overview: 'Cached overview',
      };

      // Setup mock to return cached data
      mockCache.getOrSet.mockResolvedValueOnce(cachedData);

      // Call the method
      const service = getTMDBService();
      const result = await service.getShowDetails(123);

      // Verify cache was checked
      expect(mockCache.getOrSet).toHaveBeenCalledWith(TMDB_CACHE_KEYS.showDetails(123), expect.any(Function), 3600);

      // Axios should not be called if cache hit
      expect(mockAxios.get).not.toHaveBeenCalled();

      // Verify result matches cached data
      expect(result).toEqual(cachedData);
    });
  });

  describe('getMovieDetails', () => {
    it('should fetch and cache movie details', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          id: 456,
          title: 'Test Movie',
          overview: 'Test movie overview',
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getMovieDetails(456);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(TMDB_CACHE_KEYS.movieDetails(456), expect.any(Function), 3600);

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/movie/456?append_to_response=credits,release_dates,watch/providers&language=en-US',
        {
          timeout: 10000,
        },
      );

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSeasonDetails', () => {
    it('should fetch and cache season details', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          id: 789,
          name: 'Season 1',
          episodes: [
            { id: 101, name: 'Episode 1' },
            { id: 102, name: 'Episode 2' },
          ],
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getSeasonDetails(123, 1);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.seasonDetails(123, 1),
        expect.any(Function),
        3600,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/tv/123/season/1', {
        timeout: 10000,
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('searchShows', () => {
    it('should fetch and cache show search results', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 123, name: 'Test Show' },
            { id: 124, name: 'Another Show' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.searchShows('test query', 1, '2023');

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.search.shows('test query', 1, '2023'),
        expect.any(Function),
        600,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/search/tv', {
        params: {
          query: 'test query',
          page: 1,
          first_air_date_year: '2023',
          include_adult: false,
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('searchMovies', () => {
    it('should fetch and cache movie search results', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 456, title: 'Test Movie' },
            { id: 457, title: 'Another Movie' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.searchMovies('test query', 1, '2023');

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.search.movies('test query', 1, '2023'),
        expect.any(Function),
        600,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/search/movie', {
        params: {
          query: 'test query',
          page: 1,
          primary_release_year: '2023',
          include_adult: false,
          region: 'US',
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getTrending', () => {
    it('should fetch and cache trending media', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 789, title: 'Trending Movie' },
            { id: 790, title: 'Another Trending Movie' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getTrending('movie', '1');

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.trending('movie', '1'),
        expect.any(Function),
        1800,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/trending/movie/week', {
        params: {
          page: '1',
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getShowRecommendations', () => {
    it('should fetch and cache show recommendations', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 234, name: 'Recommended Show 1' },
            { id: 235, name: 'Recommended Show 2' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getShowRecommendations(123);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.showRecommendations(123),
        expect.any(Function),
        43200,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/tv/123/recommendations', {
        params: {
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMovieRecommendations', () => {
    it('should fetch and cache movie recommendations', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 567, title: 'Recommended Movie 1' },
            { id: 568, title: 'Recommended Movie 2' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getMovieRecommendations(456);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.movieRecommendations(456),
        expect.any(Function),
        43200,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/movie/456/recommendations', {
        params: {
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSimilarShows', () => {
    it('should fetch and cache similar shows', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 345, name: 'Similar Show 1' },
            { id: 346, name: 'Similar Show 2' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getSimilarShows(123);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(TMDB_CACHE_KEYS.similarShows(123), expect.any(Function), 43200);

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/tv/123/similar', {
        params: {
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSimilarMovies', () => {
    it('should fetch and cache similar movies', async () => {
      // Mock response data
      const mockResponse = {
        data: {
          results: [
            { id: 678, title: 'Similar Movie 1' },
            { id: 679, title: 'Similar Movie 2' },
          ],
          total_results: 2,
          total_pages: 1,
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getSimilarMovies(456);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(TMDB_CACHE_KEYS.similarMovies(456), expect.any(Function), 43200);

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith('/movie/456/similar', {
        params: {
          language: 'en-US',
        },
      });

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getShowChanges', () => {
    it('should fetch and cache show changes', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-01-10';

      // Mock response data
      const mockResponse = {
        data: {
          changes: [
            { key: 'name', items: [] },
            { key: 'overview', items: [] },
          ],
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getShowChanges(123, startDate, endDate);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.showChanges(123, startDate, endDate),
        expect.any(Function),
        600,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith(`tv/123/changes?end_date=${endDate}&start_date=${startDate}`);

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMovieChanges', () => {
    it('should fetch and cache movie changes', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-01-10';

      // Mock response data
      const mockResponse = {
        data: {
          changes: [
            { key: 'title', items: [] },
            { key: 'overview', items: [] },
          ],
        },
      };

      // Setup mock implementations
      mockAxios.get.mockResolvedValueOnce(mockResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      // Call the method
      const service = getTMDBService();
      const result = await service.getMovieChanges(456, startDate, endDate);

      // Verify cache key and function were called correctly
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.movieChanges(456, startDate, endDate),
        expect.any(Function),
        600,
      );

      // Verify axios was called with correct parameters
      expect(mockAxios.get).toHaveBeenCalledWith(`movie/456/changes?end_date=${endDate}&start_date=${startDate}`);

      // Verify result
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSeasonChanges', () => {
    const seasonId = 123456;
    const startDate = '2023-01-01';
    const endDate = '2023-01-10';
    const cacheKey = TMDB_CACHE_KEYS.seasonChanges(seasonId, startDate, endDate);

    const mockChangesResponse = {
      changes: [
        {
          key: 'episode',
          items: [
            {
              id: 'abc123',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: { episode_id: 789 },
              original_value: null,
            },
          ],
        },
      ],
    };

    it('should return cached data when available', async () => {
      mockCache.getOrSet.mockImplementation(async () => {
        return mockChangesResponse;
      });

      const result = await getTMDBService().getSeasonChanges(seasonId, startDate, endDate);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(cacheKey, expect.any(Function), 600);
      expect(result).toEqual(mockChangesResponse);

      expect(axiosTMDBAPIInstance.get).not.toHaveBeenCalled();
    });

    it('should fetch and cache season changes', async () => {
      const mockAxiosResponse = { data: mockChangesResponse };

      mockAxios.get.mockResolvedValueOnce(mockAxiosResponse);
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      const service = getTMDBService();
      const result = await service.getSeasonChanges(seasonId, startDate, endDate);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        TMDB_CACHE_KEYS.seasonChanges(seasonId, startDate, endDate),
        expect.any(Function),
        600,
      );
      expect(mockAxios.get).toHaveBeenCalledWith(
        `tv/season/${seasonId}/changes?end_date=${endDate}&start_date=${startDate}`,
      );
      expect(result).toEqual(mockAxiosResponse.data);
    });
  });
});
