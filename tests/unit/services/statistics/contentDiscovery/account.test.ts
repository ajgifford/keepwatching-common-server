import { BadRequestError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import {
  AccountStatisticsService,
  createAccountStatisticsService,
  resetAccountStatisticsService,
} from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');
jest.mock('@services/profileService');
jest.mock('@services/statistics/profileStatisticsService');

describe('Statistics - ContentDiscovery - Account', () => {
  let accountStatisticsService: AccountStatisticsService;
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resetAccountStatisticsService();

    accountStatisticsService = createAccountStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetAccountStatisticsService();
    jest.resetModules();
  });

  describe('getAccountContentDiscoveryStats', () => {
    it('should return account content discovery stats from cache if available', async () => {
      const mockStats = {
        daysSinceLastContentAdded: 3,
        contentAdditionRate: {
          showsPerMonth: 5.5,
          moviesPerMonth: 3.8,
        },
        watchToAddRatio: {
          shows: 0.78,
          movies: 0.88,
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountContentDiscoveryStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_content_discovery_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account content discovery stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        daysSinceLastContentAdded: 5,
        contentAdditionRate: {
          showsPerMonth: 3.5,
          moviesPerMonth: 2.2,
        },
        watchToAddRatio: {
          shows: 0.75,
          movies: 0.85,
        },
      };
      const profile2Stats = {
        daysSinceLastContentAdded: 3,
        contentAdditionRate: {
          showsPerMonth: 4.2,
          moviesPerMonth: 3.0,
        },
        watchToAddRatio: {
          shows: 0.8,
          movies: 0.9,
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getContentDiscoveryStats as jest.Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountContentDiscoveryStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_content_discovery_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.daysSinceLastContentAdded).toBe(3);
      expect(result.contentAdditionRate.showsPerMonth).toBe(3.85);
      expect(result.contentAdditionRate.moviesPerMonth).toBe(2.6);
    });

    it('should handle errors when getting account content discovery stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get content discovery stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getContentDiscoveryStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountContentDiscoveryStats(1)).rejects.toThrow(
        'Handled: Failed to get content discovery stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountContentDiscoveryStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountContentDiscoveryStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
