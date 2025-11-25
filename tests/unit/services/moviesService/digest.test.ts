import { setupMoviesService } from './helpers/mocks';
import * as moviesDb from '@db/moviesDb';
import { errorService } from '@services/errorService';

describe('MoviesService - Digest', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
  });

  describe('getTrendingMovies', () => {
    it('should return trending movies', async () => {
      (moviesDb.getTrendingMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await service.getTrendingMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting trending movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getTrendingMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getTrendingMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTrendingMovies(10)');
    });
  });

  describe('getRecentlyReleasedMovies', () => {
    it('should return newly added movies', async () => {
      (moviesDb.getRecentlyReleasedMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await service.getRecentlyReleasedMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting newly added movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getRecentlyReleasedMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getRecentlyReleasedMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getRecentlyReleasedMovies(10)');
    });
  });

  describe('getTopRatedMovies', () => {
    it('should return top rated movies', async () => {
      (moviesDb.getTopRatedMovies as jest.Mock).mockResolvedValue([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);

      const result = await service.getTopRatedMovies();
      expect(result).toEqual([{ id: 1, tmdbId: 100, title: 'Movie 1' }]);
    });

    it('should handle errors when getting top rated movies', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getTopRatedMovies as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getTopRatedMovies()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getTopRatedMovies(10)');
    });
  });
});
