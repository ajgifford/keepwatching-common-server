import * as performanceArchiveDb from '../../../src/db/performanceArchiveDb';
import * as performanceArchiveUtil from '../../../src/utils/performanceArchiveUtil';
import { DbMonitor } from '../../../src/utils/dbMonitoring';
import { TransactionHelper } from '../../../src/utils/transactionHelper';
import { DBQueryCallHistory } from '@ajgifford/keepwatching-types';
import * as config from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { errorService } from '@services/errorService';
import { PoolConnection } from 'mysql2/promise';

jest.mock('@db/performanceArchiveDb');
jest.mock('@utils/dbMonitoring');
jest.mock('@utils/transactionHelper');
jest.mock('@config/config');
jest.mock('@logger/logger');
jest.mock('@services/errorService');
jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
  createDbPool: jest.fn(),
}));

describe('performanceArchiveUtil Module', () => {
  let mockDbMonitor: jest.Mocked<DbMonitor>;
  let mockConnection: jest.Mocked<PoolConnection>;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DbMonitor instance
    mockDbMonitor = {
      getQueryHistory: jest.fn(),
      getAllQueryNames: jest.fn(),
      getStoreInfo: jest.fn(),
      clearStats: jest.fn(),
    } as any;

    (DbMonitor.getInstance as jest.Mock).mockReturnValue(mockDbMonitor);

    // Mock connection
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    } as any;

    // Mock TransactionHelper
    mockTransactionHelper = {
      executeInTransaction: jest.fn(),
    } as any;

    (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);

    // Mock config
    (config.getPerformanceRetentionConfig as jest.Mock).mockReturnValue({
      detailedMetricsDays: 30,
      dailySummaryDays: 90,
    });

    // Mock logger methods
    (cliLogger.warn as jest.Mock).mockImplementation(() => {});
    (cliLogger.info as jest.Mock).mockImplementation(() => {});
    (appLogger.error as jest.Mock).mockImplementation(() => {});

    // Mock errorService
    (errorService.handleError as jest.Mock).mockImplementation((error) => error);
  });

  describe('archiveDailyPerformance()', () => {
    it('should successfully archive performance data for multiple queries', async () => {
      // Setup mocks
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1', 'query2', 'query3']);

      const mockHistory1: DBQueryCallHistory[] = [
        { executionTime: 10, timestamp: new Date('2024-01-15T10:00:00Z').getTime(), success: true },
        { executionTime: 15, timestamp: new Date('2024-01-15T11:00:00Z').getTime(), success: true },
        { executionTime: 20, timestamp: new Date('2024-01-15T12:00:00Z').getTime(), success: true },
      ];

      const mockHistory2: DBQueryCallHistory[] = [
        { executionTime: 25, timestamp: new Date('2024-01-15T13:00:00Z').getTime(), success: true },
        { executionTime: 30, timestamp: new Date('2024-01-15T14:00:00Z').getTime(), success: true },
      ];

      const mockHistory3: DBQueryCallHistory[] = [
        { executionTime: 5, timestamp: new Date('2024-01-15T15:00:00Z').getTime(), success: true },
      ];

      mockDbMonitor.getQueryHistory
        .mockResolvedValueOnce(mockHistory1)
        .mockResolvedValueOnce(mockHistory1)
        .mockResolvedValueOnce(mockHistory2)
        .mockResolvedValueOnce(mockHistory2)
        .mockResolvedValueOnce(mockHistory3)
        .mockResolvedValueOnce(mockHistory3);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(2);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(50);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(10);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      // Mock executeInTransaction to actually call the callback
      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      // Execute
      await performanceArchiveUtil.archiveDailyPerformance();

      // Verify transaction was created
      expect(TransactionHelper).toHaveBeenCalledTimes(1);
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);

      // Verify archive log started
      expect(performanceArchiveDb.startArchiveLog).toHaveBeenCalledWith(
        expect.any(Date),
        mockConnection,
      );

      // Verify all queries were processed
      expect(mockDbMonitor.getAllQueryNames).toHaveBeenCalledTimes(1);
      expect(mockDbMonitor.getQueryHistory).toHaveBeenCalledTimes(6); // 2 calls per query (summary + detailed)

      // Verify monthly aggregation
      expect(performanceArchiveDb.aggregateMonthlyPerformance).toHaveBeenCalledWith(mockConnection);

      // Verify cleanup operations
      expect(performanceArchiveDb.cleanupOldDetailedMetrics).toHaveBeenCalledWith(30, mockConnection);
      expect(performanceArchiveDb.cleanupOldDailySummaries).toHaveBeenCalledWith(90, mockConnection);

      // Verify archive log completed
      expect(performanceArchiveDb.completeArchiveLog).toHaveBeenCalledWith(
        1,
        6, // 3 + 2 + 1 metrics
        3, // 3 queries
        mockConnection,
      );

      // Verify success logging
      expect(cliLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Archive completed'),
      );

      // Verify Redis stats were cleared after successful archive
      expect(mockDbMonitor.clearStats).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Redis stats cleared after successful archive');
    });

    it('should handle empty query history correctly', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1', 'query2']);
      mockDbMonitor.getQueryHistory.mockResolvedValue([]);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      // Should process 2 queries but archive 0 metrics (empty history)
      expect(performanceArchiveDb.completeArchiveLog).toHaveBeenCalledWith(
        1,
        0, // No metrics archived
        2, // 2 queries processed
        mockConnection,
      );

      // Verify Redis stats were still cleared even with empty history
      expect(mockDbMonitor.clearStats).toHaveBeenCalledTimes(1);
    });

    it('should calculate percentiles correctly for large dataset', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      // Create 100 executions with predictable times
      const mockHistory: DBQueryCallHistory[] = Array.from({ length: 100 }, (_, i) => ({
        executionTime: i + 1, // 1ms to 100ms
        timestamp: new Date('2024-01-15T10:00:00Z').getTime() + i * 1000,
        success: true,
      }));

      mockDbMonitor.getQueryHistory.mockResolvedValue(mockHistory);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      // Verify summary stats were inserted with correct percentiles
      const summaryInsertCall = mockConnection.execute.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('query_performance_daily_summary'),
      );

      expect(summaryInsertCall).toBeDefined();
      const params = summaryInsertCall![1] as any[];

      // Verify calculations
      expect(params[3]).toBe(100); // totalExecutions
      expect(params[4]).toBe(50.5); // avgDuration (1+2+...+100)/100
      expect(params[5]).toBe(1); // minDuration
      expect(params[6]).toBe(100); // maxDuration
      expect(params[7]).toBe(51); // p50 (50th percentile) - Math.floor(100 * 0.5) = 50, so index 50 = value 51
      expect(params[8]).toBe(96); // p95 (95th percentile) - Math.floor(100 * 0.95) = 95, so index 95 = value 96
      expect(params[9]).toBe(100); // p99 (99th percentile) - Math.floor(100 * 0.99) = 99, so index 99 = value 100
    });

    it('should handle query history with metadata fields', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      const mockHistory: DBQueryCallHistory[] = [
        {
          executionTime: 10,
          timestamp: new Date('2024-01-15T10:00:00Z').getTime(),
          success: true,
          endpoint: '/api/shows',
          profileId: 123,
          accountId: 456,
          content: { id: 789, type: 'show' },
          resultCount: 5,
        },
        {
          executionTime: 15,
          timestamp: new Date('2024-01-15T11:00:00Z').getTime(),
          success: true,
          endpoint: '/api/movies',
          resultCount: 3,
        },
      ];

      mockDbMonitor.getQueryHistory.mockResolvedValue(mockHistory);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      // Verify detailed metrics were inserted with metadata
      const detailedInsertCall = mockConnection.execute.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('query_performance_detailed_metrics'),
      );

      expect(detailedInsertCall).toBeDefined();
      const params = detailedInsertCall![1] as any[];

      // First execution
      expect(params[4]).toBe('/api/shows');
      expect(params[5]).toBe(123);
      expect(params[6]).toBe(456);
      expect(params[7]).toBe('{"id":789,"type":"show"}');
      expect(params[8]).toBe(5);

      // Second execution
      expect(params[13]).toBe('/api/movies');
      expect(params[14]).toBe(null);
      expect(params[15]).toBe(null);
      expect(params[16]).toBe(null);
      expect(params[17]).toBe(3);
    });

    it('should return early when Redis is not connected', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'Redis', isRedis: true, connected: false });

      await performanceArchiveUtil.archiveDailyPerformance();

      expect(cliLogger.warn).toHaveBeenCalledWith('Cannot archive: Redis client not ready');
      expect(mockDbMonitor.getAllQueryNames).not.toHaveBeenCalled();
      expect(mockTransactionHelper.executeInTransaction).not.toHaveBeenCalled();
      // Should not clear stats if archive didn't run
      expect(mockDbMonitor.clearStats).not.toHaveBeenCalled();
    });

    it('should continue archiving when Redis is connected', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'Redis', isRedis: true, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);
      mockDbMonitor.getQueryHistory.mockResolvedValue([
        { executionTime: 10, timestamp: new Date('2024-01-15T10:00:00Z').getTime(), success: true },
      ]);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      expect(cliLogger.warn).not.toHaveBeenCalled();
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      // Verify Redis stats were cleared after successful archive
      expect(mockDbMonitor.clearStats).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during archive and log failure', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      const testError = new Error('Archive failed');
      mockDbMonitor.getQueryHistory.mockRejectedValue(testError);

      (performanceArchiveDb.failArchiveLog as jest.Mock).mockResolvedValue(undefined);

      // First transaction fails, second succeeds for logging
      mockTransactionHelper.executeInTransaction
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        })
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        });

      await expect(performanceArchiveUtil.archiveDailyPerformance()).rejects.toThrow();

      // Verify error was logged
      expect(appLogger.error).toHaveBeenCalledWith('Archive failed:', testError);

      // Verify failure log was created
      expect(performanceArchiveDb.failArchiveLog).toHaveBeenCalledWith(
        expect.any(Date),
        'Archive failed',
        mockConnection,
      );

      // Verify error service was called
      expect(errorService.handleError).toHaveBeenCalledWith(testError, 'archiveDailyPerformance()');

      // Verify Redis stats were NOT cleared after failed archive
      expect(mockDbMonitor.clearStats).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions during archive', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      const testError = 'String error';
      mockDbMonitor.getQueryHistory.mockRejectedValue(testError);

      (performanceArchiveDb.failArchiveLog as jest.Mock).mockResolvedValue(undefined);
      (errorService.handleError as jest.Mock).mockReturnValue(testError);

      mockTransactionHelper.executeInTransaction
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        })
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        });

      await expect(performanceArchiveUtil.archiveDailyPerformance()).rejects.toBe(testError);

      // Verify failure log was created with string error
      expect(performanceArchiveDb.failArchiveLog).toHaveBeenCalledWith(
        expect.any(Date),
        'String error',
        mockConnection,
      );
    });

    it('should use correct archive date (start of current day)', async () => {
      const now = new Date('2024-01-15T15:30:45.123Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);

      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue([]);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      // Verify archive date is start of day
      const expectedDate = new Date('2024-01-15T00:00:00.000Z');
      expect(performanceArchiveDb.startArchiveLog).toHaveBeenCalledWith(
        expectedDate,
        mockConnection,
      );

      jest.restoreAllMocks();
    });

    it('should batch insert detailed metrics efficiently', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      const mockHistory: DBQueryCallHistory[] = [
        { executionTime: 10, timestamp: new Date('2024-01-15T10:00:00Z').getTime(), success: true },
        { executionTime: 15, timestamp: new Date('2024-01-15T11:00:00Z').getTime(), success: true },
        { executionTime: 20, timestamp: new Date('2024-01-15T12:00:00Z').getTime(), success: true },
      ];

      mockDbMonitor.getQueryHistory.mockResolvedValue(mockHistory);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveDailyPerformance();

      // Verify single batch insert was used for detailed metrics
      const detailedInsertCall = mockConnection.execute.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('query_performance_detailed_metrics'),
      );

      expect(detailedInsertCall).toBeDefined();
      const sql = String(detailedInsertCall![0]);

      // Should have 3 sets of placeholders for 3 executions
      const placeholderMatches = sql.match(/\(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/g);
      expect(placeholderMatches).toHaveLength(3);
    });
  });

  describe('archiveNow()', () => {
    it('should trigger archive and log start message', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue([]);

      (performanceArchiveDb.startArchiveLog as jest.Mock).mockResolvedValue(1);
      (performanceArchiveDb.aggregateMonthlyPerformance as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDetailedMetrics as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.cleanupOldDailySummaries as jest.Mock).mockResolvedValue(0);
      (performanceArchiveDb.completeArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction.mockImplementation(async (callback: any) => {
        return await callback(mockConnection);
      });

      await performanceArchiveUtil.archiveNow();

      expect(cliLogger.info).toHaveBeenCalledWith('Manual archive triggered');
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from archiveDailyPerformance', async () => {
      mockDbMonitor.getStoreInfo.mockReturnValue({ type: 'In-Memory', isRedis: false, connected: true });
      mockDbMonitor.getAllQueryNames.mockResolvedValue(['query1']);

      const testError = new Error('Archive failed');
      mockDbMonitor.getQueryHistory.mockRejectedValue(testError);

      (performanceArchiveDb.failArchiveLog as jest.Mock).mockResolvedValue(undefined);

      mockTransactionHelper.executeInTransaction
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        })
        .mockImplementationOnce(async (callback: any) => {
          return await callback(mockConnection);
        });

      await expect(performanceArchiveUtil.archiveNow()).rejects.toThrow();

      expect(errorService.handleError).toHaveBeenCalledWith(testError, 'archiveNow()');
    });
  });
});
