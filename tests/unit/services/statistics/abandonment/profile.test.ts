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

describe('Statistics - Abandonment - Profile', () => {
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

  describe('getAbandonmentRiskStats', () => {
    it('should return abandonment risk stats from cache if available', async () => {
      const mockStats = {
        showsAtRisk: [
          { showId: 1, showTitle: 'The Wire', daysSinceLastWatch: 120, progressPercentage: 35 },
          { showId: 2, showTitle: 'Sopranos', daysSinceLastWatch: 90, progressPercentage: 50 },
        ],
        showAbandonmentRate: 15.5,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getAbandonmentRiskStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_abandonment_risk_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getAbandonmentRiskStats).not.toHaveBeenCalled();
    });

    it('should fetch and return abandonment risk stats on cache miss', async () => {
      const mockStats = {
        showsAtRisk: [
          { showId: 1, showTitle: 'The Wire', daysSinceLastWatch: 120, progressPercentage: 35 },
          { showId: 2, showTitle: 'Sopranos', daysSinceLastWatch: 90, progressPercentage: 50 },
        ],
        showAbandonmentRate: 15.5,
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getAbandonmentRiskStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getAbandonmentRiskStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_abandonment_risk_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getAbandonmentRiskStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting abandonment risk stats', async () => {
      const error = new Error('Failed to get abandonment risk stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getAbandonmentRiskStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getAbandonmentRiskStats(123)).rejects.toThrow(
        'Handled: Failed to get abandonment risk stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAbandonmentRiskStats(123)');
    });
  });
});
