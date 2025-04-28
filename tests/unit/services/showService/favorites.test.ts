import { createMockCache, setupMocks } from './helpers/mocks';
import * as episodesDb from '@db/episodesDb';
import * as seasonsDb from '@db/seasonsDb';
import * as showsDb from '@db/showsDb';
import { BadRequestError, NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { ShowService, showService } from '@services/showService';
import { getTMDBService } from '@services/tmdbService';

describe('ShowService - Favorites', () => {
  let service: ShowService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    setupMocks();
    mockCache = createMockCache();

    Object.setPrototypeOf(showService, ShowService.prototype);
    (showService as any).cache = mockCache;
    service = showService;
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
});
