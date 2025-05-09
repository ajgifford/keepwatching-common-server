import { mockTMDBResponses } from './showService/helpers/fixtures';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { appLogger, cliLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { adminShowService } from '@services/adminShowService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import * as contentUtility from '@utils/contentUtility';
import * as watchProvidersUtility from '@utils/watchProvidersUtility';

// Mock the repositories and services
jest.mock('@db/showsDb');
jest.mock('@db/seasonsDb');
jest.mock('@db/episodesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
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
  appLogger: {
    error: jest.fn(),
  },
}));

describe('AdminShowService', () => {
  let mockCacheService: jest.Mocked<any>;

  const mockShowId = 123;
  const mockSeasonId = 456;
  const mockShowDetails = { id: mockShowId, title: 'Test Show', tmdbId: 999 };
  const mockSeasons = [{ id: mockSeasonId, name: 'Season 1', seasonNumber: 1 }];
  const mockEpisodes = [{ id: 789, title: 'Episode 1', episodeNumber: 1 }];
  const mockProfiles = [{ profileId: 101, name: 'Test User', watchStatus: 'WATCHING' }];
  const mockWatchProgress = [
    {
      profileId: 101,
      name: 'Test User',
      totalEpisodes: 10,
      watchedEpisodes: 5,
      percentComplete: 50,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      getOrSet: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
    };

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    Object.defineProperty(adminShowService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (showsDb.getAdminShowDetails as jest.Mock).mockResolvedValue(mockShowDetails);
    (showsDb.getAdminShowSeasons as jest.Mock).mockResolvedValue(mockSeasons);
    (showsDb.getAdminSeasonEpisodes as jest.Mock).mockResolvedValue(mockEpisodes);
    (showsDb.getAdminShowProfiles as jest.Mock).mockResolvedValue(mockProfiles);
    (showsDb.getAdminShowWatchProgress as jest.Mock).mockResolvedValue(mockWatchProgress);
    (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue([
      { ...mockSeasons[0], episodes: mockEpisodes },
    ]);

    (errorService.handleError as jest.Mock).mockImplementation((err) => {
      throw err;
    });

    (contentUtility.getUSRating as jest.Mock).mockReturnValue('TV-14');
    (contentUtility.getInProduction as jest.Mock).mockReturnValue(1);
    (contentUtility.getEpisodeToAirId as jest.Mock).mockReturnValue(null);
    (contentUtility.getUSNetwork as jest.Mock).mockReturnValue('HBO');
    (watchProvidersUtility.getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

    // Set up TMDB service mock with default implementation
    (getTMDBService as jest.Mock).mockReturnValue({
      getShowDetails: jest.fn().mockResolvedValue(mockTMDBResponses.showDetails),
      getSeasonDetails: jest.fn().mockResolvedValue(mockTMDBResponses.seasonDetails),
      getShowRecommendations: jest.fn().mockResolvedValue(mockTMDBResponses.showRecommendations),
      getSimilarShows: jest.fn().mockResolvedValue(mockTMDBResponses.similarShows),
      getShowChanges: jest.fn().mockResolvedValue(mockTMDBResponses.showChanges),
    });

    // Set up Socket service mock with default implementation
    (socketService.notifyShowsUpdate as jest.Mock).mockImplementation(() => {});
    (socketService.notifyShowDataLoaded as jest.Mock).mockImplementation(() => {});
  });

  describe('getShowDetails', () => {
    it('should return cached show details when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockShowDetails);

      const result = await adminShowService.getShowDetails(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockShowDetails);
      expect(showsDb.getAdminShowDetails).not.toHaveBeenCalled();
    });

    it('should fetch show details from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowDetails(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowDetails).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockShowDetails);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Repository error');
      (showsDb.getAdminShowDetails as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getShowDetails(mockShowId)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowDetails(${mockShowId})`);
    });
  });

  describe('getShowSeasons', () => {
    it('should return cached seasons when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSeasons);

      const result = await adminShowService.getShowSeasons(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockSeasons);
      expect(showsDb.getAdminShowSeasons).not.toHaveBeenCalled();
    });

    it('should fetch seasons from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowSeasons(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowSeasons).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockSeasons);
    });
  });

  describe('getSeasonEpisodes', () => {
    it('should return cached episodes when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockEpisodes);

      const result = await adminShowService.getSeasonEpisodes(mockSeasonId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockEpisodes);
      expect(showsDb.getAdminSeasonEpisodes).not.toHaveBeenCalled();
    });

    it('should fetch episodes from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getSeasonEpisodes(mockSeasonId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminSeasonEpisodes).toHaveBeenCalledWith(mockSeasonId);
      expect(result).toEqual(mockEpisodes);
    });
  });

  describe('getShowProfiles', () => {
    it('should return cached profiles when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockProfiles);

      const result = await adminShowService.getShowProfiles(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockProfiles);
      expect(showsDb.getAdminShowProfiles).not.toHaveBeenCalled();
    });

    it('should fetch profiles from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowProfiles(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowProfiles).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('getShowWatchProgress', () => {
    it('should return cached watch progress when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockWatchProgress);

      const result = await adminShowService.getShowWatchProgress(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockWatchProgress);
      expect(showsDb.getAdminShowWatchProgress).not.toHaveBeenCalled();
    });

    it('should fetch watch progress from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminShowService.getShowWatchProgress(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowWatchProgress).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockWatchProgress);
    });
  });

  describe('getCompleteShowInfo', () => {
    it('should return cached complete show info when available', async () => {
      const mockCompleteInfo = {
        details: mockShowDetails,
        seasons: [{ ...mockSeasons[0], episodes: mockEpisodes }],
        profiles: mockProfiles,
        watchProgress: mockWatchProgress,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockCompleteInfo);

      const result = await adminShowService.getCompleteShowInfo(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockCompleteInfo);
    });

    it('should fetch and build complete show info when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const mockSeasonsWithEpisodes = [
        {
          ...mockSeasons[0],
          episodes: mockEpisodes,
        },
      ];

      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getCompleteShowInfo(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowDetails).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowSeasonsWithEpisodes).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowProfiles).toHaveBeenCalledWith(mockShowId);
      expect(showsDb.getAdminShowWatchProgress).toHaveBeenCalledWith(mockShowId);

      // The method should no longer call getAdminSeasonEpisodes since we're using the optimized method
      expect(showsDb.getAdminSeasonEpisodes).not.toHaveBeenCalled();

      expect(result).toEqual({
        details: mockShowDetails,
        seasons: mockSeasonsWithEpisodes,
        profiles: mockProfiles,
        watchProgress: mockWatchProgress,
      });
    });
  });

  describe('getShowSeasonsWithEpisodes', () => {
    const mockSeasonsWithEpisodes = [
      {
        id: mockSeasonId,
        name: 'Season 1',
        episodes: [
          { id: 101, title: 'Episode 1' },
          { id: 102, title: 'Episode 2' },
        ],
      },
    ];

    it('should return cached seasons with episodes when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getShowSeasonsWithEpisodes(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockSeasonsWithEpisodes);
      expect(showsDb.getAdminShowSeasonsWithEpisodes).not.toHaveBeenCalled();
    });

    it('should fetch seasons with episodes from repository when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockResolvedValue(mockSeasonsWithEpisodes);

      const result = await adminShowService.getShowSeasonsWithEpisodes(mockShowId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(showsDb.getAdminShowSeasonsWithEpisodes).toHaveBeenCalledWith(mockShowId);
      expect(result).toEqual(mockSeasonsWithEpisodes);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Repository error');
      (showsDb.getAdminShowSeasonsWithEpisodes as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminShowService.getShowSeasonsWithEpisodes(mockShowId)).rejects.toThrow();
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getShowSeasonsWithEpisodes(${mockShowId})`);
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

      const result = await adminShowService.updateShowById(showId, tmdbId, updateMode);

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

      await adminShowService.updateShowById(showId, tmdbId, 'all');

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
      const result = await adminShowService.updateShowById(showId, tmdbId);

      // Verify the error was logged but the function still completed successfully
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating season 2 for show ${showId}`),
        mockError,
      );
      expect(result).toBe(true);
    });
  });

  describe('invalidateShowCache', () => {
    it('should invalidate all cache keys related to a show', () => {
      adminShowService.invalidateShowCache(mockShowId);

      // Check that all cache keys are invalidated, including the new one
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_details'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_seasons'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        expect.stringContaining('admin_show_seasons_with_episodes'),
      );
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_profiles'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_watch_progress'));
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(expect.stringContaining('admin_show_complete'));
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(expect.stringContaining('admin_season_episodes'));
    });
  });
});
