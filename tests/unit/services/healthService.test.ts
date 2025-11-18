import { DatabaseHealthResponse } from '@ajgifford/keepwatching-types';
import { errorService } from '@services/errorService';
import { HealthService, healthService } from '@services/healthService';
import { getDbPool } from '@utils/db';
import { QueryCallHistory } from '../../../src/types/statsStore';

// Mock must be defined before it's used
const mockDbMonitorInstance = {
  executeWithTiming: jest.fn((name: string, fn: () => any) => fn()),
  getStats: jest.fn().mockResolvedValue([]),
  getQueryHistory: jest.fn().mockResolvedValue([]),
};

jest.mock('@utils/db');
jest.mock('@services/errorService');
jest.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: () => mockDbMonitorInstance,
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
      const mockHistory: QueryCallHistory[] = [];
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
