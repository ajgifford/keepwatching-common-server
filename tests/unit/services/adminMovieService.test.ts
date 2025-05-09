import * as moviesDb from '@db/moviesDb';
import { appLogger } from '@logger/logger';
import { adminMovieService } from '@services/adminMovieService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';
import { getUSMPARating } from '@utils/contentUtility';
import { getUSWatchProviders } from '@utils/watchProvidersUtility';

jest.mock('@db/moviesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@utils/contentUtility', () => ({
  getUSMPARating: jest.fn().mockReturnValue('PG-13'),
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
      invalidate: jest.fn(),
    };

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    Object.defineProperty(adminMovieService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('updateMovieById', () => {
    const movieId = 123;
    const tmdbId = 456;

    const mockTMDBMovie = {
      id: tmdbId,
      title: 'Updated Movie Title',
      overview: 'New overview',
      release_date: '2023-01-15',
      runtime: 120,
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      vote_average: 8.5,
      release_dates: {
        results: [
          {
            iso_3166_1: 'US',
            release_dates: [
              {
                certification: 'PG-13',
              },
            ],
          },
        ],
      },
      genres: [{ id: 28 }, { id: 12 }],
    };

    const mockUpdatedMovie = {
      id: movieId,
      tmdb_id: tmdbId,
      title: 'Updated Movie Title',
      description: 'New overview',
      release_date: '2023-01-15',
      runtime: 120,
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      user_rating: 8.5,
      mpa_rating: 'PG-13',
      genreIds: [28, 12],
      streaming_services: [8, 9],
    };

    it('should update a movie successfully', async () => {
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      (moviesDb.createMovie as jest.Mock).mockReturnValue(mockUpdatedMovie);
      (moviesDb.updateMovie as jest.Mock).mockResolvedValue(true);

      await adminMovieService.updateMovieById(movieId, tmdbId);

      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(tmdbId);
      expect(getUSMPARating).toHaveBeenCalledWith(mockTMDBMovie.release_dates);
      expect(getUSWatchProviders).toHaveBeenCalledWith(mockTMDBMovie, 9998);
      expect(moviesDb.createMovie).toHaveBeenCalledWith(
        tmdbId,
        'Updated Movie Title',
        'New overview',
        '2023-01-15',
        120,
        '/poster.jpg',
        '/backdrop.jpg',
        8.5,
        'PG-13',
        movieId,
        [8, 9],
        [28, 12],
      );
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await expect(adminMovieService.updateMovieById(movieId, tmdbId)).rejects.toThrow('TMDB API error');
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(tmdbId);
      expect(appLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
        error: mockError,
        movieId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateMovieById(${movieId})`);
    });

    it('should handle database errors', async () => {
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      (moviesDb.createMovie as jest.Mock).mockReturnValue(mockUpdatedMovie);

      const mockError = new Error('Database error');
      (moviesDb.updateMovie as jest.Mock).mockRejectedValue(mockError);

      await expect(adminMovieService.updateMovieById(movieId, tmdbId)).rejects.toThrow('Database error');
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
      expect(appLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
        error: mockError,
        movieId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateMovieById(${movieId})`);
    });
  });

  describe('getAllMovies', () => {
    const mockMovies = [
      { id: 1, title: 'Movie 1', created_at: '2023-01-01', updated_at: '2023-01-10' },
      { id: 2, title: 'Movie 2', created_at: '2023-02-01', updated_at: '2023-02-10' },
    ];

    const mockPaginationResult = {
      movies: mockMovies,
      pagination: {
        totalCount: 10,
        totalPages: 5,
        currentPage: 1,
        limit: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };

    it('should return movies with pagination from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await adminMovieService.getAllMovies(1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allMovies_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
    });

    it('should fetch movies with pagination from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

      (moviesDb.getMoviesCount as jest.Mock).mockResolvedValue(10);
      (moviesDb.getAllMovies as jest.Mock).mockResolvedValue(mockMovies);

      const result = await adminMovieService.getAllMovies(1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMoviesCount).toHaveBeenCalled();
      expect(moviesDb.getAllMovies).toHaveBeenCalledWith(2, 0);

      expect(result).toEqual({
        movies: mockMovies,
        pagination: {
          totalCount: 10,
          totalPages: 5,
          currentPage: 1,
          limit: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should use default values when not provided', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

      (moviesDb.getMoviesCount as jest.Mock).mockResolvedValue(100);
      (moviesDb.getAllMovies as jest.Mock).mockResolvedValue(mockMovies);

      await adminMovieService.getAllMovies(1, 0, 50);

      expect(moviesDb.getAllMovies).toHaveBeenCalledWith(50, 0);
    });
  });
});
