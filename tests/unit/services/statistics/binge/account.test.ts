import { BadRequestError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import {
  AccountStatisticsService,
  createAccountStatisticsService,
  resetAccountStatisticsService,
} from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@services/profileService');
vi.mock('@services/statistics/profileStatisticsService');

describe('Statistics - Binge - Account', () => {
  let accountStatisticsService: AccountStatisticsService;
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    resetAccountStatisticsService();

    accountStatisticsService = createAccountStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetAccountStatisticsService();
    vi.resetModules();
  });

  describe('getAccountBingeWatchingStats', () => {
    it('should return account binge watching stats from cache if available', async () => {
      const mockStats = {
        bingeSessionCount: 30,
        averageEpisodesPerBinge: 5.5,
        longestBingeSession: {
          profileName: 'Profile 1',
          showTitle: 'Breaking Bad',
          episodeCount: 12,
          date: '2024-01-15',
        },
        topBingedShows: [
          { showId: 1, showTitle: 'Breaking Bad', bingeSessionCount: 8 },
          { showId: 2, showTitle: 'Game of Thrones', bingeSessionCount: 5 },
        ],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountBingeWatchingStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_binge_watching_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account binge watching stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        bingeSessionCount: 15,
        averageEpisodesPerBinge: 5.2,
        longestBingeSession: {
          showTitle: 'Breaking Bad',
          episodeCount: 12,
          date: '2024-01-15',
        },
        topBingedShows: [
          { showId: 1, showTitle: 'Breaking Bad', bingeSessionCount: 5 },
          { showId: 2, showTitle: 'Game of Thrones', bingeSessionCount: 3 },
        ],
      };
      const profile2Stats = {
        bingeSessionCount: 10,
        averageEpisodesPerBinge: 4.8,
        longestBingeSession: {
          showTitle: 'The Wire',
          episodeCount: 8,
          date: '2024-01-10',
        },
        topBingedShows: [
          { showId: 1, showTitle: 'Breaking Bad', bingeSessionCount: 3 },
          { showId: 3, showTitle: 'Sopranos', bingeSessionCount: 2 },
        ],
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getBingeWatchingStats as Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountBingeWatchingStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_binge_watching_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.bingeSessionCount).toBe(25);
      expect(result.averageEpisodesPerBinge).toBe(5.04);
      expect(result.longestBingeSession.episodeCount).toBe(12);
      expect(result.topBingedShows).toHaveLength(3);
    });

    it('should handle errors when getting account binge watching stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get binge watching stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getBingeWatchingStats as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountBingeWatchingStats(1)).rejects.toThrow(
        'Handled: Failed to get binge watching stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountBingeWatchingStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountBingeWatchingStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
