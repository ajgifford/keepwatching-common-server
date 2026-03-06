import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { BulkMarkedShowRow, WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

jest.mock('@utils/watchStatusManager');
jest.mock('@utils/errorHandlingUtility');

describe('WatchStatusDbService - Prior Watch Operations', () => {
  let watchStatusDbService: WatchStatusDbService;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;
  let mockWatchStatusManager: jest.Mocked<WatchStatusManager>;
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockTransactionHelper = mocks.mockTransactionHelper;
    mockPool = mocks.mockPool;

    mockConnection = {
      ...mocks.mockConnection,
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    mockWatchStatusManager = {
      calculateEpisodeStatus: jest.fn(),
      calculateSeasonStatus: jest.fn(),
      calculateShowStatus: jest.fn(),
      onStatusChange: jest.fn(),
      generateStatusSummary: jest.fn(),
    } as unknown as jest.Mocked<WatchStatusManager>;

    jest.mocked(handleDatabaseError).mockImplementation((error, contextMessage) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Database error ${contextMessage}: ${errorMessage}`);
    });

    watchStatusDbService = new WatchStatusDbService(mockWatchStatusManager, mockTransactionHelper);
  });

  describe('markEpisodesAsPriorWatched', () => {
    const profileId = 123;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should insert/update each episode with is_prior_watch = TRUE', async () => {
      const episodeAirDateMap = new Map<number, string>([
        [101, '2023-01-01'],
        [102, '2023-01-08'],
      ]);

      const updateResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValue([updateResult, []]);

      const result = await watchStatusDbService.markEpisodesAsPriorWatched(profileId, episodeAirDateMap);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(2);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);

      // Verify both calls include is_prior_watch
      const calls = mockConnection.execute.mock.calls;
      calls.forEach((call: any[]) => {
        expect(call[0]).toContain('is_prior_watch');
        expect(call[0]).toContain('WATCHED');
      });

      // Verify first episode call params
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_prior_watch'),
        [profileId, 101, '2023-01-01'],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_prior_watch'),
        [profileId, 102, '2023-01-08'],
      );
    });

    it('should return zero affectedRows for empty map', async () => {
      const result = await watchStatusDbService.markEpisodesAsPriorWatched(profileId, new Map());

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0);
      expect(mockConnection.execute).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const episodeAirDateMap = new Map<number, string>([[101, '2023-01-01']]);
      const dbError = new Error('Database connection failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(
        watchStatusDbService.markEpisodesAsPriorWatched(profileId, episodeAirDateMap),
      ).rejects.toThrow();

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'marking episodes as prior watched');
    });
  });

  describe('detectBulkMarkedShows', () => {
    const profileId = 123;

    it('should return bulk-marked shows with 10+ episodes on same date', async () => {
      const mockRows = [
        {
          showId: 1,
          title: 'Breaking Bad',
          posterImage: '/poster1.jpg',
          markDate: '2023-01-15',
          episodeCount: 50,
        },
        {
          showId: 2,
          title: 'The Wire',
          posterImage: '/poster2.jpg',
          markDate: '2023-02-01',
          episodeCount: 12,
        },
      ] as unknown as BulkMarkedShowRow[];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await watchStatusDbService.detectBulkMarkedShows(profileId);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_prior_watch = FALSE'),
        [profileId],
      );
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(*) >= 10'),
        expect.any(Array),
      );
      expect(result).toHaveLength(2);
      expect(result[0].showId).toBe(1);
      expect(result[0].title).toBe('Breaking Bad');
      expect(result[0].episodeCount).toBe(50);
    });

    it('should return empty array when no bulk-marked shows exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await watchStatusDbService.detectBulkMarkedShows(profileId);

      expect(result).toEqual([]);
    });

    it('should pass correct profileId to the query', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await watchStatusDbService.detectBulkMarkedShows(456);

      expect(mockPool.execute).toHaveBeenCalledWith(expect.any(String), [456]);
    });

    it('should handle database errors', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Query failed'));

      await expect(watchStatusDbService.detectBulkMarkedShows(profileId)).rejects.toThrow('Query failed');
    });
  });

  describe('retroactivelyMarkShowAsPrior', () => {
    const profileId = 123;
    const showId = 456;

    beforeEach(() => {
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });
    });

    it('should update all watched episodes for a show as prior watched', async () => {
      const updateResult = {
        affectedRows: 10,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.retroactivelyMarkShowAsPrior(profileId, showId);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(10);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_prior_watch = TRUE'),
        [profileId, showId],
      );
    });

    it('should filter by seasonIds when provided', async () => {
      const seasonIds = [1, 2, 3];
      const updateResult = {
        affectedRows: 5,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await watchStatusDbService.retroactivelyMarkShowAsPrior(profileId, showId, seasonIds);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(5);
      // Should include season filter in query
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('se.id IN'),
        [profileId, showId, ...seasonIds],
      );
    });

    it('should not add season filter for empty seasonIds array', async () => {
      const updateResult = { affectedRows: 3, insertId: 0, info: '', serverStatus: 0, warningStatus: 0, changedRows: 0, fieldCount: 0 } as ResultSetHeader;
      mockConnection.execute.mockResolvedValueOnce([updateResult, []]);

      await watchStatusDbService.retroactivelyMarkShowAsPrior(profileId, showId, []);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.not.stringContaining('se.id IN'),
        [profileId, showId],
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Update failed');
      mockTransactionHelper.executeInTransaction.mockRejectedValue(dbError);

      await expect(
        watchStatusDbService.retroactivelyMarkShowAsPrior(profileId, showId),
      ).rejects.toThrow();

      expect(handleDatabaseError).toHaveBeenCalledWith(dbError, 'retroactively marking show as prior watched');
    });
  });

  describe('getEpisodeAirDatesForShow', () => {
    const profileId = 123;
    const showId = 456;

    it('should return a map of episodeId to airDate', async () => {
      const mockRows = [
        { episodeId: 101, airDate: '2023-01-01' } as RowDataPacket & { episodeId: number; airDate: string },
        { episodeId: 102, airDate: '2023-01-08' } as RowDataPacket & { episodeId: number; airDate: string },
        { episodeId: 103, airDate: '2023-01-15' } as RowDataPacket & { episodeId: number; airDate: string },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRows]);

      const result = await watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get(101)).toBe('2023-01-01');
      expect(result.get(102)).toBe('2023-01-08');
      expect(result.get(103)).toBe('2023-01-15');
    });

    it('should filter by upToSeasonNumber when provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId, 2);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('season_number <='),
        [showId, 2],
      );
    });

    it('should not add season filter when upToSeasonNumber is not provided', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.not.stringContaining('season_number <='),
        [showId],
      );
    });

    it('should only include episodes with air dates on or before today', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      await watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('CURDATE()'),
        expect.any(Array),
      );
    });

    it('should return empty map when no episodes exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle database errors', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        watchStatusDbService.getEpisodeAirDatesForShow(profileId, showId),
      ).rejects.toThrow('Query failed');
    });
  });
});
