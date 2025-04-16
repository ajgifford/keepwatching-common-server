import * as moviesDb from '@db/moviesDb';
import * as showsDb from '@db/showsDb';
import { cliLogger, httpLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { updateMovies, updateShows } from '@services/contentUpdatesService';
import { checkForMovieChanges } from '@services/movieChangesService';
import { checkForShowChanges } from '@services/showChangesService';
import * as changesUtility from '@utils/changesUtility';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  httpLogger: {
    error: jest.fn(),
  },
}));

jest.mock('@db/moviesDb');
jest.mock('@db/showsDb');

jest.mock('@services/movieChangesService', () => ({
  checkForMovieChanges: jest.fn(),
}));

jest.mock('@services/showChangesService', () => ({
  checkForShowChanges: jest.fn(),
}));

jest.mock('@utils/changesUtility', () => ({
  generateDateRange: jest.fn(),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

describe('contentUpdatesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
      currentDate: '2025-01-01',
      pastDate: '2024-12-22',
    });
  });

  describe('updateMovies', () => {
    it('should update movies with changes', async () => {
      const mockMovies = [
        { id: 1, tmdb_id: 101, title: 'Movie 1' },
        { id: 2, tmdb_id: 102, title: 'Movie 2' },
      ];
      (moviesDb.getMoviesForUpdates as jest.Mock).mockResolvedValue(mockMovies);
      (checkForMovieChanges as jest.Mock).mockResolvedValue(undefined);

      await updateMovies();

      expect(moviesDb.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(changesUtility.generateDateRange).toHaveBeenCalledWith(10);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 2 movies to check for updates');
      expect(checkForMovieChanges).toHaveBeenCalledTimes(2);
      expect(checkForMovieChanges).toHaveBeenCalledWith(mockMovies[0], '2024-12-22', '2025-01-01');
      expect(checkForMovieChanges).toHaveBeenCalledWith(mockMovies[1], '2024-12-22', '2025-01-01');
      expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
    });

    it('should handle error when fetching movies', async () => {
      const error = new Error('Database error');
      (moviesDb.getMoviesForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updateMovies()).rejects.toThrow('Database error');
      expect(cliLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie updates', error);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.MoviesChangeFail, { error });
      expect(checkForMovieChanges).not.toHaveBeenCalled();
    });

    it('should continue processing if one movie check fails', async () => {
      const mockMovies = [
        { id: 1, tmdb_id: 101, title: 'Movie 1' },
        { id: 2, tmdb_id: 102, title: 'Movie 2' },
        { id: 3, tmdb_id: 103, title: 'Movie 3' },
      ];
      const error = new Error('API error');

      (moviesDb.getMoviesForUpdates as jest.Mock).mockResolvedValue(mockMovies);
      (checkForMovieChanges as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      await updateMovies();

      expect(moviesDb.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(checkForMovieChanges).toHaveBeenCalledTimes(3);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to check for changes in movie ID 2', error);

      expect(checkForMovieChanges).toHaveBeenCalledWith(mockMovies[0], '2024-12-22', '2025-01-01');
      expect(checkForMovieChanges).toHaveBeenCalledWith(mockMovies[1], '2024-12-22', '2025-01-01');
      expect(checkForMovieChanges).toHaveBeenCalledWith(mockMovies[2], '2024-12-22', '2025-01-01');
    });

    it('should handle empty movie list', async () => {
      (moviesDb.getMoviesForUpdates as jest.Mock).mockResolvedValue([]);

      await updateMovies();

      expect(moviesDb.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 0 movies to check for updates');
      expect(checkForMovieChanges).not.toHaveBeenCalled();
    });
  });

  describe('updateShows', () => {
    it('should update shows with changes', async () => {
      const mockShows = [
        { id: 1, tmdb_id: 201, title: 'Show 1' },
        { id: 2, tmdb_id: 202, title: 'Show 2' },
      ];
      (showsDb.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);
      (checkForShowChanges as jest.Mock).mockResolvedValue(undefined);
      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30', // 2-day range for shows
      });

      await updateShows();

      expect(showsDb.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(changesUtility.generateDateRange).toHaveBeenCalledWith(2);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 2 shows to check for updates');
      expect(checkForShowChanges).toHaveBeenCalledTimes(2);
      expect(checkForShowChanges).toHaveBeenCalledWith(mockShows[0], '2024-12-30', '2025-01-01');
      expect(checkForShowChanges).toHaveBeenCalledWith(mockShows[1], '2024-12-30', '2025-01-01');
      expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
    });

    it('should handle error when fetching shows', async () => {
      const error = new Error('Database error');
      (showsDb.getShowsForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updateShows()).rejects.toThrow('Database error');
      expect(cliLogger.error).toHaveBeenCalledWith('Unexpected error while checking for show updates', error);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowsChangeFail, { error });
      expect(checkForShowChanges).not.toHaveBeenCalled();
    });

    it('should continue processing if one show check fails', async () => {
      const mockShows = [
        { id: 1, tmdb_id: 201, title: 'Show 1' },
        { id: 2, tmdb_id: 202, title: 'Show 2' },
        { id: 3, tmdb_id: 203, title: 'Show 3' },
      ];
      const error = new Error('API error');

      (showsDb.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);
      (checkForShowChanges as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30',
      });

      await updateShows();

      expect(showsDb.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(checkForShowChanges).toHaveBeenCalledTimes(3);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to check for changes in show ID 2', error);
      expect(checkForShowChanges).toHaveBeenCalledWith(mockShows[0], '2024-12-30', '2025-01-01');
      expect(checkForShowChanges).toHaveBeenCalledWith(mockShows[1], '2024-12-30', '2025-01-01');
      expect(checkForShowChanges).toHaveBeenCalledWith(mockShows[2], '2024-12-30', '2025-01-01');
    });

    it('should handle empty show list', async () => {
      (showsDb.getShowsForUpdates as jest.Mock).mockResolvedValue([]);
      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30',
      });

      await updateShows();

      expect(showsDb.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 0 shows to check for updates');
      expect(checkForShowChanges).not.toHaveBeenCalled();
    });
  });
});
