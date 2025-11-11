import * as statisticsDb from '@db/statisticsDb';
import { errorService } from '@services/errorService';
import {
  ProfileStatisticsService,
  createProfileStatisticsService,
  resetProfileStatisticsService,
} from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - ContentDiscovery - Profile', () => {
  let profileStatisticsService: ProfileStatisticsService;
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    resetProfileStatisticsService();

    profileStatisticsService = createProfileStatisticsService({ cacheService: mockCacheService as any });
  });

  afterEach(() => {
    resetProfileStatisticsService();
    jest.resetModules();
  });

  describe('getContentDiscoveryStats', () => {
    it('should return content discovery stats from cache if available', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDiscoveryStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_discovery_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getContentDiscoveryStats).not.toHaveBeenCalled();
    });

    it('should fetch and return content discovery stats on cache miss', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDiscoveryStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDiscoveryStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_discovery_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getContentDiscoveryStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting content discovery stats', async () => {
      const error = new Error('Failed to get content discovery stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDiscoveryStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getContentDiscoveryStats(123)).rejects.toThrow(
        'Handled: Failed to get content discovery stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getContentDiscoveryStats(123)');
    });
  });
});
