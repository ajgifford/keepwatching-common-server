import * as profilesDb from '@db/profilesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { CustomError, NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@db/profilesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/socketService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');

describe('ShowService', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCache = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateProfileShows: jest.fn(),
      invalidateAccount: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      keys: jest.fn(),
    } as any;

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;

    service = showService;

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('updateShowWatchStatusForNewContent', () => {
    it('should update show status from WATCHED to WATCHING for profiles with new content', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');

      await service.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('1', 123, 'WATCHING');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('2', 123, 'WATCHING');
    });

    it('should not update show status if already set to something other than WATCHED', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHING');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('NOT_WATCHED');

      await service.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when getting show watch status', async () => {
      const mockError = new Error('Get show watch status failed');
      (showsDb.getWatchStatus as jest.Mock).mockRejectedValue(mockError);

      await expect(service.updateShowWatchStatusForNewContent(123, [1])).rejects.toThrow(
        'Get show watch status failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'updateShowWatchStatusForNewContent(123)');
    });
  });

  describe('getShowsForProfile', () => {
    it('should return shows from cache when available', async () => {
      const mockShows = [
        { show_id: 1, title: 'Show 1', watch_status: 'WATCHED' },
        { show_id: 2, title: 'Show 2', watch_status: 'WATCHING' },
      ];
      mockCache.getOrSet.mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_shows', expect.any(Function), 600);
      expect(result).toEqual(mockShows);
    });

    it('should fetch shows from database when not in cache', async () => {
      const mockShows = [
        { show_id: 1, title: 'Show 1', watch_status: 'WATCHED' },
        { show_id: 2, title: 'Show 2', watch_status: 'WATCHING' },
      ];
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockShows);

      const result = await service.getShowsForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockShows);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowsForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowsForProfile(123)');
    });
  });

  describe('getShowDetailsForProfile', () => {
    it('should return show details from cache when available', async () => {
      const mockShow = {
        show_id: 1,
        title: 'Test Show',
        seasons: [{ season_id: 1, name: 'Season 1', episodes: [] }],
      };
      mockCache.getOrSet.mockResolvedValue(mockShow);

      const result = await service.getShowDetailsForProfile('123', '1');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_show_details_1', expect.any(Function), 600);
      expect(result).toEqual(mockShow);
    });

    it('should fetch show details from database when not in cache', async () => {
      const mockShow = {
        show_id: 1,
        title: 'Test Show',
        seasons: [{ season_id: 1, name: 'Season 1', episodes: [] }],
      };
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockResolvedValue(mockShow);

      const result = await service.getShowDetailsForProfile('123', '1');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith('123', '1');
      expect(result).toEqual(mockShow);
    });

    it('should throw NotFoundError when show is not found', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowDetailsForProfile('123', '999')).rejects.toThrow(CustomError);
      expect(showsDb.getShowWithSeasonsForProfile).toHaveBeenCalledWith('123', '999');
      expect(errorService.assertExists).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getShowWithSeasonsForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowDetailsForProfile('123', '1')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowDetailsForProfile(123, 1)');
    });
  });

  describe('addShowToFavorites', () => {
    const mockExistingShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Existing Show',
      description: 'A show description',
      release_date: '2023-01-01',
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      user_rating: 8.5,
      content_rating: 'TV-MA',
    };

    const mockProfileShow = {
      show_id: 1,
      profile_id: 456,
      title: 'Existing Show',
      watch_status: 'NOT_WATCHED',
    };

    it('should add an existing show to favorites', async () => {
      (showsDb.findShowByTMDBId as jest.Mock).mockResolvedValue(mockExistingShow);
      (showsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
      (showsDb.getShowForProfile as jest.Mock).mockResolvedValue(mockProfileShow);

      const episodeData = {
        recentEpisodes: [],
        upcomingEpisodes: [],
        nextUnwatchedEpisodes: [],
      };
      service.getEpisodesForProfile = jest.fn().mockResolvedValue(episodeData);

      const result = await service.addShowToFavorites('456', 123);

      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(showsDb.saveFavorite).toHaveBeenCalledWith('456', 1, true);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('456');
      expect(result).toEqual({
        favoritedShow: mockProfileShow,
        ...episodeData,
      });
    });

    it('should add a new show to favorites by fetching from TMDB', async () => {
      (showsDb.findShowByTMDBId as jest.Mock).mockResolvedValue(null);

      const mockTMDBShow = {
        id: 123,
        name: 'New Show',
        overview: 'A new show description',
        first_air_date: '2023-01-01',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.5,
        content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
        'watch/providers': { results: { US: { flatrate: [] } } },
        networks: [{ origin_country: 'US', name: 'Netflix' }],
        number_of_seasons: 2,
        number_of_episodes: 16,
        genres: [{ id: 18 }, { id: 10765 }],
        status: 'Returning Series',
        type: 'Scripted',
        in_production: 1,
        last_air_date: '2023-06-01',
        last_episode_to_air: { id: 100 },
        next_episode_to_air: { id: 101 },
      };

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      const newShow = { ...mockTMDBShow, id: 999 };
      (showsDb.createShow as jest.Mock).mockReturnValue(newShow);
      (showsDb.saveShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getShowForProfile as jest.Mock).mockResolvedValue({
        show_id: 999,
        profile_id: 456,
        title: 'New Show',
        watch_status: 'NOT_WATCHED',
      });

      const result = await service.addShowToFavorites('456', 123);

      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(123);
      expect(showsDb.createShow).toHaveBeenCalled();
      expect(showsDb.saveShow).toHaveBeenCalled();
      expect(showsDb.saveFavorite).toHaveBeenCalledWith('456', 999, false);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('456');
      expect(result).toHaveProperty('favoritedShow');
    });

    it('should throw BadRequestError when saving new show fails', async () => {
      (showsDb.findShowByTMDBId as jest.Mock).mockResolvedValue(null);

      const mockTMDBShow = {
        id: 123,
        name: 'New Show',
        overview: 'A new show description',
        first_air_date: '2023-01-01',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.5,
        content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
        'watch/providers': { results: { US: { flatrate: [] } } },
        networks: [],
        number_of_seasons: 2,
        number_of_episodes: 16,
        genres: [{ id: 18 }, { id: 10765 }],
        status: 'Returning Series',
        type: 'Scripted',
        in_production: 1,
      };

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      const newShow = { ...mockTMDBShow, id: 999 };
      (showsDb.createShow as jest.Mock).mockReturnValue(newShow);
      (showsDb.saveShow as jest.Mock).mockResolvedValue(false);

      await expect(service.addShowToFavorites('456', 123)).rejects.toThrow(CustomError);
      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(showsDb.saveShow).toHaveBeenCalled();
      expect(showsDb.saveFavorite).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowByTMDBId as jest.Mock).mockRejectedValue(error);

      await expect(service.addShowToFavorites('456', 123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'addShowToFavorites(456, 123)');
    });
  });

  describe('removeShowFromFavorites', () => {
    const mockShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Test Show',
    };

    it('should remove a show from favorites successfully', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue(true);
      (showsDb.removeFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockEpisodeData = {
        recentEpisodes: [],
        upcomingEpisodes: [],
        nextUnwatchedEpisodes: [],
      };
      service.getEpisodesForProfile = jest.fn().mockResolvedValue(mockEpisodeData);

      const result = await service.removeShowFromFavorites('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(showsDb.removeFavorite).toHaveBeenCalledWith('123', 1);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        removedShow: mockShow,
        ...mockEpisodeData,
      });
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.removeShowFromFavorites('123', 999)).rejects.toThrow(CustomError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
      expect(showsDb.removeFavorite).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.removeShowFromFavorites('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'removeShowFromFavorites(123, 1)');
    });
  });

  describe('updateShowWatchStatus', () => {
    it('should update watch status successfully', async () => {
      (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.updateShowWatchStatus('123', 1, 'WATCHED');

      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('123', 1, 'WATCHED');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_shows');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_unwatched_episodes');
      expect(result).toBe(true);
    });

    it('should update all watch statuses recursively when requested', async () => {
      (showsDb.updateAllWatchStatuses as jest.Mock).mockResolvedValue(true);

      const result = await service.updateShowWatchStatus('123', 1, 'WATCHED', true);

      expect(showsDb.updateAllWatchStatuses).toHaveBeenCalledWith('123', 1, 'WATCHED');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_show_details_1');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_shows');
      expect(mockCache.invalidate).toHaveBeenCalledWith('profile_123_unwatched_episodes');
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (showsDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);

      await expect(service.updateShowWatchStatus('123', 1, 'WATCHED')).rejects.toThrow(CustomError);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('123', 1, 'WATCHED');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.updateWatchStatus as jest.Mock).mockRejectedValue(error);

      await expect(service.updateShowWatchStatus('123', 1, 'WATCHED')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateShowWatchStatus(123, 1, WATCHED, false)');
    });
  });

  describe('getShowRecommendations', () => {
    const mockShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Test Show',
    };

    const mockTMDBResponse = {
      results: [
        {
          id: 456,
          name: 'Recommended Show 1',
          genre_ids: [18, 10765],
          first_air_date: '2022-01-01',
          overview: 'A recommended show',
          poster_path: '/poster1.jpg',
          vote_average: 8.2,
          popularity: 52.3,
          origin_country: ['US'],
          original_language: 'en',
        },
        {
          id: 789,
          name: 'Recommended Show 2',
          genre_ids: [28, 12],
          first_air_date: '2023-05-15',
          overview: 'Another recommended show',
          poster_path: '/poster2.jpg',
          vote_average: 7.5,
          popularity: 42.1,
          origin_country: ['GB'],
          original_language: 'en',
        },
      ],
    };

    const mockUserShows = [
      { tmdb_id: 123, title: 'Test Show' },
      { tmdb_id: 456, title: 'Already Favorited Show' },
    ];

    it('should return recommendations from cache when available', async () => {
      const mockRecommendations = [
        {
          id: 456,
          title: 'Recommended Show 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Recommended Show 2',
          inFavorites: false,
        },
      ];
      (errorService.assertExists as jest.Mock).mockResolvedValue(true);
      mockCache.getOrSet.mockResolvedValue(mockRecommendations);

      const result = await service.getShowRecommendations('123', 1);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('recommendations_1', expect.any(Function), 86400);
      expect(result).toEqual(mockRecommendations);
    });

    it('should fetch recommendations from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue(true);

      const mockTMDBService = {
        getShowRecommendations: jest.fn().mockResolvedValue(mockTMDBResponse),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      const result = await service.getShowRecommendations('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getShowRecommendations).toHaveBeenCalledWith(123);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getShowRecommendations('123', 999)).rejects.toThrow(CustomError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getShowRecommendations('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getShowRecommendations(123, 1)');
    });
  });

  describe('getProfileShowStatistics', () => {
    const mockShows = [
      {
        show_id: 1,
        title: 'Show 1',
        watch_status: 'WATCHED',
        genres: 'Drama, Sci-Fi & Fantasy',
        streaming_services: 'Netflix, Disney+',
      },
      {
        show_id: 2,
        title: 'Show 2',
        watch_status: 'WATCHING',
        genres: 'Comedy, Drama',
        streaming_services: 'Netflix, Prime Video',
      },
      {
        show_id: 3,
        title: 'Show 3',
        watch_status: 'NOT_WATCHED',
        genres: 'Action & Adventure, Sci-Fi & Fantasy',
        streaming_services: 'Hulu, Prime Video',
      },
    ];

    it('should return statistics from cache when available', async () => {
      const mockStats = {
        total: 3,
        watchStatusCounts: { watched: 1, watching: 1, notWatched: 1 },
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
      expect(result).toHaveProperty('total', 3);
      expect(result).toHaveProperty('watchStatusCounts');
      expect(result.watchStatusCounts).toHaveProperty('watched', 1);
      expect(result.watchStatusCounts).toHaveProperty('watching', 1);
      expect(result.watchStatusCounts).toHaveProperty('notWatched', 1);
      expect(result).toHaveProperty('genreDistribution');
      expect(result).toHaveProperty('serviceDistribution');
      expect(result).toHaveProperty('watchProgress');
      expect(result.watchProgress).toBe(33); // 1/3 * 100, rounded
    });

    it('should handle empty shows list', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileShowStatistics('123');

      expect(result).toHaveProperty('total', 0);
      expect(result.watchStatusCounts).toHaveProperty('watched', 0);
      expect(result.watchStatusCounts).toHaveProperty('watching', 0);
      expect(result.watchStatusCounts).toHaveProperty('notWatched', 0);
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

  describe('getSimilarShows', () => {
    const mockShow = {
      id: 1,
      tmdb_id: 123,
      title: 'Test Show',
    };

    const mockTMDBResponse = {
      results: [
        {
          id: 456,
          name: 'Similar Show 1',
          genre_ids: [18, 10765],
          first_air_date: '2022-01-01',
          overview: 'A similar show',
          poster_path: '/poster1.jpg',
          vote_average: 8.2,
          popularity: 52.3,
          origin_country: ['US'],
          original_language: 'en',
        },
        {
          id: 789,
          name: 'Similar Show 2',
          genre_ids: [28, 12],
          first_air_date: '2023-05-15',
          overview: 'Another similar show',
          poster_path: '/poster2.jpg',
          vote_average: 7.5,
          popularity: 42.1,
          origin_country: ['GB'],
          original_language: 'en',
        },
      ],
    };

    const mockUserShows = [
      { tmdb_id: 123, title: 'Test Show' },
      { tmdb_id: 456, title: 'Already Favorited Show' },
    ];

    it('should return similar shows from cache when available', async () => {
      const mockSimilarShows = [
        {
          id: 456,
          title: 'Similar Show 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Similar Show 2',
          inFavorites: false,
        },
      ];
      mockCache.getOrSet.mockResolvedValue(mockSimilarShows);
      (errorService.assertExists as jest.Mock).mockResolvedValue(true);

      const result = await service.getSimilarShows('123', 1);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('similarShows_1', expect.any(Function), 86400);
      expect(result).toEqual(mockSimilarShows);
    });

    it('should fetch similar shows from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue(true);

      const mockTMDBService = {
        getSimilarShows: jest.fn().mockResolvedValue(mockTMDBResponse),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.getAllShowsForProfile as jest.Mock).mockResolvedValue(mockUserShows);

      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      const result = await service.getSimilarShows('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getSimilarShows).toHaveBeenCalledWith(123);
      expect(showsDb.getAllShowsForProfile).toHaveBeenCalledWith('123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getSimilarShows('123', 999)).rejects.toThrow(CustomError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getSimilarShows('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSimilarShows(123, 1)');
    });
  });

  describe('invalidateProfileCache', () => {
    it('should invalidate profile shows cache', () => {
      service.invalidateProfileCache('123');

      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('123');
    });
  });

  describe('invalidateAccountCache', () => {
    it('should invalidate all profiles in an account', async () => {
      const mockProfiles = [
        { id: 1, name: 'Profile 1', account_id: 123 },
        { id: 2, name: 'Profile 2', account_id: 123 },
      ];
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockResolvedValue(mockProfiles);

      await service.invalidateAccountCache(123);

      expect(profilesDb.getAllProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('1');
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('2');
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle empty profiles array', async () => {
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await service.invalidateAccountCache(123);

      expect(profilesDb.getAllProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).not.toHaveBeenCalled();
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profilesDb.getAllProfilesByAccountId as jest.Mock).mockRejectedValue(error);

      await expect(service.invalidateAccountCache(123)).rejects.toThrow('Database error');
    });
  });
});
