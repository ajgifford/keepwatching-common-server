import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { createMockEpisodeRow, createMockSeasonRow, createMockShowRow } from './helpers/watchStatusTestTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

// Mock dependencies specific to this test
jest.mock('@utils/watchStatusManager');
jest.mock('@utils/errorHandlingUtility');

describe('WatchStatusDbService - Show Operations', () => {
  let watchStatusDbService: WatchStatusDbService;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;
  let mockWatchStatusManager: jest.Mocked<WatchStatusManager>;
  let mockConnection: jest.Mocked<PoolConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockTransactionHelper = mocks.mockTransactionHelper;

    // Extend the mock connection with additional methods needed for these tests
    mockConnection = {
      ...mocks.mockConnection,
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<PoolConnection>;

    // Mock WatchStatusManager (test-specific)
    mockWatchStatusManager = {
      calculateEpisodeStatus: jest.fn(),
      calculateSeasonStatus: jest.fn(),
      calculateShowStatus: jest.fn(),
      onStatusChange: jest.fn(),
      generateStatusSummary: jest.fn(),
    } as unknown as jest.Mocked<WatchStatusManager>;

    // Setup handleDatabaseError mock (test-specific)
    jest.mocked(handleDatabaseError).mockImplementation((error, contextMessage) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error ${contextMessage}: ${errorMessage}`);
    });

    // Create service instance with mocked dependencies
    watchStatusDbService = new WatchStatusDbService(mockWatchStatusManager, mockTransactionHelper);
  });

  describe('updateShowWatchStatus', () => {
    const profileId = 123;
    const showId = 456;
    const seasonId = 789;

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

      const originalShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.NOT_WATCHED }),
        createMockSeasonRow({ id: seasonId + 2, show_id: showId, status: WatchStatus.NOT_WATCHED }),
      ];

      const episodeId = 1;
      const season1EpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: WatchStatus.WATCHED, seasonId: seasonId }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.WATCHED, seasonId: seasonId }),
      ];

      const season2EpisodeRows = [
        createMockEpisodeRow({ id: episodeId + 2, seasonId: seasonId + 1, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: episodeId + 3, seasonId: seasonId + 1, status: WatchStatus.NOT_WATCHED }),
      ];

      const season3EpisodeRows = [
        createMockEpisodeRow({ id: episodeId + 4, seasonId: seasonId + 2, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: episodeId + 5, seasonId: seasonId + 2, status: WatchStatus.NOT_WATCHED }),
      ];

      const updatedShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.NOT_WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.NOT_WATCHED }),
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

      const episodeUpdateResult = {
        affectedRows: 6,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      const seasonUpdateResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls in order: show query, episode bulk update, season bulk update, show update
      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([originalShowSeasons, []])
        .mockResolvedValueOnce([season1EpisodeRows, []])
        .mockResolvedValueOnce([season2EpisodeRows, []])
        .mockResolvedValueOnce([seasonUpdateResult, []])
        .mockResolvedValueOnce([season3EpisodeRows, []])
        .mockResolvedValueOnce([seasonUpdateResult, []])
        .mockResolvedValueOnce([updatedShowSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValueOnce(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValueOnce(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValueOnce(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(9); // 6 episodes + 2 seasons (1 not changed) + 1 show
      expect(result.changes).toHaveLength(3); // Show and season changes

      // Verify season change
      expect(result.changes[0]).toEqual({
        entityType: 'season',
        entityId: seasonId + 1,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Show manually set to WATCHED',
      });

      expect(result.changes[1]).toEqual({
        entityType: 'season',
        entityId: seasonId + 2,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Show manually set to WATCHED',
      });

      // verify show changes
      expect(result.changes[2]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Show manually set to WATCHED',
      });

      // Verify season bulk update
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO season_watch_status (profile_id, season_id, status'),
        expect.arrayContaining([profileId, seasonId + 1, 'WATCHED']),
      );

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO season_watch_status (profile_id, season_id, status'),
        expect.arrayContaining([profileId, seasonId + 2, 'WATCHED']),
      );

      // Verify show status update
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO show_watch_status'),
        expect.arrayContaining([profileId, showId, 'WATCHED']),
      );
    });

    it('should handle NOT_WATCHED status correctly and leave unaired episodes unchanged', async () => {
      const showRow = createMockShowRow({
        id: showId,
        status: WatchStatus.WATCHED,
        release_date: '2023-01-01',
        in_production: 0,
      });

      const originalShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.UP_TO_DATE }),
      ];

      const episodeId = 1;
      const season1EpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: WatchStatus.WATCHED, seasonId: seasonId }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.WATCHED, seasonId: seasonId }),
      ];

      const season2EpisodeRows = [
        createMockEpisodeRow({ id: episodeId + 2, seasonId: seasonId + 1, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: episodeId + 3, seasonId: seasonId + 1, status: WatchStatus.UNAIRED }),
      ];

      const updatedShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.NOT_WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.NOT_WATCHED }),
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

      const episodeUpdateResult = {
        affectedRows: 4,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      const seasonUpdateResult = {
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
        .mockResolvedValueOnce([originalShowSeasons, []])
        .mockResolvedValueOnce([season1EpisodeRows, []])
        .mockResolvedValueOnce([seasonUpdateResult, []])
        .mockResolvedValueOnce([season2EpisodeRows, []])
        .mockResolvedValueOnce([seasonUpdateResult, []])
        .mockResolvedValueOnce([updatedShowSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.NOT_WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.NOT_WATCHED);

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.NOT_WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(7); // 4 episodes + 2 seasons + 1 show
      expect(result.changes).toHaveLength(3); // 2 seasons + 1 show

      // Verify NOT_WATCHED propagation leaves unaired episodes as unaired
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHEN e.air_date IS NULL OR DATE(e.air_date) <= ?'),
        expect.arrayContaining([profileId, expect.any(String), 'NOT_WATCHED', 'NOT_WATCHED', showId]),
      );
    });

    it('should not update show status if it remains the same', async () => {
      const showRow = createMockShowRow({
        id: showId,
        status: 'UP_TO_DATE',
        release_date: '2023-01-01',
        in_production: 0,
      });

      const originalShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.UP_TO_DATE }),
      ];

      const episodeId = 1;
      const season1EpisodeRows = [
        createMockEpisodeRow({ id: episodeId, seasonId: seasonId, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: episodeId + 1, seasonId: seasonId, status: WatchStatus.WATCHED }),
      ];

      const season2EpisodeRows = [
        createMockEpisodeRow({ id: episodeId + 2, seasonId: seasonId + 1, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: episodeId + 3, seasonId: seasonId + 1, status: WatchStatus.UNAIRED }),
      ];

      const updatedShowSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: WatchStatus.UP_TO_DATE }),
      ];

      const episodeUpdateResult = {
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
        .mockResolvedValueOnce([originalShowSeasons, []])
        .mockResolvedValueOnce([season1EpisodeRows, []])
        .mockResolvedValueOnce([season2EpisodeRows, []])
        .mockResolvedValueOnce([updatedShowSeasons, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValueOnce(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValueOnce(WatchStatus.UP_TO_DATE);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.UP_TO_DATE);

      const result = await watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1); // 1 episode,  no seasons or show update
      expect(result.changes).toHaveLength(0); // No status changes recorded since show status didn't change

      // Verify no show status update query was made (only 6 queries total)
      expect(mockConnection.execute).toHaveBeenCalledTimes(6);
    });

    it('should handle show not found error', async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED)).rejects.toThrow(
        `Show ${showId} not found`,
      );
    });

    it('should handle database errors during show update', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(watchStatusDbService.updateShowWatchStatus(profileId, showId, WatchStatus.WATCHED)).rejects.toThrow(
        'Database error updating show watch status with propagation: Database connection failed',
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

    it('should recalculate and update show and season status when unaired content airs', async () => {
      // Mock show query result
      const showRow = createMockShowRow({
        id: showId,
        status: 'UP_TO_DATE',
        release_date: '2023-01-01',
        in_production: 1,
      });

      // Mock season data with different statuses
      const seasonRows = [
        createMockSeasonRow({ id: 101, show_id: showId, status: 'WATCHED' }),
        createMockSeasonRow({ id: 102, show_id: showId, status: 'UP_TO_DATE' }),
      ];

      // Mock episode data for season 1
      const season1Episodes = [
        createMockEpisodeRow({ id: 201, season_id: 101, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 202, season_id: 101, status: 'WATCHED' }),
      ];

      // Mock episode data for season 2
      const season2Episodes = [
        createMockEpisodeRow({ id: 203, season_id: 102, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 204, season_id: 102, status: 'NOT_WATCHED' }),
      ];

      const bulkEpisodeUpdateResult = {
        affectedRows: 1,
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

      // Mock database calls: show query, seasons query, episodes for each season, updates
      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []]) // Show query
        .mockResolvedValueOnce([bulkEpisodeUpdateResult, []]) // Bulk episode UNAIRED update
        .mockResolvedValueOnce([seasonRows, []]) // Season status query
        .mockResolvedValueOnce([season1Episodes, []]) // Season 1 episodes
        .mockResolvedValueOnce([season2Episodes, []]) // Season 2 episodes
        .mockResolvedValueOnce([updateResult, []]) // Season 2 update
        .mockResolvedValueOnce([updateResult, []]); // Show update

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus
        .mockReturnValueOnce(WatchStatus.WATCHED) // Season 1 status
        .mockReturnValueOnce(WatchStatus.WATCHING); // Season 2 status

      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(3); // 1 UNAIRED episodes to NOT_WATCHED, 1 season update, 1 show update
      expect(result.changes).toHaveLength(2);

      // Verify season status change
      expect(result.changes[0]).toEqual({
        entityType: 'season',
        entityId: 102,
        from: WatchStatus.UP_TO_DATE,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: 'Content updates detected',
      });

      // Verify show status change
      expect(result.changes[1]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.UP_TO_DATE,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: 'Content updates detected',
      });

      // Verify status manager was called correctly
      expect(mockWatchStatusManager.calculateSeasonStatus).toHaveBeenCalledTimes(2);
      expect(mockWatchStatusManager.calculateShowStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: showId,
          inProduction: true,
          seasons: expect.arrayContaining([
            expect.objectContaining({ id: 101, watchStatus: 'WATCHED' }),
            expect.objectContaining({ id: 102, watchStatus: 'UP_TO_DATE' }),
          ]),
        }),
      );
    });

    it('should evaluate show and season status when new content is added', async () => {
      // Mock show query result
      const showRow = createMockShowRow({
        id: showId,
        status: 'UP_TO_DATE',
        release_date: '2023-01-01',
        in_production: 1,
      });

      // Mock season data with different statuses
      const seasonRows = [
        createMockSeasonRow({ id: 101, show_id: showId, status: 'WATCHED' }),
        createMockSeasonRow({ id: 102, show_id: showId, status: 'UP_TO_DATE' }),
      ];

      // Mock episode data for season 1
      const season1Episodes = [
        createMockEpisodeRow({ id: 201, season_id: 101, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 202, season_id: 101, status: 'WATCHED' }),
      ];

      // Mock episode data for season 2
      const season2Episodes = [
        createMockEpisodeRow({ id: 203, season_id: 102, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 204, season_id: 102, status: 'WATCHED' }),
        createMockEpisodeRow({ id: 205, season_id: 102, status: 'UNAIRED' }),
      ];

      const bulkEpisodeUpdateResult = {
        affectedRows: 0,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls: show query, seasons query, episodes for each season, updates
      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []]) // Show query
        .mockResolvedValueOnce([bulkEpisodeUpdateResult, []]) // Bulk episode update
        .mockResolvedValueOnce([seasonRows, []]) // Season status query
        .mockResolvedValueOnce([season1Episodes, []]) // Season 1 episodes
        .mockResolvedValueOnce([season2Episodes, []]); // Season 2 episodes

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus
        .mockReturnValueOnce(WatchStatus.WATCHED) // Season 1 status
        .mockReturnValueOnce(WatchStatus.UP_TO_DATE); // Season 2 status

      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.UP_TO_DATE);

      const result = await watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0); // no changes
      expect(result.changes).toHaveLength(0);

      // Verify status manager was called correctly
      expect(mockWatchStatusManager.calculateSeasonStatus).toHaveBeenCalledTimes(2);
      expect(mockWatchStatusManager.calculateShowStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: showId,
          inProduction: true,
          seasons: expect.arrayContaining([
            expect.objectContaining({ id: 101, watchStatus: 'WATCHED' }),
            expect.objectContaining({ id: 102, watchStatus: 'UP_TO_DATE' }),
          ]),
        }),
      );
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

      const bulkEpisodeUpdateResult = {
        affectedRows: 0,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[showRow], []])
        .mockResolvedValueOnce([bulkEpisodeUpdateResult, []])
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
        `Show ${showId} not found`,
      );
    });

    it('should handle database errors during status check', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(watchStatusDbService.checkAndUpdateShowWatchStatus(profileId, showId)).rejects.toThrow(
        'Database error checking and updating show watch status: Database connection failed',
      );

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'checking and updating show watch status');
    });
  });
});
