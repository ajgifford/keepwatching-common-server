import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as summaryDb from '@db/summaryDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';

jest.mock('@utils/errorHandlingUtility');

describe('summaryDb Module', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;

    jest.mocked(handleDatabaseError).mockImplementation((error, context) => {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error ${context}: ${msg}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummaryCounts()', () => {
    it('should reduce row results into a SummaryCounts object', async () => {
      const mockRows = [
        { entity: 'accounts', count: 10 },
        { entity: 'profiles', count: 25 },
        { entity: 'shows', count: 100 },
        { entity: 'seasons', count: 500 },
        { entity: 'episodes', count: 5000 },
        { entity: 'movies', count: 200 },
        { entity: 'people', count: 1000 },
        { entity: 'favoritedShows', count: 300 },
        { entity: 'favoritedMovies', count: 150 },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await summaryDb.getSummaryCounts();

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        accounts: 10,
        profiles: 25,
        shows: 100,
        seasons: 500,
        episodes: 5000,
        movies: 200,
        people: 1000,
        favoritedShows: 300,
        favoritedMovies: 150,
      });
    });

    it('should return an empty object when no rows are returned', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await summaryDb.getSummaryCounts();

      expect(result).toEqual({});
    });

    it('should propagate database errors via handleDatabaseError', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('connection refused'));

      await expect(summaryDb.getSummaryCounts()).rejects.toThrow(
        'Database error getting summary counts: connection refused',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(expect.any(Error), 'getting summary counts');
    });
  });

  describe('getTableCount()', () => {
    it('should return the count value from the first row', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 42 }]]);

      const result = await summaryDb.getTableCount('accounts');

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(42);
    });

    it('should return 0 when the table is empty', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ count: 0 }]]);

      const result = await summaryDb.getTableCount('movies');

      expect(result).toBe(0);
    });

    it('should propagate database errors via handleDatabaseError', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('table not found'));

      await expect(summaryDb.getTableCount('nonexistent')).rejects.toThrow(
        'Database error getting summary counts: table not found',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(expect.any(Error), 'getting summary counts');
    });
  });
});
