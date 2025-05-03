import { Change, ContentUpdates } from '../../../../src/types/contentTypes';
import { createMockCache, setupMocks } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { appLogger, cliLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { processSeasonChanges } from '@services/seasonChangesService';
import { ShowService, showService } from '@services/showService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

describe('ShowService - Content Updates', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
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
        1,
        10,
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
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
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
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
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
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId: mockShowContent.id,
      });
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

      const result = await showService.updateShowById(showId, tmdbId, updateMode);

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

      await showService.updateShowById(showId, tmdbId, 'all');

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(1, tmdbId, 2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(2, tmdbId, 1);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getShowDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await expect(showService.updateShowById(showId, tmdbId)).rejects.toThrow('TMDB API error');
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(tmdbId);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowChangeFail, {
        error: mockError,
        showId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateShowById(${showId})`);
    });

    it('should handle errors when updating a season', async () => {
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
      const result = await showService.updateShowById(showId, tmdbId);

      // Verify the error was logged but the function still completed successfully
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating season 2 for show ${showId}`),
        mockError,
      );
      expect(result).toBe(true);
    });
  });
});
