import * as statisticsDb from '@db/statisticsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';

jest.mock('@db/statisticsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('Statistics - Milestone - Profile', () => {
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

  describe('getMilestoneStats', () => {
    it('should return milestone stats from cache if available', async () => {
      const mockStats = {
        totalEpisodesWatched: 1500,
        totalMoviesWatched: 250,
        totalHoursWatched: 2500,
        milestones: [
          { name: '1000 Episodes', achieved: true, achievedDate: '2024-01-01' },
          { name: '2000 Episodes', achieved: false, achievedDate: null },
        ],
        recentAchievements: [
          {
            name: '1000 Episodes',
            description: 'Watched 1000 episodes',
            achievedDate: '2024-01-01',
            category: 'episodes',
          },
        ],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getMilestoneStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_milestone_stats', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);
      expect(statisticsDb.getMilestoneStats).not.toHaveBeenCalled();
    });

    it('should fetch and return milestone stats on cache miss', async () => {
      const mockStats = {
        totalEpisodesWatched: 1500,
        totalMoviesWatched: 250,
        totalHoursWatched: 2500,
        milestones: [
          { name: '1000 Episodes', achieved: true, achievedDate: '2024-01-01' },
          { name: '2000 Episodes', achieved: false, achievedDate: null },
        ],
        recentAchievements: [
          {
            name: '1000 Episodes',
            description: 'Watched 1000 episodes',
            achievedDate: '2024-01-01',
            category: 'episodes',
          },
        ],
      };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getMilestoneStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getMilestoneStats(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_milestone_stats', expect.any(Function), 1800);
      expect(statisticsDb.getMilestoneStats).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockStats);
    });

    it('should handle errors when getting milestone stats', async () => {
      const error = new Error('Failed to get milestone stats');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (statisticsDb.getMilestoneStats as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(profileStatisticsService.getMilestoneStats(123)).rejects.toThrow(
        'Handled: Failed to get milestone stats',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMilestoneStats(123)');
    });
  });
});
