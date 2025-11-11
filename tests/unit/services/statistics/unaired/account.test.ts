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

describe('Statistics - Unaired - Account', () => {
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

  describe('getAccountUnairedContentStats', () => {
    it('should return account unaired content stats from cache if available', async () => {
      const mockStats = {
        unairedShowCount: 10,
        unairedSeasonCount: 16,
        unairedMovieCount: 6,
        unairedEpisodeCount: 250,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountUnairedContentStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_unaired_content_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account unaired content stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        unairedShowCount: 5,
        unairedSeasonCount: 8,
        unairedMovieCount: 3,
        unairedEpisodeCount: 125,
      };
      const profile2Stats = {
        unairedShowCount: 4,
        unairedSeasonCount: 6,
        unairedMovieCount: 2,
        unairedEpisodeCount: 100,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getUnairedContentStats as jest.Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountUnairedContentStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_unaired_content_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.unairedShowCount).toBe(9);
      expect(result.unairedSeasonCount).toBe(14);
      expect(result.unairedMovieCount).toBe(5);
      expect(result.unairedEpisodeCount).toBe(225);
    });

    it('should handle errors when getting account unaired content stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get unaired content stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getUnairedContentStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountUnairedContentStats(1)).rejects.toThrow(
        'Handled: Failed to get unaired content stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountUnairedContentStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountUnairedContentStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
