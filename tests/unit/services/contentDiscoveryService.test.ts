import { MediaType } from '@ajgifford/keepwatching-types';
import { CacheService } from '@services/cacheService';
import { contentDiscoveryService } from '@services/contentDiscoveryService';
import { errorService } from '@services/errorService';
import { StreamingAvailabilityService } from '@services/streamingAvailabilityService';
import { getTMDBService } from '@services/tmdbService';
import { getStreamingPremieredDate, getTMDBItemName, getTMDBPremieredDate, stripPrefix } from '@utils/contentUtility';
import { generateGenreArrayFromIds } from '@utils/genreUtility';
import { buildTMDBImagePath } from '@utils/imageUtility';

jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/streamingAvailabilityService');
jest.mock('@services/tmdbService');
jest.mock('@utils/genreUtility');
jest.mock('@utils/imageUtility');
jest.mock('@utils/contentUtility');

describe('ContentDiscoveryService', () => {
  let mockCacheService: jest.Mocked<CacheService>;
  let mockStreamingAvailabilityClient: any;
  let mockTMDBService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Cache Mock Setup
    mockCacheService = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateAccount: jest.fn(),
      invalidateProfile: jest.fn(),
      invalidateProfileStatistics: jest.fn(),
      invalidateAccountStatistics: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      keys: jest.fn(),
    } as any;

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    // Streaming Availability Mock Setup
    mockStreamingAvailabilityClient = {
      showsApi: {
        getTopShows: jest.fn(),
      },
      changesApi: {
        getChanges: jest.fn(),
      },
    };

    const mockStreamingService = {
      getClient: jest.fn().mockReturnValue(mockStreamingAvailabilityClient),
    };

    jest.spyOn(StreamingAvailabilityService, 'getInstance').mockReturnValue(mockStreamingService as any);

    // TMDB Service Mock Setup
    mockTMDBService = {
      getTrending: jest.fn(),
      searchShows: jest.fn(),
      searchMovies: jest.fn(),
    };

    (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

    // Utility Mocks
    (stripPrefix as jest.Mock).mockImplementation((val) => val.replace(/^(tv\/|movie\/)/, ''));
    (getStreamingPremieredDate as jest.Mock).mockReturnValue('2023-01-01');
    (getTMDBPremieredDate as jest.Mock).mockReturnValue('2023-01-01');
    (getTMDBItemName as jest.Mock).mockImplementation((type, result) =>
      type === 'movie' ? result.title : result.name,
    );
    (generateGenreArrayFromIds as jest.Mock).mockReturnValue(['Action', 'Drama']);
    (buildTMDBImagePath as jest.Mock).mockReturnValue('https://image.tmdb.org/t/p/w185/poster.jpg');

    // Error Service Mock
    (errorService.handleError as jest.Mock).mockImplementation((error, context) => {
      const handledError = new Error(`Handled: ${error.message} in context ${context}`);
      return handledError; // Return the error instead of throwing it
    });

    // Attach mocks to contentDiscoveryService
    Object.defineProperty(contentDiscoveryService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    Object.defineProperty(contentDiscoveryService, 'streamingAvailability', {
      value: mockStreamingService,
      writable: true,
    });
  });

  describe('discoverTopContent', () => {
    it('should return top content from cache when available', async () => {
      const mockTopContent = {
        message: 'Found top series for netflix',
        results: [{ id: '123', title: 'Test Show' }],
        total_results: 1,
        total_pages: 1,
        current_page: 1,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockTopContent);

      const result = await contentDiscoveryService.discoverTopContent('series', 'netflix');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('discover_top_series_netflix', expect.any(Function));
      expect(result).toEqual(mockTopContent);
      expect(mockStreamingAvailabilityClient.showsApi.getTopShows).not.toHaveBeenCalled();
    });

    it('should fetch and return top content on cache miss', async () => {
      const mockStreamingResponse = [
        {
          tmdbId: 'tv/123',
          title: 'Top Show',
          genres: [{ name: 'Drama' }, { name: 'Thriller' }],
          overview: 'A great show',
          imageSet: { verticalPoster: { w240: 'poster.jpg' } },
          rating: 8.5,
          firstAirYear: '2023',
        },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockStreamingAvailabilityClient.showsApi.getTopShows.mockResolvedValue(mockStreamingResponse);

      const result = await contentDiscoveryService.discoverTopContent('series', 'netflix');

      expect(mockStreamingAvailabilityClient.showsApi.getTopShows).toHaveBeenCalledWith({
        country: 'us',
        service: 'netflix',
        showType: 'series',
      });

      expect(result).toEqual({
        message: 'Found top series for netflix',
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '123',
            title: 'Top Show',
            genres: ['Drama', 'Thriller'],
            summary: 'A great show',
            image: 'poster.jpg',
            rating: 8.5,
          }),
        ]),
        totalResults: 1,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  describe('discoverChangesContent', () => {
    it('should return changes content from cache when available', async () => {
      const mockChangesContent = {
        message: 'Found new series for netflix',
        results: [{ id: '456', title: 'New Show' }],
        total_results: 1,
        total_pages: 1,
        current_page: 1,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockChangesContent);

      const result = await contentDiscoveryService.discoverChangesContent('series', 'netflix', 'new');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'discover_changes_series_netflix_new',
        expect.any(Function),
      );
      expect(result).toEqual(mockChangesContent);
      expect(mockStreamingAvailabilityClient.changesApi.getChanges).not.toHaveBeenCalled();
    });

    it('should fetch and return changes content on cache miss', async () => {
      const mockChangesResponse = {
        shows: {
          'tv/456': {
            tmdbId: 'tv/456',
            title: 'New Show',
            genres: [{ name: 'Comedy' }],
            overview: 'A funny show',
            imageSet: { verticalPoster: { w240: 'poster.jpg' } },
            rating: 7.5,
            firstAirYear: '2023',
          },
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockStreamingAvailabilityClient.changesApi.getChanges.mockResolvedValue(mockChangesResponse);

      const result = await contentDiscoveryService.discoverChangesContent('series', 'netflix', 'new');

      expect(mockStreamingAvailabilityClient.changesApi.getChanges).toHaveBeenCalledWith({
        changeType: 'new',
        itemType: 'show',
        country: 'us',
        catalogs: ['netflix'],
        showType: 'series',
        orderDirection: 'asc',
        includeUnknownDates: false,
      });

      expect(result).toEqual({
        message: 'Found new series for netflix',
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '456',
            title: 'New Show',
            genres: ['Comedy'],
            summary: 'A funny show',
            image: 'poster.jpg',
            rating: 7.5,
          }),
        ]),
        totalResults: 1,
        totalPages: 1,
        currentPage: 1,
      });
    });

    it('should handle empty shows data in changes response', async () => {
      const mockChangesResponse = { shows: {} };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockStreamingAvailabilityClient.changesApi.getChanges.mockResolvedValue(mockChangesResponse);

      const result = await contentDiscoveryService.discoverChangesContent('series', 'netflix', 'new');

      expect(result).toEqual({
        message: 'Found new series for netflix',
        results: [],
        totalResults: 0,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  describe('discoverTrendingContent', () => {
    it('should return trending content from cache when available', async () => {
      const mockTrendingContent = {
        message: 'Found trending movie',
        results: [{ id: '789', title: 'Trending Movie' }],
        total_results: 20,
        total_pages: 2,
        current_page: 1,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockTrendingContent);

      const result = await contentDiscoveryService.discoverTrendingContent('movie', 1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('discover_trending_movie_1', expect.any(Function));
      expect(result).toEqual(mockTrendingContent);
      expect(mockTMDBService.getTrending).not.toHaveBeenCalled();
    });

    it('should fetch and return trending content on cache miss', async () => {
      const mockTMDBResponse = {
        results: [
          {
            id: 789,
            media_type: 'movie',
            title: 'Trending Movie',
            genre_ids: [28, 18],
            overview: 'A trending movie',
            poster_path: '/poster.jpg',
            vote_average: 8.0,
            popularity: 1500,
            original_language: 'en',
            release_date: '2023-01-01',
          },
        ],
        total_results: 20,
        total_pages: 2,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getTrending.mockResolvedValue(mockTMDBResponse);

      const result = await contentDiscoveryService.discoverTrendingContent('movie', 1);

      expect(mockTMDBService.getTrending).toHaveBeenCalledWith('movie', '1');

      expect(result).toEqual({
        message: 'Found trending movie',
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '789',
            title: 'Trending Movie',
            genres: ['Action', 'Drama'],
            summary: 'A trending movie',
            image: 'https://image.tmdb.org/t/p/w185/poster.jpg',
            premiered: '2023-01-01',
            rating: 8.0,
            popularity: 1500,
          }),
        ]),
        totalResults: 20,
        totalPages: 2,
        currentPage: 1,
      });
    });

    it('should filter TV shows by origin country', async () => {
      const mockTMDBResponse = {
        results: [
          {
            id: 789,
            name: 'US Show',
            media_type: 'tv',
            origin_country: ['US'],
            genre_ids: [28, 18],
            overview: 'A US show',
            poster_path: '/poster.jpg',
            vote_average: 8.0,
            popularity: 1500,
            first_air_date: '2023-01-01',
          },
          {
            id: 790,
            name: 'Foreign Show',
            media_type: 'tv',
            origin_country: ['UK'],
            genre_ids: [28, 18],
            overview: 'A non-US show',
            poster_path: '/poster2.jpg',
            vote_average: 7.5,
            popularity: 1200,
            first_air_date: '2023-02-01',
          },
        ],
        total_results: 20,
        total_pages: 2,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getTrending.mockResolvedValue(mockTMDBResponse);

      const result = await contentDiscoveryService.discoverTrendingContent('series', 1);

      expect(mockTMDBService.getTrending).toHaveBeenCalledWith('tv', '1');

      // Should only include the US show
      expect(result.results.length).toBe(1);
      expect(result.results[0].title).toBe('US Show');
    });
  });

  describe('searchMedia', () => {
    it('should return search results from cache when available', async () => {
      const mockSearchResults = {
        results: [{ id: 123, title: 'Search Result' }],
        total_pages: 2,
        total_results: 20,
        current_page: 1,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockSearchResults);

      const result = await contentDiscoveryService.searchMedia(MediaType.SHOW, 'test query', '2023', 1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('tv_search_test query_2023_1', expect.any(Function));
      expect(result).toEqual(mockSearchResults);
      expect(mockTMDBService.searchShows).not.toHaveBeenCalled();
    });

    it('should search for TV shows on cache miss', async () => {
      const mockTMDBResponse = {
        results: [
          {
            id: 123,
            name: 'Test Show',
            genre_ids: [28, 18],
            overview: 'A test show',
            poster_path: '/poster.jpg',
            vote_average: 8.5,
            popularity: 1500,
            first_air_date: '2023-01-01',
          },
        ],
        total_results: 20,
        total_pages: 2,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.searchShows.mockResolvedValue(mockTMDBResponse);

      const result = await contentDiscoveryService.searchMedia(MediaType.SHOW, 'test query', '2023', 1);

      expect(mockTMDBService.searchShows).toHaveBeenCalledWith('test query', 1, '2023');

      expect(result).toEqual({
        message: `Search results for 'test query' of type: tv`,
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '123',
            title: 'Test Show',
            genres: ['Action', 'Drama'],
            summary: 'A test show',
            image: '/poster.jpg',
            premiered: '2023-01-01',
            rating: 8.5,
            popularity: 1500,
          }),
        ]),
        totalPages: 2,
        totalResults: 20,
        currentPage: 1,
      });
    });

    it('should search for movies on cache miss', async () => {
      const mockTMDBResponse = {
        results: [
          {
            id: 456,
            title: 'Test Movie',
            genre_ids: [28, 18],
            overview: 'A test movie',
            poster_path: '/poster.jpg',
            vote_average: 7.5,
            popularity: 1200,
            release_date: '2023-01-01',
          },
        ],
        total_results: 15,
        total_pages: 2,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.searchMovies.mockResolvedValue(mockTMDBResponse);

      const result = await contentDiscoveryService.searchMedia(MediaType.MOVIE, 'test query', undefined, 1);

      expect(mockTMDBService.searchMovies).toHaveBeenCalledWith('test query', 1, undefined);

      expect(result).toEqual({
        message: `Search results for 'test query' of type: movie`,
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '456',
            title: 'Test Movie',
            genres: ['Action', 'Drama'],
            summary: 'A test movie',
            image: '/poster.jpg',
            premiered: '2023-01-01',
            rating: 7.5,
            popularity: 1200,
          }),
        ]),
        totalPages: 2,
        totalResults: 15,
        currentPage: 1,
      });
    });
  });
});
