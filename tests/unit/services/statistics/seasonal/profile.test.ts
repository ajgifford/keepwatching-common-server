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

describe('Statistics - Seasonal - Profile', () => {
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

  describe('getSeasonalViewingStats', () => {
    it('should return seasonal viewing stats from cache if available', async () => {
      const mockStats = {
        viewingByMonth: {
          January: 45,
          February: 38,
          March: 52,
        },
        viewingBySeason: {
          spring: 120,
          summer: 95,
          fall: 110,
          winter: 130,
        },
        peakViewingMonth: 'March',
        slowestViewingMonth: 'February',
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getSeasonalViewingStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_seasonal_viewing_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getSeasonalViewingStats).not.toHaveBeenCalled();
    });

    it('should fetch and return seasonal viewing stats on cache miss', async () => {
      const mockStats = {
        viewingByMonth: {
          January: 45,
          February: 38,
          March: 52,
        },
        viewingBySeason: {
          spring: 120,
          summer: 95,
          fall: 110,
          winter: 130,
        },
        peakViewingMonth: 'March',
        slowestViewingMonth: 'February',
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getSeasonalViewingStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getSeasonalViewingStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_seasonal_viewing_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getSeasonalViewingStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting seasonal viewing stats', async () => {
      const error = new Error('Failed to get seasonal viewing stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getSeasonalViewingStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getSeasonalViewingStats(123)).rejects.toThrow(
        'Handled: Failed to get seasonal viewing stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSeasonalViewingStats(123)');
    });
  });
});
