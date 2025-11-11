import { setupMoviesService } from './helpers/mocks';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as moviesDb from '@db/moviesDb';
import { errorService } from '@services/errorService';

describe('MoviesService - Watch Status', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('updateMovieWatchStatus', () => {
    it('should update movie watch status successfully', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.updateMovieWatchStatus(1, 123, 5, WatchStatus.WATCHED);

      expect(moviesDb.updateWatchStatus).toHaveBeenCalledWith(123, 5, WatchStatus.WATCHED);
      expect(mockCache.invalidateProfileMovies).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should throw BadRequestError when update fails', async () => {
      (moviesDb.updateWatchStatus as jest.Mock).mockResolvedValue(false);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(service.updateMovieWatchStatus(1, 123, 5, WatchStatus.WATCHED)).rejects.toThrow(
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

      await expect(service.updateMovieWatchStatus(1, 123, 5, WatchStatus.WATCHED)).rejects.toThrow(
        'Database error',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateMovieWatchStatus(123, 5, WATCHED)');
    });
  });
});
