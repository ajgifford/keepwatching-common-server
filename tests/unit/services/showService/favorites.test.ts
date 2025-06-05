import { createMockCache, setupMocks } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Favorites', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  const accountId = 1;
  const profileId = 456;
  const showTMDBId = 123;
  const showId = 1;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
  });

  describe('addShowToFavorites', () => {
    const mockExistingShow = {
      id: showId,
      tmdb_id: showTMDBId,
      title: 'Existing Show',
      description: 'A show description',
      release_date: '2023-01-01',
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      user_rating: 8.5,
      content_rating: 'TV-MA',
    };

    const mockProfileShow = {
      show_id: showId,
      profile_id: profileId,
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

      const result = await service.addShowToFavorites(accountId, profileId, showTMDBId);

      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(showsDb.saveFavorite).toHaveBeenCalledWith(profileId, showId, true);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        favoritedShow: mockProfileShow,
        episodes: episodeData,
      });
    });

    it('should add a new show to favorites by fetching from TMDB', async () => {
      (showsDb.findShowByTMDBId as jest.Mock).mockResolvedValue(null);

      const mockTMDBShow = {
        id: showTMDBId,
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

      (showsDb.saveShow as jest.Mock).mockResolvedValue(999);

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

      (seasonsDb.saveSeason as jest.Mock)
        .mockResolvedValueOnce(mockSavedSeason1)
        .mockResolvedValueOnce(mockSavedSeason2);

      (seasonsDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      const mockSavedEpisode1 = { id: 301, tmdb_id: 1001, show_id: 999, season_id: 201 };
      const mockSavedEpisode2 = { id: 302, tmdb_id: 1002, show_id: 999, season_id: 201 };
      const mockSavedEpisode3 = { id: 303, tmdb_id: 2001, show_id: 999, season_id: 202 };

      (episodesDb.saveEpisode as jest.Mock)
        .mockResolvedValueOnce(mockSavedEpisode1)
        .mockResolvedValueOnce(mockSavedEpisode2)
        .mockResolvedValueOnce(mockSavedEpisode3);

      (episodesDb.saveFavorite as jest.Mock).mockResolvedValue(undefined);

      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as NodeJS.Timeout;
      });

      const result = await service.addShowToFavorites(accountId, profileId, showTMDBId);

      expect(showsDb.findShowByTMDBId).toHaveBeenCalledWith(123);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getShowDetails).toHaveBeenCalledWith(123);
      expect(showsDb.saveShow).toHaveBeenCalled();
      expect(showsDb.saveFavorite).toHaveBeenCalledWith(profileId, 999, false);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(accountId, profileId);
      expect(mockTMDBService.getSeasonDetails).toHaveBeenCalledWith(showTMDBId, 1);
      expect(result).toHaveProperty('favoritedShow');
      expect(result.favoritedShow).toEqual(mockProfileShow);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowByTMDBId as jest.Mock).mockRejectedValue(error);

      await expect(service.addShowToFavorites(accountId, profileId, 123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(
        error,
        `addShowToFavorites(${accountId}, ${profileId}, ${showTMDBId})`,
      );
    });
  });

  describe('removeShowFromFavorites', () => {
    const mockShow = {
      tmdb_id: 123,
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

      const result = await service.removeShowFromFavorites(accountId, profileId, showId);

      expect(showsDb.findShowById).toHaveBeenCalledWith(showId);
      expect(showsDb.removeFavorite).toHaveBeenCalledWith(profileId, showId);
      expect(mockCache.invalidateProfileShows).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        removedShow: mockShow,
        episodes: mockEpisodeData,
      });
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (showsDb.findShowById as jest.Mock).mockResolvedValue(null);
      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.removeShowFromFavorites(accountId, profileId, 999)).rejects.toThrow(NotFoundError);
      expect(showsDb.findShowById).toHaveBeenCalledWith(999);
      expect(showsDb.removeFavorite).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (showsDb.findShowById as jest.Mock).mockRejectedValue(error);

      await expect(service.removeShowFromFavorites(accountId, profileId, showId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(
        error,
        `removeShowFromFavorites(${accountId}, ${profileId}, ${showId})`,
      );
    });
  });
});
