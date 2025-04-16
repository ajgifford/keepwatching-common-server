import { Change, ContentUpdates } from '../../../src/types/contentTypes';
import * as moviesDb from '@db/moviesDb';
import { cliLogger, httpLogger } from '@logger/logger';
import { errorService } from '@services/errorService';
import { checkForMovieChanges } from '@services/movieChangesService';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    error: jest.fn(),
  },
  httpLogger: {
    error: jest.fn(),
  },
}));

jest.mock('@db/moviesDb');

jest.mock('@utils/contentUtility', () => ({
  getUSMPARating: jest.fn().mockReturnValue('PG-13'),
}));

jest.mock('@utils/watchProvidersUtility', () => ({
  getUSWatchProviders: jest.fn().mockReturnValue([8, 9]),
}));

jest.mock('@services/errorService', () => ({
  errorService: {
    handleError: jest.fn((error) => {
      throw error;
    }),
  },
}));

jest.mock('@services/tmdbService', () => ({
  getTMDBService: jest.fn(),
}));

describe('movieChangesService', () => {
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

    await checkForMovieChanges(mockMovieContent, pastDate, currentDate);

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    expect(moviesDb.createMovie).not.toHaveBeenCalled();
  });

  it('should do nothing when only unsupported changes are detected', async () => {
    const unsupportedChanges: Change[] = [
      {
        key: 'unsupported_key',
        items: [
          {
            id: 'abc123',
            action: 'added',
            time: '2023-01-05',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: {},
            original_value: null,
          },
        ],
      },
    ];

    mockTMDBService.getMovieChanges.mockResolvedValue({ changes: unsupportedChanges });

    await checkForMovieChanges(mockMovieContent, pastDate, currentDate);

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    expect(moviesDb.createMovie).not.toHaveBeenCalled();
  });

  it('should update movie when supported changes are detected', async () => {
    const supportedChanges: Change[] = [
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

    await checkForMovieChanges(mockMovieContent, pastDate, currentDate);

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
    expect(moviesDb.createMovie).toHaveBeenCalledWith(
      456,
      'Updated Movie Title',
      'New overview',
      '2023-02-01',
      120,
      '/new-poster.jpg',
      '/new-backdrop.jpg',
      8.5,
      'PG-13',
      123,
      [8, 9],
      [28, 12],
    );

    expect(moviesDb.updateMovie).toHaveBeenCalled();
  });

  it('should handle errors from getMovieChanges API', async () => {
    const mockError = new Error('API error');
    mockTMDBService.getMovieChanges.mockRejectedValue(mockError);

    await expect(checkForMovieChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow('API error');

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for movie ID 123`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
      error: mockError,
      movieId: 123,
    });
    expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'checkForMovieChanges(123)');
  });

  it('should handle errors from getMovieDetails API', async () => {
    const supportedChanges: Change[] = [
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

    await expect(checkForMovieChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
      'Movie details API error',
    );
    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for movie ID 123`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
      error: mockError,
      movieId: 123,
    });
  });

  it('should handle multiple supported changes', async () => {
    const supportedChanges: Change[] = [
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

    await checkForMovieChanges(mockMovieContent, pastDate, currentDate);

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
    expect(moviesDb.createMovie).toHaveBeenCalledTimes(1);
    expect(moviesDb.updateMovie).toHaveBeenCalled();
  });

  it('should handle empty changes array', async () => {
    mockTMDBService.getMovieChanges.mockResolvedValue({});

    await checkForMovieChanges(mockMovieContent, pastDate, currentDate);

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
    expect(moviesDb.createMovie).not.toHaveBeenCalled();
  });

  it('should handle errors from moviesDb.updateMovie()', async () => {
    const supportedChanges: Change[] = [
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

    await expect(checkForMovieChanges(mockMovieContent, pastDate, currentDate)).rejects.toThrow(
      'Database update error',
    );

    expect(mockTMDBService.getMovieChanges).toHaveBeenCalledWith(456, pastDate, currentDate);
    expect(mockTMDBService.getMovieDetails).toHaveBeenCalledWith(456);
    expect(moviesDb.updateMovie).toHaveBeenCalled();
    expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for movie ID 123`, mockError);
    expect(httpLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie changes', {
      error: mockError,
      movieId: 123,
    });
  });
});
