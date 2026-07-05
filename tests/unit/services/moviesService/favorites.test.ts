import { setupMoviesService } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '@utils/contentUtility';
import { getUSWatchProvidersMovie } from '@utils/watchProvidersUtility';

describe('MoviesService - Favorites', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('addMovieToFavorites', () => {
    it('should add existing movie to favorites', async () => {
      const mockMovie = {
        id: 5,
        tmdb_id: 12345,
        title: 'Existing Movie',
        releaseDate: '2099-12-31', // Future date to trigger UNAIRED status
      };
      const mockMovieForProfile = { movie_id: 5, title: 'Existing Movie' };
      const mockRecentMovies = [{ movie_id: 1 }];
      const mockUpcomingMovies = [{ movie_id: 2 }];

      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.saveFavorite as jest.Mock).mockResolvedValue(true);
      (moviesDb.hasMovieWatchHistory as jest.Mock).mockResolvedValue(false);

      // First call returns null (movie not yet favorited), second call returns the movie after it's favorited
      (moviesDb.getMovieForProfile as jest.Mock)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(mockMovieForProfile);

      mockCache.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCache.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await service.addMovieToFavorites(123, 12345);

      expect(moviesDb.findMovieByTMDBId).toHaveBeenCalledWith(12345);
      expect(moviesDb.saveFavorite).toHaveBeenCalledWith(123, 5, WatchStatus.UNAIRED);
      expect(mockCache.invalidateProfileMovies).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        favoritedMovie: mockMovieForProfile,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
        hasSurvivingHistory: false,
      });
    });

    it('should rebuild status from history when restoreFromHistory is true and history exists', async () => {
      const mockMovie = {
        id: 5,
        tmdb_id: 12345,
        title: 'Existing Movie',
        releaseDate: '2099-12-31',
      };
      const mockMovieForProfile = { movie_id: 5, title: 'Existing Movie' };

      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.saveFavorite as jest.Mock).mockResolvedValue(true);
      (moviesDb.hasMovieWatchHistory as jest.Mock).mockResolvedValue(true);
      (moviesDb.rebuildMovieStatusFromHistory as jest.Mock).mockResolvedValue(true);
      (moviesDb.getMovieForProfile as jest.Mock)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(mockMovieForProfile);
      mockCache.getOrSet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.addMovieToFavorites(123, 12345, true);

      expect(moviesDb.rebuildMovieStatusFromHistory).toHaveBeenCalledWith(123, 5);
      expect(result.hasSurvivingHistory).toBe(true);
    });

    it('should not rebuild status from history when restoreFromHistory is true but no history exists', async () => {
      const mockMovie = {
        id: 5,
        tmdb_id: 12345,
        title: 'Existing Movie',
        releaseDate: '2099-12-31',
      };

      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.saveFavorite as jest.Mock).mockResolvedValue(true);
      (moviesDb.hasMovieWatchHistory as jest.Mock).mockResolvedValue(false);
      (moviesDb.getMovieForProfile as jest.Mock)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ movie_id: 5 });
      mockCache.getOrSet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.addMovieToFavorites(123, 12345, true);

      expect(moviesDb.rebuildMovieStatusFromHistory).not.toHaveBeenCalled();
    });

    it('should rebuild status from history when restoreFromHistory is true even if the movie is already favorited (regression: restore-dialog second call)', async () => {
      // Regression test for a real bug: the "already favorited" branch (movie_watch_status row
      // already exists — as it would after the first addMovieFavorite call that surfaced the
      // restore dialog) used to return early before ever checking restoreFromHistory, so the
      // user's "Restore previous watch status" choice on the second call was silently ignored.
      const mockMovie = {
        id: 5,
        tmdb_id: 12345,
        title: 'Existing Movie',
        releaseDate: '2099-12-31',
      };
      const mockMovieForProfile = { movie_id: 5, title: 'Existing Movie', watchStatus: WatchStatus.WATCHED };

      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.hasMovieWatchHistory as jest.Mock).mockResolvedValue(true);
      (moviesDb.rebuildMovieStatusFromHistory as jest.Mock).mockResolvedValue(true);
      // Already favorited: getMovieForProfile resolves truthy on the very first call.
      (moviesDb.getMovieForProfile as jest.Mock).mockResolvedValue(mockMovieForProfile);
      mockCache.getOrSet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.addMovieToFavorites(123, 12345, true);

      expect(moviesDb.saveFavorite).not.toHaveBeenCalled();
      expect(moviesDb.hasMovieWatchHistory).toHaveBeenCalledWith(123, 5);
      expect(moviesDb.rebuildMovieStatusFromHistory).toHaveBeenCalledWith(123, 5);
      expect(result.hasSurvivingHistory).toBe(true);
      expect(result.favoritedMovie).toEqual(mockMovieForProfile);
    });

    it('should fetch and add new movie from TMDB', async () => {
      const mockTMDBResponse = {
        id: 12345,
        title: 'New Movie',
        overview: 'Description',
        release_date: '2023-01-01',
        runtime: 120,
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.5,
        release_dates: { results: [] },
        genres: [{ id: 28 }, { id: 12 }],
      };

      const mockMovieForProfile = { id: 5, title: 'New Movie' };
      const mockRecentMovies = [{ movie_id: 1 }];
      const mockUpcomingMovies = [{ movie_id: 2 }];

      const mockTMDBService = { getMovieDetails: jest.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(null);
      (moviesDb.getMovieForProfile as jest.Mock).mockResolvedValue(mockMovieForProfile);
      (moviesDb.saveMovie as jest.Mock).mockImplementation(() => {
        return 5;
      });
      (moviesDb.saveFavorite as jest.Mock).mockReturnValue(true);
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getDirectors as jest.Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as jest.Mock).mockReturnValue('MGM Global');
      (getUSWatchProvidersMovie as jest.Mock).mockReturnValue([8, 9]);
      mockCache.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCache.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await service.addMovieToFavorites(123, 12345);
      // Brand-new movies never have prior history — service returns hasSurvivingHistory: false
      // without calling hasMovieWatchHistory (see assertions below).

      expect(moviesDb.findMovieByTMDBId).toHaveBeenCalledWith(12345);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(12345);
      expect(moviesDb.saveMovie).toHaveBeenCalledWith({
        tmdb_id: 12345,
        title: 'New Movie',
        description: 'Description',
        release_date: '2023-01-01',
        runtime: 120,
        poster_image: '/poster.jpg',
        backdrop_image: '/backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        director: 'Steven Jones',
        production_companies: 'MGM Global',
        genre_ids: [28, 12],
        streaming_service_ids: [8, 9],
      });
      expect(moviesDb.saveMovie).toHaveBeenCalled();
      expect(moviesDb.saveFavorite).toHaveBeenCalledWith(123, 5, WatchStatus.NOT_WATCHED);
      expect(moviesDb.hasMovieWatchHistory).not.toHaveBeenCalled();
      expect(result).toEqual({
        favoritedMovie: mockMovieForProfile,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
        hasSurvivingHistory: false,
      });
    });

    it('should throw error when save favorite for movie fails', async () => {
      const mockTMDBResponse = {
        id: 12345,
        title: 'New Movie',
        overview: 'Description',
        release_date: '2023-01-01',
        runtime: 120,
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.5,
        release_dates: { results: [] },
        genres: [{ id: 28 }, { id: 12 }],
      };

      const mockTMDBService = { getMovieDetails: jest.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(null);
      (moviesDb.saveFavorite as jest.Mock).mockReturnValue(false);
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getDirectors as jest.Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as jest.Mock).mockReturnValue('MGM Global');
      (getUSWatchProvidersMovie as jest.Mock).mockReturnValue([8, 9]);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.addMovieToFavorites(123, 12345)).rejects.toThrow('Failed to save a movie as a favorite');
      expect(moviesDb.saveMovie).toHaveBeenCalled();
    });

    it('should handle TMDB API errors', async () => {
      const error = new Error('TMDB API error');
      const mockTMDBService = { getMovieDetails: jest.fn().mockRejectedValue(error) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(null);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.addMovieToFavorites(123, 12345)).rejects.toThrow('TMDB API error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'addMovieToFavorites(123, 12345)');
    });
  });

  describe('removeMovieFromFavorites', () => {
    it('should remove a movie from favorites', async () => {
      const mockMovie = {
        id: 5,
        title: 'Movie to Remove',
      };

      const mockRecentMovies = [{ movie_id: 1 }];
      const mockUpcomingMovies = [{ movie_id: 2 }];

      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(mockMovie);
      mockCache.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCache.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await service.removeMovieFromFavorites(123, 5);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(5);
      expect(moviesDb.removeFavorite).toHaveBeenCalledWith(123, 5, false);
      expect(mockCache.invalidateProfileMovies).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        removedMovie: mockMovie,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
      });
    });

    it('should pass removeHistory through to moviesDb.removeFavorite when true', async () => {
      const mockMovie = { id: 5, title: 'Movie to Remove' };
      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(mockMovie);
      mockCache.getOrSet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.removeMovieFromFavorites(123, 5, true);

      expect(moviesDb.removeFavorite).toHaveBeenCalledWith(123, 5, true);
    });

    it('should throw NotFoundError when movie does not exist', async () => {
      const profileId = 123;
      const movieId = 999;
      const notFoundError = new NotFoundError(`Movie with ID ${movieId} not found`);

      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(null);

      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw notFoundError;
      });

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(service.removeMovieFromFavorites(profileId, movieId)).rejects.toThrow(notFoundError);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(movieId);
      expect(errorService.assertExists).toHaveBeenCalledWith(null, 'Movie', movieId);
      expect(errorService.handleError).toHaveBeenCalledWith(
        notFoundError,
        `removeMovieFromFavorites(${profileId}, ${movieId})`,
      );
      expect(moviesDb.removeFavorite).not.toHaveBeenCalled();
      expect(mockCache.invalidateProfileMovies).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.findMovieById as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.removeMovieFromFavorites(123, 5)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'removeMovieFromFavorites(123, 5)');
    });
  });
});
