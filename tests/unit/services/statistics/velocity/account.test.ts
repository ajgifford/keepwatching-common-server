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

describe('Statistics - Velocity - Account', () => {
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

  describe('getAccountWatchingVelocity', () => {
    it('should return account watching velocity statistics from cache if available', async () => {
      const mockStats = {
        episodesPerWeek: 12,
        episodesPerMonth: 47,
        averageEpisodesPerDay: 2,
        mostActiveDay: 'Sunday',
        mostActiveHour: 20,
        velocityTrend: 'increasing',
      };

      mockCacheService.getOrSet.mockResolvedValueOnce(mockStats);

      const result = await accountStatisticsService.getAccountWatchingVelocity(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_velocity_30', expect.any(Function), 3600);
      expect(result).toEqual(mockStats);

      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
      expect(profileStatisticsService.getWatchingVelocity).not.toHaveBeenCalled();
    });

    it('should fetch and return account watching velocity statistics on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        episodesPerWeek: 12,
        episodesPerMonth: 47,
        averageEpisodesPerDay: 2,
        mostActiveDay: 'Sunday',
        mostActiveHour: 20,
        velocityTrend: 'increasing',
      };
      const profile2Stats = {
        episodesPerWeek: 7,
        episodesPerMonth: 33,
        averageEpisodesPerDay: 1,
        mostActiveDay: 'Saturday',
        mostActiveHour: 18,
        velocityTrend: 'decreasing',
      };
      const expectedAccountStats = {
        averageEpisodesPerDay: 1.59,
        episodesPerMonth: 41.23,
        episodesPerWeek: 9.94,
        mostActiveDay: 'Sunday',
        mostActiveHour: 20,
        velocityTrend: 'increasing',
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValueOnce(profiles);
      (profileStatisticsService.getWatchingVelocity as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountWatchingVelocity(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_1_velocity_30', expect.any(Function), 3600);
      expect(result).toEqual(expectedAccountStats);
    });

    it('should handle errors when getting account watching velocity statistics', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValueOnce(profiles);

      const error = new Error('Failed to get watching velocity statistics');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getWatchingVelocity as Mock).mockRejectedValueOnce(error);
      (errorService.handleError as Mock).mockImplementationOnce((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountWatchingVelocity(1)).rejects.toThrow(
        'Handled: Failed to get watching velocity statistics',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountWatchingVelocity(1, 30)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValueOnce(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementationOnce((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountWatchingVelocity(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
