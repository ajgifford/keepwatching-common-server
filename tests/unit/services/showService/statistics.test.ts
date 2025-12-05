import { mockProfileShows } from './helpers/fixtures';
import { createMockCache, setupMocks } from './helpers/mocks';
import * as showsDb from '@db/showsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import {
  ShowService,
  createShowService,
  resetShowService,
} from '@services/showService';

describe('ShowService - Statistics', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    resetShowService();
    mockCache = createMockCache();

    service = createShowService({ cacheService: mockCache });
  });

  afterEach(() => {
    resetShowService();
  });

  describe('getProfileShowStatistics', () => {
    it('should return statistics from cache when available', async () => {
      const mockStats = {
        total: 3,
        watchStatusCounts: { watched: 2, watching: 1, notWatched: 1, upToDate: 1 },
        genreDistribution: { Drama: 2, 'Sci-Fi & Fantasy': 2, Comedy: 1, 'Action & Adventure': 1 },
        serviceDistribution: { Netflix: 2, 'Disney+': 1, 'Prime Video': 2, Hulu: 1 },
        watchProgress: 33,
      };
      mockCache.getOrSet.mockResolvedValue(mockStats);

      const result = await service.getProfileShowStatistics(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_show_stats', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);
    });

    it('should calculate statistics from shows when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockProfileShows);

      const result = await service.getProfileShowStatistics(123);

      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith(123);
      expect(result).toHaveProperty('total', 5);
      expect(result).toHaveProperty('watchStatusCounts');
      expect(result.watchStatusCounts).toHaveProperty('watched', 2);
      expect(result.watchStatusCounts).toHaveProperty('watching', 1);
      expect(result.watchStatusCounts).toHaveProperty('notWatched', 1);
      expect(result.watchStatusCounts).toHaveProperty('upToDate', 1);
      expect(result).toHaveProperty('genreDistribution');
      expect(result).toHaveProperty('serviceDistribution');
      expect(result).toHaveProperty('watchProgress');
      expect(result.watchProgress).toBe(40); // 1/3 * 100, rounded
    });

    it('should handle empty shows list', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileShowStatistics(123);

      expect(result).toHaveProperty('total', 0);
      expect(result.watchStatusCounts).toHaveProperty('watched', 0);
      expect(result.watchStatusCounts).toHaveProperty('watching', 0);
      expect(result.watchStatusCounts).toHaveProperty('notWatched', 0);
      expect(result.watchStatusCounts).toHaveProperty('upToDate', 0);
      expect(result.genreDistribution).toEqual({});
      expect(result.serviceDistribution).toEqual({});
      expect(result.watchProgress).toBe(0);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getProfileShowStatistics(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowStatistics(123)');
    });
  });

  describe('getProfileWatchProgress', () => {
    const mockShowsProgress = [
      {
        showId: 1,
        title: 'Show 1',
        status: 'WATCHED',
        totalEpisodes: 4,
        watchedEpisodes: 4,
        unairedEpisodes: 0,
        percentComplete: 100,
      },
      {
        showId: 2,
        title: 'Show 2',
        status: 'WATCHING',
        totalEpisodes: 4,
        watchedEpisodes: 2,
        unairedEpisodes: 0,
        percentComplete: 50,
      },
    ];

    it('should return watch progress from cache when available', async () => {
      const mockProgress = {
        totalEpisodes: 8,
        watchedEpisodes: 6,
        overallProgress: 75,
        showsProgress: [
          {
            showId: 1,
            title: 'Show 1',
            status: 'WATCHED',
            totalEpisodes: 4,
            watchedEpisodes: 4,
            percentComplete: 100,
          },
          {
            showId: 2,
            title: 'Show 2',
            status: 'WATCHING',
            totalEpisodes: 4,
            watchedEpisodes: 2,
            percentComplete: 50,
          },
        ],
      };
      mockCache.getOrSet.mockResolvedValue(mockProgress);

      const result = await service.getProfileWatchProgress(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_watch_progress', expect.any(Function), 3600);
      expect(result).toEqual(mockProgress);
    });

    it('should calculate watch progress when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getWatchProgressForProfile as jest.Mock).mockResolvedValue(mockShowsProgress);

      const result = await service.getProfileWatchProgress(123);

      expect(showsDb.getWatchProgressForProfile).toHaveBeenCalledWith(123);

      expect(result).toHaveProperty('totalEpisodes', 8);
      expect(result).toHaveProperty('watchedEpisodes', 6);
      expect(result).toHaveProperty('unairedEpisodes', 0);
      expect(result).toHaveProperty('overallProgress', 75); // 6/8 * 100 = 75
      expect(result).toHaveProperty('showsProgress');
      expect(result.showsProgress).toHaveLength(2);

      expect(result.showsProgress[0]).toHaveProperty('showId', 1);
      expect(result.showsProgress[0]).toHaveProperty('totalEpisodes', 4);
      expect(result.showsProgress[0]).toHaveProperty('watchedEpisodes', 4);
      expect(result.showsProgress[0]).toHaveProperty('unairedEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('percentComplete', 100);

      expect(result.showsProgress[1]).toHaveProperty('showId', 2);
      expect(result.showsProgress[1]).toHaveProperty('totalEpisodes', 4);
      expect(result.showsProgress[1]).toHaveProperty('watchedEpisodes', 2);
      expect(result.showsProgress[1]).toHaveProperty('unairedEpisodes', 0);
      expect(result.showsProgress[1]).toHaveProperty('percentComplete', 50);
    });

    it('should handle shows with no episodes', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getWatchProgressForProfile as jest.Mock).mockResolvedValue([
        {
          showId: 3,
          title: 'Empty Show',
          status: 'NOT_WATCHED',
          totalEpisodes: 0,
          watchedEpisodes: 0,
          unairedEpisodes: 0,
          percentComplete: 0,
        },
      ]);

      const result = await service.getProfileWatchProgress(123);

      expect(result).toHaveProperty('totalEpisodes', 0);
      expect(result).toHaveProperty('watchedEpisodes', 0);
      expect(result).toHaveProperty('unairedEpisodes', 0);
      expect(result).toHaveProperty('overallProgress', 0);
      expect(result.showsProgress).toHaveLength(1);
      expect(result.showsProgress[0]).toHaveProperty('showId', 3);
      expect(result.showsProgress[0]).toHaveProperty('totalEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('watchedEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('unairedEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('percentComplete', 0);
    });

    it('should handle no shows in profile', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (showsDb.getWatchProgressForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileWatchProgress(123);

      expect(result).toHaveProperty('totalEpisodes', 0);
      expect(result).toHaveProperty('watchedEpisodes', 0);
      expect(result).toHaveProperty('unairedEpisodes', 0);
      expect(result).toHaveProperty('overallProgress', 0);
      expect(result.showsProgress).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getWatchProgressForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getProfileWatchProgress(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWatchProgress(123)');
    });
  });
});
