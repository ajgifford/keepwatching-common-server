import { createMockEpisodeRow, createMockSeasonRow, createMockShowRow } from './helpers/watchStatusTestTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { NotFoundError } from '@middleware/errorMiddleware';
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

describe('WatchStatusDbService - Show Operations', () => {
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

  describe('updateShowWatchStatus', () => {
    const profileId = 123;
    const showId = 456;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should successfully update show status and propagate to all seasons and episodes', async () => {
      // Mock show query result
      const showRow = createMockShowRow({
        id: showId,
        status: 'NOT_WATCHED',
        release_date: '2023-01-01',
        in_production: 1,
      });

      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      const episodeUpdateResult = {
        affectedRows: 10,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      const seasonUpdateResult = {
        affectedRows: 3,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls
      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []]) // Show query
        .mockResolvedValueOnce([episodeUpdateResult, []]) // Episode bulk update
        .mockResolvedValueOnce([seasonUpdateResult, []]) // Season bulk update
        .mockResolvedValueOnce([updateResult, []]); // Show update

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(14); // 10 episodes + 3 seasons + 1 show
      expect(result.changes).toHaveLength(1); // Only show change recorded

      // Verify show change
      expect(result.changes[0]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Show manually set to WATCHED',
      });

      // Verify episode update query handles unaired episodes
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHEN e.air_date IS NULL OR DATE(e.air_date) <= ?'),
        expect.arrayContaining([profileId, expect.any(String), 'WATCHED', showId]),
      );

      // Verify season update query
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO season_watch_status'),
        expect.arrayContaining([profileId, 'WATCHED', showId]),
      );

      // Verify show update query
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO show_watch_status'),
        expect.arrayContaining([profileId, showId, 'WATCHED']),
      );
    });

    it('should handle show not found', async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED)).rejects.toThrow(
        `Show ${showId} not found`,
      );
    });

    it('should handle marking show as NOT_WATCHED', async () => {
      const showRow = createMockShowRow({
        id: showId,
        status: 'WATCHED',
        release_date: '2023-01-01',
        in_production: 0,
      });

      const episodeUpdateResult = {
        affectedRows: 20,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.NOT_WATCHED);

      expect(result.success).toBe(true);
      expect(result.changes[0].from).toBe(WatchStatus.WATCHED);
      expect(result.changes[0].to).toBe(WatchStatus.NOT_WATCHED);

      // Verify that episodes are marked as NOT_WATCHED
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('NOT_WATCHED'),
        expect.arrayContaining([profileId, 'NOT_WATCHED', showId]),
      );
    });

    it('should not update show status if it remains the same', async () => {
      const showRow = createMockShowRow({
        id: showId,
        status: 'WATCHED',
        release_date: '2023-01-01',
        in_production: 0,
      });

      const updateResult = {
        affectedRows: 5,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(10); // episodes + seasons, no show update
      expect(result.changes).toHaveLength(0); // No status changes recorded
    });

    it('should handle database errors during show update', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED)).rejects.toThrow(
        'Handled database error',
      );

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'updating show watch status with propagation');
    });
  });

  describe('checkAndUpdateShowWatchStatus', () => {
    const profileId = 123;
    const showId = 456;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should successfully recalculate and update show status based on current episodes and seasons', async () => {
      // Mock show query result
      const showRow = createMockShowRow({
        id: showId,
        status: 'NOT_WATCHED',
        release_date: '2023-01-01',
        in_production: 1,
      });

      // Mock season data
      const seasonRows = [
        createMockSeasonRow({ id: 101, show_id: showId, status: 'WATCHING' }),
        createMockSeasonRow({ id: 102, show_id: showId, status: 'NOT_WATCHED' }),
      ];

      // Mock episode data for each season
      const season1Episodes = [
        createMockEpisodeRow({ id: 201, season_id: 101, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 202, season_id: 101, status: 'NOT_WATCHED' }),
      ];

      const season2Episodes = [
        createMockEpisodeRow({ id: 203, season_id: 102, status: 'NOT_WATCHED' }),
        createMockEpisodeRow({ id: 204, season_id: 102, status: 'NOT_WATCHED' }),
      ];

      const updateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls
      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []]) // Show query
        .mockResolvedValueOnce([seasonRows, []]) // Season status query
        .mockResolvedValueOnce([season1Episodes, []]) // Season 1 episodes
        .mockResolvedValueOnce([updateResult, []]) // Season 1 update
        .mockResolvedValueOnce([season2Episodes, []]) // Season 2 episodes
        .mockResolvedValueOnce([updateResult, []]); // Show update

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus
        .mockReturnValueOnce(WatchStatus.WATCHING) // Season 1 status
        .mockReturnValueOnce(WatchStatus.NOT_WATCHED); // Season 2 status

      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(2); // 1 season + 1 show update
      expect(result.changes).toHaveLength(2);

      // Verify season change
      expect(result.changes[0]).toEqual({
        entityType: 'season',
        entityId: 101,
        from: WatchStatus.WATCHING,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: 'Content updates detected',
      });

      // Verify show change
      expect(result.changes[1]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: 'Content updates detected',
      });
    });

    it('should return success with no changes when show status is already correct', async () => {
      const showRow = createMockShowRow({
        id: showId,
        status: 'WATCHING',
        release_date: '2023-01-01',
        in_production: 1,
      });

      const seasonRows = [createMockSeasonRow({ id: 101, show_id: showId, status: 'WATCHING' })];

      const episodeRows = [
        createMockEpisodeRow({ id: 201, season_id: 101, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 202, season_id: 101, status: 'NOT_WATCHED' }),
      ];

      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []])
        .mockResolvedValueOnce([seasonRows, []])
        .mockResolvedValueOnce([episodeRows, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHING);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should handle show not found', async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId)).rejects.toThrow(
        NotFoundError,
      );

      expect(NotFoundError).toHaveBeenCalledWith(`Show ${showId} not found`);
    });

    it('should handle database errors during status check', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId)).rejects.toThrow(
        'Handled database error',
      );

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'checking and updating show watch status');
    });
  });
});
