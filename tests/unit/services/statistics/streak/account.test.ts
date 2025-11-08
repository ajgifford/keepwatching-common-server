import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import { accountStatisticsService } from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@services/profileService');
vi.mock('@services/statistics/profileStatisticsService');

describe('Statistics - Streak - Account', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(accountStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getAccountWatchStreakStats', () => {
    it('should return account watch streak stats from cache if available', async () => {
      const mockStats = {
        currentStreak: 15,
        longestStreak: 30,
        currentStreakStartDate: '2024-01-15',
        longestStreakPeriod: {
          startDate: '2023-12-01',
          endDate: '2023-12-30',
          days: 30,
        },
        streaksOver7Days: 8,
        averageStreakLength: 10.5,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountWatchStreakStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_watch_streak_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account watch streak stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        currentStreak: 15,
        longestStreak: 30,
        currentStreakStartDate: '2024-01-15',
        longestStreakPeriod: {
          startDate: '2023-12-01',
          endDate: '2023-12-30',
          days: 30,
        },
        streaksOver7Days: 5,
        averageStreakLength: 10.5,
      };
      const profile2Stats = {
        currentStreak: 10,
        longestStreak: 20,
        currentStreakStartDate: '2024-01-10',
        longestStreakPeriod: {
          startDate: '2023-11-01',
          endDate: '2023-11-20',
          days: 20,
        },
        streaksOver7Days: 3,
        averageStreakLength: 8.2,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getWatchStreakStats as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountWatchStreakStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_watch_streak_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.currentStreak).toBe(15);
      expect(result.longestStreak).toBe(30);
      expect(result.streaksOver7Days).toBe(8);
    });

    it('should handle errors when getting account watch streak stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get watch streak stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getWatchStreakStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountWatchStreakStats(1)).rejects.toThrow(
        'Handled: Failed to get watch streak stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountWatchStreakStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountWatchStreakStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
