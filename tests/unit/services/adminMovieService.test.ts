import * as moviesDb from '@db/moviesDb';
import * as personsDb from '@db/personsDb';
import { appLogger, cliLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { adminMovieService } from '@services/adminMovieService';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { socketService } from '@services/socketService';
import { getTMDBService } from '@services/tmdbService';
import { getUSMPARating } from '@utils/contentUtility';
import { getUSWatchProvidersMovie } from '@utils/watchProvidersUtility';
import { type Mock, MockedObject, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the repositories and services
vi.mock('@db/moviesDb');
vi.mock('@db/personsDb');
vi.mock('@services/errorService');
vi.mock('@services/cacheService');
vi.mock('@services/socketService');
vi.mock('@services/tmdbService');
vi.mock('@utils/contentUtility');
vi.mock('@utils/watchProvidersUtility');
vi.mock('@logger/logger', () => ({
  appLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  cliLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminMovieService', () => {
  let mockCacheService: MockedObject<any>;

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
    vi.clearAllMocks();

    mockCacheService = {
      getOrSet: vi.fn(),
      invalidate: vi.fn(),
      invalidatePattern: vi.fn(),
    };

    vi.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService);

    Object.defineProperty(adminMovieService, 'cache', {
      value: mockCacheService,
      writable: true,
    });

    (errorService.handleError as Mock).mockImplementation((error) => {
      throw error;
    });

    // Set up default mocks
    (moviesDb.getMovieDetails as Mock).mockResolvedValue(mockMovieDetails);
    (moviesDb.getMovieProfiles as Mock).mockResolvedValue(mockProfiles);
    (moviesDb.getAllMovies as Mock).mockResolvedValue(mockMovies);
    (moviesDb.getMoviesCount as Mock).mockResolvedValue(10);
    (socketService.notifyMoviesUpdate as Mock).mockImplementation(() => {});
    (personsDb.findPersonByTMDBId as Mock).mockResolvedValue(null);
    (personsDb.savePerson as Mock).mockResolvedValue(1);
    (personsDb.saveMovieCast as Mock).mockResolvedValue(undefined);
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
      (moviesDb.getMovieDetails as Mock).mockRejectedValue(error);

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
      (moviesDb.getMovieProfiles as Mock).mockRejectedValue(error);

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
      (moviesDb.getMovieDetails as Mock).mockRejectedValue(error);

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
      (moviesDb.getMoviesCount as Mock).mockResolvedValue(21);

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
      (moviesDb.getMoviesCount as Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getAllMovies(1, 0, 2)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });

  describe('getAllMoviesByProfile', () => {
    const mockProfileId = 5;

    it('should return movies with pagination from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockPaginationResult);

      const result = await adminMovieService.getAllMoviesByProfile(mockProfileId, 1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allMoviesByProfile_5_1_0_2', expect.any(Function));
      expect(result).toEqual(mockPaginationResult);
      expect(moviesDb.getAllMoviesByProfile).not.toHaveBeenCalled();
      expect(moviesDb.getMoviesCountByProfile).not.toHaveBeenCalled();
    });

    it('should fetch movies with pagination from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getMoviesCountByProfile as Mock).mockResolvedValue(10);
      (moviesDb.getAllMoviesByProfile as Mock).mockResolvedValue(mockMovies);

      const result = await adminMovieService.getAllMoviesByProfile(mockProfileId, 1, 0, 2);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMoviesCountByProfile).toHaveBeenCalledWith(mockProfileId);
      expect(moviesDb.getAllMoviesByProfile).toHaveBeenCalledWith(mockProfileId, 2, 0);

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

    it('should calculate pagination correctly for profile movies', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getMoviesCountByProfile as Mock).mockResolvedValue(15);
      (moviesDb.getAllMoviesByProfile as Mock).mockResolvedValue(mockMovies);

      const result = await adminMovieService.getAllMoviesByProfile(mockProfileId, 3, 10, 5);

      expect(result.pagination).toEqual({
        totalCount: 15,
        totalPages: 3, // 15 / 5 = 3
        currentPage: 3,
        limit: 5,
        hasNextPage: false, // currentPage 3 = totalPages 3
        hasPrevPage: true, // currentPage 3 > 1
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getMoviesCountByProfile as Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getAllMoviesByProfile(mockProfileId, 1, 0, 2)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getAllMoviesByProfile(${mockProfileId}, 1, 0, 2)`);
    });
  });

  describe('getAllMovieReferences', () => {
    const mockReferences = [
      { id: 1, tmdbId: 1001, title: 'Movie 1', releaseDate: '2023-01-01' },
      { id: 2, tmdbId: 1002, title: 'Movie 2', releaseDate: '2023-02-01' },
    ];

    it('should return movie references from cache when available', async () => {
      mockCacheService.getOrSet.mockResolvedValue(mockReferences);

      const result = await adminMovieService.getAllMovieReferences();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('allMovieReferences', expect.any(Function));
      expect(result).toEqual(mockReferences);
      expect(moviesDb.getAllMoviesReferences).not.toHaveBeenCalled();
    });

    it('should fetch movie references from database when not in cache', async () => {
      mockCacheService.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesReferences as Mock).mockResolvedValue(mockReferences);

      const result = await adminMovieService.getAllMovieReferences();

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesReferences).toHaveBeenCalled();
      expect(result).toEqual(mockReferences);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      (moviesDb.getAllMoviesReferences as Mock).mockRejectedValue(error);

      mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
        return await fetchFn();
      });

      await expect(adminMovieService.getAllMovieReferences()).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAllMovieReferences()');
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
      credits: {
        cast: [],
      },
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
        getMovieDetails: vi.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);

      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      const result = await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(mockTMDBId);
      expect(getUSMPARating).toHaveBeenCalledWith(mockTMDBMovie.release_dates);
      expect(getUSWatchProvidersMovie).toHaveBeenCalledWith(mockTMDBMovie);
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
      expect(result).toBe(true);
    });

    it('should handle TMDB API errors', async () => {
      const mockError = new Error('TMDB API error');
      const mockTMDBService = {
        getMovieDetails: vi.fn().mockRejectedValue(mockError),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

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
        getMovieDetails: vi.fn().mockResolvedValue(mockTMDBMovie),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);

      const mockError = new Error('Database error');
      (moviesDb.updateMovie as Mock).mockRejectedValue(mockError);

      await expect(adminMovieService.updateMovieById(mockMovieId, mockTMDBId)).rejects.toThrow('Database error');
      expect(moviesDb.updateMovie).toHaveBeenCalledWith(mockUpdatedMovie);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.MovieChangeFail, {
        error: mockError,
        movieId: mockMovieId,
      });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, `updateMovieById(${mockMovieId})`);
    });

    it('should process cast when person already exists in database', async () => {
      const mockMovieWithCast = {
        ...mockTMDBMovie,
        credits: {
          cast: [
            {
              id: 5001,
              credit_id: 'credit123',
              character: 'Hero',
              order: 0,
            },
          ],
        },
      };

      const mockTMDBService = {
        getMovieDetails: vi.fn().mockResolvedValue(mockMovieWithCast),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      // Mock person exists
      (personsDb.findPersonByTMDBId as Mock).mockResolvedValue({ id: 100 });

      await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      expect(personsDb.findPersonByTMDBId).toHaveBeenCalledWith(5001);
      expect(personsDb.savePerson).not.toHaveBeenCalled();
      expect(personsDb.saveMovieCast).toHaveBeenCalledWith({
        content_id: mockMovieId,
        person_id: 100,
        credit_id: 'credit123',
        character_name: 'Hero',
        cast_order: 0,
      });
    });

    it('should process cast when person does not exist and fetch from TMDB', async () => {
      const mockMovieWithCast = {
        ...mockTMDBMovie,
        credits: {
          cast: [
            {
              id: 5002,
              credit_id: 'credit456',
              character: 'Villain',
              order: 1,
            },
          ],
        },
      };

      const mockTMDBPerson = {
        id: 5002,
        name: 'John Actor',
        gender: 2,
        biography: 'Famous actor',
        profile_path: '/profile.jpg',
        birthday: '1980-01-01',
        deathday: null,
        place_of_birth: 'Los Angeles',
      };

      const mockTMDBService = {
        getMovieDetails: vi.fn().mockResolvedValue(mockMovieWithCast),
        getPersonDetails: vi.fn().mockResolvedValue(mockTMDBPerson),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      // Mock person does not exist
      (personsDb.findPersonByTMDBId as Mock).mockResolvedValue(null);
      (personsDb.savePerson as Mock).mockResolvedValue(200);
      (personsDb.saveMovieCast as Mock).mockResolvedValue(true);

      await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      // Wait for async processMovieCast to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(personsDb.findPersonByTMDBId).toHaveBeenCalledWith(5002);
      expect(mockTMDBService.getPersonDetails).toHaveBeenCalledWith(5002);
      expect(personsDb.savePerson).toHaveBeenCalledWith({
        tmdb_id: 5002,
        name: 'John Actor',
        gender: 2,
        biography: 'Famous actor',
        profile_image: '/profile.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        place_of_birth: 'Los Angeles',
      });
      expect(personsDb.saveMovieCast).toHaveBeenCalledWith({
        content_id: mockMovieId,
        person_id: 200,
        credit_id: 'credit456',
        character_name: 'Villain',
        cast_order: 1,
      });
    });

    it('should process multiple cast members', async () => {
      const mockMovieWithCast = {
        ...mockTMDBMovie,
        credits: {
          cast: [
            {
              id: 5001,
              credit_id: 'credit1',
              character: 'Hero',
              order: 0,
            },
            {
              id: 5002,
              credit_id: 'credit2',
              character: 'Sidekick',
              order: 1,
            },
          ],
        },
      };

      const mockTMDBPerson = {
        id: 5002,
        name: 'John Actor',
        gender: 2,
        biography: 'Famous actor',
        profile_path: '/profile.jpg',
        birthday: '1980-01-01',
        deathday: null,
        place_of_birth: 'Los Angeles',
      };

      const mockTMDBService = {
        getMovieDetails: vi.fn().mockResolvedValue(mockMovieWithCast),
        getPersonDetails: vi.fn().mockResolvedValue(mockTMDBPerson),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      // First person exists, second doesn't
      (personsDb.findPersonByTMDBId as Mock).mockResolvedValueOnce({ id: 100 }).mockResolvedValueOnce(null);
      (personsDb.savePerson as Mock).mockResolvedValue(200);

      await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      // Wait for async processMovieCast to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(personsDb.findPersonByTMDBId).toHaveBeenCalledTimes(2);
      expect(personsDb.saveMovieCast).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in cast processing gracefully', async () => {
      const mockMovieWithCast = {
        ...mockTMDBMovie,
        credits: {
          cast: [
            {
              id: 5001,
              credit_id: 'credit123',
              character: 'Hero',
              order: 0,
            },
          ],
        },
      };

      const mockTMDBService = {
        getMovieDetails: vi.fn().mockResolvedValue(mockMovieWithCast),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      // Mock error in cast processing
      const castError = new Error('Cast processing error');
      (personsDb.findPersonByTMDBId as Mock).mockRejectedValue(castError);

      // Should not throw, just log error
      const result = await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      expect(result).toBe(true);
      expect(cliLogger.error).toHaveBeenCalledWith('Error fetching movie cast:', castError);
    });

    it('should handle empty cast array', async () => {
      const mockMovieWithEmptyCast = {
        ...mockTMDBMovie,
        credits: {
          cast: [],
        },
      };

      const mockTMDBService = {
        getMovieDetails: vi.fn().mockResolvedValue(mockMovieWithEmptyCast),
      };
      (getTMDBService as Mock).mockReturnValue(mockTMDBService);

      (getUSMPARating as Mock).mockReturnValue('PG-13');
      (getUSWatchProvidersMovie as Mock).mockReturnValue([8, 9]);
      (moviesDb.updateMovie as Mock).mockResolvedValue(true);

      await adminMovieService.updateMovieById(mockMovieId, mockTMDBId);

      expect(personsDb.findPersonByTMDBId).not.toHaveBeenCalled();
      expect(personsDb.savePerson).not.toHaveBeenCalled();
      expect(personsDb.saveMovieCast).not.toHaveBeenCalled();
    });
  });

  describe('updateAllMovies', () => {
    const mockReferences = [
      { id: 1, tmdbId: 1001, title: 'Movie 1', releaseDate: '2023-01-01' },
      { id: 2, tmdbId: 1002, title: 'Movie 2', releaseDate: '2023-02-01' },
    ];

    it('should update all movies successfully', async () => {
      vi.spyOn(adminMovieService, 'getAllMovieReferences').mockResolvedValue(mockReferences);
      vi.spyOn(adminMovieService, 'updateMovieById').mockResolvedValue(true);

      await adminMovieService.updateAllMovies();

      expect(adminMovieService.getAllMovieReferences).toHaveBeenCalled();
      expect(adminMovieService.updateMovieById).toHaveBeenCalledWith(1, 1001);
      expect(adminMovieService.updateMovieById).toHaveBeenCalledWith(2, 1002);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      vi.spyOn(adminMovieService, 'getAllMovieReferences').mockRejectedValue(error);

      await expect(adminMovieService.updateAllMovies()).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateAllMovies()');
    });
  });

  describe('invalidateAllMovies', () => {
    it('should invalidate all movies cache pattern', () => {
      adminMovieService.invalidateAllMovies();

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('allMovies_');
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
