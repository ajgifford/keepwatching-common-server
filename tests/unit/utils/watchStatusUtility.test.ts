import { WatchStatus } from '@ajgifford/keepwatching-types';
import { DatabaseError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { WatchStatusUtility } from '@utils/watchStatusUtility';

jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
}));

jest.mock('@utils/errorHandlingUtility', () => ({
  handleDatabaseError: jest.fn(),
}));

describe('WatchStatusUtility', () => {
  let mockPool: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    mockExecute = jest.fn();
    mockPool = {
      execute: mockExecute,
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('integration scenarios', () => {
    it('should properly integrate convertStatus with database operations', async () => {
      // Setup mock for database query checking for UP_TO_DATE support
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      // Check if UP_TO_DATE status is supported
      const hasUpToDate = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(hasUpToDate).toBe(true);

      // Get a properly converted status - this should work regardless of DB status
      const status = WatchStatusUtility.convertStatus('WATCHED');
      expect(status).toBe(WatchStatus.WATCHED);

      // If database has UP_TO_DATE status and show is in production,
      // watching all episodes should result in UP_TO_DATE status
      const completionStatus = WatchStatusUtility.determineCompletionStatus(true, true, false);
      expect(completionStatus).toBe(WatchStatus.UP_TO_DATE);
    });

    it('should handle scenarios where UP_TO_DATE is not supported by database', async () => {
      // Mock database indicating no UP_TO_DATE status support
      mockExecute.mockResolvedValueOnce([[{ count: 0 }]]);

      // Check DB support
      const hasUpToDate = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(hasUpToDate).toBe(false);

      // Even without DB support, the utility should still calculate the proper status
      const completionStatus = WatchStatusUtility.determineCompletionStatus(true, true, false);
      expect(completionStatus).toBe(WatchStatus.UP_TO_DATE);

      // This highlights that the application logic for determining status works independently
      // from the database's ability to store that status
    });

    it('should provide fallback behavior for legacy statuses', () => {
      // Even if we get a non-standard status from some source, it should be handled safely
      const unknownStatus = WatchStatusUtility.convertStatus('COMPLETED'); // Not a real status
      expect(unknownStatus).toBe(WatchStatus.NOT_WATCHED); // Should default to NOT_WATCHED

      // But valid legacy statuses should map correctly
      const watchedStatus = WatchStatusUtility.convertStatus('WATCHED');
      expect(watchedStatus).toBe(WatchStatus.WATCHED);
    });

    it('should allow for future expansion of watch status types', () => {
      // The current implementation supports these statuses
      const allStatuses = Object.values(WatchStatus);
      expect(allStatuses).toContain(WatchStatus.NOT_WATCHED);
      expect(allStatuses).toContain(WatchStatus.WATCHING);
      expect(allStatuses).toContain(WatchStatus.WATCHED);
      expect(allStatuses).toContain(WatchStatus.UP_TO_DATE);

      // If new statuses are added to the enum in the future,
      // the convertStatus method should be updated accordingly
      const knownStatus = WatchStatusUtility.convertStatus(WatchStatus.UP_TO_DATE);
      expect(knownStatus).toBe(WatchStatus.UP_TO_DATE);
    });
  });

  describe('migration workflow testing', () => {
    it('should validate database status and perform migration if needed', async () => {
      // First check if UP_TO_DATE status exists in the schema
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      const hasUpToDate = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(hasUpToDate).toBe(true);

      // Then perform the migration
      mockExecute.mockResolvedValueOnce([{ affectedRows: 5 }]); // Shows
      mockExecute.mockResolvedValueOnce([{ affectedRows: 10 }]); // Seasons

      const migrationResult = await WatchStatusUtility.migrateWatchedToUpToDate();
      expect(migrationResult).toEqual({
        shows: 5,
        seasons: 10,
      });

      // Validate that the correct queries were executed in the right order
      expect(mockExecute.mock.calls[0][0]).toContain('SELECT COUNT(*) as count');
      expect(mockExecute.mock.calls[0][1]).toEqual(['show_watch_status', 'status']);

      // The second call was for the first part of the migration (shows)
      expect(mockExecute.mock.calls[1][0]).toContain('UPDATE show_watch_status');

      // The third call was for the second part of the migration (seasons)
      expect(mockExecute.mock.calls[2][0]).toContain('UPDATE season_watch_status');
    });

    it('should handle case where database schema does not support UP_TO_DATE yet', async () => {
      // Mock that UP_TO_DATE status doesn't exist in schema
      mockExecute.mockResolvedValueOnce([[{ count: 0 }]]);

      const hasUpToDate = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(hasUpToDate).toBe(false);

      // In a real application, this would indicate that schema migration
      // should be performed before data migration
    });
  });

  describe('convertStatus', () => {
    it('should return the same status if it is a valid WatchStatus', () => {
      expect(WatchStatusUtility.convertStatus(WatchStatus.NOT_WATCHED)).toBe(WatchStatus.NOT_WATCHED);
      expect(WatchStatusUtility.convertStatus(WatchStatus.WATCHING)).toBe(WatchStatus.WATCHING);
      expect(WatchStatusUtility.convertStatus(WatchStatus.WATCHED)).toBe(WatchStatus.WATCHED);
      expect(WatchStatusUtility.convertStatus(WatchStatus.UP_TO_DATE)).toBe(WatchStatus.UP_TO_DATE);
    });

    it('should convert legacy status values to correct WatchStatus', () => {
      expect(WatchStatusUtility.convertStatus('NOT_WATCHED')).toBe(WatchStatus.NOT_WATCHED);
      expect(WatchStatusUtility.convertStatus('WATCHING')).toBe(WatchStatus.WATCHING);
      expect(WatchStatusUtility.convertStatus('WATCHED')).toBe(WatchStatus.WATCHED);
    });

    it('should return NOT_WATCHED for unknown status values', () => {
      expect(WatchStatusUtility.convertStatus('INVALID_STATUS')).toBe(WatchStatus.NOT_WATCHED);
      expect(WatchStatusUtility.convertStatus('')).toBe(WatchStatus.NOT_WATCHED);
    });
  });

  describe('determineCompletionStatus', () => {
    describe('when content is incomplete', () => {
      it('should return WATCHING if not all content is complete regardless of production status', () => {
        expect(WatchStatusUtility.determineCompletionStatus(false, true, false)).toBe(WatchStatus.WATCHING);
        expect(WatchStatusUtility.determineCompletionStatus(false, false, true)).toBe(WatchStatus.WATCHING);
        expect(WatchStatusUtility.determineCompletionStatus(false, true, true)).toBe(WatchStatus.WATCHING);
        expect(WatchStatusUtility.determineCompletionStatus(false, false, false)).toBe(WatchStatus.WATCHING);
      });

      it('should prioritize completion status over production status', () => {
        // Even when a show is not in production and has no upcoming episodes,
        // if it's not complete, it should be WATCHING
        expect(WatchStatusUtility.determineCompletionStatus(false, false, false)).toBe(WatchStatus.WATCHING);
      });
    });

    describe('when content is complete', () => {
      it('should return UP_TO_DATE if show is in production', () => {
        expect(WatchStatusUtility.determineCompletionStatus(true, true, false)).toBe(WatchStatus.UP_TO_DATE);
      });

      it('should return UP_TO_DATE if show has upcoming episodes', () => {
        expect(WatchStatusUtility.determineCompletionStatus(true, false, true)).toBe(WatchStatus.UP_TO_DATE);
      });

      it('should return UP_TO_DATE if show is both in production and has upcoming episodes', () => {
        expect(WatchStatusUtility.determineCompletionStatus(true, true, true)).toBe(WatchStatus.UP_TO_DATE);
      });

      it('should return WATCHED if show is not in production and has no upcoming episodes', () => {
        expect(WatchStatusUtility.determineCompletionStatus(true, false, false)).toBe(WatchStatus.WATCHED);
      });

      it('should prioritize production or upcoming status over completion when determining UP_TO_DATE', () => {
        // When content is complete but show is active or has upcoming episodes,
        // it should be UP_TO_DATE instead of WATCHED
        expect(WatchStatusUtility.determineCompletionStatus(true, true, false)).toBe(WatchStatus.UP_TO_DATE);
        expect(WatchStatusUtility.determineCompletionStatus(true, false, true)).toBe(WatchStatus.UP_TO_DATE);
      });
    });

    describe('edge cases', () => {
      // Testing with various truthy/falsy values to ensure robustness
      it('should handle numeric boolean values', () => {
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus(1, 1, 0)).toBe(WatchStatus.UP_TO_DATE);
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus(1, 0, 0)).toBe(WatchStatus.WATCHED);
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus(0, 1, 1)).toBe(WatchStatus.WATCHING);
      });

      it('should handle string boolean values', () => {
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus('true', 'true', '')).toBe(WatchStatus.UP_TO_DATE);
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus('true', '', 'true')).toBe(WatchStatus.UP_TO_DATE);
        // @ts-expect-error Testing with non-boolean values for robustness
        expect(WatchStatusUtility.determineCompletionStatus('', 'true', 'true')).toBe(WatchStatus.WATCHING);
      });
    });
  });

  describe('migrateWatchedToUpToDate', () => {
    it('should update WATCHED status to UP_TO_DATE for shows and seasons that are in production', async () => {
      // Mock successful update results
      mockExecute.mockImplementation((query: string) => {
        if (query.includes('show_watch_status')) {
          return Promise.resolve([{ affectedRows: 10 }]);
        } else if (query.includes('season_watch_status')) {
          return Promise.resolve([{ affectedRows: 20 }]);
        }
        return Promise.resolve([{ affectedRows: 0 }]);
      });

      const result = await WatchStatusUtility.migrateWatchedToUpToDate();

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE show_watch_status'));
      expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE season_watch_status'));
      expect(result).toEqual({
        shows: 10,
        seasons: 20,
      });
    });

    it('should handle case when no rows are affected', async () => {
      // Mock update results with no affected rows
      mockExecute.mockImplementation(() => {
        return Promise.resolve([{ affectedRows: 0 }]);
      });

      const result = await WatchStatusUtility.migrateWatchedToUpToDate();

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        shows: 0,
        seasons: 0,
      });
    });

    it('should pass the correct SQL query with UP_TO_DATE status and in_production filter', async () => {
      // Mock updates with minimal implementation
      mockExecute.mockResolvedValue([{ affectedRows: 1 }]);

      await WatchStatusUtility.migrateWatchedToUpToDate();

      // Verify show query includes correct status and filter
      const showQuery = mockExecute.mock.calls[0][0];
      expect(showQuery).toContain(`SET sws.status = '${WatchStatus.UP_TO_DATE}'`);
      expect(showQuery).toContain(`WHERE sws.status = '${WatchStatus.WATCHED}'`);
      expect(showQuery).toContain('AND s.in_production = 1');

      // Verify season query includes correct status and filter
      const seasonQuery = mockExecute.mock.calls[1][0];
      expect(seasonQuery).toContain(`SET sws.status = '${WatchStatus.UP_TO_DATE}'`);
      expect(seasonQuery).toContain(`WHERE sws.status = '${WatchStatus.WATCHED}'`);
      expect(seasonQuery).toContain('AND sh.in_production = 1');
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      // Mock handleDatabaseError to throw a custom error
      (handleDatabaseError as unknown as jest.Mock).mockImplementation((error) => {
        throw new Error(`Database error: ${error.message}`);
      });

      await expect(WatchStatusUtility.migrateWatchedToUpToDate()).rejects.toThrow(
        'Database error: Database connection failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'migrating WATCHED statuses to UP_TO_DATE');
    });

    it('should handle CustomError propagation', async () => {
      const customError = new DatabaseError('Custom database error', null);
      mockExecute.mockRejectedValueOnce(customError);

      // Mock handleDatabaseError to propagate CustomError
      (handleDatabaseError as unknown as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(WatchStatusUtility.migrateWatchedToUpToDate()).rejects.toThrow(customError);
      expect(handleDatabaseError).toHaveBeenCalledWith(customError, 'migrating WATCHED statuses to UP_TO_DATE');
    });
  });

  describe('hasUpToDateStatus', () => {
    it('should return true if table has UP_TO_DATE status in ENUM', async () => {
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count'), [
        'show_watch_status',
        'status',
      ]);
      expect(result).toBe(true);
    });

    it('should return false if table does not have UP_TO_DATE status in ENUM', async () => {
      mockExecute.mockResolvedValueOnce([[{ count: 0 }]]);

      const result = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');

      expect(result).toBe(false);
    });

    it('should use custom column name if provided', async () => {
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      await WatchStatusUtility.hasUpToDateStatus('custom_table', 'custom_column');

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count'), [
        'custom_table',
        'custom_column',
      ]);
    });

    it('should check specifically for UP_TO_DATE in ENUM values', async () => {
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      await WatchStatusUtility.hasUpToDateStatus('show_watch_status');

      const query = mockExecute.mock.calls[0][0];
      expect(query).toContain('column_type LIKE "%\'UP_TO_DATE\'%"');
    });

    it('should check in the current database schema', async () => {
      mockExecute.mockResolvedValueOnce([[{ count: 1 }]]);

      await WatchStatusUtility.hasUpToDateStatus('show_watch_status');

      const query = mockExecute.mock.calls[0][0];
      expect(query).toContain('table_schema = DATABASE()');
    });

    it('should handle null or undefined result', async () => {
      // Mock a response with undefined/null count
      mockExecute.mockResolvedValueOnce([[{ count: null }]]);

      const result = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(result).toBe(false);
    });

    it('should handle empty result set', async () => {
      // Mock an empty result
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      // Mock handleDatabaseError to throw a custom error
      (handleDatabaseError as unknown as jest.Mock).mockImplementation((error) => {
        throw new Error(`Database error: ${error.message}`);
      });

      await expect(WatchStatusUtility.hasUpToDateStatus('show_watch_status')).rejects.toThrow(
        'Database error: Database connection failed',
      );
      expect(handleDatabaseError).toHaveBeenCalledWith(
        dbError,
        'checking if show_watch_status.status has UP_TO_DATE status',
      );
    });

    it('should handle custom database errors properly', async () => {
      const customDbError = new DatabaseError('Custom database error message', new Error('Original error'));
      mockExecute.mockRejectedValueOnce(customDbError);

      // Mock handleDatabaseError to propagate the CustomError
      (handleDatabaseError as unknown as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(WatchStatusUtility.hasUpToDateStatus('show_watch_status')).rejects.toThrow(customDbError);
    });
  });
});
