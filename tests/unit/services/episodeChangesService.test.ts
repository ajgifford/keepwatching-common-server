import { cliLogger, httpLogger } from '@logger/logger';
import { ErrorMessages } from '@logger/loggerModel';
import { checkSeasonForEpisodeChanges } from '@services/episodeChangesService';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    error: jest.fn(),
  },
  httpLogger: {
    error: jest.fn(),
  },
}));

jest.mock('@services/tmdbService', () => ({
  getTMDBService: jest.fn(),
}));

describe('episodeChangesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSeasonForEpisodeChanges', () => {
    const mockTMDBService = {
      getSeasonChanges: jest.fn(),
    };

    beforeEach(() => {
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);
    });

    it('should return true when episode changes are found', async () => {
      const seasonId = 123;
      const pastDate = '2023-01-01';
      const currentDate = '2023-01-10';

      mockTMDBService.getSeasonChanges.mockResolvedValue({
        changes: [
          { key: 'episode', items: [{ id: '1', action: 'added' }] },
          { key: 'overview', items: [{ id: '2', action: 'updated' }] },
        ],
      });

      const result = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      expect(result).toBe(true);
      expect(mockTMDBService.getSeasonChanges).toHaveBeenCalledWith(seasonId, pastDate, currentDate);
    });

    it('should return false when no episode changes are found', async () => {
      const seasonId = 123;
      const pastDate = '2023-01-01';
      const currentDate = '2023-01-10';

      mockTMDBService.getSeasonChanges.mockResolvedValue({
        changes: [
          { key: 'overview', items: [{ id: '1', action: 'updated' }] },
          { key: 'name', items: [{ id: '2', action: 'updated' }] },
        ],
      });

      const result = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      expect(result).toBe(false);
      expect(mockTMDBService.getSeasonChanges).toHaveBeenCalledWith(seasonId, pastDate, currentDate);
    });

    it('should return false when changes array is empty', async () => {
      const seasonId = 123;
      const pastDate = '2023-01-01';
      const currentDate = '2023-01-10';

      mockTMDBService.getSeasonChanges.mockResolvedValue({
        changes: [],
      });

      const result = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      expect(result).toBe(false);
      expect(mockTMDBService.getSeasonChanges).toHaveBeenCalledWith(seasonId, pastDate, currentDate);
    });

    it('should return false when changes property is missing', async () => {
      const seasonId = 123;
      const pastDate = '2023-01-01';
      const currentDate = '2023-01-10';

      mockTMDBService.getSeasonChanges.mockResolvedValue({});

      const result = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      expect(result).toBe(false);
      expect(mockTMDBService.getSeasonChanges).toHaveBeenCalledWith(seasonId, pastDate, currentDate);
    });

    it('should handle API errors and return false', async () => {
      const seasonId = 123;
      const pastDate = '2023-01-01';
      const currentDate = '2023-01-10';
      const error = new Error('API Error');

      mockTMDBService.getSeasonChanges.mockRejectedValue(error);

      const result = await checkSeasonForEpisodeChanges(seasonId, pastDate, currentDate);

      expect(result).toBe(false);
      expect(mockTMDBService.getSeasonChanges).toHaveBeenCalledWith(seasonId, pastDate, currentDate);
      expect(cliLogger.error).toHaveBeenCalledWith(`Error checking changes for season ID ${seasonId}`, error);
      expect(httpLogger.error).toHaveBeenCalledWith(ErrorMessages.SeasonChangeFail, { error, seasonId });
    });
  });
});
