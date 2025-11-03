import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - Streak - Profile', () => {
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

  describe('getWatchStreakStats', () => {
    it('should return watch streak stats from cache if available', async () => {
      const mockStats = {
        currentStreak: 7,
        longestStreak: 21,
        currentStreakStartDate: '2024-01-15',
        longestStreakPeriod: {
          startDate: '2023-12-01',
          endDate: '2023-12-21',
          days: 21,
        },
        streaksOver7Days: 5,
        averageStreakLength: 9.4,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getWatchStreakStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_watch_streak_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getWatchStreakStats).not.toHaveBeenCalled();
    });

    it('should fetch and return watch streak stats on cache miss', async () => {
      const mockStats = {
        currentStreak: 7,
        longestStreak: 21,
        currentStreakStartDate: '2024-01-15',
        longestStreakPeriod: {
          startDate: '2023-12-01',
          endDate: '2023-12-21',
          days: 21,
        },
        streaksOver7Days: 5,
        averageStreakLength: 9.4,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWatchStreakStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getWatchStreakStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_watch_streak_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getWatchStreakStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting watch streak stats', async () => {
      const error = new Error('Failed to get watch streak stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getWatchStreakStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getWatchStreakStats(123)).rejects.toThrow(
        'Handled: Failed to get watch streak stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWatchStreakStats(123)');
    });
  });
});
