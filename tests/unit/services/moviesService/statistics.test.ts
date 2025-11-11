import { setupMoviesService } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { errorService } from '@services/errorService';

describe('MoviesService - Statistics', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
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

      mockCache.getOrSet.mockResolvedValue(mockStats);

      const result = await service.getProfileMovieStatistics(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_movie_stats', expect.any(Function), 1800);
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

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await service.getProfileMovieStatistics(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
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
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getProfileMovieStatistics(123);

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
      mockCache.getOrSet.mockImplementation(async (key: any, fn: () => any) => fn());
      (moviesDb.getAllMoviesForProfile as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.getProfileMovieStatistics(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfileMovieStatistics(123)');
    });
  });
});
