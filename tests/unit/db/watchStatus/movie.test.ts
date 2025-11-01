import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

// Mock dependencies
jest.mock('@utils/transactionHelper');
jest.mock('@utils/watchStatusManager');
jest.mock('@utils/errorHandlingUtility', () => ({
  handleDatabaseError: jest.fn((error: Error, operation: string) => {
    throw new Error(`Database error ${operation}: ${error.message}`);
  }),
}));

describe('WatchStatusDbService - Movie Operations', () => {
  let watchStatusDbService: WatchStatusDbService;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;
  let mockWatchStatusManager: jest.Mocked<WatchStatusManager>;
  let mockConnection: jest.Mocked<PoolConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock connection
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<PoolConnection>;

    // Mock TransactionHelper
    mockTransactionHelper = {
      executeInTransaction: jest.fn(),
    } as jest.Mocked<TransactionHelper>;

    // Mock WatchStatusManager
    mockWatchStatusManager = {
      calculateEpisodeStatus: jest.fn(),
      calculateSeasonStatus: jest.fn(),
      calculateShowStatus: jest.fn(),
      onStatusChange: jest.fn(),
      generateStatusSummary: jest.fn(),
    } as unknown as jest.Mocked<WatchStatusManager>;

    // Create service instance with mocked dependencies
    watchStatusDbService = new WatchStatusDbService(mockWatchStatusManager, mockTransactionHelper);
  });

  describe('checkAndUpdateMovieWatchStatus', () => {
    const profileId = 123;
    const movieId = 456;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should successfully update UNAIRED movie to NOT_WATCHED when release date has passed', async () => {
      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.changes).toHaveLength(1);

      // Verify the status change was recorded
      expect(result.changes[0]).toEqual({
        entityType: 'episode', // Movie uses 'episode' as entity type
        entityId: movieId,
        from: WatchStatus.UNAIRED,
        to: WatchStatus.NOT_WATCHED,
        timestamp: expect.any(Date),
        reason: 'Movie release date passed',
      });

      // Verify the database query was called correctly
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO movie_watch_status (profile_id, movie_id, status)'),
        [profileId, profileId, movieId, expect.any(Date)],
      );

      // Verify the query includes the ON DUPLICATE KEY UPDATE clause
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('ON DUPLICATE KEY UPDATE'),
        expect.any(Array),
      );

      // Verify the query filters for UNAIRED status
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining("(mws.status = 'UNAIRED' OR mws.movie_id IS NULL)"),
        expect.any(Array),
      );
    });

    it('should return success with no changes when movie is already NOT_WATCHED or other status', async () => {
      const updateResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0);
      expect(result.changes).toHaveLength(0);

      // Verify the database query was called
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });

    it('should return success with no changes when movie has not been released yet', async () => {
      const updateResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0);
      expect(result.changes).toHaveLength(0);

      // Verify the query includes release date check
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('DATE(m.release_date) <= ?'),
        expect.any(Array),
      );
    });

    it('should handle multiple affected rows if somehow multiple movies match', async () => {
      const updateResult = {
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 2,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(2);
      expect(result.changes).toHaveLength(1);

      // Verify the status change was recorded
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: movieId,
        from: WatchStatus.UNAIRED,
        to: WatchStatus.NOT_WATCHED,
        timestamp: expect.any(Date),
        reason: 'Movie release date passed',
      });
    });

    it('should handle database errors during movie status check', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId)).rejects.toThrow(
        'Database error checking and updating movie watch status: Database connection failed',
      );

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'checking and updating movie watch status');
    });

    it('should execute within a transaction', async () => {
      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      // Verify transaction helper was called
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should use current timestamp for date comparison', async () => {
      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      // Verify the timestamp in the change is between before and after
      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('DATE(m.release_date) <= ?'), [
        profileId,
        profileId,
        movieId,
        expect.any(Date),
      ]);
    });

    it('should only update movies with NULL watch status or UNAIRED status', async () => {
      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      // Verify the query specifically checks for UNAIRED or NULL status
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining("(mws.status = 'UNAIRED' OR mws.movie_id IS NULL)"),
        expect.any(Array),
      );
    });

    it('should set updated_at timestamp when updating existing records', async () => {
      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      await watchStatusDbService.checkAndUpdateMovieWatchStatus(profileId, movieId);

      // Verify the query includes updated_at in ON DUPLICATE KEY UPDATE
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array),
      );
    });
  });
});
