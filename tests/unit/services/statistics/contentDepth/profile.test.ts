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

describe('Statistics - ContentDepth - Profile', () => {
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

  describe('getContentDepthStats', () => {
    it('should return content depth stats from cache if available', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDepthStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_depth_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getContentDepthStats).not.toHaveBeenCalled();
    });

    it('should fetch and return content depth stats on cache miss', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDepthStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getContentDepthStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_content_depth_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getContentDepthStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting content depth stats', async () => {
      const error = new Error('Failed to get content depth stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getContentDepthStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getContentDepthStats(123)).rejects.toThrow(
        'Handled: Failed to get content depth stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getContentDepthStats(123)');
    });
  });
});
