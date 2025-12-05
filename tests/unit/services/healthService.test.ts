import {
  ArchiveLogEntry,
  DBQueryCallHistory,
  DBQueryStats,
  DatabaseHealthResponse,
  SlowestQuery,
} from '@ajgifford/keepwatching-types';
import { MonthlyPerformanceSummary } from '../../../src/types/performanceTypes';
import { errorService } from '@services/errorService';
import { HealthService, healthService } from '@services/healthService';
import { getDbPool } from '@utils/db';
import * as performanceArchiveDb from '@db/performanceArchiveDb';
import * as performanceArchiveUtil from '@utils/performanceArchiveUtil';

// Mock must be defined before it's used
const mockDbMonitorInstance = {
  executeWithTiming: jest.fn((name: string, fn: () => any) => fn()),
  getStats: jest.fn().mockResolvedValue([]),
  getQueryHistory: jest.fn().mockResolvedValue([]),
};

const mockCacheInstance = {
  getOrSet: jest.fn((key: string, fn: () => any) => fn()),
};

jest.mock('@utils/db');
jest.mock('@services/errorService');
jest.mock('@db/performanceArchiveDb');
jest.mock('@utils/performanceArchiveUtil');
jest.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: () => mockDbMonitorInstance,
  },
}));
jest.mock('@services/cacheService', () => ({
  CacheService: {
    getInstance: () => mockCacheInstance,
  },
}));

describe('HealthService', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock connection
    mockConnection = {
      ping: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    // Mock pool with internal structure
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      pool: {
        config: {
          connectionLimit: 10,
        },
        _allConnections: [1, 2, 3, 4, 5], // 5 active connections
        _freeConnections: [1, 2], // 2 free connections
      },
    };

    (getDbPool as jest.Mock).mockReturnValue(mockPool);

    mockDbMonitorInstance.executeWithTiming.mockClear();
    mockDbMonitorInstance.executeWithTiming.mockImplementation((name: string, fn: () => any) => fn());
    mockDbMonitorInstance.getStats.mockResolvedValue([]);

    mockCacheInstance.getOrSet.mockClear();
    mockCacheInstance.getOrSet.mockImplementation((key: string, fn: () => any) => fn());
  });

  describe('getDatabaseHealth', () => {
    it('should return healthy status with pool statistics and query stats', async () => {
      const mockQueryStats = [
        { query: 'SELECT * FROM shows', count: 100, avgTime: 50, maxTime: 200, totalTime: 5000 },
        { query: 'SELECT * FROM movies', count: 80, avgTime: 45, maxTime: 180, totalTime: 3600 },
      ];

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockQueryStats);

      const result = await healthService.getDatabaseHealth();

      expect(result).toEqual({
        status: 'healthy',
        pool: {
          totalConnections: 10,
          activeConnections: 5,
          freeConnections: 2,
        },
        queryStats: mockQueryStats,
      } as DatabaseHealthResponse);

      expect(getDbPool).toHaveBeenCalled();
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockDbMonitorInstance.getStats).toHaveBeenCalled();
    });

    it('should limit query stats to top 10', async () => {
      const mockQueryStats = Array.from({ length: 15 }, (_, i) => ({
        query: `Query ${i}`,
        count: 100 - i,
        avgTime: 50 - i,
        maxTime: 200 - i,
        totalTime: 5000 - i * 100,
      }));

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockQueryStats);

      const result = await healthService.getDatabaseHealth();

      expect(result.queryStats).toHaveLength(10);
      expect(result.queryStats).toEqual(mockQueryStats.slice(0, 10));
    });

    it('should handle empty query stats', async () => {
      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result).toEqual({
        status: 'healthy',
        pool: {
          totalConnections: 10,
          activeConnections: 5,
          freeConnections: 2,
        },
        queryStats: [],
      } as DatabaseHealthResponse);
    });

    it('should handle pool with no active connections', async () => {
      mockPool.pool._allConnections = null;
      mockPool.pool._freeConnections = null;

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result.pool).toEqual({
        totalConnections: 10,
        activeConnections: 0,
        freeConnections: 0,
      });
    });

    it('should handle pool with undefined _allConnections', async () => {
      mockPool.pool._allConnections = undefined;
      mockPool.pool._freeConnections = undefined;

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result.pool).toEqual({
        totalConnections: 10,
        activeConnections: 0,
        freeConnections: 0,
      });
    });

    it('should handle pool with empty arrays', async () => {
      mockPool.pool._allConnections = [];
      mockPool.pool._freeConnections = [];

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result.pool).toEqual({
        totalConnections: 10,
        activeConnections: 0,
        freeConnections: 0,
      });
    });

    it('should release connection even if ping succeeds', async () => {
      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      await healthService.getDatabaseHealth();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should throw error when connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.getConnection.mockRejectedValue(connectionError);

      const handledError = new Error('Handled connection error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getDatabaseHealth()).rejects.toThrow('Handled connection error');

      expect(errorService.handleError).toHaveBeenCalledWith(connectionError, 'getDatabaseHealth()');
      expect(mockConnection.release).not.toHaveBeenCalled();
    });

    it('should throw error when ping fails', async () => {
      const pingError = new Error('Ping failed');
      mockConnection.ping.mockRejectedValue(pingError);

      const handledError = new Error('Handled ping error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getDatabaseHealth()).rejects.toThrow('Handled ping error');

      expect(errorService.handleError).toHaveBeenCalledWith(pingError, 'getDatabaseHealth()');
    });

    it('should handle error when getting pool stats', async () => {
      const statsError = new Error('Stats error');
      (mockDbMonitorInstance.getStats as jest.Mock).mockImplementation(() => {
        throw statsError;
      });

      const handledError = new Error('Handled stats error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getDatabaseHealth()).rejects.toThrow('Handled stats error');

      expect(errorService.handleError).toHaveBeenCalledWith(statsError, 'getDatabaseHealth()');
    });

    it('should handle error from getDbPool', async () => {
      const poolError = new Error('Pool error');
      (getDbPool as jest.Mock).mockImplementation(() => {
        throw poolError;
      });

      const handledError = new Error('Handled pool error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getDatabaseHealth()).rejects.toThrow('Handled pool error');

      expect(errorService.handleError).toHaveBeenCalledWith(poolError, 'getDatabaseHealth()');
    });

    it('should work with different pool configurations', async () => {
      mockPool.pool.config.connectionLimit = 50;
      mockPool.pool._allConnections = Array.from({ length: 30 }, (_, i) => i);
      mockPool.pool._freeConnections = Array.from({ length: 10 }, (_, i) => i);

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result.pool).toEqual({
        totalConnections: 50,
        activeConnections: 30,
        freeConnections: 10,
      });
    });
  });

  describe('getQueryHistory', () => {
    it('should return query history for a specific query', async () => {
      const mockHistory = [
        { timestamp: Date.now(), executionTime: 150, success: true },
        { timestamp: Date.now() - 1000, executionTime: 200, success: true },
        { timestamp: Date.now() - 2000, executionTime: 180, success: true },
      ];

      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockResolvedValue(mockHistory);

      const result = await healthService.getQueryHistory('SELECT * FROM shows');

      expect(result).toEqual(mockHistory);
      expect(mockDbMonitorInstance.getQueryHistory).toHaveBeenCalledWith('SELECT * FROM shows', 100);
    });

    it('should respect custom limit parameter', async () => {
      const mockHistory = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        executionTime: 100 + i,
        success: true,
      }));

      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockResolvedValue(mockHistory);

      const result = await healthService.getQueryHistory('SELECT * FROM movies', 50);

      expect(result).toEqual(mockHistory);
      expect(mockDbMonitorInstance.getQueryHistory).toHaveBeenCalledWith('SELECT * FROM movies', 50);
    });

    it('should enforce maximum limit of 1000', async () => {
      const mockHistory: DBQueryCallHistory[] = [];
      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockResolvedValue(mockHistory);

      await healthService.getQueryHistory('SELECT * FROM users', 5000);

      expect(mockDbMonitorInstance.getQueryHistory).toHaveBeenCalledWith('SELECT * FROM users', 1000);
    });

    it('should handle query history with errors', async () => {
      const mockHistory = [
        { timestamp: Date.now(), executionTime: 150, success: true },
        { timestamp: Date.now() - 1000, executionTime: 5000, success: false, error: 'Connection timeout' },
        { timestamp: Date.now() - 2000, executionTime: 180, success: true },
      ];

      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockResolvedValue(mockHistory);

      const result = await healthService.getQueryHistory('SELECT * FROM orders');

      expect(result).toEqual(mockHistory);
      expect(result[1].success).toBe(false);
      expect(result[1].error).toBe('Connection timeout');
    });

    it('should handle empty history', async () => {
      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await healthService.getQueryHistory('SELECT * FROM new_table');

      expect(result).toEqual([]);
    });

    it('should handle errors from DbMonitor', async () => {
      const dbError = new Error('Failed to retrieve history');
      (mockDbMonitorInstance.getQueryHistory as jest.Mock) = jest.fn().mockRejectedValue(dbError);

      const handledError = new Error('Handled history error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getQueryHistory('SELECT * FROM shows')).rejects.toThrow('Handled history error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getQueryHistory(SELECT * FROM shows)');
    });
  });

  describe('getQueryStats', () => {
    it('should return query stats with default limit', async () => {
      const mockStats = Array.from({ length: 25 }, (_, i) => ({
        query: `Query ${i}`,
        count: 100 - i,
        avgTime: 50 - i,
        maxTime: 200 - i,
        totalTime: 5000 - i * 100,
      }));

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getQueryStats();

      expect(result).toEqual(mockStats.slice(0, 30));
      expect(mockDbMonitorInstance.getStats).toHaveBeenCalled();
    });

    it('should respect custom limit parameter', async () => {
      const mockStats = Array.from({ length: 50 }, (_, i) => ({
        query: `Query ${i}`,
        count: 100 - i,
        avgTime: 50 - i,
        maxTime: 200 - i,
        totalTime: 5000 - i * 100,
      }));

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getQueryStats(20);

      expect(result).toEqual(mockStats.slice(0, 20));
    });

    it('should enforce maximum limit of 50', async () => {
      const mockStats = Array.from({ length: 100 }, (_, i) => ({
        query: `Query ${i}`,
        count: 100 - i,
        avgTime: 50 - i,
        maxTime: 200 - i,
        totalTime: 5000 - i * 100,
      }));

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getQueryStats(200);

      expect(result).toEqual(mockStats.slice(0, 50));
    });

    it('should handle empty stats', async () => {
      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getQueryStats();

      expect(result).toEqual([]);
    });

    it('should handle errors from DbMonitor', async () => {
      const dbError = new Error('Failed to retrieve stats');
      (mockDbMonitorInstance.getStats as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled stats error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getQueryStats(30)).rejects.toThrow('Handled stats error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getQueryStats(30)');
    });
  });

  describe('getHistoricalPerformanceTrends', () => {
    it('should return performance trends for a query hash', async () => {
      const queryHash = 'abc123';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');
      const mockTrends = [
        { date: '2025-01-01', avgDuration: 100, maxDuration: 200, callCount: 50 },
        { date: '2025-01-02', avgDuration: 110, maxDuration: 220, callCount: 55 },
        { date: '2025-01-03', avgDuration: 105, maxDuration: 210, callCount: 52 },
      ];

      (performanceArchiveDb.getPerformanceTrends as jest.Mock).mockResolvedValue(mockTrends);

      const result = await healthService.getHistoricalPerformanceTrends(queryHash, startDate, endDate);

      expect(result).toEqual(mockTrends);
      expect(performanceArchiveDb.getPerformanceTrends).toHaveBeenCalledWith(queryHash, startDate, endDate);
    });

    it('should handle empty trends', async () => {
      const queryHash = 'xyz789';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');

      (performanceArchiveDb.getPerformanceTrends as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getHistoricalPerformanceTrends(queryHash, startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should handle errors from performanceArchiveDb', async () => {
      const queryHash = 'error123';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');
      const dbError = new Error('Failed to retrieve trends');

      (performanceArchiveDb.getPerformanceTrends as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled trends error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getHistoricalPerformanceTrends(queryHash, startDate, endDate)).rejects.toThrow(
        'Handled trends error',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getHistoricalPerformanceTrends(${queryHash}, ${startDate}, ${endDate})`,
      );
    });
  });

  describe('getHistoricalSlowestQueries', () => {
    it('should return slowest queries with default limit', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');
      const mockQueries = [
        { queryHash: 'hash1', queryName: 'SELECT * FROM large_table', avgDuration: 500, maxDuration: 1000 },
        { queryHash: 'hash2', queryName: 'SELECT * FROM another_table', avgDuration: 400, maxDuration: 800 },
      ];

      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue(mockQueries);

      const result = await healthService.getHistoricalSlowestQueries(startDate, endDate);

      expect(result).toEqual(mockQueries);
      expect(performanceArchiveDb.getSlowestQueries).toHaveBeenCalledWith(startDate, endDate, 10);
    });

    it('should respect custom limit parameter', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');
      const mockQueries = Array.from({ length: 25 }, (_, i) => ({
        queryHash: `hash${i}`,
        queryName: `Query ${i}`,
        avgDuration: 500 - i * 10,
        maxDuration: 1000 - i * 20,
      }));

      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue(mockQueries.slice(0, 25));

      const result = await healthService.getHistoricalSlowestQueries(startDate, endDate, 25);

      expect(result).toHaveLength(25);
      expect(performanceArchiveDb.getSlowestQueries).toHaveBeenCalledWith(startDate, endDate, 25);
    });

    it('should handle empty results', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');

      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getHistoricalSlowestQueries(startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should handle errors from performanceArchiveDb', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-07');
      const dbError = new Error('Failed to retrieve slowest queries');

      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled slowest queries error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getHistoricalSlowestQueries(startDate, endDate, 10)).rejects.toThrow(
        'Handled slowest queries error',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        dbError,
        `getHistoricalSlowestQueries(${startDate}, ${endDate}, 10)`,
      );
    });
  });

  describe('getArchiveLogs', () => {
    it('should return archive logs with default limit', async () => {
      const mockLogs = [
        {
          id: 1,
          archiveDate: new Date('2025-01-07'),
          startedAt: new Date('2025-01-07T00:00:00Z'),
          completedAt: new Date('2025-01-07T00:05:00Z'),
          status: 'completed' as const,
          metricsArchived: 100,
          queriesProcessed: 50,
          errorMessage: null,
        },
        {
          id: 2,
          archiveDate: new Date('2025-01-06'),
          startedAt: new Date('2025-01-06T00:00:00Z'),
          completedAt: new Date('2025-01-06T00:04:00Z'),
          status: 'completed' as const,
          metricsArchived: 95,
          queriesProcessed: 48,
          errorMessage: null,
        },
      ];

      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue(mockLogs);

      const result = await healthService.getArchiveLogs();

      expect(result).toEqual(mockLogs);
      expect(performanceArchiveDb.getArchiveLogs).toHaveBeenCalledWith(10);
    });

    it('should respect custom limit parameter', async () => {
      const mockLogs = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        archiveDate: new Date(`2025-01-${20 - i}`),
        startedAt: new Date(`2025-01-${20 - i}T00:00:00Z`),
        completedAt: new Date(`2025-01-${20 - i}T00:05:00Z`),
        status: 'completed' as const,
        metricsArchived: 100 - i,
        queriesProcessed: 50 - i,
        errorMessage: null,
      }));

      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue(mockLogs);

      const result = await healthService.getArchiveLogs(20);

      expect(result).toEqual(mockLogs);
      expect(performanceArchiveDb.getArchiveLogs).toHaveBeenCalledWith(20);
    });

    it('should handle logs with failures', async () => {
      const mockLogs = [
        {
          id: 1,
          archiveDate: new Date('2025-01-07'),
          startedAt: new Date('2025-01-07T00:00:00Z'),
          completedAt: new Date('2025-01-07T00:05:00Z'),
          status: 'completed' as const,
          metricsArchived: 100,
          queriesProcessed: 50,
          errorMessage: null,
        },
        {
          id: 2,
          archiveDate: new Date('2025-01-06'),
          startedAt: new Date('2025-01-06T00:00:00Z'),
          completedAt: null,
          status: 'failed' as const,
          metricsArchived: 0,
          queriesProcessed: 0,
          errorMessage: 'Connection failed',
        },
      ];

      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue(mockLogs);

      const result = await healthService.getArchiveLogs();

      expect(result).toEqual(mockLogs);
      expect(result[1].status).toBe('failed');
      expect(result[1].errorMessage).toBe('Connection failed');
    });

    it('should handle empty logs', async () => {
      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getArchiveLogs();

      expect(result).toEqual([]);
    });

    it('should handle errors from performanceArchiveDb', async () => {
      const dbError = new Error('Failed to retrieve archive logs');

      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled archive logs error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getArchiveLogs(10)).rejects.toThrow('Handled archive logs error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getArchiveLogs(10)');
    });
  });

  describe('getArchiveStatistics', () => {
    it('should return archive statistics with default days', async () => {
      const mockStats = {
        totalQueries: 500,
        totalExecutions: 10000,
        avgDuration: 125.5,
        slowestQuery: 'SELECT * FROM large_table',
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-07'),
        },
      };

      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getArchiveStatistics();

      expect(result).toEqual(mockStats);
      expect(performanceArchiveDb.getArchiveStatistics).toHaveBeenCalledWith(7);
    });

    it('should respect custom days parameter', async () => {
      const mockStats = {
        totalQueries: 1000,
        totalExecutions: 50000,
        avgDuration: 100.0,
        slowestQuery: 'SELECT * FROM huge_table',
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-30'),
        },
      };

      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getArchiveStatistics(30);

      expect(result).toEqual(mockStats);
      expect(performanceArchiveDb.getArchiveStatistics).toHaveBeenCalledWith(30);
    });

    it('should enforce maximum days of 90', async () => {
      const mockStats = {
        totalQueries: 2000,
        totalExecutions: 100000,
        avgDuration: 95.5,
        slowestQuery: null,
        dateRange: {
          start: new Date('2024-10-01'),
          end: new Date('2025-01-07'),
        },
      };

      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getArchiveStatistics(365);

      expect(result).toEqual(mockStats);
      expect(performanceArchiveDb.getArchiveStatistics).toHaveBeenCalledWith(90);
    });

    it('should handle stats with no slowest query', async () => {
      const mockStats = {
        totalQueries: 0,
        totalExecutions: 0,
        avgDuration: 0,
        slowestQuery: null,
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-07'),
        },
      };

      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockStats);

      const result = await healthService.getArchiveStatistics();

      expect(result).toEqual(mockStats);
      expect(result.slowestQuery).toBeNull();
    });

    it('should handle errors from performanceArchiveDb', async () => {
      const dbError = new Error('Failed to retrieve archive statistics');

      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled archive statistics error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getArchiveStatistics(7)).rejects.toThrow('Handled archive statistics error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getArchiveStatistics(7)');
    });
  });

  describe('getPerformanceOverview', () => {
    it('should return combined performance overview', async () => {
      const mockRealtimeStats = [
        { query: 'SELECT * FROM shows', count: 100, avgTime: 50, maxTime: 200, totalTime: 5000 },
      ];
      const mockHistoricalStats = {
        totalQueries: 500,
        totalExecutions: 10000,
        avgDuration: 125.5,
        slowestQuery: 'SELECT * FROM large_table',
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-07'),
        },
      };
      const mockSlowestQueries = [
        { queryHash: 'hash1', queryName: 'SELECT * FROM large_table', avgDuration: 500, maxDuration: 1000 },
      ];
      const mockArchiveLogs = [
        {
          id: 1,
          archiveDate: new Date('2025-01-07'),
          startedAt: new Date('2025-01-07T00:00:00Z'),
          completedAt: new Date('2025-01-07T00:05:00Z'),
          status: 'completed' as const,
          metricsArchived: 100,
          queriesProcessed: 50,
          errorMessage: null,
        },
      ];

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockRealtimeStats);
      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockHistoricalStats);
      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue(mockSlowestQueries);
      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue(mockArchiveLogs);

      const result = await healthService.getPerformanceOverview();

      expect(result).toEqual({
        realtime: {
          queryStats: mockRealtimeStats,
        },
        historical: {
          statistics: mockHistoricalStats,
          slowestQueries: mockSlowestQueries,
          archiveLogs: mockArchiveLogs,
        },
      });
      expect(mockDbMonitorInstance.getStats).toHaveBeenCalled();
      expect(performanceArchiveDb.getArchiveStatistics).toHaveBeenCalledWith(7);
      expect(performanceArchiveDb.getArchiveLogs).toHaveBeenCalledWith(5);
    });

    it('should respect custom days parameter', async () => {
      const mockRealtimeStats: DBQueryStats[] = [];
      const mockHistoricalStats = {
        totalQueries: 1000,
        totalExecutions: 50000,
        avgDuration: 100.0,
        slowestQuery: 'SELECT * FROM huge_table',
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-30'),
        },
      };
      const mockSlowestQueries: SlowestQuery[] = [];
      const mockArchiveLogs: ArchiveLogEntry[] = [];

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue(mockRealtimeStats);
      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue(mockHistoricalStats);
      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue(mockSlowestQueries);
      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue(mockArchiveLogs);

      const result = await healthService.getPerformanceOverview(30);

      expect(result.historical.statistics).toEqual(mockHistoricalStats);
      expect(performanceArchiveDb.getArchiveStatistics).toHaveBeenCalledWith(30);
    });

    it('should handle errors from any data source', async () => {
      const dbError = new Error('Failed to retrieve overview data');

      (mockDbMonitorInstance.getStats as jest.Mock).mockRejectedValue(dbError);

      const handledStatsError = new Error('Handled stats error');
      const handledOverviewError = new Error('Handled overview error');
      (errorService.handleError as jest.Mock)
        .mockReturnValueOnce(handledStatsError)
        .mockReturnValueOnce(handledOverviewError);

      await expect(healthService.getPerformanceOverview(7)).rejects.toThrow('Handled overview error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getQueryStats(10)');
      expect(errorService.handleError).toHaveBeenCalledWith(handledStatsError, 'getPerformanceOverview(7)');
    });

    it('should calculate correct date range for slowest queries', async () => {
      const days = 14;
      const now = Date.now();
      const expectedStartTime = now - days * 24 * 60 * 60 * 1000;

      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);
      (performanceArchiveDb.getArchiveStatistics as jest.Mock).mockResolvedValue({
        totalQueries: 0,
        totalExecutions: 0,
        avgDuration: 0,
        slowestQuery: null,
        dateRange: { start: new Date(), end: new Date() },
      });
      (performanceArchiveDb.getSlowestQueries as jest.Mock).mockResolvedValue([]);
      (performanceArchiveDb.getArchiveLogs as jest.Mock).mockResolvedValue([]);

      await healthService.getPerformanceOverview(days);

      const callArgs = (performanceArchiveDb.getSlowestQueries as jest.Mock).mock.calls[0];
      const startDate = callArgs[0] as Date;
      const endDate = callArgs[1] as Date;

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(startDate.getTime() - expectedStartTime)).toBeLessThan(1000);
      expect(Math.abs(endDate.getTime() - now)).toBeLessThan(1000);
      expect(callArgs[2]).toBe(10);
    });
  });

  describe('getMonthlyPerformanceSummary', () => {
    it('should return monthly performance summary with default parameters', async () => {
      const mockSummary = [
        {
          year: 2024,
          month: 1,
          queryHash: 'abc123',
          queryTemplate: 'SELECT * FROM shows WHERE id = ?',
          totalExecutions: 1000,
          avgDurationInMillis: 50.5,
          minDurationInMillis: 10,
          maxDurationInMillis: 150,
          p50DurationInMillis: 45,
          p95DurationInMillis: 120,
          p99DurationInMillis: 140,
        },
        {
          year: 2024,
          month: 1,
          queryHash: 'def456',
          queryTemplate: 'SELECT * FROM movies WHERE id = ?',
          totalExecutions: 800,
          avgDurationInMillis: 45.2,
          minDurationInMillis: 8,
          maxDurationInMillis: 120,
          p50DurationInMillis: 40,
          p95DurationInMillis: 100,
          p99DurationInMillis: 110,
        },
      ];

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await healthService.getMonthlyPerformanceSummary();

      expect(result).toEqual(mockSummary);
      expect(performanceArchiveDb.getMonthlyPerformanceSummary).toHaveBeenCalledWith(12, 10);
    });

    it('should respect custom months and limit parameters', async () => {
      const mockSummary = [
        {
          year: 2024,
          month: 1,
          queryHash: 'abc123',
          queryTemplate: 'SELECT * FROM shows WHERE id = ?',
          totalExecutions: 1000,
          avgDurationInMillis: 50.5,
          minDurationInMillis: 10,
          maxDurationInMillis: 150,
          p50DurationInMillis: 45,
          p95DurationInMillis: 120,
          p99DurationInMillis: 140,
        },
      ];

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await healthService.getMonthlyPerformanceSummary(6, 5);

      expect(result).toEqual(mockSummary);
      expect(performanceArchiveDb.getMonthlyPerformanceSummary).toHaveBeenCalledWith(6, 5);
    });

    it('should enforce maximum months of 24', async () => {
      const mockSummary: MonthlyPerformanceSummary[] = [];

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue(mockSummary);

      await healthService.getMonthlyPerformanceSummary(100, 10);

      expect(performanceArchiveDb.getMonthlyPerformanceSummary).toHaveBeenCalledWith(24, 10);
    });

    it('should enforce maximum limit of 50', async () => {
      const mockSummary: MonthlyPerformanceSummary[] = [];

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue(mockSummary);

      await healthService.getMonthlyPerformanceSummary(12, 200);

      expect(performanceArchiveDb.getMonthlyPerformanceSummary).toHaveBeenCalledWith(12, 50);
    });

    it('should handle empty results', async () => {
      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getMonthlyPerformanceSummary();

      expect(result).toEqual([]);
    });

    it('should handle null percentile values', async () => {
      const mockSummary = [
        {
          year: 2024,
          month: 1,
          queryHash: 'abc123',
          queryTemplate: 'SELECT * FROM shows WHERE id = ?',
          totalExecutions: 1000,
          avgDurationInMillis: 50.5,
          minDurationInMillis: 10,
          maxDurationInMillis: 150,
          p50DurationInMillis: null,
          p95DurationInMillis: null,
          p99DurationInMillis: null,
        },
      ];

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await healthService.getMonthlyPerformanceSummary();

      expect(result).toEqual(mockSummary);
      expect(result[0].p50DurationInMillis).toBeNull();
      expect(result[0].p95DurationInMillis).toBeNull();
      expect(result[0].p99DurationInMillis).toBeNull();
    });

    it('should handle errors from performanceArchiveDb', async () => {
      const dbError = new Error('Failed to retrieve monthly summary');

      (performanceArchiveDb.getMonthlyPerformanceSummary as jest.Mock).mockRejectedValue(dbError);

      const handledError = new Error('Handled monthly summary error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.getMonthlyPerformanceSummary(12, 10)).rejects.toThrow('Handled monthly summary error');

      expect(errorService.handleError).toHaveBeenCalledWith(dbError, 'getMonthlyPerformanceSummary(12, 10)');
    });
  });

  describe('archiveDailyPerformanceNow', () => {
    it('should call archiveNow utility', async () => {
      (performanceArchiveUtil.archiveNow as jest.Mock).mockResolvedValue(undefined);

      await healthService.archiveDailyPerformanceNow();

      expect(performanceArchiveUtil.archiveNow).toHaveBeenCalled();
    });

    it('should handle errors from archiveNow', async () => {
      const archiveError = new Error('Failed to archive data');

      (performanceArchiveUtil.archiveNow as jest.Mock).mockRejectedValue(archiveError);

      const handledError = new Error('Handled archive error');
      (errorService.handleError as jest.Mock).mockReturnValue(handledError);

      await expect(healthService.archiveDailyPerformanceNow()).rejects.toThrow('Handled archive error');

      expect(errorService.handleError).toHaveBeenCalledWith(archiveError, 'archiveDailyPerformanceNow()');
    });
  });

  describe('HealthService singleton', () => {
    it('should export a healthService instance', () => {
      expect(healthService).toBeInstanceOf(HealthService);
    });

    it('should be callable directly', async () => {
      (mockDbMonitorInstance.getStats as jest.Mock).mockResolvedValue([]);

      const result = await healthService.getDatabaseHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
    });
  });
});
