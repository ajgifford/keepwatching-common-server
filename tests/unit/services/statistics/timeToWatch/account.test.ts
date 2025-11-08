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

describe('Statistics - TimeToWatch - Account', () => {
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

  describe('getAccountTimeToWatchStats', () => {
    it('should return account time to watch stats from cache if available', async () => {
      const mockStats = {
        averageDaysToStartShow: 4.2,
        averageDaysToCompleteShow: 50.5,
        fastestCompletions: [
          { profileName: 'Profile 1', showId: 1, showTitle: 'Breaking Bad', daysToComplete: 7 },
          { profileName: 'Profile 2', showId: 2, showTitle: 'The Wire', daysToComplete: 10 },
        ],
        backlogAging: {
          unwatchedOver30Days: 8,
          unwatchedOver90Days: 3,
          unwatchedOver365Days: 1,
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountTimeToWatchStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_time_to_watch_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account time to watch stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        averageDaysToStartShow: 3.5,
        averageDaysToCompleteShow: 45.2,
        fastestCompletions: [{ showId: 1, showTitle: 'Breaking Bad', daysToComplete: 7 }],
        backlogAging: {
          unwatchedOver30Days: 5,
          unwatchedOver90Days: 2,
          unwatchedOver365Days: 1,
        },
      };
      const profile2Stats = {
        averageDaysToStartShow: 4.8,
        averageDaysToCompleteShow: 55.8,
        fastestCompletions: [{ showId: 2, showTitle: 'The Wire', daysToComplete: 10 }],
        backlogAging: {
          unwatchedOver30Days: 3,
          unwatchedOver90Days: 1,
          unwatchedOver365Days: 0,
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getTimeToWatchStats as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountTimeToWatchStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_time_to_watch_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.averageDaysToStartShow).toBe(4.15);
      expect(result.averageDaysToCompleteShow).toBe(50.5);
      expect(result.fastestCompletions).toHaveLength(2);
    });

    it('should handle errors when getting account time to watch stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get time to watch stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getTimeToWatchStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountTimeToWatchStats(1)).rejects.toThrow(
        'Handled: Failed to get time to watch stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountTimeToWatchStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountTimeToWatchStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
