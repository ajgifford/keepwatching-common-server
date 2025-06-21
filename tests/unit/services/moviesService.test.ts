import { ContentUpdates } from '../../../src/types/contentTypes';
import { TMDBChange } from '../../../src/types/tmdbTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { appLogger } from '@logger/logger';
import { NotFoundError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { profileService } from '@services/profileService';
import { getTMDBService } from '@services/tmdbService';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '@utils/contentUtility';
import { getUSWatchProviders } from '@utils/watchProvidersUtility';

jest.mock('@db/moviesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/profileService');
jest.mock('@utils/contentUtility', () => ({
  getUSMPARating: jest.fn().mockReturnValue('Unknown'),
  getDirectors: jest.fn().mockReturnValue('Director A'),
  getUSProductionCompanies: jest.fn().mockReturnValue('Production A'),
}));
jest.mock('@utils/watchProvidersUtility', () => ({
  getUSWatchProviders: jest.fn().mockReturnValue([8, 9]),
}));
jest.mock('@services/tmdbService', () => ({
  getTMDBService: jest.fn(),
}));
jest.mock('@logger/logger', () => ({
  appLogger: {
    error: jest.fn(),
  },
}));

describe('MoviesService', () => {
  let mockCacheService: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateAccount: jest.fn(),
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

      const result = await moviesService.getMoviesForProfile(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_movies', expect.any(Function), 600);
      expect(result).toEqual(mockMovies);
    });

    it('should fetch movies from database when not in cache', async () => {
      const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await moviesService.getMoviesForProfile(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getMoviesForProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMoviesForProfile(123)');
    });
  });

  describe('getMovieDetailsForProfile', () => {
    it('should return a movie with details from cache when available', async () => {
      const mockMovie = { id: 1, title: 'Test Movie' };
      mockCacheService.getOrSet.mockResolvedValue(mockMovie);

      const result = await moviesService.getMovieDetailsForProfile(123, 1);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_movie_1', expect.any(Function), 600);
      expect(result).toEqual(mockMovie);
    });

    it('should fetch movies from database when not in cache', async () => {
      const mockMovie = { id: 1, title: 'Test Movie' };
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getMovieDetailsForProfile as jest.Mock).mockResolvedValue(mockMovie);

      const result = await moviesService.getMovieDetailsForProfile(123, 1);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMovieDetailsForProfile).toHaveBeenCalledWith(123, 1);
      expect(result).toEqual(mockMovie);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getMovieDetailsForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getMovieDetailsForProfile(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMovieDetailsForProfile(123, 1)');
    });
  });

  describe('getRecentMoviesForProfile', () => {
    it('should fetch recent movies', async () => {
      const mockRecentMovies = [{ movie_id: 1, title: 'Recent Movie' }];

      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockRecentMovies);

      const result = await moviesService.getRecentMoviesForProfile(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_recent_movies', expect.any(Function), 300);
      expect(moviesDb.getRecentMovieReleasesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockRecentMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getRecentMoviesForProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getRecentMoviesForProfile(123)');
    });
  });

  describe('getUpcomingMoviesForProfile', () => {
    it('should fetch upcoming movies', async () => {
      const mockUpcomingMovies = [{ movie_id: 2, title: 'Upcoming Movie' }];

      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockUpcomingMovies);

      const result = await moviesService.getUpcomingMoviesForProfile(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_upcoming_movies', expect.any(Function), 300);
      expect(moviesDb.getUpcomingMovieReleasesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockUpcomingMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.getUpcomingMoviesForProfile(123)).rejects.toThrow('Database error');
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
      (moviesDb.saveFavorite as jest.Mock).mockResolvedValue(true);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(mockMovie);
      (moviesDb.getMovieForProfile as jest.Mock).mockResolvedValue(mockMovieForProfile);

      const result = await moviesService.addMovieToFavorites(123, 12345);

      expect(moviesDb.findMovieByTMDBId).toHaveBeenCalledWith(12345);
      expect(moviesDb.saveFavorite).toHaveBeenCalledWith(123, 5, WatchStatus.NOT_WATCHED);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledWith(123);
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
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockRecentMovies);
      mockCacheService.getOrSet.mockResolvedValueOnce(mockUpcomingMovies);

      const result = await moviesService.addMovieToFavorites(123, 12345);

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

      const mockTMDBService = { getMovieDetails: jest.fn().mockResolvedValue(mockTMDBResponse) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
      (moviesDb.findMovieByTMDBId as jest.Mock).mockResolvedValue(null);
      (moviesDb.saveFavorite as jest.Mock).mockReturnValue(false);
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getDirectors as jest.Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as jest.Mock).mockReturnValue('MGM Global');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.addMovieToFavorites(123, 12345)).rejects.toThrow(
        'Failed to save a movie as a favorite',
      );
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

      await expect(moviesService.addMovieToFavorites(123, 12345)).rejects.toThrow('TMDB API error');
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

      const result = await moviesService.removeMovieFromFavorites(123, 5);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(5);
      expect(moviesDb.removeFavorite).toHaveBeenCalledWith(123, 5);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        removedMovie: mockMovie,
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
      });
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

      await expect(moviesService.removeMovieFromFavorites(123, 5)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'removeMovieFromFavorites(123, 5)');
    });
  });

  describe('updateMovieWatchStatus', () => {
    it('should update movie watch status successfully', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);

      const result = await moviesService.updateMovieWatchStatus(123, 5, WatchStatus.WATCHED);

      expect(moviesDb.updateWatchStatus).toHaveBeenCalledWith(123, 5, WatchStatus.WATCHED);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.updateMovieWatchStatus(123, 5, WatchStatus.WATCHED)).rejects.toThrow(
        'Failed to update watch status. Ensure the movie (ID: 5) exists in your favorites.',
      );
      expect(moviesDb.updateWatchStatus).toHaveBeenCalledWith(123, 5, WatchStatus.WATCHED);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.updateWatchStatus as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(moviesService.updateMovieWatchStatus(123, 5, WatchStatus.WATCHED)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateMovieWatchStatus(123, 5, WATCHED)');
    });
  });

  describe('checkMovieForChanges', () => {
    const mockMovieContent: ContentUpdates = {
      id: 123,
      title: 'Test Movie',
      tmdb_id: 456,
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    };

    const pastDate = '2023-01-01';
    const currentDate = '2023-01-10';

    const mockTMDBService = {
      getMovieChanges: jest.fn(),
      getMovieDetails: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: [] });
      mockTMDBService.getMovieDetails.mockResolvedValue({
        id: 456,
        title: 'Updated Movie Title',
        overview: 'New overview',
        release_date: '2023-02-01',
        runtime: 120,
        poster_path: '/new-poster.jpg',
        backdrop_path: '/new-backdrop.jpg',
        vote_average: 8.5,
        release_dates: { results: [] },
        genres: [{ id: 28 }, { id: 12 }],
      });
    });

    it('should do nothing when no changes are detected', async () => {
      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: [] });

      await moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    });

    it('should do nothing when only unsupported changes are detected', async () => {
      const unsupportedChanges: TMDBChange[] = [
        {
          key: 'unsupported_key',
          items: [
            {
              id: 'abc123',
              action: 'added',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: '',
              original_value: undefined,
            },
          ],
        },
      ];

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: unsupportedChanges });

      await moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    });

    it('should update movie when supported changes are detected', async () => {
      const supportedChanges: TMDBChange[] = [
        {
          key: 'title',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Movie Title',
              original_value: 'Test Movie',
            },
          ],
        },
      ];

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: supportedChanges });

      await moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
      expect(moviesDb.updateMovie).toHaveBeenCalledWith({
        tmdb_id: 456,
        title: 'Updated Movie Title',
        description: 'New overview',
        release_date: '2023-02-01',
        runtime: 120,
        poster_image: '/new-poster.jpg',
        backdrop_image: '/new-backdrop.jpg',
        user_rating: 8.5,
        mpa_rating: 'PG-13',
        director: 'Steven Jones',
        production_companies: 'MGM Global',
        budget: undefined,
        revenue: undefined,
        id: 123,
        streaming_service_ids: [8, 9],
        genre_ids: [28, 12],
      });
    });

    it('should handle errors from getMovieChanges API', async () => {
      const mockError = new Error('API error');
      mockTMDBService.getMovieChanges.mockRejectedValue(mockError);

      await expect(moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
        'API error',
      );

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(appLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
        error: mockError,
        movieId: 123,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'checkMovieForChanges(123)');
    });

    it('should handle errors from getMovieDetails API', async () => {
      const supportedChanges: TMDBChange[] = [
        {
          key: 'title',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Movie Title',
              original_value: 'Test Movie',
            },
          ],
        },
      ];

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Movie details API error');
      mockTMDBService.getMovieDetails.mockRejectedValue(mockError);

      await expect(moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
        'Movie details API error',
      );
      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
      expect(appLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
        error: mockError,
        movieId: 123,
      });
    });

    it('should handle multiple supported changes', async () => {
      const supportedChanges: TMDBChange[] = [
        {
          key: 'title',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Movie Title',
              original_value: 'Test Movie',
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

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: supportedChanges });

      await moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
      expect(moviesDb.updateMovie).toHaveBeenCalled();
    });

    it('should handle empty changes array', async () => {
      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: [] });

      await moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    });

    it('should handle errors from moviesDb.updateMovie()', async () => {
      const supportedChanges: TMDBChange[] = [
        {
          key: 'title',
          items: [
            {
              id: 'abc123',
              action: 'updated',
              time: '2023-01-05',
              iso_639_1: 'en',
              iso_3166_1: 'US',
              value: 'Updated Movie Title',
              original_value: 'Test Movie',
            },
          ],
        },
      ];

      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: supportedChanges });

      const mockError = new Error('Database update error');
      (moviesDb.updateMovie as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
        'Database update error',
      );

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
      expect(moviesDb.updateMovie).toHaveBeenCalled();
      expect(appLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
        error: mockError,
        movieId: 123,
      });
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

      const result = await moviesService.getProfileMovieStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('profile_123_movie_stats', expect.any(Function), 1800);
      expect(result).toEqual(mockStats);
    });

    it('should calculate statistics from movies when not in cache', async () => {
      const mockMovies = [
        {
          id: 1,
          watchStatus: WatchStatus.WATCHED,
          genres: 'Action, Adventure',
          streamingServices: 'Netflix, Disney+',
        },
        {
          id: 2,
          watchStatus: WatchStatus.NOT_WATCHED,
          genres: 'Comedy',
          streamingServices: 'Prime',
        },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await moviesService.getProfileMovieStatistics(123);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        movieReferences: [{ id: 1 }, { id: 2 }],
        total: 2,
        watchStatusCounts: { unaired: 0, watched: 1, notWatched: 1 },
        genreDistribution: { Action: 1, Adventure: 1, Comedy: 1 },
        serviceDistribution: { Netflix: 1, 'Disney+': 1, Prime: 1 },
        watchProgress: 50,
      });
    });

    it('should handle empty movie list', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await moviesService.getProfileMovieStatistics(123);

      expect(result).toEqual({
        movieReferences: [],
        total: 0,
        watchStatusCounts: { unaired: 0, watched: 0, notWatched: 0 },
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

      await expect(moviesService.getProfileMovieStatistics(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileMovieStatistics(123)');
    });
  });

  describe('invalidateAccountCache', () => {
    const mockProfiles = [
      { id: 1, name: 'Profile 1', image: 'profile1.jpg', account_id: 123 },
      { id: 2, name: 'Profile 2', image: 'profile2.jpg', account_id: 123 },
    ];

    it('should invalidate cache for all profiles in an account', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue(mockProfiles);

      await moviesService.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenCalledTimes(2);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenNthCalledWith(1, 1);
      expect(mockCacheService.invalidateProfileMovies).toHaveBeenNthCalledWith(2, 2);
      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle empty profiles array', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await moviesService.invalidateAccountCache(123);

      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCacheService.invalidateProfileMovies).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateAccount).toHaveBeenCalledWith(123);
    });

    it('should handle errors when fetching profiles', async () => {
      const mockError = new Error('Failed to get profiles');
      (profileService.getProfilesByAccountId as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.invalidateAccountCache(123)).rejects.toThrow('Failed to get profiles');
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(mockCacheService.invalidateProfileMovies).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateAccount).not.toHaveBeenCalled();
    });
  });

  describe('getTrendingMovies', () => {
    it('should return trending movies', async () => {
      (moviesDb.getTrendingMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await moviesService.getTrendingMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting trending movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getTrendingMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.getTrendingMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTrendingMovies(10)');
    });
  });

  describe('getRecentlyReleasedMovies', () => {
    it('should return newly added movies', async () => {
      (moviesDb.getRecentlyReleasedMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await moviesService.getRecentlyReleasedMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting newly added movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getRecentlyReleasedMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.getRecentlyReleasedMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getRecentlyReleasedMovies(10)');
    });
  });

  describe('getTopRatedMovies', () => {
    it('should return top rated movies', async () => {
      (moviesDb.getTopRatedMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await moviesService.getTopRatedMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting top rated movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getTopRatedMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.getTopRatedMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTopRatedMovies(10)');
    });
  });

  describe('getMoviesForUpdates', () => {
    it('should return movies for updates', async () => {
      (moviesDb.getMoviesForUpdates as jest.Mock).mockResolvedValue([
        { id: 1, tmdb_id: 100, title: 'Movie 1', created_at: '2025-01-01', updated_at: '2025-02-01' },
      ]);

      const result = await moviesService.getMoviesForUpdates();
      expect(result).toEqual([
        { id: 1, tmdb_id: 100, title: 'Movie 1', created_at: '2025-01-01', updated_at: '2025-02-01' },
      ]);
    });

    it('should handle errors when getting movies for updates', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getMoviesForUpdates as jest.Mock).mockRejectedValue(mockError);

      await expect(moviesService.getMoviesForUpdates()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getMoviesForUpdates()');
    });
  });
});
