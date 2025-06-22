import { StatusUpdateContext } from './helpers/watchStatusTestTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { WatchStatusManager } from '@utils/watchStatusManager';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

// Mock dependencies
jest.mock('@utils/transactionHelper');
jest.mock('@utils/watchStatusManager');
jest.mock('@middleware/errorMiddleware');
jest.mock('@utils/errorHandlingUtility', () => ({
  handleDatabaseError: jest.fn((error: Error, operation: string) => {
    throw new Error(`Database error ${operation}: ${error.message}`);
  }),
}));

describe('WatchStatusDbService - Core Functionality', () => {
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

  describe('Constructor', () => {
    it('should initialize with provided dependencies', () => {
      const customStatusManager = {} as WatchStatusManager;
      const customTransactionHelper = {} as TransactionHelper;

      const service = new WatchStatusDbService(customStatusManager, customTransactionHelper);

      expect((service as any).statusManager).toBe(customStatusManager);
      expect((service as any).transactionHelper).toBe(customTransactionHelper);
    });

    it('should initialize with default dependencies when none provided', () => {
      // Mock the static getInstance method and constructor
      const mockGetInstance = jest.spyOn(WatchStatusManager, 'getInstance');
      const mockDefaultStatusManager = {} as WatchStatusManager;
      mockGetInstance.mockReturnValue(mockDefaultStatusManager);

      const service = new WatchStatusDbService();

      expect(mockGetInstance).toHaveBeenCalledTimes(1);
      expect((service as any).statusManager).toBe(mockDefaultStatusManager);
      expect((service as any).transactionHelper).toBeInstanceOf(TransactionHelper);

      mockGetInstance.mockRestore();
    });

    it('should use injected dependencies over defaults', () => {
      const service = new WatchStatusDbService(mockWatchStatusManager, mockTransactionHelper);

      expect((service as any).statusManager).toBe(mockWatchStatusManager);
      expect((service as any).transactionHelper).toBe(mockTransactionHelper);
    });
  });

  describe('executeStatusUpdate', () => {
    it('should execute operation within transaction and return result', async () => {
      const mockOperation = jest.fn().mockResolvedValue('test result');

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback) => {
        return await callback(mockConnection);
      });

      // Access private method through any type casting
      const result = await (watchStatusDbService as any).executeStatusUpdate('test operation', mockOperation);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [],
          totalAffectedRows: 0,
          connection: mockConnection,
          profileId: 0,
          timestamp: expect.any(Date),
        }),
      );
      expect(result).toBe('test result');
    });

    it('should handle database errors properly', async () => {
      const mockError = new Error('Database connection failed');
      const mockOperation = jest.fn().mockRejectedValue(mockError);

      mockTransactionHelper.executeInTransaction.mockRejectedValue(mockError);

      await expect((watchStatusDbService as any).executeStatusUpdate('test operation', mockOperation)).rejects.toThrow(
        'Database error test operation: Database connection failed',
      );

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'test operation');
    });
  });

  describe('updateEntityStatus', () => {
    it('should execute INSERT...ON DUPLICATE KEY UPDATE query with correct parameters', async () => {
      const mockResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const context: StatusUpdateContext = {
        changes: [],
        totalAffectedRows: 0,
        connection: mockConnection,
        profileId: 123,
        timestamp: new Date(),
      };

      const params = {
        table: 'episode_watch_status',
        entityColumn: 'episode_id',
        entityId: 456,
        status: WatchStatus.WATCHED,
      };

      await (watchStatusDbService as any).updateEntityStatus(context, params);

      expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO episode_watch_status'), [
        123,
        456,
        WatchStatus.WATCHED,
      ]);
      expect(context.totalAffectedRows).toBe(1);
    });

    it('should accumulate affected rows in context', async () => {
      const mockResult = {
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockConnection.execute.mockResolvedValue([mockResult, []]);

      const context: StatusUpdateContext = {
        changes: [],
        totalAffectedRows: 5,
        connection: mockConnection,
        profileId: 123,
        timestamp: new Date(),
      };

      const params = {
        table: 'season_watch_status',
        entityColumn: 'season_id',
        entityId: 789,
        status: WatchStatus.UP_TO_DATE,
      };

      await (watchStatusDbService as any).updateEntityStatus(context, params);

      expect(context.totalAffectedRows).toBe(7); // 5 + 2
    });
  });

  describe('recordStatusChange', () => {
    it('should record status change when statuses are different', () => {
      const context: StatusUpdateContext = {
        changes: [],
        totalAffectedRows: 0,
        connection: mockConnection,
        profileId: 123,
        timestamp: new Date('2023-01-01T10:00:00Z'),
      };

      (watchStatusDbService as any).recordStatusChange(
        context,
        'episode',
        456,
        WatchStatus.NOT_WATCHED,
        WatchStatus.WATCHED,
        'User marked as watched',
      );

      expect(context.changes).toHaveLength(1);
      expect(context.changes[0]).toEqual({
        entityType: 'episode',
        entityId: 456,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: new Date('2023-01-01T10:00:00Z'),
        reason: 'User marked as watched',
      });
    });

    it('should not record status change when statuses are the same', () => {
      const context: StatusUpdateContext = {
        changes: [],
        totalAffectedRows: 0,
        connection: mockConnection,
        profileId: 123,
        timestamp: new Date(),
      };

      (watchStatusDbService as any).recordStatusChange(
        context,
        'episode',
        456,
        WatchStatus.WATCHED,
        WatchStatus.WATCHED,
        'No change',
      );

      expect(context.changes).toHaveLength(0);
    });
  });

  describe('createSuccessResult', () => {
    it('should create proper success result from context', () => {
      const context: StatusUpdateContext = {
        changes: [
          {
            entityType: 'episode',
            entityId: 123,
            from: WatchStatus.NOT_WATCHED,
            to: WatchStatus.WATCHED,
            timestamp: new Date(),
            reason: 'Test change',
          },
        ],
        totalAffectedRows: 2,
        connection: mockConnection,
        profileId: 123,
        timestamp: new Date(),
      };

      const result = (watchStatusDbService as any).createSuccessResult(context);

      expect(result).toEqual({
        success: true,
        changes: context.changes,
        affectedRows: 2,
      });
    });
  });
});
