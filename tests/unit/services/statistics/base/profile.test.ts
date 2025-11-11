import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { showService } from '@services/showService';
import {
  ProfileStatisticsService,
  createProfileStatisticsService,
  resetProfileStatisticsService,
} from '@services/statistics/profileStatisticsService';

jest.mock('@services/showService');
jest.mock('@services/errorService');
jest.mock('@services/moviesService');
jest.mock('@services/cacheService');

describe('profileStatisticsService', () => {
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

  describe('getProfileStatistics', () => {
    it('should return profile statistics from cache if available', async () => {
      const mockStats = {
        showStatistics: { total: 5 },
        movieStatistics: { total: 3 },
        episodeWatchProgress: { watchedEpisodes: 20 },
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await profileStatisticsService.getProfileStatistics(123);

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

      const result = await profileStatisticsService.getProfileStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_statistics', expect.any(Function), 1800);
      expect(showService.getProfileShowStatistics).toHaveBeenCalledWith(123);
      expect(moviesService.getProfileMovieStatistics).toHaveBeenCalledWith(123);
      expect(showService.getProfileWatchProgress).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        profileId: 123,
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

      await expect(profileStatisticsService.getProfileStatistics(123)).rejects.toThrow(
        'Handled: Failed to get show statistics',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileStatistics(123)');
    });
  });
});
