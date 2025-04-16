import * as profilesDb from '@db/profilesDb';
import { CustomError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { showService } from '@services/showService';
import { statisticsService } from '@services/statisticsService';

jest.mock('@db/profilesDb');
jest.mock('@services/showService');
jest.mock('@services/errorService');
jest.mock('@services/moviesService');
jest.mock('@services/cacheService');

describe('statisticsService', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(statisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getProfileStatistics', () => {
    it('should return profile statistics from cache if available', async () => {
      const mockStats = {
        showStatistics: { total: 5 },
        movieStatistics: { total: 3 },
        episodeWatchProgress: { watchedEpisodes: 20 },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await statisticsService.getProfileStatistics('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_statistics', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);

      expect(showService.getProfileShowStatistics).not.toHaveBeenCalled();
      expect(moviesService.getProfileMovieStatistics).not.toHaveBeenCalled();
      expect(showService.getProfileWatchProgress).not.toHaveBeenCalled();
    });

    it('should fetch and return profile statistics on cache miss', async () => {
      const mockShowStats = { total: 5 };
      const mockMovieStats = { total: 3 };
      const mockWatchProgress = { watchedEpisodes: 20 };

      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showService.getProfileShowStatistics as jest.Mock).mockResolvedValue(mockShowStats);
      (moviesService.getProfileMovieStatistics as jest.Mock).mockResolvedValue(mockMovieStats);
      (showService.getProfileWatchProgress as jest.Mock).mockResolvedValue(mockWatchProgress);

      const result = await statisticsService.getProfileStatistics('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_statistics', expect.any(Function), 1800);
      expect(showService.getProfileShowStatistics).toHaveBeenCalledWith('123');
      expect(moviesService.getProfileMovieStatistics).toHaveBeenCalledWith('123');
      expect(showService.getProfileWatchProgress).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        showStatistics: mockShowStats,
        movieStatistics: mockMovieStats,
        episodeWatchProgress: mockWatchProgress,
      });
    });

    it('should handle errors when getting profile statistics', async () => {
      const error = new Error('Failed to get show statistics');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showService.getProfileShowStatistics as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(statisticsService.getProfileStatistics('123')).rejects.toThrow(
        'Handled: Failed to get show statistics',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileStatistics(123)');
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
          total: 8,
          watchStatusCounts: { watched: 3, notWatched: 5 },
          genreDistribution: { Action: 3, Comedy: 5 },
          serviceDistribution: { Netflix: 5, 'Prime Video': 3 },
          watchProgress: 37,
        },
        progress: {
          totalEpisodes: 50,
          watchedEpisodes: 25,
          overallProgress: 50,
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
          total: 3,
          watchStatusCounts: { watched: 1, notWatched: 2 },
          genreDistribution: { Drama: 1, Horror: 2 },
          serviceDistribution: { Netflix: 2, HBO: 1 },
          watchProgress: 33,
        },
        progress: {
          totalEpisodes: 30,
          watchedEpisodes: 10,
          overallProgress: 33,
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

      const result = await statisticsService.getAccountStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_123_statistics', expect.any(Function), 3600);
      expect(result).toEqual(mockStats);

      expect(profilesDb.getAllProfilesByAccountId).not.toHaveBeenCalled();
    });

    it('should fetch and aggregate account statistics on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockResolvedValue(mockProfiles);

      (showService.getProfileShowStatistics as jest.Mock)
        .mockResolvedValueOnce(mockProfileStats[0].showStatistics)
        .mockResolvedValueOnce(mockProfileStats[1].showStatistics);

      (moviesService.getProfileMovieStatistics as jest.Mock)
        .mockResolvedValueOnce(mockProfileStats[0].movieStatistics)
        .mockResolvedValueOnce(mockProfileStats[1].movieStatistics);

      (showService.getProfileWatchProgress as jest.Mock)
        .mockResolvedValueOnce(mockProfileStats[0].progress)
        .mockResolvedValueOnce(mockProfileStats[1].progress);

      const result = await statisticsService.getAccountStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('account_123_statistics', expect.any(Function), 3600);
      expect(profilesDb.getAllProfilesByAccountId).toHaveBeenCalledWith(123);

      expect(showService.getProfileShowStatistics).toHaveBeenCalledTimes(2);
      expect(moviesService.getProfileMovieStatistics).toHaveBeenCalledTimes(2);
      expect(showService.getProfileWatchProgress).toHaveBeenCalledTimes(2);

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
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockResolvedValue([]);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(statisticsService.getAccountStatistics(123)).rejects.toThrow(CustomError);
      expect(profilesDb.getAllProfilesByAccountId).toHaveBeenCalledWith(123);
    });

    it('should handle errors when getting account statistics', async () => {
      const error = new Error('Failed to get profiles');
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(statisticsService.getAccountStatistics(123)).rejects.toThrow('Handled: Failed to get profiles');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAccountStatistics(123)');
    });
  });
});
