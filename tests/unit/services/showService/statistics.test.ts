import { createMockCache, setupMocks } from './helpers/mocks';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';

describe('ShowService - Statistics', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('getProfileShowStatistics', () => {
    const mockShows = [
      {
        show_id: 1,
        title: 'Show 1',
        watch_status: 'WATCHED',
        status: 'Ended',
        in_production: 0,
        genres: 'Drama, Sci-Fi & Fantasy',
        streaming_services: 'Netflix, Disney+',
      },
      {
        show_id: 2,
        title: 'Show 2',
        watch_status: 'UP_TO_DATE',
        status: 'Returning Series',
        in_production: 1,
        genres: 'Comedy, Drama',
        streaming_services: 'Netflix, Prime Video',
      },
      {
        show_id: 3,
        title: 'Show 3',
        watch_status: 'WATCHING',
        status: 'Returning Series',
        in_production: 1,
        genres: 'Comedy, Action & Adventure',
        streaming_services: 'Hulu, Prime Video',
      },
      {
        show_id: 4,
        title: 'Show 4',
        watch_status: 'NOT_WATCHED',
        status: 'Returning Series',
        in_production: 1,
        genres: 'Action & Adventure, Sci-Fi & Fantasy',
        streaming_services: 'Hulu, Prime Video',
      },
      {
        show_id: 5,
        title: 'Show 5',
        watch_status: 'WATCHED',
        status: 'Canceled',
        in_production: 0,
        genres: 'Drama, Mystery',
        streaming_services: 'Netflix, HBO Max',
      },
    ];

    it('should return statistics from cache when available', async () => {
      const mockStats = {
        total: 3,
        watchStatusCounts: { watched: 2, watching: 1, notWatched: 1, upToDate: 1 },
        genreDistribution: { Drama: 2, 'Sci-Fi & Fantasy': 2, Comedy: 1, 'Action & Adventure': 1 },
        serviceDistribution: { Netflix: 2, 'Disney+': 1, 'Prime Video': 2, Hulu: 1 },
        watchProgress: 33,
      };
      mockCache.getOrSet.mockResolvedValue(mockStats);

      const result = await service.getProfileShowStatistics('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_show_stats', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);
    });

    it('should calculate statistics from shows when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockShows);

      const result = await service.getProfileShowStatistics('123');

      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');
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

      const result = await service.getProfileShowStatistics('123');

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

      await expect(service.getProfileShowStatistics('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowStatistics(123)');
    });
  });

  describe('getProfileWatchProgress', () => {
    const mockShows = [
      { show_id: 1, title: 'Show 1', watch_status: 'WATCHED' },
      { show_id: 2, title: 'Show 2', watch_status: 'WATCHING' },
    ];

    const mockSeasons1 = [
      {
        season_id: 101,
        show_id: 1,
        name: 'Season 1',
        episodes: [
          { episode_id: 1001, watch_status: 'WATCHED' },
          { episode_id: 1002, watch_status: 'WATCHED' },
        ],
      },
      {
        season_id: 102,
        show_id: 1,
        name: 'Season 2',
        episodes: [
          { episode_id: 1003, watch_status: 'WATCHED' },
          { episode_id: 1004, watch_status: 'WATCHED' },
        ],
      },
    ];

    const mockSeasons2 = [
      {
        season_id: 201,
        show_id: 2,
        name: 'Season 1',
        episodes: [
          { episode_id: 2001, watch_status: 'WATCHED' },
          { episode_id: 2002, watch_status: 'WATCHED' },
          { episode_id: 2003, watch_status: 'NOT_WATCHED' },
          { episode_id: 2004, watch_status: 'NOT_WATCHED' },
        ],
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

      const result = await service.getProfileWatchProgress('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_watch_progress', expect.any(Function), 3600);
      expect(result).toEqual(mockProgress);
    });

    it('should calculate watch progress when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockShows);
      (seasonsDb.getSeasonsForShow as jest.Mock)
        .mockResolvedValueOnce(mockSeasons1)
        .mockResolvedValueOnce(mockSeasons2);

      const result = await service.getProfileWatchProgress('123');

      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');
      expect(seasonsDb.getSeasonsForShow).toHaveBeenCalledWith('123', '1');
      expect(seasonsDb.getSeasonsForShow).toHaveBeenCalledWith('123', '2');

      expect(result).toHaveProperty('totalEpisodes', 8);
      expect(result).toHaveProperty('watchedEpisodes', 6);
      expect(result).toHaveProperty('overallProgress', 75); // 6/8 * 100 = 75
      expect(result).toHaveProperty('showsProgress');
      expect(result.showsProgress).toHaveLength(2);

      expect(result.showsProgress[0]).toHaveProperty('showId', 1);
      expect(result.showsProgress[0]).toHaveProperty('totalEpisodes', 4);
      expect(result.showsProgress[0]).toHaveProperty('watchedEpisodes', 4);
      expect(result.showsProgress[0]).toHaveProperty('percentComplete', 100);

      expect(result.showsProgress[1]).toHaveProperty('showId', 2);
      expect(result.showsProgress[1]).toHaveProperty('totalEpisodes', 4);
      expect(result.showsProgress[1]).toHaveProperty('watchedEpisodes', 2);
      expect(result.showsProgress[1]).toHaveProperty('percentComplete', 50);
    });

    it('should handle shows with no episodes', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue([
        { show_id: 3, title: 'Empty Show', watch_status: 'NOT_WATCHED' },
      ]);
      (seasonsDb.getSeasonsForShow as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileWatchProgress('123');

      expect(result).toHaveProperty('totalEpisodes', 0);
      expect(result).toHaveProperty('watchedEpisodes', 0);
      expect(result).toHaveProperty('overallProgress', 0);
      expect(result.showsProgress).toHaveLength(1);
      expect(result.showsProgress[0]).toHaveProperty('showId', 3);
      expect(result.showsProgress[0]).toHaveProperty('totalEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('watchedEpisodes', 0);
      expect(result.showsProgress[0]).toHaveProperty('percentComplete', 0);
    });

    it('should handle no shows in profile', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileWatchProgress('123');

      expect(result).toHaveProperty('totalEpisodes', 0);
      expect(result).toHaveProperty('watchedEpisodes', 0);
      expect(result).toHaveProperty('overallProgress', 0);
      expect(result.showsProgress).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getProfileWatchProgress('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getWatchProgress(123)');
    });
  });
});
