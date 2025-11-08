import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import { accountStatisticsService } from '@services/statistics/accountStatisticsService';
import { profileStatisticsService } from '@services/statistics/profileStatisticsService';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/profileService');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@services/statistics/profileStatisticsService');

describe('statisticsService', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(accountStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getAccountStatistics', () => {
    const mockProfiles = [
      { id: 1, name: 'Profile 1' },
      { id: 2, name: 'Profile 2' },
    ];

    const mockProfileStats = [
      {
        profileId: 1,
        profileName: 'Profile 1',
        showStatistics: {
          total: 10,
          watchStatusCounts: { watched: 5, watching: 3, notWatched: 2 },
          genreDistribution: { Drama: 4, Comedy: 6 },
          serviceDistribution: { Netflix: 6, 'Prime Video': 4 },
          watchProgress: 50,
        },
        movieStatistics: {
          movieReferences: [{ id: 1 }, { id: 2 }],
          total: 8,
          watchStatusCounts: { watched: 3, notWatched: 5 },
          genreDistribution: { Action: 3, Comedy: 5 },
          serviceDistribution: { Netflix: 5, 'Prime Video': 3 },
          watchProgress: 37,
        },
        episodeWatchProgress: {
          totalEpisodes: 50,
          watchedEpisodes: 25,
          unairedEpisodes: 0,
          watchProgress: 50,
          showsProgress: [
            { showId: 101, title: 'Show 1', totalEpisodes: 20, watchedEpisodes: 10 },
            { showId: 102, title: 'Show 2', totalEpisodes: 30, watchedEpisodes: 15 },
          ],
        },
      },
      {
        profileId: 2,
        profileName: 'Profile 2',
        showStatistics: {
          total: 5,
          watchStatusCounts: { watched: 2, watching: 1, notWatched: 2 },
          genreDistribution: { Drama: 2, 'Sci-Fi': 3 },
          serviceDistribution: { Netflix: 3, Disney: 2 },
          watchProgress: 40,
        },
        movieStatistics: {
          movieReferences: [{ id: 1 }, { id: 2 }],
          total: 3,
          watchStatusCounts: { watched: 1, notWatched: 2 },
          genreDistribution: { Drama: 1, Horror: 2 },
          serviceDistribution: { Netflix: 2, HBO: 1 },
          watchProgress: 33,
        },
        episodeWatchProgress: {
          totalEpisodes: 30,
          watchedEpisodes: 10,
          unairedEpisodes: 0,
          watchProgress: 33,
          showsProgress: [
            { showId: 101, title: 'Show 1', totalEpisodes: 20, watchedEpisodes: 5 },
            { showId: 103, title: 'Show 3', totalEpisodes: 10, watchedEpisodes: 5 },
          ],
        },
      },
    ];

    it('should return account statistics from cache if available', async () => {
      const mockStats = {
        profileCount: 2,
        uniqueContent: { showCount: 3, movieCount: 11 },
        showStatistics: { total: 15 },
        movieStatistics: { total: 11 },
        episodeStatistics: { watchedEpisodes: 35 },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await accountStatisticsService.getAccountStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_123_statistics', expect.any(Function), 3600);
      expect(result).toEqual(mockStats);

      expect(profileService.getProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and aggregate account statistics on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue(mockProfiles);

      (profileStatisticsService.getProfileStatistics as Mock)
        .mockResolvedValueOnce({
          profileId: 1,
          showStatistics: mockProfileStats[0].showStatistics,
          movieStatistics: mockProfileStats[0].movieStatistics,
          episodeWatchProgress: mockProfileStats[0].episodeWatchProgress,
        })
        .mockResolvedValueOnce({
          profileId: 2,
          showStatistics: mockProfileStats[1].showStatistics,
          movieStatistics: mockProfileStats[1].movieStatistics,
          episodeWatchProgress: mockProfileStats[1].episodeWatchProgress,
        });

      const result = await accountStatisticsService.getAccountStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_123_statistics', expect.any(Function), 3600);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);

      expect(profileStatisticsService.getProfileStatistics).toHaveBeenCalledTimes(2);
      expect(profileStatisticsService.getProfileStatistics).toHaveBeenCalledWith(1);
      expect(profileStatisticsService.getProfileStatistics).toHaveBeenCalledWith(2);

      expect(result).toHaveProperty('profileCount', 2);
      expect(result).toHaveProperty('uniqueContent');
      expect(result).toHaveProperty('showStatistics');
      expect(result).toHaveProperty('movieStatistics');
      expect(result).toHaveProperty('episodeStatistics');
      expect(result.uniqueContent.showCount).toBeGreaterThan(0);
      expect(result.showStatistics.total).toBe(15); // 10 + 5
    });

    it('should throw BadRequestError when no profiles found', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue([]);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(accountStatisticsService.getAccountStatistics(123)).rejects.toThrow(BadRequestError);
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
    });

    it('should handle errors when getting account statistics', async () => {
      const error = new Error('Failed to get profiles');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profileService.getProfilesByAccountId as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(accountStatisticsService.getAccountStatistics(123)).rejects.toThrow(
        'Handled: Failed to get profiles',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountStatistics(123)');
    });
  });
});
