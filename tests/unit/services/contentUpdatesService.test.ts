import { appLogger, cliLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { updateMovies, updatePeople, updateShows } from '@services/contentUpdatesService';
import { moviesService } from '@services/moviesService';
import { personService } from '@services/personService';
import { showService } from '@services/showService';
import * as changesUtility from '@utils/changesUtility';

jest.mock('@services/moviesService');
jest.mock('@services/showService');
jest.mock('@services/personService');
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  appLogger: {
    error: jest.fn(),
  },
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
      (moviesService.getMoviesForUpdates as jest.Mock).mockResolvedValue(mockMovies);
      (moviesService.checkMovieForChanges as jest.Mock).mockResolvedValue(undefined);

      await updateMovies();

      expect(moviesService.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(changesUtility.generateDateRange).toHaveBeenCalledWith(10);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 2 movies to check for updates');
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledTimes(2);
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledWith(mockMovies[0], '2024-12-22', '2025-01-01');
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledWith(mockMovies[1], '2024-12-22', '2025-01-01');
      expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
    });

    it('should handle error when fetching movies', async () => {
      const error = new Error('Database error');
      (moviesService.getMoviesForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updateMovies()).rejects.toThrow('Database error');
      expect(cliLogger.error).toHaveBeenCalledWith('Unexpected error while checking for movie updates', error);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.MoviesChangeFail, { error });
      expect(moviesService.checkMovieForChanges).not.toHaveBeenCalled();
    });

    it('should continue processing if one movie check fails', async () => {
      const mockMovies = [
        { id: 1, tmdb_id: 101, title: 'Movie 1' },
        { id: 2, tmdb_id: 102, title: 'Movie 2' },
        { id: 3, tmdb_id: 103, title: 'Movie 3' },
      ];
      const error = new Error('API error');

      (moviesService.getMoviesForUpdates as jest.Mock).mockResolvedValue(mockMovies);
      (moviesService.checkMovieForChanges as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      await updateMovies();

      expect(moviesService.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledTimes(3);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to check for changes in movie ID 2', error);

      expect(moviesService.checkMovieForChanges).toHaveBeenCalledWith(mockMovies[0], '2024-12-22', '2025-01-01');
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledWith(mockMovies[1], '2024-12-22', '2025-01-01');
      expect(moviesService.checkMovieForChanges).toHaveBeenCalledWith(mockMovies[2], '2024-12-22', '2025-01-01');
    });

    it('should handle empty movie list', async () => {
      (moviesService.getMoviesForUpdates as jest.Mock).mockResolvedValue([]);

      await updateMovies();

      expect(moviesService.getMoviesForUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 0 movies to check for updates');
      expect(moviesService.checkMovieForChanges).not.toHaveBeenCalled();
    });
  });

  describe('updateShows', () => {
    it('should update shows with changes', async () => {
      const mockShows = [
        { id: 1, tmdb_id: 201, title: 'Show 1' },
        { id: 2, tmdb_id: 202, title: 'Show 2' },
      ];
      (showService.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);
      (showService.checkShowForChanges as jest.Mock).mockResolvedValue(undefined);
      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30', // 2-day range for shows
      });

      await updateShows();

      expect(showService.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(changesUtility.generateDateRange).toHaveBeenCalledWith(2);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 2 shows to check for updates');
      expect(showService.checkShowForChanges).toHaveBeenCalledTimes(2);
      expect(showService.checkShowForChanges).toHaveBeenCalledWith(mockShows[0], '2024-12-30', '2025-01-01');
      expect(showService.checkShowForChanges).toHaveBeenCalledWith(mockShows[1], '2024-12-30', '2025-01-01');
      expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
    });

    it('should handle error when fetching shows', async () => {
      const error = new Error('Database error');
      (showService.getShowsForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updateShows()).rejects.toThrow('Database error');
      expect(cliLogger.error).toHaveBeenCalledWith('Unexpected error while checking for show updates', error);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.ShowsChangeFail, { error });
      expect(showService.checkShowForChanges).not.toHaveBeenCalled();
    });

    it('should continue processing if one show check fails', async () => {
      const mockShows = [
        { id: 1, tmdb_id: 201, title: 'Show 1' },
        { id: 2, tmdb_id: 202, title: 'Show 2' },
        { id: 3, tmdb_id: 203, title: 'Show 3' },
      ];
      const error = new Error('API error');

      (showService.getShowsForUpdates as jest.Mock).mockResolvedValue(mockShows);
      (showService.checkShowForChanges as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30',
      });

      await updateShows();

      expect(showService.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(showService.checkShowForChanges).toHaveBeenCalledTimes(3);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to check for changes in show ID 2', error);
      expect(showService.checkShowForChanges).toHaveBeenCalledWith(mockShows[0], '2024-12-30', '2025-01-01');
      expect(showService.checkShowForChanges).toHaveBeenCalledWith(mockShows[1], '2024-12-30', '2025-01-01');
      expect(showService.checkShowForChanges).toHaveBeenCalledWith(mockShows[2], '2024-12-30', '2025-01-01');
    });

    it('should handle empty show list', async () => {
      (showService.getShowsForUpdates as jest.Mock).mockResolvedValue([]);
      (changesUtility.generateDateRange as jest.Mock).mockReturnValue({
        currentDate: '2025-01-01',
        pastDate: '2024-12-30',
      });

      await updateShows();

      expect(showService.getShowsForUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Found 0 shows to check for updates');
      expect(showService.checkShowForChanges).not.toHaveBeenCalled();
    });
  });

  describe('updatePeople', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update people with changes', async () => {
      const mockPeople = [
        { id: 1, tmdb_id: 301, name: 'Person 1' },
        { id: 2, tmdb_id: 302, name: 'Person 2' },
      ];
      const mockBlockInfo = {
        date: '2025-01-15',
        blockNumber: 15,
        totalPeople: 100,
      };
      const mockResults = [
        { personId: 1, success: true, hadUpdates: true },
        { personId: 2, success: true, hadUpdates: false },
      ];

      (personService.calculateBlockNumber as jest.Mock).mockReturnValue(15);
      (personService.getTodayBlockInfo as jest.Mock).mockResolvedValue(mockBlockInfo);
      (personService.getPeopleForUpdates as jest.Mock).mockResolvedValue(mockPeople);
      (personService.checkAndUpdatePerson as jest.Mock)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);
      (showService.invalidateAllShowsCache as jest.Mock).mockResolvedValue(undefined);

      await updatePeople();

      expect(personService.calculateBlockNumber).toHaveBeenCalledWith(new Date('2025-01-15T10:00:00Z'));
      expect(personService.getTodayBlockInfo).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting daily person update for block 15', {
        totalPeople: 100,
        date: '2025-01-15',
      });
      expect(personService.getPeopleForUpdates).toHaveBeenCalledWith(15);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledTimes(2);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledWith(mockPeople[0]);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledWith(mockPeople[1]);
      expect(changesUtility.sleep).toHaveBeenCalledTimes(2);
      expect(showService.invalidateAllShowsCache).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Daily person update completed', {
        blockNumber: 15,
        processed: 2,
        successful: 2,
        updated: 1,
        failed: 0,
        duration: expect.any(String),
      });
    });

    it('should handle error when fetching people', async () => {
      const error = new Error('Database error');
      const mockBlockInfo = {
        date: '2025-01-15',
        blockNumber: 15,
        totalPeople: 100,
      };

      (personService.calculateBlockNumber as jest.Mock).mockReturnValue(15);
      (personService.getTodayBlockInfo as jest.Mock).mockResolvedValue(mockBlockInfo);
      (personService.getPeopleForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updatePeople()).rejects.toThrow('Database error');
      expect(cliLogger.error).toHaveBeenCalledWith('Unexpected error while checking for person updates', error);
      expect(appLogger.error).toHaveBeenCalledWith(ErrorMessages.PeopleChangeFail, { error });
      expect(personService.checkAndUpdatePerson).not.toHaveBeenCalled();
    });

    it('should continue processing if one person check fails', async () => {
      const mockPeople = [
        { id: 1, tmdb_id: 301, name: 'Person 1' },
        { id: 2, tmdb_id: 302, name: 'Person 2' },
        { id: 3, tmdb_id: 303, name: 'Person 3' },
      ];
      const mockBlockInfo = {
        date: '2025-01-15',
        blockNumber: 15,
        totalPeople: 100,
      };
      const error = new Error('API error');

      (personService.calculateBlockNumber as jest.Mock).mockReturnValue(15);
      (personService.getTodayBlockInfo as jest.Mock).mockResolvedValue(mockBlockInfo);
      (personService.getPeopleForUpdates as jest.Mock).mockResolvedValue(mockPeople);
      (personService.checkAndUpdatePerson as jest.Mock)
        .mockResolvedValueOnce({ personId: 1, success: true, hadUpdates: true })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ personId: 3, success: true, hadUpdates: false });
      (showService.invalidateAllShowsCache as jest.Mock).mockResolvedValue(undefined);

      await updatePeople();

      expect(personService.getPeopleForUpdates).toHaveBeenCalledTimes(1);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledTimes(3);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to check for changes in person ID 2', error);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledWith(mockPeople[0]);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledWith(mockPeople[1]);
      expect(personService.checkAndUpdatePerson).toHaveBeenCalledWith(mockPeople[2]);
      expect(showService.invalidateAllShowsCache).toHaveBeenCalledTimes(1);
    });

    it('should handle empty people list', async () => {
      const mockBlockInfo = {
        date: '2025-01-15',
        blockNumber: 15,
        totalPeople: 100,
      };

      (personService.calculateBlockNumber as jest.Mock).mockReturnValue(15);
      (personService.getTodayBlockInfo as jest.Mock).mockResolvedValue(mockBlockInfo);
      (personService.getPeopleForUpdates as jest.Mock).mockResolvedValue([]);
      (showService.invalidateAllShowsCache as jest.Mock).mockResolvedValue(undefined);

      await updatePeople();

      expect(personService.getPeopleForUpdates).toHaveBeenCalledTimes(1);
      expect(personService.checkAndUpdatePerson).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Daily person update completed', {
        blockNumber: 15,
        processed: 0,
        successful: 0,
        updated: 0,
        failed: 0,
        duration: expect.any(String),
      });
    });

    it('should calculate correct statistics', async () => {
      const mockPeople = [
        { id: 1, tmdb_id: 301, name: 'Person 1' },
        { id: 2, tmdb_id: 302, name: 'Person 2' },
        { id: 3, tmdb_id: 303, name: 'Person 3' },
        { id: 4, tmdb_id: 304, name: 'Person 4' },
      ];
      const mockBlockInfo = {
        date: '2025-01-15',
        blockNumber: 15,
        totalPeople: 100,
      };
      const mockResults = [
        { personId: 1, success: true, hadUpdates: true },
        { personId: 2, success: true, hadUpdates: true },
        { personId: 3, success: true, hadUpdates: false },
        { personId: 4, success: false, hadUpdates: false },
      ];

      (personService.calculateBlockNumber as jest.Mock).mockReturnValue(15);
      (personService.getTodayBlockInfo as jest.Mock).mockResolvedValue(mockBlockInfo);
      (personService.getPeopleForUpdates as jest.Mock).mockResolvedValue(mockPeople);
      (personService.checkAndUpdatePerson as jest.Mock)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2])
        .mockResolvedValueOnce(mockResults[3]);
      (showService.invalidateAllShowsCache as jest.Mock).mockResolvedValue(undefined);

      await updatePeople();

      expect(cliLogger.info).toHaveBeenCalledWith('Daily person update completed', {
        blockNumber: 15,
        processed: 4,
        successful: 3,
        updated: 2,
        failed: 1,
        duration: expect.any(String),
      });
    });
  });
});
