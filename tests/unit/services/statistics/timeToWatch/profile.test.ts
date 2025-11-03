import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - TimeToWatch - Profile', () => {
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

  describe('getTimeToWatchStats', () => {
    it('should return time to watch stats from cache if available', async () => {
      const mockStats = {
        averageDaysToStartShow: 3.5,
        averageDaysToCompleteShow: 45.2,
        fastestCompletions: [
          { showId: 1, showTitle: 'Breaking Bad', daysToComplete: 7 },
          { showId: 2, showTitle: 'The Wire', daysToComplete: 10 },
        ],
        backlogAging: {
          unwatchedOver30Days: 5,
          unwatchedOver90Days: 2,
          unwatchedOver365Days: 1,
        },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getTimeToWatchStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_time_to_watch_stats',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getTimeToWatchStats).not.toHaveBeenCalled();
    });

    it('should fetch and return time to watch stats on cache miss', async () => {
      const mockStats = {
        averageDaysToStartShow: 3.5,
        averageDaysToCompleteShow: 45.2,
        fastestCompletions: [
          { showId: 1, showTitle: 'Breaking Bad', daysToComplete: 7 },
          { showId: 2, showTitle: 'The Wire', daysToComplete: 10 },
        ],
        backlogAging: {
          unwatchedOver30Days: 5,
          unwatchedOver90Days: 2,
          unwatchedOver365Days: 1,
        },
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getTimeToWatchStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getTimeToWatchStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'profile_123_time_to_watch_stats',
        expect.any(Function),
        1800,
      );
      expect(statisticsDb.getTimeToWatchStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting time to watch stats', async () => {
      const error = new Error('Failed to get time to watch stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getTimeToWatchStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getTimeToWatchStats(123)).rejects.toThrow(
        'Handled: Failed to get time to watch stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getTimeToWatchStats(123)');
    });
  });
});
