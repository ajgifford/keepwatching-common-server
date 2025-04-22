import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Recommendations', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('getShowRecommendations', () => {
    const mockShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Test Show',
    };

    const mockTMDBResponse = {
      results: [
        {
          id: 456,
          name: 'Recommended Show 1',
          genre_ids: [18, 10765],
          first_air_date: '2022-01-01',
          overview: 'A recommended show',
          poster_path: '/poster1.jpg',
          vote_average: 8.2,
          popularity: 52.3,
          origin_country: ['US'],
          original_language: 'en',
        },
        {
          id: 789,
          name: 'Recommended Show 2',
          genre_ids: [28, 12],
          first_air_date: '2023-05-15',
          overview: 'Another recommended show',
          poster_path: '/poster2.jpg',
          vote_average: 7.5,
          popularity: 42.1,
          origin_country: ['GB'],
          original_language: 'en',
        },
      ],
    };

    const mockUserShows = [
      { tmdb_id: 123, title: 'Test Show' },
      { tmdb_id: 456, title: 'Already Favorited Show' },
    ];

    it('should return recommendations from cache when available', async () => {
      const mockRecommendations = [
        {
          id: 456,
          title: 'Recommended Show 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Recommended Show 2',
          inFavorites: false,
        },
      ];
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);
      mockCache.getOrSet.mockResolvedValue(mockRecommendations);

      const result = await service.getShowRecommendations('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('recommendations_1', expect.any(Function), 86400);
      expect(result).toEqual(mockRecommendations);
    });

    it('should fetch recommendations from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

      const mockTMDBService = {
        getShowRecommendations: jest.fn().mockResolvedValue(mockTMDBResponse),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      const result = await service.getShowRecommendations('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getShowRecommendations).toHaveBeenCalledWith(123);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowRecommendations('123', 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowRecommendations('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowRecommendations(123, 1)');
    });
  });

  describe('getSimilarShows', () => {
    const mockShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Test Show',
    };

    const mockTMDBResponse = {
      results: [
        {
          id: 456,
          name: 'Similar Show 1',
          genre_ids: [18, 10765],
          first_air_date: '2022-01-01',
          overview: 'A similar show',
          poster_path: '/poster1.jpg',
          vote_average: 8.2,
          popularity: 52.3,
          origin_country: ['US'],
          original_language: 'en',
        },
        {
          id: 789,
          name: 'Similar Show 2',
          genre_ids: [28, 12],
          first_air_date: '2023-05-15',
          overview: 'Another similar show',
          poster_path: '/poster2.jpg',
          vote_average: 7.5,
          popularity: 42.1,
          origin_country: ['GB'],
          original_language: 'en',
        },
      ],
    };

    const mockUserShows = [
      { tmdb_id: 123, title: 'Test Show' },
      { tmdb_id: 456, title: 'Already Favorited Show' },
    ];

    it('should return similar shows from cache when available', async () => {
      const mockSimilarShows = [
        {
          id: 456,
          title: 'Similar Show 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Similar Show 2',
          inFavorites: false,
        },
      ];
      mockCache.getOrSet.mockResolvedValue(mockSimilarShows);
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

      const result = await service.getSimilarShows('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('similarShows_1', expect.any(Function), 86400);
      expect(result).toEqual(mockSimilarShows);
    });

    it('should fetch similar shows from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

      const mockTMDBService = {
        getSimilarShows: jest.fn().mockResolvedValue(mockTMDBResponse),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      const result = await service.getSimilarShows('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getSimilarShows).toHaveBeenCalledWith(123);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getSimilarShows('123', 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getSimilarShows('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSimilarShows(123, 1)');
    });
  });
});
