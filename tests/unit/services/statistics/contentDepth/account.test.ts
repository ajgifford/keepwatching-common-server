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

describe('Statistics - ContentDepth - Account', () => {
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

  describe('getAccountContentDepthStats', () => {
    it('should return account content depth stats from cache if available', async () => {
      const mockStats = {
        averageEpisodeCountPerShow: 45.0,
        averageMovieRuntime: 120.5,
        releaseYearDistribution: {
          '2020': 30,
          '2021': 44,
          '2022': 36,
        },
        contentMaturityDistribution: {
          'TV-14': 50,
          'TV-MA': 36,
          'PG-13': 24,
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountContentDepthStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_content_depth_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account content depth stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
        averageEpisodeCountPerShow: 42.5,
        averageMovieRuntime: 118.3,
        releaseYearDistribution: {
          '2020': 15,
          '2021': 22,
          '2022': 18,
        },
        contentMaturityDistribution: {
          'TV-14': 25,
          'TV-MA': 18,
          'PG-13': 12,
        },
      };
      const profile2Stats = {
        averageEpisodeCountPerShow: 45.8,
        averageMovieRuntime: 122.1,
        releaseYearDistribution: {
          '2020': 12,
          '2021': 18,
          '2022': 15,
        },
        contentMaturityDistribution: {
          'TV-14': 20,
          'TV-MA': 15,
          'PG-13': 10,
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getContentDepthStats as jest.Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountContentDepthStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_content_depth_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.averageEpisodeCountPerShow).toBe(44.15);
      expect(result.averageMovieRuntime).toBe(120.2);
    });

    it('should handle errors when getting account content depth stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get content depth stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getContentDepthStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountContentDepthStats(1)).rejects.toThrow(
        'Handled: Failed to get content depth stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountContentDepthStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountContentDepthStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
