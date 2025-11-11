import { ContentUpdates } from '../../../../src/types/contentTypes';
import { TMDBChange } from '../../../../src/types/tmdbTypes';
import { setupMoviesService } from './helpers/mocks';
import * as moviesDb from '@db/moviesDb';
import { appLogger } from '@logger/logger';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';
import { getDirectors, getUSMPARating, getUSProductionCompanies } from '@utils/contentUtility';
import { getUSWatchProvidersMovie } from '@utils/watchProvidersUtility';

describe('MoviesService - Updates', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
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

      // Re-establish utility function mocks after clearAllMocks
      (getUSMPARating as jest.Mock).mockReturnValue('PG-13');
      (getDirectors as jest.Mock).mockReturnValue('Steven Jones');
      (getUSProductionCompanies as jest.Mock).mockReturnValue('MGM Global');
      (getUSWatchProvidersMovie as jest.Mock).mockReturnValue([8, 9]);
    });

    it('should do nothing when no changes are detected', async () => {
      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: [] });

      await service.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

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

      await service.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

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

      await service.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

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

      await expect(service.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow('API error');

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

      await expect(service.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
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

      await service.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

      expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
      expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
      expect(moviesDb.updateMovie).toHaveBeenCalled();
    });

    it('should handle empty changes array', async () => {
      mockTMDBService.getMovieChanges.mockResolvedValue({ changes: [] });

      await service.checkMovieForChanges(mockMovieContent, pastDate, currentDate);

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

      await expect(service.checkMovieForChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
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

  describe('getMoviesForUpdates', () => {
    it('should return movies for updates', async () => {
      (moviesDb.getMoviesForUpdates as jest.Mock).mockResolvedValue([
        { id: 1, tmdb_id: 100, title: 'Movie 1', created_at: '2025-01-01', updated_at: '2025-02-01' },
      ]);

      const result = await service.getMoviesForUpdates();
      expect(result).toEqual([
        { id: 1, tmdb_id: 100, title: 'Movie 1', created_at: '2025-01-01', updated_at: '2025-02-01' },
      ]);
    });

    it('should handle errors when getting movies for updates', async () => {
      const mockError = new Error('Database error');
      (moviesDb.getMoviesForUpdates as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getMoviesForUpdates()).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getMoviesForUpdates()');
    });
  });
});
