import { setupDatabaseTest } from '../helpers/dbTestSetup';
import {
  createMockEpisodeExtendedRow,
  createMockEpisodeRow,
  createMockSeasonRow,
} from './helpers/watchStatusTestTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

// Mock dependencies specific to this test
jest.mock('@utils/watchStatusManager');
jest.mock('@utils/errorHandlingUtility');

describe('WatchStatusDbService - Episode Operations', () => {
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

  describe('updateEpisodeWatchStatus', () => {
    const profileId = 123;
    const episodeId = 456;
    const seasonId = 789;
    const showId = 101112;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should successfully update episode status and propagate to season and show', async () => {
      // Mock episode query result
      const episodeRow = createMockEpisodeExtendedRow({
        id: episodeId,
        season_id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        season_status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        air_date: '2023-01-15',
        season_air_date: '2023-01-01',
        show_air_date: '2023-01-01',
        show_in_production: 1,
      });

      const seasonEpisodesRows = [
        createMockEpisodeRow({ id: episodeId, season_id: seasonId, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: episodeId + 1, season_id: seasonId, status: WatchStatus.NOT_WATCHED }),
      ];

      const seasonRow = createMockSeasonRow({
        id: seasonId,
        show_id: showId,
        status: WatchStatus.NOT_WATCHED,
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

      const noUpdateResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      // Mock database calls
      mockConnection.execute
        .mockResolvedValueOnce([[episodeRow], []]) // Episode query
        .mockResolvedValueOnce([updateResult, []]) // Episode update
        .mockResolvedValueOnce([noUpdateResult, []]) // Episodes in season update
        .mockResolvedValueOnce([seasonEpisodesRows, []]) // Season episodes query
        .mockResolvedValueOnce([updateResult, []]) // Season update
        .mockResolvedValueOnce([[seasonRow], []]) // Show seasons query
        .mockResolvedValueOnce([updateResult, []]); // Show update

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHING);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(3); // episode + season + show
      expect(result.changes).toHaveLength(3);

      // Verify episode change
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: episodeId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Episode manually set to WATCHED',
      });

      // Verify season change
      expect(result.changes[1]).toEqual({
        entityType: 'season',
        entityId: seasonId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: `Episode ${episodeId} status changed`,
      });

      // Verify show change
      expect(result.changes[2]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} status changed`,
      });
    });

    it('should handle episode not found', async () => {
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      await expect(
        watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.WATCHED),
      ).rejects.toThrow(`Episode ${episodeId} not found`);
    });

    it('should handle unaired episodes correctly', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const episodeRow = createMockEpisodeExtendedRow({
        id: episodeId,
        season_id: seasonId,
        show_id: showId,
        status: 'NOT_WATCHED',
        season_status: 'NOT_WATCHED',
        show_status: 'NOT_WATCHED',
        air_date: '2025-05-01',
        season_air_date: '2025-05-01',
        show_air_date: '2025-05-01',
        show_in_production: 1,
      });

      // Mock season episodes (mix of aired and unaired)
      const seasonEpisodesRows = [
        createMockEpisodeRow({
          id: episodeId,
          season_id: seasonId,
          status: 'WATCHED',
          air_date: '2025-05-01',
        }),
        createMockEpisodeRow({
          id: episodeId + 1,
          season_id: seasonId,
          status: 'NOT_WATCHED',
          air_date: '2025-05-15',
        }),
        createMockEpisodeRow({
          id: episodeId + 2,
          season_id: seasonId,
          status: 'UNAIRED',
          air_date: '2025-06-01',
        }),
      ];

      // Mock show seasons
      const showSeasons = [createMockSeasonRow({ id: seasonId, show_id: showId, status: 'WATCHING' })];

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
        .mockResolvedValueOnce([[episodeRow], []]) // Episode query
        .mockResolvedValueOnce([updateResult, []]) // Episode update
        .mockResolvedValueOnce([updateResult, []]) // Episodes in season update
        .mockResolvedValueOnce([seasonEpisodesRows, []]) // Season episodes query
        .mockResolvedValueOnce([updateResult, []]) // Season update
        .mockResolvedValueOnce([showSeasons, []]) // Show seasons query
        .mockResolvedValueOnce([updateResult, []]); // Show update

      // Mock status manager calculations
      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHING);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.WATCHED);

      // Verify the complete workflow executed
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(4); // episode + season + show
      expect(result.changes).toHaveLength(3);

      // Verify episode change (NOT_WATCHED -> UNAIRED)
      expect(result.changes[0]).toEqual({
        entityType: 'episode',
        entityId: episodeId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: expect.any(Date),
        reason: 'Episode manually set to WATCHED',
      });

      // Verify season status was recalculated
      expect(mockWatchStatusManager.calculateSeasonStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: seasonId,
          episodes: expect.arrayContaining([
            expect.objectContaining({ id: episodeId, watchStatus: 'WATCHED' }),
            expect.objectContaining({ id: episodeId + 1, watchStatus: 'NOT_WATCHED' }),
            expect.objectContaining({ id: episodeId + 2, watchStatus: 'UNAIRED' }),
          ]),
        }),
      );

      // Verify show status was recalculated
      expect(mockWatchStatusManager.calculateShowStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: showId,
          seasons: expect.arrayContaining([expect.objectContaining({ id: seasonId, watchStatus: 'WATCHING' })]),
        }),
      );

      // Verify season and show changes if status manager indicated changes
      expect(result.changes[1]).toEqual({
        entityType: 'season',
        entityId: seasonId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: `Episode ${episodeId} status changed`,
      });

      expect(result.changes[2]).toEqual({
        entityType: 'show',
        entityId: showId,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHING,
        timestamp: expect.any(Date),
        reason: `Season ${seasonId} status changed`,
      });
    });

    it('should not update season or show if statuses remain unchanged', async () => {
      const episodeRow = createMockEpisodeExtendedRow({
        id: episodeId,
        season_id: seasonId,
        show_id: showId,
        status: WatchStatus.NOT_WATCHED,
        season_status: WatchStatus.WATCHING,
        show_status: WatchStatus.WATCHING,
      });

      const seasonEpisodesRows = [
        createMockEpisodeRow({ id: episodeId, status: WatchStatus.WATCHED }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.NOT_WATCHED }),
      ];

      const seasonRow = createMockSeasonRow({
        id: seasonId,
        show_id: showId,
        status: WatchStatus.WATCHING,
      });

      const noUpdateResult = {
        affectedRows: 0,
        insertId: 0,
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
        .mockResolvedValueOnce([[episodeRow], []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([noUpdateResult, []])
        .mockResolvedValueOnce([seasonEpisodesRows, []])
        .mockResolvedValueOnce([[seasonRow], []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHING);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.WATCHED);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1); // Only episode updated
      expect(result.changes).toHaveLength(1); // Only episode change recorded
    });

    it('should handle database errors during episode update', async () => {
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(
        watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.WATCHED),
      ).rejects.toThrow('Database error updating episode watch status with propagation: Database connection failed');

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'updating episode watch status with propagation');
    });

    it('should handle marking episode as NOT_WATCHED', async () => {
      const episodeRow = createMockEpisodeExtendedRow({
        id: episodeId,
        season_id: seasonId,
        show_id: showId,
        status: WatchStatus.WATCHED,
        season_status: WatchStatus.WATCHED,
        show_status: WatchStatus.WATCHED,
      });

      const seasonEpisodesRows = [
        createMockEpisodeRow({ id: episodeId, status: WatchStatus.NOT_WATCHED }),
        createMockEpisodeRow({ id: episodeId + 1, status: WatchStatus.WATCHED }),
      ];

      const seasonRow = createMockSeasonRow({
        id: seasonId,
        show_id: showId,
        status: WatchStatus.WATCHED,
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

      mockConnection.execute
        .mockResolvedValueOnce([[episodeRow], []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([seasonEpisodesRows, []])
        .mockResolvedValueOnce([updateResult, []])
        .mockResolvedValueOnce([[seasonRow], []])
        .mockResolvedValueOnce([updateResult, []]);

      mockWatchStatusManager.calculateSeasonStatus.mockReturnValue(WatchStatus.WATCHING);
      mockWatchStatusManager.calculateShowStatus.mockReturnValue(WatchStatus.WATCHING);

      const result = await watchStatusDbService.updateEpisodeWatchStatus(profileId, episodeId, WatchStatus.NOT_WATCHED);

      expect(result.success).toBe(true);
      expect(result.changes[0].from).toBe(WatchStatus.WATCHED);
      expect(result.changes[0].to).toBe(WatchStatus.NOT_WATCHED);
    });
  });
});
