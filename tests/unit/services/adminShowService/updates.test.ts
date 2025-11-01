import { mockSeasonDetails, mockTMDBShow } from './helpers/fixtures';
import { createMockCacheService, setupDefaultMocks } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { appLogger, cliLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { adminShowService } from '@services/adminShowService';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as notificationUtility from '@utils/notificationUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

// Mock the repositories and services
jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/socketService');
jest.mock('@services/showService');
jest.mock('@services/tmdbService');
jest.mock('@utils/db');
jest.mock('@utils/contentUtility');
jest.mock('@utils/notificationUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  appLogger: {
    error: jest.fn(),
  },
}));

describe('AdminShowService - Updates', () => {
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = createMockCacheService();
    setupDefaultMocks(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('updateShowById', () => {
    const showId = 123;
    const tmdbId = 456;
    const updateMode = 'latest';

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
      (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([9999]);

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue({ id: showId, seasonCount: 2 });
      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [
          { accountId: 1, profileId: 1 },
          { accountId: 1, profileId: 2 },
        ],
        totalCount: 2,
      });

      const mockSeason = {
        id: 201,
        tmdb_id: 101,
        name: 'Season 2',
        show_id: showId,
      };

      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(mockSeason);
      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockEpisode = {
        id: 301,
        tmdb_id: 1001,
        show_id: showId,
        season_id: 201,
      };

      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(mockEpisode);
      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
      (showService.checkAndUpdateShowStatus as jest.Mock).mockResolvedValue(undefined);

      const result = await adminShowService.updateShowById(showId, tmdbId, updateMode);

      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(tmdbId);
      expect(contentUtility.getUSRating).toHaveBeenCalledWith(mockTMDBShow.content_ratings);
      expect(contentUtility.getInProduction).toHaveBeenCalledWith(mockTMDBShow);
      expect(contentUtility.getEpisodeToAirId).toHaveBeenCalledWith(mockTMDBShow.last_episode_to_air);
      expect(contentUtility.getEpisodeToAirId).toHaveBeenCalledWith(mockTMDBShow.next_episode_to_air);
      expect(contentUtility.getUSNetwork).toHaveBeenCalledWith(mockTMDBShow.networks);
      expect(watchProvidersUtility.getUSWatchProvidersShow).toHaveBeenCalledWith(mockTMDBShow);

      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(showsDb.getProfilesForShow).toHaveBeenCalledWith(showId);

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(mockTMDBShow.id, 2);
      expect(seasonsDb.updateSeason).toHaveBeenCalled();
      expect(seasonsDb.saveFavorite).toHaveBeenCalledTimes(2); // Once for each profile

      expect(episodesDb.updateEpisode).toHaveBeenCalledTimes(2); // Two episodes in the season
      expect(episodesDb.saveFavorite).toHaveBeenCalledTimes(4); // Two episodes for two profiles

      expect(socketService.notifyShowsUpdate).toHaveBeenCalled();
      expect(mockCacheService.invalidate).toHaveBeenCalled();

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
      (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([9999]);

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue({ id: showId, seasonCount: 2 });
      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [
          { accountId: 1, profileId: 1 },
          { accountId: 1, profileId: 2 },
          { accountId: 2, profileId: 3 },
        ],
        totalCount: 1,
      });

      const mockSeason = {
        id: 201,
        tmdb_id: 101,
        name: 'Season 2',
        show_id: showId,
      };

      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(mockSeason);

      const mockEpisode = {
        id: 301,
        tmdb_id: 1001,
        show_id: showId,
        season_id: 201,
      };

      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(mockEpisode);

      await adminShowService.updateShowById(showId, tmdbId, 'all');

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(1, mockTMDBShow.id, 2);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenNthCalledWith(2, mockTMDBShow.id, 1);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getShowDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await expect(adminShowService.updateShowById(showId, tmdbId)).rejects.toThrow('TMDB API error');
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
      (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([9999]);

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue({ id: showId, seasonCount: 2 });
      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [{ accountId: 1, profileId: 1 }],
        totalCount: 1,
      });

      const mockError = new Error('Season update error');
      (seasonsDb.updateSeason as jest.Mock).mockRejectedValue(mockError);

      // Log spy to verify error is logged but not thrown
      const logSpy = jest.spyOn(cliLogger, 'error');

      // Execute test
      const result = await adminShowService.updateShowById(showId, tmdbId);

      // Verify the error was logged but the function still completed successfully
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating season 2 for show ${showId}`),
        mockError,
      );
      expect(result).toBe(true);
    });

    it('should return false when show update fails', async () => {
      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockTMDBShow),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
      (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
      (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValueOnce(100).mockReturnValueOnce(101);
      (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('Netflix');
      (watchProvidersUtility.getUSWatchProvidersShow as jest.Mock).mockReturnValue([9999]);

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue({ id: showId, seasonCount: 2 });
      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(false);

      const result = await adminShowService.updateShowById(showId, tmdbId);

      expect(result).toBe(false);
      expect(showsDb.updateShow).toHaveBeenCalled();
      expect(showsDb.getProfilesForShow).not.toHaveBeenCalled();
    });

    it('should filter out season 0 (specials) from updates', async () => {
      const showWithSeasonZero = {
        ...mockTMDBShow,
        seasons: [
          {
            air_date: '2023-01-01',
            episode_count: 5,
            id: 99,
            name: 'Specials',
            overview: 'Special episodes',
            poster_path: '/specials_poster.jpg',
            season_number: 0,
            vote_average: 7.0,
          },
          ...mockTMDBShow.seasons,
        ],
      };

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(showWithSeasonZero),
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue({ id: showId, seasonCount: 2 });
      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [{ accountId: 1, profileId: 1 }],
        totalCount: 1,
      });

      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(201);
      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(301);
      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);
      (showService.checkAndUpdateShowStatus as jest.Mock).mockResolvedValue(undefined);

      await adminShowService.updateShowById(showId, tmdbId, 'latest');

      // Wait for async processShowCast to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Should only process season 2 (latest), not season 0
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(1);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(showWithSeasonZero.id, 2);
    });

    it('should create notifications when new seasons are added', async () => {
      const mockCurrentShow = { id: showId, seasonCount: 1 };
      const mockShowWithNewSeason = {
        ...mockTMDBShow,
        number_of_seasons: 3,
      };

      (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue(mockCurrentShow);

      const mockTMDBService = {
        getShowDetails: jest.fn().mockResolvedValue(mockShowWithNewSeason),
        getSeasonDetails: jest.fn().mockResolvedValue(mockSeasonDetails),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (showsDb.updateShow as jest.Mock).mockResolvedValueOnce(true);
      (showsDb.getProfilesForShow as jest.Mock).mockResolvedValue({
        showId: '1',
        profileAccountMappings: [{ accountId: 1, profileId: 1 }],
        totalCount: 1,
      });

      (seasonsDb.updateSeason as jest.Mock).mockResolvedValue(201);
      (episodesDb.updateEpisode as jest.Mock).mockResolvedValue(301);

      (notificationUtility.createNewSeasonNotifications as jest.Mock).mockResolvedValue(undefined);

      await adminShowService.updateShowById(showId, tmdbId);

      // Wait for async processShowCast to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(notificationUtility.createNewSeasonNotifications).toHaveBeenCalledWith('Test Show', 3, [
        { accountId: 1, profileId: 1 },
      ]);
    });
  });

  describe('updateAllShows', () => {
    const mockShowReferences = [
      { id: 1, tmdbId: 1001, title: 'Show 1', releaseDate: '2023-01-01' },
      { id: 2, tmdbId: 1002, title: 'Show 2', releaseDate: '2023-02-01' },
    ];

    beforeEach(() => {
      jest.spyOn(adminShowService, 'getAllShowReferences').mockResolvedValue(mockShowReferences);
      jest.spyOn(adminShowService, 'updateShowById').mockResolvedValue(true);
    });

    it('should update all shows successfully', async () => {
      await adminShowService.updateAllShows();

      expect(cliLogger.info).toHaveBeenCalledWith('updateAllShows -- Started');
      expect(adminShowService.getAllShowReferences).toHaveBeenCalled();
      expect(adminShowService.updateShowById).toHaveBeenCalledTimes(2);
      expect(adminShowService.updateShowById).toHaveBeenCalledWith(1, 1001);
      expect(adminShowService.updateShowById).toHaveBeenCalledWith(2, 1002);
      expect(cliLogger.info).toHaveBeenCalledWith('updateAllShows -- Ended');
    });

    it('should handle errors properly', async () => {
      const error = new Error('Update error');
      jest.spyOn(adminShowService, 'getAllShowReferences').mockRejectedValue(error);

      await expect(adminShowService.updateAllShows()).rejects.toThrow();
      expect(cliLogger.info).toHaveBeenCalledWith('updateAllShows -- Started');
      expect(cliLogger.info).toHaveBeenCalledWith('updateAllShows -- Error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateAllShows()');
    });
  });
});
