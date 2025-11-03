import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import { accountStatisticsService } from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');
jest.mock('@services/profileService');
jest.mock('@services/statistics/profileStatisticsService');

describe('Statistics - Seasonal - Account', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(accountStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getAccountSeasonalViewingStats', () => {
    it('should return account seasonal viewing stats from cache if available', async () => {
      const mockStats = {
        viewingByMonth: {
          January: 90,
          February: 76,
          March: 104,
        },
        viewingBySeason: {
          spring: 240,
          summer: 190,
          fall: 220,
          winter: 260,
        },
        peakViewingMonth: 'March',
        slowestViewingMonth: 'February',
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountSeasonalViewingStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_seasonal_viewing_stats',
        expect.any(Function),
        3600,
      );
      expect(result).toEqual(mockStats);
      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and return account seasonal viewing stats on cache miss', async () => {
      const profiles = [
        { id: 101, name: 'Profile 1' },
        { id: 102, name: 'Profile 2' },
      ];
      const profile1Stats = {
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
      const profile2Stats = {
        viewingByMonth: {
          January: 40,
          February: 35,
          March: 48,
        },
        viewingBySeason: {
          spring: 110,
          summer: 85,
          fall: 100,
          winter: 120,
        },
        peakViewingMonth: 'March',
        slowestViewingMonth: 'February',
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);
      (profileStatisticsService.getSeasonalViewingStats as jest.Mock).mockImplementation((id) => {
        if (id === 101) return profile1Stats;
        else if (id === 102) return profile2Stats;
        else return {};
      });

      const result = await accountStatisticsService.getAccountSeasonalViewingStats(1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'account_1_seasonal_viewing_stats',
        expect.any(Function),
        3600,
      );
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
      expect(result.viewingByMonth.January).toBe(85);
      expect(result.viewingBySeason.spring).toBe(230);
    });

    it('should handle errors when getting account seasonal viewing stats', async () => {
      const profiles = [{ id: 101, name: 'Profile 1' }];
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(profiles);

      const error = new Error('Failed to get seasonal viewing stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileStatisticsService.getSeasonalViewingStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountSeasonalViewingStats(1)).rejects.toThrow(
        'Handled: Failed to get seasonal viewing stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountSeasonalViewingStats(1)');
    });

    it('should throw an error when an account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(undefined);
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountSeasonalViewingStats(1)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(1);
    });
  });
});
