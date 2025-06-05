import { mockShowTMDBReferences, mockTMDBResponses } from './helpers/fixtures';
import { setupShowService } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Recommendations', () => {
  let service: ReturnType<typeof setupShowService>['service'];
  let mockCache: ReturnType<typeof setupShowService>['mockCache'];

  beforeEach(() => {
    const setup = setupShowService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('getShowRecommendations', () => {
    const mockShowTMDBReference = mockShowTMDBReferences[0];
    const mockUserShows = [
      { tmdbId: 123, title: 'Test Show' },
      { tmdbId: 456, title: 'Already Favorited Show' },
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

      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShowTMDBReference);
      mockCache.getOrSet.mockResolvedValue(mockRecommendations);

      const result = await service.getShowRecommendations(123, 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('recommendations_1', expect.any(Function), 86400);
      expect(result).toEqual(mockRecommendations);
    });

    it('should fetch recommendations from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShowTMDBReference);
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());

      const mockTMDBService = getTMDBService() as jest.Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getShowRecommendations.mockResolvedValue(mockTMDBResponses.showRecommendations);

      const result = await service.getShowRecommendations(123, 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockTMDBService.getShowRecommendations).toHaveBeenCalledWith(mockShowTMDBReference.tmdbId);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith(123);

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

      await expect(service.getShowRecommendations(123, 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowRecommendations(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowRecommendations(123, 1)');
    });
  });

  describe('getSimilarShows', () => {
    const mockShowTMDBReference = mockShowTMDBReferences[0];
    const mockUserShows = [
      { tmdbId: 123, title: 'Test Show' },
      { tmdbId: 456, title: 'Already Favorited Show' },
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

      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShowTMDBReference);
      mockCache.getOrSet.mockResolvedValue(mockSimilarShows);

      const result = await service.getSimilarShows(123, 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('similar_1', expect.any(Function), 86400);
      expect(result).toEqual(mockSimilarShows);
    });

    it('should fetch similar shows from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShowTMDBReference);
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());

      const mockTMDBService = getTMDBService() as jest.Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getSimilarShows.mockResolvedValue(mockTMDBResponses.similarShows);

      const result = await service.getSimilarShows(123, 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockTMDBService.getSimilarShows).toHaveBeenCalledWith(mockShowTMDBReference.tmdbId);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith(123);

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

      await expect(service.getSimilarShows(123, 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getSimilarShows(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSimilarShows(123, 1)');
    });
  });
});
