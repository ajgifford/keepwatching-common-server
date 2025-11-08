import * as statisticsDb from '@db/statisticsDb';
import { errorService } from '@services/errorService';
import {
  ProfileStatisticsService,
  createProfileStatisticsService,
  resetProfileStatisticsService,
} from '@services/statistics/profileStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/statisticsDb');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');

describe('Statistics - Streak - Profile', () => {
  let profileStatisticsService: ProfileStatisticsService;
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    resetProfileStatisticsService();

    profileStatisticsService = createProfileStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetProfileStatisticsService();
    vi.resetModules();
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
      (statisticsDb.getWatchStreakStats as Mock).mockResolvedValue(mockStats);

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
      (statisticsDb.getWatchStreakStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getWatchStreakStats(123)).rejects.toThrow(
        'Handled: Failed to get watch streak stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWatchStreakStats(123)');
    });
  });
});
