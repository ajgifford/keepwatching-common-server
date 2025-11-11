import { setupMoviesService } from './helpers/mocks';
import * as moviesDb from '@db/moviesDb';
import { errorService } from '@services/errorService';

describe('MoviesService - Basic Functionality', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('getMoviesForProfile', () => {
    it('should return movies from cache when available', async () => {
      const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
      mockCache.getOrSet.mockResolvedValue(mockMovies);

      const result = await service.getMoviesForProfile(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_movies', expect.any(Function), 600);
      expect(result).toEqual(mockMovies);
    });

    it('should fetch movies from database when not in cache', async () => {
      const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await service.getMoviesForProfile(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.getMoviesForProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMoviesForProfile(123)');
    });
  });

  describe('getMovieDetailsForProfile', () => {
    it('should return a movie with details from cache when available', async () => {
      const mockMovie = { id: 1, title: 'Test Movie' };
      mockCache.getOrSet.mockResolvedValue(mockMovie);

      const result = await service.getMovieDetailsForProfile(123, 1);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_movie_1', expect.any(Function), 600);
      expect(result).toEqual(mockMovie);
    });

    it('should fetch movies from database when not in cache', async () => {
      const mockMovie = { id: 1, title: 'Test Movie' };
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getMovieDetailsForProfile as jest.Mock).mockResolvedValue(mockMovie);

      const result = await service.getMovieDetailsForProfile(123, 1);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(moviesDb.getMovieDetailsForProfile).toHaveBeenCalledWith(123, 1);
      expect(result).toEqual(mockMovie);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getMovieDetailsForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.getMovieDetailsForProfile(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMovieDetailsForProfile(123, 1)');
    });
  });

  describe('getRecentMoviesForProfile', () => {
    it('should fetch recent movies', async () => {
      const mockRecentMovies = [{ movie_id: 1, title: 'Recent Movie' }];

      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockRecentMovies);

      const result = await service.getRecentMoviesForProfile(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_recent_movies', expect.any(Function), 300);
      expect(moviesDb.getRecentMovieReleasesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockRecentMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getRecentMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.getRecentMoviesForProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getRecentMoviesForProfile(123)');
    });
  });

  describe('getUpcomingMoviesForProfile', () => {
    it('should fetch upcoming movies', async () => {
      const mockUpcomingMovies = [{ movie_id: 2, title: 'Upcoming Movie' }];

      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockResolvedValue(mockUpcomingMovies);

      const result = await service.getUpcomingMoviesForProfile(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_upcoming_movies', expect.any(Function), 300);
      expect(moviesDb.getUpcomingMovieReleasesForProfile).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockUpcomingMovies);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getUpcomingMovieReleasesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.getUpcomingMoviesForProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getUpcomingMoviesForProfile(123)');
    });
  });
});
