import * as moviesDb from '@db/moviesDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { getTMDBService } from '@services/tmdbService';
import { getUSMPARating } from '@utils/contentUtility';
import { getUSWatchProviders } from '@utils/watchProvidersUtility';

jest.mock('@db/moviesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/tmdbService');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');

describe('MoviesService', () => {
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateProfileMovies: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      keys: jest.fn(),
    };

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    Object.defineProperty(moviesService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getMoviesForProfile', () => {
    it('should return movies from cache when available', async () => {
      const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
      mockCacheService.getOrSet.mockResolvedValue(mockMovies);

      const result = await moviesService.getMoviesForProfile('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_movies', expect.any(Function), 600);
      expect(result).toEqual(mockMovies);
    });

    it('should fetch movies from database when not in cache', async () => {
      const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await moviesService.getMoviesForProfile('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getMoviesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMoviesForProfile(123)');
    });
  });

  describe('getRecentMoviesForProfile', () => {
    it('should fetch recent movies', async () => {
      const mockRecentMovies = [{ movie_id: 1, title: 'Recent Movie' }];

      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockRecentMovies);

      const result = await moviesService.getRecentMoviesForProfile('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recent_movies', expect.any(Function), 300);
      expect(moviesDb.getRecentMovieReleasesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockRecentMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getRecentMoviesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getRecentMoviesForProfile(123)');
    });
  });

  describe('getUpcomingMoviesForProfile', () => {
    it('should fetch upcoming movies', async () => {
      const mockUpcomingMovies = [{ movie_id: 2, title: 'Upcoming Movie' }];

      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockUpcomingMovies);

      const result = await moviesService.getUpcomingMoviesForProfile('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_upcoming_movies', expect.any(Function), 300);
      expect(moviesDb.getUpcomingMovieReleasesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockUpcomingMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getUpcomingMoviesForProfile('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getUpcomingMoviesForProfile(123)');
    });
  });

  describe('addMovieToFavorites', () => {
    it('should add existing movie to favorites', async () => {
      const mockMovie = {
        id: 5,
        tmdb_id: 12345,
        title: 'Existing Movie',
      };
      const mockMovieForProfile = { movie_id: 5, title: 'Existing Movie' };
      const mockRecentMovies = [{ movie_id: 1 }];
      const mockUpcomingMovies = [{ movie_id: 2 }];

      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(mockMovie);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.getMovieForProfile as jest.Mock).mockResolvedValue(mockMovieForProfile);

      const result = await moviesService.addMovieToFavorites('123', 12345);

      expect(moviesDb.findMovieByTMDBId).toHaveBeenCalledWith(12345);
      expect(moviesDb.saveFavorite).toHaveBeenCalledWith('123', 12345);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        favoritedMovie: mockMovieForProfile,
        recentMovies: mockRecentMovies,
        upcomingMovies: mockUpcomingMovies,
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

      const mockMovieForProfile = { movie_id: 5, title: 'New Movie' };
      const mockRecentMovies = [{ movie_id: 1 }];
      const mockUpcomingMovies = [{ movie_id: 2 }];

      const mockMovie = {
        tmdb_id: 12345,
        title: 'New Movie',
        description: 'Description',
        release_date: '2023-01-01',
        runtime: 120,
        poster_image: '/poster.jpg',
        backdrop_image: '/backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        streaming_services: [8, 9],
        genreIds: [28, 12],
      };

      const mockTMDBService = { getMovieDetails: jest.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(null);
      (moviesDb.getMovieForProfile as jest.Mock).mockResolvedValue(mockMovieForProfile);
      (moviesDb.createMovie as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.saveMovie as jest.Mock).mockReturnValue(true);
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await moviesService.addMovieToFavorites('123', 12345);

      expect(moviesDb.findMovieByTMDBId).toHaveBeenCalledWith(12345);
      expect(getTMDBService).toHaveBeenCalled();
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(12345);
      expect(moviesDb.createMovie).toHaveBeenCalledWith(
        12345,
        'New Movie',
        'Description',
        '2023-01-01',
        120,
        '/poster.jpg',
        '/backdrop.jpg',
        8.5,
        'PG-13',
        undefined,
        [8, 9],
        [28, 12],
      );
      expect(moviesDb.saveMovie).toHaveBeenCalled();
      expect(moviesDb.saveFavorite).toHaveBeenCalledWith('123', 12345);
      expect(result).toEqual({
        favoritedMovie: mockMovieForProfile,
        recentMovies: mockRecentMovies,
        upcomingMovies: mockUpcomingMovies,
      });
    });

    it('should throw error when movie save fails', async () => {
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
      (moviesDb.saveMovie as jest.Mock).mockReturnValue(false);
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.addMovieToFavorites('123', 12345)).rejects.toThrow('Failed to save movie information');
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

      await expect(moviesService.addMovieToFavorites('123', 12345)).rejects.toThrow('TMDB API error');
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
      mockCacheService.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await moviesService.removeMovieFromFavorites('123', 5);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(5);
      expect(moviesDb.removeFavorite).toHaveBeenCalledWith('123', 5);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        removedMovie: mockMovie,
        recentMovies: mockRecentMovies,
        upcomingMovies: mockUpcomingMovies,
      });
    });

    it('should throw NotFoundError when movie does not exist', async () => {
      const profileId = '123';
      const movieId = 999;
      const notFoundError = new NotFoundError(`Movie with ID ${movieId} not found`);

      (moviesDb.findMovieById as jest.Mock).mockResolvedValue(null);

      (errorService.assertExists as jest.Mock).mockImplementation(() => {
        throw notFoundError;
      });

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(moviesService.removeMovieFromFavorites(profileId, movieId)).rejects.toThrow(notFoundError);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(movieId);
      expect(errorService.assertExists).toHaveBeenCalledWith(null, 'Movie', movieId);
      expect(errorService.handleError).toHaveBeenCalledWith(
        notFoundError,
        `removeMovieFromFavorites(${profileId}, ${movieId})`,
      );
      expect(moviesDb.removeFavorite).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateProfileMovies).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.findMovieById as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.removeMovieFromFavorites('123', 5)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'removeMovieFromFavorites(123, 5)');
    });
  });

  describe('updateMovieWatchStatus', () => {
    it('should update movie watch status successfully', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);

      const result = await moviesService.updateMovieWatchStatus('123', 5, 'WATCHED');

      expect(moviesDb.updateWatchStatus).toHaveBeenCalledWith('123', 5, 'WATCHED');
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.updateMovieWatchStatus('123', 5, 'WATCHED')).rejects.toThrow(
        'Failed to update watch status. Ensure the movie (ID: 5) exists in your favorites.',
      );
      expect(moviesDb.updateWatchStatus).toHaveBeenCalledWith('123', 5, 'WATCHED');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.updateWatchStatus as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.updateMovieWatchStatus('123', 5, 'WATCHED')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateMovieWatchStatus(123, 5, WATCHED)');
    });
  });

  describe('getProfileMovieStatistics', () => {
    it('should return movie statistics from cache when available', async () => {
      const mockStats = {
        total: 2,
        watchStatusCounts: { watched: 1, notWatched: 1 },
        genreDistribution: { Action: 1, Comedy: 1 },
        serviceDistribution: { Netflix: 1, Prime: 1 },
        watchProgress: 50,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockStats);

      const result = await moviesService.getProfileMovieStatistics('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_movie_stats', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);
    });

    it('should calculate statistics from movies when not in cache', async () => {
      const mockMovies = [
        {
          watch_status: 'WATCHED',
          genres: 'Action, Adventure',
          streaming_services: 'Netflix, Disney+',
        },
        {
          watch_status: 'NOT_WATCHED',
          genres: 'Comedy',
          streaming_services: 'Prime',
        },
      ];

      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await moviesService.getProfileMovieStatistics('123');

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        total: 2,
        watchStatusCounts: { watched: 1, notWatched: 1 },
        genreDistribution: { Action: 1, Adventure: 1, Comedy: 1 },
        serviceDistribution: { Netflix: 1, 'Disney+': 1, Prime: 1 },
        watchProgress: 50,
      });
    });

    it('should handle empty movie list', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await moviesService.getProfileMovieStatistics('123');

      expect(result).toEqual({
        total: 0,
        watchStatusCounts: { watched: 0, notWatched: 0 },
        genreDistribution: {},
        serviceDistribution: {},
        watchProgress: 0,
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getProfileMovieStatistics('123')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileMovieStatistics(123)');
    });
  });
});
