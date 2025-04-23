import {
  mockNextUnwatchedEpisodes,
  mockRecentEpisodes,
  mockTMDBResponses,
  mockUpcomingEpisodes,
} from './helpers/fixtures';
import { setupDbMocks, setupShowService, testUtils } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { cliLogger } from '@logger/logger';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Episodes', () => {
  let service: ReturnType<typeof setupShowService>['service'];
  let mockCache: ReturnType<typeof setupShowService>['mockCache'];

  beforeEach(() => {
    const setup = setupShowService();
    service = setup.service;
    mockCache = setup.mockCache;
    setupDbMocks();
  });

  describe('getEpisodesForProfile', () => {
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
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

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
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (episodesDb.getRecentEpisodesForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getEpisodesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getEpisodesForProfile(123)');
    });
  });

  describe('getNextUnwatchedEpisodesForProfile', () => {
    it('should return next unwatched episodes from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_unwatched_episodes', expect.any(Function), 300);
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should fetch next unwatched episodes from database when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockNextUnwatchedEpisodes);
    });

    it('should handle empty results', async () => {
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getNextUnwatchedEpisodesForProfile('123');

      expect(result).toEqual([]);
      expect(showsDb.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith('123');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (showsDb.getNextUnwatchedEpisodesForProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.getNextUnwatchedEpisodesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getNextUnwatchedEpisodesForProfile(123)');
    });
  });

  describe('fetchSeasonsAndEpisodes', () => {
    let originalFetchSeasonsAndEpisodes: any;
    let fetchSeasonsAndEpisodes: any;

    beforeEach(() => {
      originalFetchSeasonsAndEpisodes = (service as any).fetchSeasonsAndEpisodes;
      fetchSeasonsAndEpisodes = async (...args: any[]) => {
        return (service as any).fetchSeasonsAndEpisodes(...args);
      };
    });

    afterEach(() => {
      (service as any).fetchSeasonsAndEpisodes = originalFetchSeasonsAndEpisodes;
    });

    const showId = 123;
    const profileId = '456';
    const mockShow = mockTMDBResponses.showDetails;

    it('should fetch and save seasons and episodes', async () => {
      const mockTMDBService = getTMDBService() as jest.Mocked<ReturnType<typeof getTMDBService>>;

      const showWithOneSeason = {
        ...mockShow,
        seasons: [mockShow.seasons[0]], // Only include the first season
      };

      mockTMDBService.getSeasonDetails.mockResolvedValue(mockTMDBResponses.seasonDetails);

      const mockSeason = {
        id: 201,
        show_id: showId,
        tmdb_id: 100,
        name: 'Season 1',
      };
      (seasonsDb.saveSeason as jest.Mock).mockResolvedValue(mockSeason);

      const mockEpisode1 = { id: 301, tmdb_id: 1001, show_id: showId, season_id: 201 };
      const mockEpisode2 = { id: 302, tmdb_id: 1002, show_id: showId, season_id: 201 };
      (episodesDb.saveEpisode as jest.Mock).mockResolvedValueOnce(mockEpisode1).mockResolvedValueOnce(mockEpisode2);

      const mockProfileShow = { show_id: showId, profile_id: Number(profileId), title: 'Test Show' };
      (showsDb.getShowForProfile as jest.Mock).mockResolvedValue(mockProfileShow);

      const timeoutSpy = testUtils.mockImmediateTimeout();

      await fetchSeasonsAndEpisodes(showWithOneSeason, showId, profileId);

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(mockShow.id, 1);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(1);
      expect(seasonsDb.saveSeason).toHaveBeenCalledWith(
        expect.objectContaining({
          show_id: showId,
          tmdb_id: mockShow.seasons[0].id,
          name: mockShow.seasons[0].name,
        }),
      );

      expect(seasonsDb.saveFavorite).toHaveBeenCalledWith(Number(profileId), 201);
      expect(episodesDb.saveEpisode).toHaveBeenCalledTimes(2);
      expect(episodesDb.saveFavorite).toHaveBeenCalledTimes(2);
      expect(showsDb.getShowForProfile).toHaveBeenCalledWith(profileId, showId);
      expect(socketService.notifyShowDataLoaded).toHaveBeenCalledWith(profileId, showId, mockProfileShow);

      timeoutSpy.mockRestore();
    });

    it('should handle API errors without failing', async () => {
      const mockError = new Error('API error');
      const mockTMDBService = getTMDBService() as jest.Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getSeasonDetails.mockRejectedValue(mockError);

      const logSpy = jest.spyOn(cliLogger, 'error');

      const timeoutSpy = testUtils.mockImmediateTimeout();

      await fetchSeasonsAndEpisodes(mockShow, showId, profileId);

      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(mockShow.id, 1);
      expect(logSpy).toHaveBeenCalledWith('Error fetching seasons and episodes:', mockError);

      timeoutSpy.mockRestore();
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
          ...mockShow.seasons,
        ],
      };

      const mockTMDBService = getTMDBService() as jest.Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getSeasonDetails.mockResolvedValue(mockTMDBResponses.seasonDetails);

      const timeoutSpy = testUtils.mockImmediateTimeout();

      await fetchSeasonsAndEpisodes(showWithSpecials, showId, profileId);

      // It should skip season 0 and only process season 1
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledTimes(1);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(showWithSpecials.id, 1);
      expect(mockTMDBService.getSeasonDetails).not.toHaveBeenCalledWith(showWithSpecials.id, 0);

      timeoutSpy.mockRestore();
    });
  });
});
