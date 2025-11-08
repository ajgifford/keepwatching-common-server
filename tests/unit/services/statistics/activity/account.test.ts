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

describe('Statistics - Activity - Account', () => {
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

  describe('getAccountActivityTimeline', () => {
    it('should return account activity timeline from cache if available', async () => {
      const mockTimeline = {
        dailyActivity: [{ date: '2024-01-01', episodesWatched: 10, showsWatched: 3 }],
        weeklyActivity: [{ weekStart: '2024-01-01', episodesWatched: 50 }],
        monthlyActivity: [{ month: '2024-01', episodesWatched: 200, moviesWatched: 15 }],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockTimeline);

      const result = await accountStatisticsService.getAccountActivityTimeline(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_activity_timeline', expect.any(Function), 3600);
      expect(result).toEqual(mockTimeline);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account activity timeline on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Timeline = {
        dailyActivity: [{ date: '2024-01-01', episodesWatched: 5, showsWatched: 2 }],
        weeklyActivity: [{ weekStart: '2024-01-01', episodesWatched: 25 }],
        monthlyActivity: [{ month: '2024-01', episodesWatched: 100, moviesWatched: 8 }],
      };
      const profile2Timeline = {
        dailyActivity: [{ date: '2024-01-01', episodesWatched: 3, showsWatched: 1 }],
        weeklyActivity: [{ weekStart: '2024-01-01', episodesWatched: 15 }],
        monthlyActivity: [{ month: '2024-01', episodesWatched: 60, moviesWatched: 5 }],
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getActivityTimeline as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Timeline;
        else if (id === 102) return profile2Timeline;
        else return {};
      });

      const result = await accountStatisticsService.getAccountActivityTimeline(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_activity_timeline', expect.any(Function), 3600);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(profileStatisticsService.getActivityTimeline).toHaveBeenCalledTimes(2);
      expect(result.dailyActivity).toHaveLength(1);
      expect(result.dailyActivity[0].episodesWatched).toBe(8);
      expect(result.monthlyActivity[0].episodesWatched).toBe(160);
      expect(result.monthlyActivity[0].moviesWatched).toBe(13);
    });

    it('should handle errors when getting account activity timeline', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get activity timeline');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getActivityTimeline as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountActivityTimeline(1)).rejects.toThrow(
        'Handled: Failed to get activity timeline',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountActivityTimeline(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountActivityTimeline(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
