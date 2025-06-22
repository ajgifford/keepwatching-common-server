import { createMockEpisodeRow, createMockSeasonExtendedRow, createMockSeasonRow } from './helpers/watchStatusTestTypes';
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

describe('WatchStatusDbService - Season Operations', () => {
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

  describe('updateSeasonWatchStatus', () => {
    const profileId = 123;
    const seasonId = 456;
    const showId = 789;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should successfully update season status and propagate to episodes and show', async () => {
      const targetStatus = WatchStatus.WATCHED;

      // Mock season query result
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        release_date: '2023-01-01',
        show_air_date: '2023-01-01',
        show_in_production: 1,
      });

      const episodeId = 1;
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: episodeId }),
        createMockEpisodeRow({ id: episodeId + 1 }),
      ];

      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: targetStatus }),
        createMockEpisodeRow({ id: episodeId + 1, status: targetStatus }),
      ];

      // Mock show seasons for show status calculation
      const showSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED }),
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
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls
      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []]) // Season query
        .mockResolvedValueOnce([originalEpisodeRows, []]) // Season episodes original query
        .mockResolvedValueOnce([episodeUpdateResult, []]) // Episode bulk update
        .mockResolvedValueOnce([updatedEpisodeRows, []]) // Season episodes updated query
        .mockResolvedValueOnce([updateResult, []]) // Season update
        .mockResolvedValueOnce([showSeasons, []]) // Show seasons query
        .mockResolvedValueOnce([updateResult, []]); // Show update

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, targetStatus);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(4); // 2 episodes + 1 season + 1 show
      expect(result.changes).toHaveLength(4); // 2 episodes + season + show changes

      // Verify episode changes
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: episodeId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} marked as ${targetStatus}`,
      });
      expect(result.changes[1]).toEqual({
        entityType: 'episode',
        entityId: episodeId + 1,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} marked as ${targetStatus}`,
      });

      // Verify season change
      expect(result.changes[2]).toEqual({
        entityType: 'season',
        entityId: seasonId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Season manually set to WATCHED',
      });

      // Verify show change
      expect(result.changes[3]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} status changed`,
      });
    });

    it('should handle season not found', async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(
        watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED),
      ).rejects.toThrow(`Season ${seasonId} not found`);
    });

    it('should handle unaired episodes when marking season as watched', async () => {
      const targetStatus = WatchStatus.WATCHED;
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        release_date: '2023-01-01',
      });

      const episodeId = 1;
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.UNAIRED }),
      ];

      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: targetStatus }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.UNAIRED }),
      ];

      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.UP_TO_DATE })];

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
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.UP_TO_DATE);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.UP_TO_DATE);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, targetStatus);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(4); // 2 episodes + 1 season + 1 show
      expect(result.changes).toHaveLength(3); // 1 episode + season + show changes

      // Verify that the episode update query includes logic for unaired episodes
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHEN e.air_date IS NULL OR DATE(e.air_date) <= ? THEN ?'),
        expect.arrayContaining([expect.any(Date), profileId, targetStatus, seasonId]),
      );

      // Verify episode changes
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: episodeId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} marked as ${targetStatus}`,
      });

      // Verify season change
      expect(result.changes[1]).toEqual({
        entityType: 'season',
        entityId: seasonId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.UP_TO_DATE,
        timestamp: expect.any(Date),
        reason: 'Season manually set to WATCHED',
      });

      // Verify show change
      expect(result.changes[2]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.UP_TO_DATE,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} status changed`,
      });
    });

    it('should handle marking season as NOT_WATCHED', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'WATCHED',
        show_status: 'WATCHED',
        release_date: '2023-01-01',
      });

      const showSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: 'NOT_WATCHED' }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: 'WATCHED' }),
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
        affectedRows: 3,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.NOT_WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.NOT_WATCHED);

      expect(result.success).toBe(true);
      expect(result.changes[0].from).toBe(WatchStatus.WATCHED);
      expect(result.changes[0].to).toBe(WatchStatus.NOT_WATCHED);
    });

    it('should not update show if show status remains unchanged', async () => {
      const targetStatus = WatchStatus.WATCHED;
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'WATCHING',
        release_date: '2023-01-01',
      });

      const episodeId = 1;
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: episodeId }),
        createMockEpisodeRow({ id: episodeId + 1 }),
      ];

      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: episodeId, status: targetStatus }),
        createMockEpisodeRow({ id: episodeId + 1, status: targetStatus }),
      ];

      const showSeasons = [
        createMockSeasonRow({ id: seasonId, show_id: showId, status: 'WATCHED' }),
        createMockSeasonRow({ id: seasonId + 1, show_id: showId, status: 'NOT_WATCHED' }),
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
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, targetStatus);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(3); // 2 episodes + season, no show update
      expect(result.changes).toHaveLength(3); // No show change

      // Verify episode changes
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: episodeId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} marked as ${targetStatus}`,
      });

      expect(result.changes[1]).toEqual({
        entityType: 'episode',
        entityId: episodeId + 1,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} marked as ${targetStatus}`,
      });

      // Verify season change
      expect(result.changes[2]).toEqual({
        entityType: 'season',
        entityId: seasonId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Season manually set to WATCHED',
      });
    });

    it('should handle database errors during season update', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(
        watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED),
      ).rejects.toThrow('Database error updating season watch status with propagation: Database connection failed');

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'updating season watch status with propagation');
    });
  });
});
