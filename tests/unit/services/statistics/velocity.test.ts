import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { statisticsService } from '@services/statisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('statisticsService', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(statisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getWatchingVelocity', () => {
    it('should return profile watching velocity statistics from cache if available', async () => {
      const mockStats = {
        episodesPerWeek: 12,
        episodesPerMonth: 47,
        averageEpisodesPerDay: 2,
        mostActiveDay: 'Sunday',
        mostActiveHour: 20,
        velocityTrend: 'increasing',
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await statisticsService.getWatchingVelocity(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_velocity_30', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);

      expect(statisticsDb.getWatchingVelocityData).not.toHaveBeenCalled();
    });

    it('should fetch and return profile watching velocity statistics on cache miss', async () => {
      const mockStats = {
        episodesPerWeek: 12,
        episodesPerMonth: 47,
        averageEpisodesPerDay: 2,
        mostActiveDay: 'Sunday',
        mostActiveHour: 20,
        velocityTrend: 'increasing',
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWatchingVelocityData as jest.Mock).mockResolvedValue(mockStats);

      const result = await statisticsService.getWatchingVelocity(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_velocity_30', expect.any(Function), 1800);
      expect(statisticsDb.getWatchingVelocityData).toHaveBeenCalledWith(123, 30);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting profile watching velocity statistics', async () => {
      const error = new Error('Failed to get watching velocity statistics');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWatchingVelocityData as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(statisticsService.getWatchingVelocity(123)).rejects.toThrow(
        'Handled: Failed to get watching velocity statistics',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWatchingVelocity(123, 30)');
    });
  });
});
