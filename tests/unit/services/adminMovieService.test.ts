import * as moviesDb from '@db/moviesDb';
import { appLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { adminMovieService } from '@services/adminMovieService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import { getUSMPARating } from '@utils/contentUtility';
import { getUSWatchProviders } from '@utils/watchProvidersUtility';

// Mock the repositories and services
jest.mock('@db/moviesDb');
jest.mock('@services/cacheService');
jest.mock('@services/errorService');
jest.mock('@services/socketService');
jest.mock('@services/tmdbService');
jest.mock('@utils/contentUtility');
jest.mock('@utils/watchProvidersUtility');
jest.mock('@logger/logger', () => ({
  appLogger: {
    error: jest.fn(),
  },
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AdminMovieService', () => {
  let mockCacheService: jest.Mocked<any>;

  const mockMovieId = 123;
  const mockTMDBId = 456;
  const mockMovieDetails = {
    id: mockMovieId,
    title: 'Test Movie',
    tmdbId: mockTMDBId,
    genres: 'Action, Comedy',
    streamingServices: 'Netflix, Disney+',
  };
  const mockProfiles = [
    {
      profileId: 101,
      name: 'Test User 1',
      watchStatus: 'WATCHED',
      accountId: 201,
      accountName: 'Test Account',
      addedDate: '2023-01-15T00:00:00.000Z',
      lastUpdated: '2023-01-16T00:00:00.000Z',
    },
    {
      profileId: 102,
      name: 'Test User 2',
      watchStatus: 'NOT_WATCHED',
      accountId: 201,
      accountName: 'Test Account',
      addedDate: '2023-01-20T00:00:00.000Z',
      lastUpdated: '2023-01-20T00:00:00.000Z',
    },
  ];

  const mockMovies = [
    { id: 1, title: 'Movie 1', releaseDate: '2023-01-01', genres: 'Action, Drama', tmdbId: 1001 },
    { id: 2, title: 'Movie 2', releaseDate: '2023-02-01', genres: 'Comedy, Romance', tmdbId: 1002 },
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

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    // Set up default mocks
    (moviesDb.getMovieDetails as jest.Mock).mockResolvedValue(mockMovieDetails);
    (moviesDb.getMovieProfiles as jest.Mock).mockResolvedValue(mockProfiles);
    (moviesDb.getAllMovies as jest.Mock).mockResolvedValue(mockMovies);
    (moviesDb.getMoviesCount as jest.Mock).mockResolvedValue(10);
    (socketService.notifyMoviesUpdate as jest.Mock).mockImplementation(() => {});
  });

  describe('getMovieDetails', () => {
    it('should return cached movie details when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockMovieDetails);

      const result = await adminMovieService.getMovieDetails(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockMovieDetails);
      expect(moviesDb.getMovieDetails).not.toHaveBeenCalled();
    });

    it('should fetch movie details from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminMovieService.getMovieDetails(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMovieDetails).toHaveBeenCalledWith(mockMovieId);
      expect(result).toEqual(mockMovieDetails);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getMovieDetails as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getMovieDetails(mockMovieId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getMovieDetails(${mockMovieId})`);
    });
  });

  describe('getMovieProfiles', () => {
    it('should return cached movie profiles when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockProfiles);

      const result = await adminMovieService.getMovieProfiles(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockProfiles);
      expect(moviesDb.getMovieProfiles).not.toHaveBeenCalled();
    });

    it('should fetch movie profiles from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminMovieService.getMovieProfiles(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMovieProfiles).toHaveBeenCalledWith(mockMovieId);
      expect(result).toEqual(mockProfiles);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getMovieProfiles as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getMovieProfiles(mockMovieId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getMovieProfiles(${mockMovieId})`);
    });
  });

  describe('getCompleteMovieInfo', () => {
    it('should return cached complete movie info when available', async () => {
      const mockCompleteInfo = {
        details: mockMovieDetails,
        profiles: mockProfiles,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockCompleteInfo);

      const result = await adminMovieService.getCompleteMovieInfo(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockCompleteInfo);
      expect(moviesDb.getMovieDetails).not.toHaveBeenCalled();
      expect(moviesDb.getMovieProfiles).not.toHaveBeenCalled();
    });

    it('should fetch and combine movie details and profiles when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      const result = await adminMovieService.getCompleteMovieInfo(mockMovieId);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMovieDetails).toHaveBeenCalledWith(mockMovieId);
      expect(moviesDb.getMovieProfiles).toHaveBeenCalledWith(mockMovieId);

      expect(result).toEqual({
        details: mockMovieDetails,
        profiles: mockProfiles,
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getMovieDetails as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getCompleteMovieInfo(mockMovieId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getCompleteMovieInfo(${mockMovieId})`);
    });
  });

  describe('getAllMovies', () => {
    it('should return movies with pagination from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await adminMovieService.getAllMovies(1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allMovies_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
      expect(moviesDb.getAllMovies).not.toHaveBeenCalled();
      expect(moviesDb.getMoviesCount).not.toHaveBeenCalled();
    });

    it('should fetch movies with pagination from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());

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

    it('should calculate pagination correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getMoviesCount as jest.Mock).mockResolvedValue(21);

      const result = await adminMovieService.getAllMovies(2, 5, 5);

      expect(result.pagination).toEqual({
        totalCount: 21,
        totalPages: 5, // 21 / 5 = 4.2, ceil = 5
        currentPage: 2,
        limit: 5,
        hasNextPage: true, // currentPage 2 < totalPages 5
        hasPrevPage: true, // currentPage 2 > 1
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getMoviesCount as jest.Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getAllMovies(1, 0, 2)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });

  describe('updateMovieById', () => {
    const mockTMDBMovie = {
      id: mockTMDBId,
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
      id: mockMovieId,
      tmdb_id: mockTMDBId,
      title: 'Updated Movie Title',
      description: 'New overview',
      release_date: '2023-01-15',
      runtime: 120,
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      user_rating: 8.5,
      mpa_rating: 'PG-13',
      genre_ids: [28, 12],
      streaming_service_ids: [8, 9],
    };

    it('should update a movie successfully', async () => {
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      (moviesDb.updateMovie as jest.Mock).mockResolvedValue(true);

      const result = await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(mockTMDBId);
      expect(getUSMPARating).toHaveBeenCalledWith(mockTMDBMovie.release_dates);
      expect(getUSWatchProviders).toHaveBeenCalledWith(mockTMDBMovie, 9998);
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
      expect(result).toBe(true);
    });

    it('should handle TMDB API errors', async () => {
      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      await expect(adminMovieService.updateMovieById(mockMovieId, mockTMDBId)).rejects.toThrow('TMDB API error');
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(mockTMDBId);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.MovieChangeFail, {
        error: mockError,
        movieId: mockMovieId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateMovieById(${mockMovieId})`);
    });

    it('should handle database errors', async () => {
      const mockTMDBService = {
        getMovieDetails: jest.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getUSWatchProviders as jest.Mock).mockReturnValue([8, 9]);

      const mockError = new Error('Database error');
      (moviesDb.updateMovie as jest.Mock).mockRejectedValue(mockError);

      await expect(adminMovieService.updateMovieById(mockMovieId, mockTMDBId)).rejects.toThrow('Database error');
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.MovieChangeFail, {
        error: mockError,
        movieId: mockMovieId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateMovieById(${mockMovieId})`);
    });
  });

  describe('invalidateMovieCache', () => {
    it('should invalidate all cache keys related to a movie', () => {
      adminMovieService.invalidateMovieCache(mockMovieId);

      // Check that all cache keys are invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        expect.stringContaining(`admin_movie_details_${mockMovieId}`),
      );
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        expect.stringContaining(`admin_movie_profiles_${mockMovieId}`),
      );
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        expect.stringContaining(`admin_movie_complete_${mockMovieId}`),
      );
      expect(mockCacheService.invalidate).toHaveBeenCalledTimes(3);
    });
  });
});
