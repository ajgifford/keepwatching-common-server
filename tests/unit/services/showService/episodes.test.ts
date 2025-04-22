import { createMockCache, setupMocks } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { cliLogger } from '@logger/logger';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Episodes', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
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
