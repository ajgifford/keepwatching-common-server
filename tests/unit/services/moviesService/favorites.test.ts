import { setupMoviesService } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '@utils/contentUtility';
import { getUSWatchProvidersMovie } from '@utils/watchProvidersUtility';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';

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

      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovie);
      (moviesDb.findMovieByTMDBId as Mock).mockResolvedValue(mockMovie);
      (moviesDb.saveFavorite as Mock).mockResolvedValue(true);

      // First call returns null (movie not yet favorited), second call returns the movie after it's favorited
      (moviesDb.getMovieForProfile as Mock)
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
      });
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

      const mockTMDBService = { getMovieDetails: vi.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as Mock).mockResolvedValue(null);
      (moviesDb.getMovieForProfile as Mock).mockResolvedValue(mockMovieForProfile);
      (moviesDb.saveMovie as Mock).mockImplementation(() => {
        return 5;
      });
      (moviesDb.saveFavorite as Mock).mockReturnValue(true);
      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getDirectors as Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as Mock).mockReturnValue('MGM Global');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      mockCache.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCache.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await service.addMovieToFavorites(123, 12345);

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
      expect(result).toEqual({
        favoritedMovie: mockMovieForProfile,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
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

      const mockTMDBService = { getMovieDetails: vi.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as Mock).mockResolvedValue(null);
      (moviesDb.saveFavorite as Mock).mockReturnValue(false);
      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getDirectors as Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as Mock).mockReturnValue('MGM Global');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.addMovieToFavorites(123, 12345)).rejects.toThrow(
        'Failed to save a movie as a favorite',
      );
      expect(moviesDb.saveMovie).toHaveBeenCalled();
    });

    it('should handle TMDB API errors', async () => {
      const error = new Error('TMDB API error');
      const mockTMDBService = { getMovieDetails: vi.fn().mockRejectedValue(error) };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as Mock).mockResolvedValue(null);
      (errorService.handleError as Mock).mockImplementation((err) => {
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

      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovie);
      mockCache.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCache.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await service.removeMovieFromFavorites(123, 5);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(5);
      expect(moviesDb.removeFavorite).toHaveBeenCalledWith(123, 5);
      expect(mockCache.invalidateProfileMovies).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        removedMovie: mockMovie,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
      });
    });

    it('should throw NotFoundError when movie does not exist', async () => {
      const profileId = 123;
      const movieId = 999;
      const notFoundError = new NotFoundError(`Movie with ID ${movieId} not found`);

      (moviesDb.findMovieById as Mock).mockResolvedValue(null);

      (errorService.assertExists as Mock).mockImplementation(() => {
        throw notFoundError;
      });

      (errorService.handleError as Mock).mockImplementation((error) => {
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
      (moviesDb.findMovieById as Mock).mockRejectedValue(error);
      (errorService.handleError as Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.removeMovieFromFavorites(123, 5)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'removeMovieFromFavorites(123, 5)');
    });
  });
});
