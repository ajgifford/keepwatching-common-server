import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - Binge - Profile', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(profileStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getBingeWatchingStats', () => {
    it('should return binge watching stats from cache if available', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getBingeWatchingStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_binge_watching_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getBingeWatchingStats).not.toHaveBeenCalled();
    });

    it('should fetch and return binge watching stats on cache miss', async () => {
      const mockStats = {
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

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getBingeWatchingStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getBingeWatchingStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_binge_watching_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getBingeWatchingStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting binge watching stats', async () => {
      const error = new Error('Failed to get binge watching stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getBingeWatchingStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getBingeWatchingStats(123)).rejects.toThrow(
        'Handled: Failed to get binge watching stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getBingeWatchingStats(123)');
    });
  });
});
