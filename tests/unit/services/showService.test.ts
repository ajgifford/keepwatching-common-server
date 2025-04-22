import { Change, ContentUpdates } from '../../../src/types/contentTypes';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { cliLogger, httpLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { BadRequestError, NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { profileService } from '@services/profileService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { ShowService, showService } from '@services/showService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@services/profileService');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/seasonChangesService');
jest.mock('@services/socketService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  httpLogger: {
    error: jest.fn(),
  },
}));

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

      await expect(service.getShowDetailsForProfile('123', '999')).rejects.toThrow(NotFoundError);
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

  describe('getEpisodesForProfile', () => {
    const mockRecentEpisodes = [
      { id: 101, title: 'Recent Episode 1', air_date: '2023-04-10', show_id: 1 },
      { id: 102, title: 'Recent Episode 2', air_date: '2023-04-12', show_id: 2 },
    ];

    const mockUpcomingEpisodes = [
      { id: 201, title: 'Upcoming Episode 1', air_date: '2023-04-20', show_id: 1 },
      { id: 202, title: 'Upcoming Episode 2', air_date: '2023-04-25', show_id: 3 },
    ];

    const mockNextUnwatchedEpisodes = [
      {
        show_id: 1,
        show_title: 'Show 1',
        poster_image: '/poster1.jpg',
        last_watched: '2023-04-05',
        episodes: [{ episode_id: 301, title: 'Next Episode 1', season_number: 2, episode_number: 3 }],
      },
      {
        show_id: 2,
        show_title: 'Show 2',
        poster_image: '/poster2.jpg',
        last_watched: '2023-04-08',
        episodes: [{ episode_id: 302, title: 'Next Episode 2', season_number: 1, episode_number: 5 }],
      },
    ];

    it('should return episodes from cache when available', async () => {
      const mockEpisodeData = {
        recentEpisodes: mockRecentEpisodes,
        upcomingEpisodes: mockUpcomingEpisodes,
        nextUnwatchedEpisodes: mockNextUnwatchedEpisodes,
      };

      mockCache.getOrSet.mockResolvedValue(mockEpisodeData);

      const result = await service.getEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_episodes', expect.any(Function), 300);
      expect(result).toEqual(mockEpisodeData);
    });

    it('should fetch episodes from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockResolvedValue(mockRecentEpisodes);
      (episodesDb.getUpcomingEpisodesForProfile as jest.Mock).mockResolvedValue(mockUpcomingEpisodes);
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.getEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(episodesDb.getRecentEpisodesForProfile).toHaveBeenCalledWith('123');
      expect(episodesDb.getUpcomingEpisodesForProfile).toHaveBeenCalledWith('123');
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith('123');

      expect(result).toEqual({
        recentEpisodes: mockRecentEpisodes,
        upcomingEpisodes: mockUpcomingEpisodes,
        nextUnwatchedEpisodes: mockNextUnwatchedEpisodes,
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getEpisodesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getEpisodesForProfile(123)');
    });
  });

  describe('getNextUnwatchedEpisodesForProfile', () => {
    const mockNextUnwatchedEpisodes = [
      {
        show_id: 1,
        show_title: 'Show 1',
        poster_image: '/poster1.jpg',
        last_watched: '2023-04-05',
        episodes: [
          {
            episode_id: 301,
            episode_title: 'Next Episode 1',
            overview: 'Episode overview',
            episode_number: 3,
            season_number: 2,
            episode_still_image: '/still1.jpg',
            air_date: '2023-03-15',
            show_id: 1,
            show_name: 'Show 1',
            season_id: 201,
            poster_image: '/poster1.jpg',
            network: 'Netflix',
            streaming_services: 'Netflix,Hulu',
            profile_id: 123,
          },
        ],
      },
      {
        show_id: 2,
        show_title: 'Show 2',
        poster_image: '/poster2.jpg',
        last_watched: '2023-04-08',
        episodes: [
          {
            episode_id: 302,
            episode_title: 'Next Episode 2',
            overview: 'Episode 2 overview',
            episode_number: 5,
            season_number: 1,
            episode_still_image: '/still2.jpg',
            air_date: '2023-03-22',
            show_id: 2,
            show_name: 'Show 2',
            season_id: 202,
            poster_image: '/poster2.jpg',
            network: 'HBO',
            streaming_services: 'HBO Max',
            profile_id: 123,
          },
        ],
      },
    ];

    it('should return next unwatched episodes from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_unwatched_episodes', expect.any(Function), 300);
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should fetch next unwatched episodes from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should handle empty results', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(result).toEqual([]);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith('123');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getNextUnwatchedEpisodesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getNextUnwatchedEpisodesForProfile(123)');
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
        seasons: [
          {
            air_date: '2023-02-01',
            episode_count: 10,
            id: 100,
            name: 'Season 1',
            overview: 'Season 1 overview',
            poster_path: '/season1_poster.jpg',
            season_number: 1,
            vote_average: 7.5,
          },
          {
            air_date: '2023-05-01',
            episode_count: 6,
            id: 101,
            name: 'Season 2',
            overview: 'Season 2 overview',
            poster_path: '/season2_poster.jpg',
            season_number: 2,
            vote_average: 8.0,
          },
        ],
      };

      const mockTMDBSeason1Details = {
        id: 100,
        name: 'Season 1',
        overview: 'Season 1 overview',
        episodes: [
          {
            id: 1001,
            name: 'Episode 1',
            overview: 'Episode 1 overview',
            episode_number: 1,
            episode_type: 'standard',
            season_number: 1,
            air_date: '2023-02-01',
            runtime: 42,
            still_path: '/ep1_still.jpg',
          },
          {
            id: 1002,
            name: 'Episode 2',
            overview: 'Episode 2 overview',
            episode_number: 2,
            episode_type: 'standard',
            season_number: 1,
            air_date: '2023-02-08',
            runtime: 44,
            still_path: '/ep2_still.jpg',
          },
        ],
      };

      const mockTMDBSeason2Details = {
        id: 101,
        name: 'Season 2',
        overview: 'Season 2 overview',
        episodes: [
          {
            id: 2001,
            name: 'Episode 1',
            overview: 'S2 Episode 1 overview',
            episode_number: 1,
            episode_type: 'standard',
            season_number: 2,
            air_date: '2023-05-01',
            runtime: 45,
            still_path: '/s2ep1_still.jpg',
          },
        ],
      };

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
        getSeasonDetails: jest
          .fn()
          .mockResolvedValueOnce(mockTMDBSeason1Details)
          .mockResolvedValueOnce(mockTMDBSeason2Details),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      const newShow = { ...mockTMDBShow, id: 999 };
      (showsDb.createShow as jest.Mock).mockReturnValue(newShow);
      (showsDb.saveShow as jest.Mock).mockResolvedValue(true);

      const mockProfileShow = {
        show_id: 999,
        profile_id: 456,
        title: 'New Show',
        watch_status: 'NOT_WATCHED',
      };
      (showsDb.getShowForProfile as jest.Mock).mockResolvedValue(mockProfileShow);

      const mockSavedSeason1 = {
        id: 201,
        show_id: 999,
        tmdb_id: 100,
        name: 'Season 1',
        overview: 'Season 1 overview',
        season_number: 1,
        release_date: '2023-02-01',
        poster_image: '/season1_poster.jpg',
        number_of_episodes: 10,
      };

      const mockSavedSeason2 = {
        id: 202,
        show_id: 999,
        tmdb_id: 101,
        name: 'Season 2',
        overview: 'Season 2 overview',
        season_number: 2,
        release_date: '2023-05-01',
        poster_image: '/season2_poster.jpg',
        number_of_episodes: 6,
      };

      (seasonsDb.createSeason as jest.Mock).mockImplementation(
        (showId, tmdbId, name, overview, seasonNumber, releaseDate, posterImage, numberOfEpisodes) => ({
          show_id: showId,
          tmdb_id: tmdbId,
          name,
          overview,
          season_number: seasonNumber,
          release_date: releaseDate,
          poster_image: posterImage,
          number_of_episodes: numberOfEpisodes,
        }),
      );

      (seasonsDb.saveSeason as jest.Mock)
        .mockResolvedValueOnce(mockSavedSeason1)
        .mockResolvedValueOnce(mockSavedSeason2);

      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockSavedEpisode1 = { id: 301, tmdb_id: 1001, show_id: 999, season_id: 201 };
      const mockSavedEpisode2 = { id: 302, tmdb_id: 1002, show_id: 999, season_id: 201 };
      const mockSavedEpisode3 = { id: 303, tmdb_id: 2001, show_id: 999, season_id: 202 };

      (episodesDb.createEpisode as jest.Mock).mockImplementation((tmdbId, showId, seasonId) => ({
        tmdb_id: tmdbId,
        show_id: showId,
        season_id: seasonId,
      }));

      (episodesDb.saveEpisode as jest.Mock)
        .mockResolvedValueOnce(mockSavedEpisode1)
        .mockResolvedValueOnce(mockSavedEpisode2)
        .mockResolvedValueOnce(mockSavedEpisode3);

      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as NodeJS.Timeout;
      });

      const result = await service.addShowToFavorites('456', 123);

      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(123);
      expect(showsDb.createShow).toHaveBeenCalled();
      expect(showsDb.saveShow).toHaveBeenCalled();
      expect(showsDb.saveFavorite).toHaveBeenCalledWith('456', 999, false);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('456');
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(123, 1);
      expect(result).toHaveProperty('favoritedShow');
      expect(result.favoritedShow).toEqual(mockProfileShow);
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

      await expect(service.addShowToFavorites('456', 123)).rejects.toThrow(BadRequestError);
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
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);
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

      await expect(service.removeShowFromFavorites('123', 999)).rejects.toThrow(NotFoundError);
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

      await expect(service.updateShowWatchStatus('123', 1, 'WATCHED')).rejects.toThrow(BadRequestError);
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
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);
      mockCache.getOrSet.mockResolvedValue(mockRecommendations);

      const result = await service.getShowRecommendations('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('recommendations_1', expect.any(Function), 86400);
      expect(result).toEqual(mockRecommendations);
    });

    it('should fetch recommendations from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

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

      await expect(service.getShowRecommendations('123', 999)).rejects.toThrow(NotFoundError);
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
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

      const result = await service.getSimilarShows('123', 1);

      expect(showsDb.findShowById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('similarShows_1', expect.any(Function), 86400);
      expect(result).toEqual(mockSimilarShows);
    });

    it('should fetch similar shows from TMDB when not in cache', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(mockShow);
      (errorService.assertExists as jest.Mock).mockResolvedValue((item: any) => item);

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

      await expect(service.getSimilarShows('123', 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.getSimilarShows('123', 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSimilarShows(123, 1)');
    });
  });

  describe('showChangesService', () => {
    const mockShowContent: ContentUpdates = {
      id: 123,
      title: 'Test Show',
      tmdb_id: 456,
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    };

    const pastDate = '2023-01-01';
    const currentDate = '2023-01-10';

    const mockTMDBService = {
      getShowChanges: jest.fn(),
      getShowDetails: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      // Mock utility functions that are used to process show details
      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
      (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      // Default mock implementations
      mockTMDBService.getShowChanges.mockResolvedValue({ changes: [] });
      mockTMDBService.getShowDetails.mockResolvedValue({
        id: 456,
        name: 'Updated Show Title',
        overview: 'New overview',
        first_air_date: '2023-02-01',
        poster_path: '/new-poster.jpg',
        backdrop_path: '/new-backdrop.jpg',
        vote_average: 8.5,
        content_ratings: { results: [] },
        number_of_episodes: 10,
        number_of_seasons: 1,
        genres: [{ id: 28 }, { id: 12 }],
        status: 'Returning Series',
        type: 'Scripted',
        in_production: true,
        last_air_date: '2023-01-15',
        last_episode_to_air: null,
        next_episode_to_air: null,
        networks: [{ origin_country: 'US', name: 'HBO' }],
      });

      (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1, 2, 3]);
      (showsDb.createShow as jest.Mock).mockImplementation((...args) => ({
        id: 123,
        tmdb_id: args[0],
        title: args[1],
        description: args[2],
        release_date: args[3],
        poster_image: args[4],
        backdrop_image: args[5],
        user_rating: args[6],
        content_rating: args[7],
        season_count: args[10],
        episode_count: args[11],
        genreIds: args[12],
        status: args[13],
        type: args[14],
        in_production: args[15],
        last_air_date: args[16],
        last_episode_to_air: args[17],
        next_episode_to_air: args[18],
        network: args[19],
      }));
    });

    it('should do nothing when no changes are detected', async () => {
      mockTMDBService.getShowChanges.mockResolvedValue({ changes: [] });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
      expect(showsDb.createShow).not.toHaveBeenCalled();
      expect(showsDb.updateShow).not.toHaveBeenCalled();
    });

    it('should do nothing when only unsupported changes are detected', async () => {
      const unsupportedChanges: Change[] = [
        {
          key: 'unsupported_key',
          items: [
            {
              id: 'abc123',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: {},
              original_value: null,
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: unsupportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
      expect(showsDb.createShow).not.toHaveBeenCalled();
      expect(showsDb.updateShow).not.toHaveBeenCalled();
    });

    it('should update show when supported changes are detected', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.createShow).toHaveBeenCalledWith(
        456,
        'Updated Show Title',
        'New overview',
        '2023-02-01',
        '/new-poster.jpg',
        '/new-backdrop.jpg',
        8.5,
        'TV-14',
        123,
        [8, 9],
        10,
        1,
        [28, 12],
        'Returning Series',
        'Scripted',
        1,
        '2023-01-15',
        null,
        null,
        'HBO',
      );
      expect(showsDb.updateShow).toHaveBeenCalled();
    });

    it('should process season changes when season changes are detected', async () => {
      const seasonChanges: Change[] = [
        {
          key: 'season',
          items: [
            {
              id: 'season1',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: { season_id: 101 },
              original_value: null,
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: seasonChanges });
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHING');

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(showsDb.getProfilesForShow).toHaveBeenCalledWith(123);
      expect(processSeasonChanges).toHaveBeenCalledWith(
        seasonChanges[0].items,
        expect.any(Object),
        mockShowContent,
        [1, 2, 3],
        pastDate,
        currentDate,
      );
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(1, '1', 123);
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(2, '2', 123);
      expect(showsDb.getWatchStatus).toHaveBeenNthCalledWith(3, '3', 123);
    });

    it('should handle errors from getShowChanges API', async () => {
      const mockError = new Error('API error');
      mockTMDBService.getShowChanges.mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
    });

    it('should handle errors from getShowDetails API', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Show details API error');
      mockTMDBService.getShowDetails.mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
    });

    it('should handle multiple supported changes', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
        {
          key: 'overview',
          items: [
            {
              id: 'def456',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'New overview',
              original_value: 'Old overview',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.createShow).toHaveBeenCalledTimes(1);
      expect(showsDb.updateShow).toHaveBeenCalled();
    });

    it('should handle empty changes array', async () => {
      mockTMDBService.getShowChanges.mockResolvedValue({});

      await showService.checkShowForChanges(mockShowContent, pastDate, currentDate);

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).not.toHaveBeenCalled();
      expect(showsDb.createShow).not.toHaveBeenCalled();
    });

    it('should handle errors from showsDb.updateShow', async () => {
      const supportedChanges: Change[] = [
        {
          key: 'name',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Show Title',
              original_value: 'Test Show',
            },
          ],
        },
      ];

      mockTMDBService.getShowChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Database update error');
      (showsDb.updateShow as jest.Mock).mockRejectedValue(mockError);

      await expect(showService.checkShowForChanges(mockShowContent, pastDate, currentDate)).rejects.toThrow();

      expect(mockTMDBService.getShowChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(456);
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
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
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(mockProfiles);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('1');
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith('2');
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle empty profiles array', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await service.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateProfileShows).not.toHaveBeenCalled();
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profileService.getProfilesByAccountId as jest.Mock).mockRejectedValue(error);

      await expect(service.invalidateAccountCache(123)).rejects.toThrow('Database error');
    });
  });

  describe('getShowsForUpdates', () => {
    it('should return shows that need updates', async () => {
      const mockShows = [
        { id: 1, title: 'Show 1', tmdb_id: 101, created_at: '2023-01-01', updated_at: '2023-01-10' },
        { id: 2, title: 'Show 2', tmdb_id: 102, created_at: '2023-02-01', updated_at: '2023-02-10' },
      ];

      (showsDb.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);

      const result = await showService.getShowsForUpdates();

      expect(showsDb.getShowsForUpdates).toHaveBeenCalled();
      expect(result).toEqual(mockShows);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      (showsDb.getShowsForUpdates as jest.Mock).mockRejectedValue(mockError);

      await expect(showService.getShowsForUpdates()).rejects.toThrow('Database error');
      expect(showsDb.getShowsForUpdates).toHaveBeenCalled();
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getShowsForUpdates()');
    });
  });

  describe('updateShowById', () => {
    const showId = 123;
    const tmdbId = 456;
    const updateMode = 'latest';

    const mockTMDBShow = {
      id: tmdbId,
      name: 'Test Show',
      overview: 'A test show',
      first_air_date: '2023-01-01',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      vote_average: 8.5,
      content_ratings: { results: [] },
      'watch/providers': { results: { US: { flatrate: [] } } },
      networks: [{ origin_country: 'US', name: 'Netflix' }],
      number_of_seasons: 2,
      number_of_episodes: 16,
      genres: [{ id: 18 }, { id: 10765 }],
      status: 'Returning Series',
      type: 'Scripted',
      in_production: true,
      last_air_date: '2023-06-01',
      last_episode_to_air: { id: 100 },
      next_episode_to_air: { id: 101 },
      seasons: [
        {
          air_date: '2023-01-01',
          episode_count: 10,
          id: 100,
          name: 'Season 1',
          overview: 'Season 1 overview',
          poster_path: '/season1_poster.jpg',
          season_number: 1,
          vote_average: 7.5,
        },
        {
          air_date: '2023-05-01',
          episode_count: 6,
          id: 101,
          name: 'Season 2',
          overview: 'Season 2 overview',
          poster_path: '/season2_poster.jpg',
          season_number: 2,
          vote_average: 8.0,
        },
      ],
    };

    const mockSeasonDetails = {
      id: 101,
      name: 'Season 2',
      episodes: [
        {
          id: 1001,
          name: 'Episode 1',
          overview: 'Episode 1 overview',
          episode_number: 1,
          episode_type: 'standard',
          season_number: 2,
          air_date: '2023-05-01',
          runtime: 45,
          still_path: '/ep1_still.jpg',
        },
        {
          id: 1002,
          name: 'Episode 2',
          overview: 'Episode 2 overview',
          episode_number: 2,
          episode_type: 'standard',
          season_number: 2,
          air_date: '2023-05-08',
          runtime: 42,
          still_path: '/ep2_still.jpg',
        },
      ],
    };

    it('should update a show successfully', async () => {
      // Set up mocks
      (showsDb.getTMDBIdForShow as jest.Mock).mockResolvedValue(tmdbId);

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock)
        .mockReturnValueOnce(100) // last_episode_to_air
        .mockReturnValueOnce(101); // next_episode_to_air
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('Netflix');
      (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([9999]);

      (showsDb.createShow as jest.Mock).mockReturnValue({
        id: showId,
        tmdb_id: tmdbId,
        title: 'Test Show',
      });
      (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1, 2]);

      const mockSeason = {
        id: 201,
        tmdb_id: 101,
        name: 'Season 2',
        show_id: showId,
      };
      (seasonsDb.createSeason as jest.Mock).mockReturnValue(mockSeason);
      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(mockSeason);
      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockEpisode = {
        id: 301,
        tmdb_id: 1001,
        show_id: showId,
        season_id: 201,
      };
      (episodesDb.createEpisode as jest.Mock).mockReturnValue(mockEpisode);
      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(mockEpisode);
      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      // Execute test
      const result = await showService.updateShowById(showId, updateMode);

      // Verify
      expect(showsDb.getTMDBIdForShow).toHaveBeenCalledWith(showId);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(tmdbId);
      expect(contentUtility.getUSRating).toHaveBeenCalledWith(mockTMDBShow.content_ratings);
      expect(contentUtility.getInProduction).toHaveBeenCalledWith(mockTMDBShow);
      expect(contentUtility.getEpisodeToAirId).toHaveBeenCalledWith(mockTMDBShow.last_episode_to_air);
      expect(contentUtility.getEpisodeToAirId).toHaveBeenCalledWith(mockTMDBShow.next_episode_to_air);
      expect(contentUtility.getUSNetwork).toHaveBeenCalledWith(mockTMDBShow.networks);
      expect(watchProvidersUtility.getUSWatchProviders).toHaveBeenCalledWith(mockTMDBShow, 9999);

      expect(showsDb.createShow).toHaveBeenCalled();
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(showsDb.getProfilesForShow).toHaveBeenCalledWith(showId);

      // For latest mode, only the newest season should be updated
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(tmdbId, 2);
      expect(seasonsDb.updateSeason).toHaveBeenCalled();
      expect(seasonsDb.saveFavorite).toHaveBeenCalledTimes(2); // Once for each profile

      expect(episodesDb.updateEpisode).toHaveBeenCalledTimes(2); // Two episodes in the season
      expect(episodesDb.saveFavorite).toHaveBeenCalledTimes(4); // Two episodes for two profiles

      expect(socketService.notifyShowsUpdate).toHaveBeenCalled();
      expect(mockCache.invalidate).toHaveBeenCalled();

      expect(result).toBe(true);
    });

    it('should update all seasons when updateMode is "all"', async () => {
      // Set up mocks
      (showsDb.getTMDBIdForShow as jest.Mock).mockResolvedValue(tmdbId);

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValueOnce(100).mockReturnValueOnce(101);
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('Netflix');
      (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([9999]);

      (showsDb.createShow as jest.Mock).mockReturnValue({
        id: showId,
        tmdb_id: tmdbId,
        title: 'Test Show',
      });
      (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1]);

      const mockSeason = {
        id: 201,
        tmdb_id: 101,
        name: 'Season 2',
        show_id: showId,
      };
      (seasonsDb.createSeason as jest.Mock).mockReturnValue(mockSeason);
      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(mockSeason);

      const mockEpisode = {
        id: 301,
        tmdb_id: 1001,
        show_id: showId,
        season_id: 201,
      };
      (episodesDb.createEpisode as jest.Mock).mockReturnValue(mockEpisode);
      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(mockEpisode);

      // Execute test
      await showService.updateShowById(showId, 'all');

      // Verify - in 'all' mode both seasons should be updated
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(1, tmdbId, 2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(2, tmdbId, 1);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.getTMDBIdForShow as jest.Mock).mockResolvedValue(null);

      const mockError = new NotFoundError(`Show with ID ${showId} not found`);
      (errorService.handleError as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      await expect(showService.updateShowById(showId)).rejects.toThrow(mockError);
      expect(showsDb.getTMDBIdForShow).toHaveBeenCalledWith(showId);
    });

    it('should handle API errors', async () => {
      (showsDb.getTMDBIdForShow as jest.Mock).mockResolvedValue(tmdbId);

      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getShowDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await expect(showService.updateShowById(showId)).rejects.toThrow('TMDB API error');
      expect(showsDb.getTMDBIdForShow).toHaveBeenCalledWith(showId);
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(tmdbId);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateShowById(${showId})`);
    });

    it('should handle errors when updating a season', async () => {
      // Set up mocks
      (showsDb.getTMDBIdForShow as jest.Mock).mockResolvedValue(tmdbId);

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValueOnce(100).mockReturnValueOnce(101);
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('Netflix');
      (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([9999]);

      (showsDb.createShow as jest.Mock).mockReturnValue({
        id: showId,
        tmdb_id: tmdbId,
        title: 'Test Show',
      });
      (showsDb.updateShow as jest.Mock).mockResolvedValue(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue([1]);

      const mockError = new Error('Season update error');
      (seasonsDb.updateSeason as jest.Mock).mockRejectedValue(mockError);

      // Log spy to verify error is logged but not thrown
      const logSpy = jest.spyOn(cliLogger, 'error');

      // Execute test
      const result = await showService.updateShowById(showId);

      // Verify the error was logged but the function still completed successfully
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating season 2 for show ${showId}`),
        mockError,
      );
      expect(result).toBe(true);
    });
  });

  describe('getAllShows', () => {
    const mockShows = [
      { id: 1, title: 'Show 1', created_at: '2023-01-01', updated_at: '2023-01-10' },
      { id: 2, title: 'Show 2', created_at: '2023-02-01', updated_at: '2023-02-10' },
    ];

    const mockPaginationResult = {
      shows: mockShows,
      pagination: {
        totalCount: 10,
        totalPages: 5,
        currentPage: 1,
        limit: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };

    it('should return shows with pagination from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await showService.getAllShows(1, 0, 2);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('allShows_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
    });

    it('should fetch shows with pagination from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(10);
      (showsDb.getAllShows as jest.Mock).mockResolvedValue(mockShows);

      const result = await showService.getAllShows(1, 0, 2);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getShowsCount).toHaveBeenCalled();
      expect(showsDb.getAllShows).toHaveBeenCalledWith(2, 0);

      expect(result).toEqual({
        shows: mockShows,
        pagination: {
          totalCount: 10,
          totalPages: 5,
          currentPage: 1,
          limit: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should use default values when not provided', async () => {
      mockCache.getOrSet.mockImplementation(async (key, fn) => fn());

      (showsDb.getShowsCount as jest.Mock).mockResolvedValue(100);
      (showsDb.getAllShows as jest.Mock).mockResolvedValue(mockShows);

      await showService.getAllShows(1, 0, 50);

      expect(showsDb.getAllShows).toHaveBeenCalledWith(50, 0);
    });
  });

  describe('fetchSeasonsAndEpisodes', () => {
    // This is a private method, so we need to access it through the showService instance
    // We'll create a test-friendly version by exposing it temporarily
    let originalFetchSeasonsAndEpisodes: any;
    let fetchSeasonsAndEpisodes: any;

    beforeEach(() => {
      // Save the original method and create a public accessor for testing
      originalFetchSeasonsAndEpisodes = (showService as any).fetchSeasonsAndEpisodes;
      fetchSeasonsAndEpisodes = async (...args: any[]) => {
        return (showService as any).fetchSeasonsAndEpisodes(...args);
      };
    });

    afterEach(() => {
      // Restore the original method
      (showService as any).fetchSeasonsAndEpisodes = originalFetchSeasonsAndEpisodes;
    });

    const showId = 123;
    const profileId = '456';
    const mockShow = {
      id: 789,
      name: 'Test Show',
      overview: 'A test show',
      first_air_date: '2023-01-01',
      seasons: [
        {
          air_date: '2023-01-01',
          episode_count: 2,
          id: 100,
          name: 'Season 1',
          overview: 'Season 1 overview',
          poster_path: '/season1_poster.jpg',
          season_number: 1,
        },
      ],
    };

    const mockSeasonDetails = {
      id: 100,
      name: 'Season 1',
      episodes: [
        {
          id: 1001,
          name: 'Episode 1',
          overview: 'Episode 1 overview',
          episode_number: 1,
          episode_type: 'standard',
          season_number: 1,
          air_date: '2023-01-01',
          runtime: 45,
          still_path: '/ep1_still.jpg',
        },
        {
          id: 1002,
          name: 'Episode 2',
          overview: 'Episode 2 overview',
          episode_number: 2,
          episode_type: 'standard',
          season_number: 1,
          air_date: '2023-01-08',
          runtime: 42,
          still_path: '/ep2_still.jpg',
        },
      ],
    };

    it('should fetch and save seasons and episodes', async () => {
      const mockTMDBService = {
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      const mockSeason = {
        id: 201,
        show_id: showId,
        tmdb_id: 100,
        name: 'Season 1',
      };
      (seasonsDb.createSeason as jest.Mock).mockReturnValue(mockSeason);
      (seasonsDb.saveSeason as jest.Mock).mockResolvedValue(mockSeason);
      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockEpisode1 = { id: 301, tmdb_id: 1001, show_id: showId, season_id: 201 };
      const mockEpisode2 = { id: 302, tmdb_id: 1002, show_id: showId, season_id: 201 };
      (episodesDb.createEpisode as jest.Mock).mockReturnValueOnce(mockEpisode1).mockReturnValueOnce(mockEpisode2);
      (episodesDb.saveEpisode as jest.Mock).mockResolvedValueOnce(mockEpisode1).mockResolvedValueOnce(mockEpisode2);
      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockProfileShow = { show_id: showId, profile_id: Number(profileId), title: 'Test Show' };
      (showsDb.getShowForProfile as jest.Mock).mockResolvedValue(mockProfileShow);

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as NodeJS.Timeout;
      });

      await fetchSeasonsAndEpisodes(mockShow, showId, profileId);

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(789, 1);

      expect(seasonsDb.createSeason).toHaveBeenCalledWith(
        showId,
        100,
        'Season 1',
        'Season 1 overview',
        1,
        '2023-01-01',
        '/season1_poster.jpg',
        2,
      );
      expect(seasonsDb.saveSeason).toHaveBeenCalledWith(mockSeason);
      expect(seasonsDb.saveFavorite).toHaveBeenCalledWith(Number(profileId), 201);

      expect(episodesDb.createEpisode).toHaveBeenCalledTimes(2);
      expect(episodesDb.saveEpisode).toHaveBeenCalledTimes(2);
      expect(episodesDb.saveFavorite).toHaveBeenCalledTimes(2);

      expect(showsDb.getShowForProfile).toHaveBeenCalledWith(profileId, showId);
      expect(socketService.notifyShowDataLoaded).toHaveBeenCalledWith(profileId, showId, mockProfileShow);
    });

    it('should handle API errors without failing', async () => {
      const mockError = new Error('API error');
      const mockTMDBService = {
        getSeasonDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      // Log spy to verify error is logged
      const logSpy = jest.spyOn(cliLogger, 'error');

      await fetchSeasonsAndEpisodes(mockShow, showId, profileId);

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(789, 1);
      expect(logSpy).toHaveBeenCalledWith('Error fetching seasons and episodes:', mockError);
    });

    it('should skip seasons with season_number = 0', async () => {
      const showWithSpecials = {
        ...mockShow,
        seasons: [
          {
            air_date: '2022-12-01',
            episode_count: 3,
            id: 99,
            name: 'Specials',
            overview: 'Special episodes',
            poster_path: '/specials_poster.jpg',
            season_number: 0,
          },
          {
            air_date: '2023-01-01',
            episode_count: 2,
            id: 100,
            name: 'Season 1',
            overview: 'Season 1 overview',
            poster_path: '/season1_poster.jpg',
            season_number: 1,
          },
        ],
      };

      const mockTMDBService = {
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await fetchSeasonsAndEpisodes(showWithSpecials, showId, profileId);

      // It should skip season 0 and only process season 1
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(1);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(789, 1);
      expect(mockTMDBService.getSeasonDetails).not.toHaveBeenCalledWith(789, 0);
    });
  });
});
