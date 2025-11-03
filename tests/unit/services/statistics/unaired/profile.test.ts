import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - Unaired - Profile', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(profileStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getUnairedContentStats', () => {
    it('should return unaired content stats from cache if available', async () => {
      const mockStats = {
        unairedShowCount: 5,
        unairedSeasonCount: 8,
        unairedMovieCount: 3,
        unairedEpisodeCount: 125,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getUnairedContentStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_unaired_content_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getUnairedContentStats).not.toHaveBeenCalled();
    });

    it('should fetch and return unaired content stats on cache miss', async () => {
      const mockStats = {
        unairedShowCount: 5,
        unairedSeasonCount: 8,
        unairedMovieCount: 3,
        unairedEpisodeCount: 125,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getUnairedContentStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getUnairedContentStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_unaired_content_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getUnairedContentStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting unaired content stats', async () => {
      const error = new Error('Failed to get unaired content stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getUnairedContentStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getUnairedContentStats(123)).rejects.toThrow(
        'Handled: Failed to get unaired content stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getUnairedContentStats(123)');
    });
  });
});
