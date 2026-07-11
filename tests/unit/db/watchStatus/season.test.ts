import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { createMockEpisodeRow, createMockSeasonExtendedRow, createMockSeasonRow } from './helpers/watchStatusTestTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import {
  getEpisodeIdsWithExistingHistory,
  logEpisodesWatched,
  logSeasonWatched,
  logShowWatched,
} from '@db/watchHistoryDb';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

// Mock dependencies specific to this test
jest.mock('@utils/watchStatusManager');
jest.mock('@utils/errorHandlingUtility');
jest.mock('@db/watchHistoryDb');

describe('WatchStatusDbService - Season Operations', () => {
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

    // Default: no episode has existing history unless a test overrides this
    jest.mocked(getEpisodeIdsWithExistingHistory).mockResolvedValue(new Set());

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

    // -------------------------------------------------------------------------
    // First-watch history gating for bulk season mark/unmark
    // -------------------------------------------------------------------------

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

    it('should log history only for newly-watched episodes with no prior history, skipping ones that already have history', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        release_date: '2023-01-01',
      });
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.NOT_WATCHED }),
      ];
      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.WATCHED }),
      ];
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      // Episode 1 already has a surviving history row; episode 2 does not.
      jest.mocked(getEpisodeIdsWithExistingHistory).mockResolvedValueOnce(new Set([1]));
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(getEpisodeIdsWithExistingHistory).toHaveBeenCalledWith(mockConnection, profileId, [1, 2]);
      expect(logEpisodesWatched).toHaveBeenCalledTimes(1);
      expect(logEpisodesWatched).toHaveBeenCalledWith(mockConnection, profileId, [2]);
    });

    it('should skip logging entirely when all newly-watched episodes already have history', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        release_date: '2023-01-01',
      });
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.NOT_WATCHED }),
      ];
      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.WATCHED }),
      ];
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      jest.mocked(getEpisodeIdsWithExistingHistory).mockResolvedValueOnce(new Set([1, 2]));
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(logEpisodesWatched).not.toHaveBeenCalled();
    });

    it('should not call getEpisodeIdsWithExistingHistory when no episodes transition to WATCHED', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'WATCHED',
        show_status: 'WATCHED',
        release_date: '2023-01-01',
      });
      // Already WATCHED before and after — no transition to WATCHED occurs.
      const originalEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
      const updatedEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []]) // Season status update (always executed)
        .mockResolvedValueOnce([showSeasons, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

      await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

      expect(getEpisodeIdsWithExistingHistory).not.toHaveBeenCalled();
      expect(logEpisodesWatched).not.toHaveBeenCalled();
    });

    it('should never touch history when unmarking a season (plain status update, no delete, no classification)', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'WATCHED',
        show_status: 'WATCHED',
        release_date: '2023-01-01',
      });
      const originalEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.WATCHED }),
      ];
      const updatedEpisodeRows = [
        createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: 2, status: WatchStatus.NOT_WATCHED }),
      ];
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.NOT_WATCHED })];

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([originalEpisodeRows, []])
        .mockResolvedValueOnce([episodeUpdateResult, []])
        .mockResolvedValueOnce([updatedEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.NOT_WATCHED);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.NOT_WATCHED);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.NOT_WATCHED);

      expect(result.success).toBe(true);
      expect(getEpisodeIdsWithExistingHistory).not.toHaveBeenCalled();
      expect(logEpisodesWatched).not.toHaveBeenCalled();
      expect(logSeasonWatched).not.toHaveBeenCalled();
      expect(logShowWatched).not.toHaveBeenCalled();
    });

    it('should never touch history when marking a season as SKIPPED', async () => {
      const seasonRow = createMockSeasonExtendedRow({
        id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        release_date: '2023-01-01',
      });
      const currentEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.NOT_WATCHED })];

      mockConnection.execute
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([currentEpisodeRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([showSeasons, []]);

      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.NOT_WATCHED);

      const result = await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.SKIPPED);

      expect(result.success).toBe(true);
      expect(result.changes).toContainEqual(
        expect.objectContaining({ entityType: 'season', entityId: seasonId, to: WatchStatus.SKIPPED }),
      );
      expect(getEpisodeIdsWithExistingHistory).not.toHaveBeenCalled();
      expect(logEpisodesWatched).not.toHaveBeenCalled();
      expect(logSeasonWatched).not.toHaveBeenCalled();
      expect(logShowWatched).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Season/show completion history logging (manual "set season status" endpoint)
    // -------------------------------------------------------------------------

    describe('completion history logging', () => {
      it('should log season completion when it transitions to UP_TO_DATE (not just WATCHED)', async () => {
        const seasonRow = createMockSeasonExtendedRow({
          id: seasonId,
          show_id: showId,
          status: 'WATCHING',
          show_status: 'WATCHING',
          release_date: '2023-01-01',
        });
        const originalEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED })];
        const updatedEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
        const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.UP_TO_DATE })];

        mockConnection.execute
          .mockResolvedValueOnce([[seasonRow], []])
          .mockResolvedValueOnce([originalEpisodeRows, []])
          .mockResolvedValueOnce([episodeUpdateResult, []])
          .mockResolvedValueOnce([updatedEpisodeRows, []])
          .mockResolvedValueOnce([updateResult, []]) // season update
          .mockResolvedValueOnce([showSeasons, []]);

        mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.UP_TO_DATE);
        mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

        await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

        expect(logSeasonWatched).toHaveBeenCalledTimes(1);
        expect(logSeasonWatched).toHaveBeenCalledWith(mockConnection, profileId, seasonId);
      });

      it('should not log season completion again on a WATCHED <-> UP_TO_DATE flip (source already complete)', async () => {
        const seasonRow = createMockSeasonExtendedRow({
          id: seasonId,
          show_id: showId,
          status: 'UP_TO_DATE',
          show_status: 'UP_TO_DATE',
          release_date: '2023-01-01',
        });
        const originalEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED })];
        const updatedEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
        const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

        mockConnection.execute
          .mockResolvedValueOnce([[seasonRow], []])
          .mockResolvedValueOnce([originalEpisodeRows, []])
          .mockResolvedValueOnce([episodeUpdateResult, []])
          .mockResolvedValueOnce([updatedEpisodeRows, []])
          .mockResolvedValueOnce([updateResult, []])
          .mockResolvedValueOnce([showSeasons, []]);

        mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
        mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.UP_TO_DATE);

        await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

        expect(logSeasonWatched).not.toHaveBeenCalled();
      });

      it('should log show completion when a season completion cascades to complete the show', async () => {
        const seasonRow = createMockSeasonExtendedRow({
          id: seasonId,
          show_id: showId,
          status: 'WATCHING',
          show_status: 'WATCHING',
          release_date: '2023-01-01',
        });
        const originalEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED })];
        const updatedEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
        const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

        mockConnection.execute
          .mockResolvedValueOnce([[seasonRow], []])
          .mockResolvedValueOnce([originalEpisodeRows, []])
          .mockResolvedValueOnce([episodeUpdateResult, []])
          .mockResolvedValueOnce([updatedEpisodeRows, []])
          .mockResolvedValueOnce([updateResult, []]) // season update
          .mockResolvedValueOnce([showSeasons, []])
          .mockResolvedValueOnce([updateResult, []]); // show update

        mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
        mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

        await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

        expect(logShowWatched).toHaveBeenCalledTimes(1);
        expect(logShowWatched).toHaveBeenCalledWith(mockConnection, profileId, showId);
      });

      it('should not log show completion again on a WATCHED <-> UP_TO_DATE flip cascaded from a season change', async () => {
        const seasonRow = createMockSeasonExtendedRow({
          id: seasonId,
          show_id: showId,
          status: 'NOT_WATCHED',
          show_status: 'UP_TO_DATE',
          release_date: '2023-01-01',
        });
        const originalEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.NOT_WATCHED })];
        const updatedEpisodeRows = [createMockEpisodeRow({ id: 1, status: WatchStatus.WATCHED })];
        const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: WatchStatus.WATCHED })];

        mockConnection.execute
          .mockResolvedValueOnce([[seasonRow], []])
          .mockResolvedValueOnce([originalEpisodeRows, []])
          .mockResolvedValueOnce([episodeUpdateResult, []])
          .mockResolvedValueOnce([updatedEpisodeRows, []])
          .mockResolvedValueOnce([updateResult, []]) // season update
          .mockResolvedValueOnce([showSeasons, []])
          .mockResolvedValueOnce([updateResult, []]); // show update

        mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHED);
        // Show flips UP_TO_DATE -> WATCHED (both already "complete")
        mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHED);

        await watchStatusDbService.updateSeasonWatchStatus(profileId, seasonId, WatchStatus.WATCHED);

        expect(logShowWatched).not.toHaveBeenCalled();
      });
    });
  });
});
