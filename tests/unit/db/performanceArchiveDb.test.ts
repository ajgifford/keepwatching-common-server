import { RedisPerformanceData } from '../../../src/types/performanceTypes';
import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as performanceArchiveDb from '@db/performanceArchiveDb';
import { DatabaseError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

describe('performanceArchiveDb Module', () => {
  let mockExecute: jest.Mock;
  let mockConnection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockConnection = mocks.mockConnection;
  });

  describe('startArchiveLog()', () => {
    it('should start a new archive log entry and return the insert ID', async () => {
      const archiveDate = new Date('2024-01-15');
      const insertResult: [ResultSetHeader, any] = [{ insertId: 1, affectedRows: 1 } as ResultSetHeader, undefined];

      mockConnection.execute.mockResolvedValueOnce(insertResult);

      const result = await performanceArchiveDb.startArchiveLog(archiveDate, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('INSERT INTO archive_execution_log');
      expect(sql).toContain('archive_date, started_at, status');
      expect(sql).toContain("VALUES (?, NOW(), 'started')");
      expect(params).toEqual([archiveDate]);
      expect(result).toBe(1);
    });

    it('should throw DatabaseError when the insert fails', async () => {
      const archiveDate = new Date('2024-01-15');
      const dbError = new Error('Database connection error');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.startArchiveLog(archiveDate, mockConnection)).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeArchiveLog()', () => {
    it('should update archive log with completion status', async () => {
      const logId = 1;
      const metricsArchived = 100;
      const queriesProcessed = 25;

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await performanceArchiveDb.completeArchiveLog(logId, metricsArchived, queriesProcessed, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('UPDATE archive_execution_log');
      expect(sql).toContain("status = 'completed'");
      expect(sql).toContain('metrics_archived = ?, queries_processed = ?');
      expect(sql).toContain('WHERE id = ?');
      expect(params).toEqual([metricsArchived, queriesProcessed, logId]);
    });

    it('should throw DatabaseError when the update fails', async () => {
      const logId = 1;
      const metricsArchived = 100;
      const queriesProcessed = 25;
      const dbError = new Error('Update failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(
        performanceArchiveDb.completeArchiveLog(logId, metricsArchived, queriesProcessed, mockConnection),
      ).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('failArchiveLog()', () => {
    it('should update archive log with failure status', async () => {
      const archiveDate = new Date('2024-01-15');
      const errorMessage = 'Archive process failed';

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await performanceArchiveDb.failArchiveLog(archiveDate, errorMessage, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('UPDATE archive_execution_log');
      expect(sql).toContain("status = 'failed'");
      expect(sql).toContain('error_message = ?');
      expect(sql).toContain("WHERE archive_date = ? AND status = 'started'");
      expect(params).toEqual([errorMessage, archiveDate]);
    });

    it('should throw DatabaseError when the update fails', async () => {
      const archiveDate = new Date('2024-01-15');
      const errorMessage = 'Archive process failed';
      const dbError = new Error('Update failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.failArchiveLog(archiveDate, errorMessage, mockConnection)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('archiveSummaryStats()', () => {
    it('should insert summary statistics successfully', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const perfData: RedisPerformanceData = {
        query: 'SELECT * FROM shows WHERE id = ?',
        executions: [],
        stats: {
          avgDuration: 15.5,
          minDuration: 10,
          maxDuration: 25,
          totalExecutions: 100,
        },
      };

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 1 } as ResultSetHeader]);

      await performanceArchiveDb.archiveSummaryStats(archiveDate, queryHash, perfData, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('INSERT INTO query_performance_daily_summary');
      expect(sql).toContain('archive_date, query_hash, query_template, total_executions');
      expect(sql).toContain('avg_duration_ms, min_duration_ms, max_duration_ms');
      expect(params).toEqual([archiveDate, queryHash, perfData.query, 100, 15.5, 10, 25]);
    });

    it('should throw DatabaseError when the insert fails', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const perfData: RedisPerformanceData = {
        query: 'SELECT * FROM shows WHERE id = ?',
        executions: [],
        stats: {
          avgDuration: 15.5,
          minDuration: 10,
          maxDuration: 25,
          totalExecutions: 100,
        },
      };
      const dbError = new Error('Insert failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(
        performanceArchiveDb.archiveSummaryStats(archiveDate, queryHash, perfData, mockConnection),
      ).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('archiveDetailedMetrics()', () => {
    it('should insert detailed metrics successfully', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const executions: RedisPerformanceData['executions'] = [
        {
          duration: 15,
          timestamp: '2024-01-15T10:00:00Z',
          endpoint: '/api/shows',
          profileId: 1,
          accountId: 2,
          content: { id: 123, type: 'show' },
          resultCount: 10,
        },
        {
          duration: 20,
          timestamp: '2024-01-15T11:00:00Z',
          endpoint: '/api/movies',
          resultCount: 5,
        },
      ];

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader]);

      await performanceArchiveDb.archiveDetailedMetrics(archiveDate, queryHash, executions, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('INSERT INTO query_performance_detailed_metrics');
      expect(sql).toContain('archive_date, query_hash, execution_time_ms, executed_at');
      expect(sql).toContain('endpoint, profile_id, account_id, content, result_count');
      expect(params).toEqual([
        archiveDate,
        queryHash,
        15,
        new Date('2024-01-15T10:00:00Z'),
        '/api/shows',
        1,
        2,
        '{"id":123,"type":"show"}',
        10,
        archiveDate,
        queryHash,
        20,
        new Date('2024-01-15T11:00:00Z'),
        '/api/movies',
        null,
        null,
        null,
        5,
      ]);
    });

    it('should handle executions with null optional fields', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const executions: RedisPerformanceData['executions'] = [
        {
          duration: 15,
          timestamp: '2024-01-15T10:00:00Z',
          endpoint: '/api/shows',
        },
      ];

      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await performanceArchiveDb.archiveDetailedMetrics(archiveDate, queryHash, executions, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockConnection.execute.mock.calls[0];
      expect(sql).toContain('INSERT INTO query_performance_detailed_metrics');
      expect(params).toEqual([
        archiveDate,
        queryHash,
        15,
        new Date('2024-01-15T10:00:00Z'),
        '/api/shows',
        null,
        null,
        null,
        null,
      ]);
    });

    it('should do nothing when executions array is empty', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const executions: RedisPerformanceData['executions'] = [];

      await performanceArchiveDb.archiveDetailedMetrics(archiveDate, queryHash, executions, mockConnection);

      expect(mockConnection.execute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the insert fails', async () => {
      const archiveDate = new Date('2024-01-15');
      const queryHash = 'abc123';
      const executions: RedisPerformanceData['executions'] = [
        {
          duration: 15,
          timestamp: '2024-01-15T10:00:00Z',
          endpoint: '/api/shows',
        },
      ];
      const dbError = new Error('Insert failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(
        performanceArchiveDb.archiveDetailedMetrics(archiveDate, queryHash, executions, mockConnection),
      ).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPerformanceTrends()', () => {
    it('should return performance trends for a query', async () => {
      const queryHash = 'abc123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRows = [
        {
          archive_date: new Date('2024-01-01'),
          total_executions: 100,
          avg_duration_ms: 15.5,
          min_duration_ms: 10,
          max_duration_ms: 25,
          p95_duration_ms: 23,
        },
        {
          archive_date: new Date('2024-01-02'),
          total_executions: 120,
          avg_duration_ms: 14.2,
          min_duration_ms: 9,
          max_duration_ms: 22,
          p95_duration_ms: 20,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getPerformanceTrends(queryHash, startDate, endDate);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `SELECT
          archive_date,
          total_executions,
          avg_duration_ms,
          min_duration_ms,
          max_duration_ms,
          p95_duration_ms
        FROM query_performance_daily_summary
        WHERE query_hash = ?
          AND archive_date BETWEEN ? AND ?
        ORDER BY archive_date ASC`,
        [queryHash, startDate, endDate],
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        archiveDate: new Date('2024-01-01'),
        totalExecutions: 100,
        avgDurationInMillis: 15.5,
        minDurationInMillis: 10,
        maxDurationInMillis: 25,
        p95DurationInMillis: 23,
      });
    });

    it('should throw DatabaseError when queryHash is missing', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await expect(performanceArchiveDb.getPerformanceTrends('', startDate, endDate)).rejects.toThrow(DatabaseError);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when startDate is missing', async () => {
      const queryHash = 'abc123';
      const endDate = new Date('2024-01-31');

      await expect(performanceArchiveDb.getPerformanceTrends(queryHash, null as any, endDate)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when endDate is missing', async () => {
      const queryHash = 'abc123';
      const startDate = new Date('2024-01-01');

      await expect(performanceArchiveDb.getPerformanceTrends(queryHash, startDate, null as any)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the query fails', async () => {
      const queryHash = 'abc123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const dbError = new Error('Query failed');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.getPerformanceTrends(queryHash, startDate, endDate)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSlowestQueries()', () => {
    it('should return slowest queries with default limit', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRows = [
        {
          query_hash: 'abc123',
          query_template: 'SELECT * FROM shows WHERE id = ?',
          total_executions: 1000,
          avg_duration_ms: 50.5,
          max_duration_ms: 150,
        },
        {
          query_hash: 'def456',
          query_template: 'SELECT * FROM movies WHERE id = ?',
          total_executions: 800,
          avg_duration_ms: 45.2,
          max_duration_ms: 120,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getSlowestQueries(startDate, endDate);

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM query_performance_daily_summary');
      expect(sql).toContain('WHERE archive_date BETWEEN ? AND ?');
      expect(sql).toContain('GROUP BY query_hash, query_template');
      expect(sql).toContain('LIMIT 10');
      expect(params).toEqual(['2024-01-01', '2024-01-31']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        queryHash: 'abc123',
        queryTemplate: 'SELECT * FROM shows WHERE id = ?',
        totalExecutions: 1000,
        avgDurationInMillis: 50.5,
        maxDurationInMillis: 150,
      });
    });

    it('should return slowest queries with custom limit', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const limit = 5;

      const mockRows = [
        {
          query_hash: 'abc123',
          query_template: 'SELECT * FROM shows WHERE id = ?',
          total_executions: 1000,
          avg_duration_ms: 50.5,
          max_duration_ms: 150,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getSlowestQueries(startDate, endDate, limit);

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('FROM query_performance_daily_summary');
      expect(sql).toContain('LIMIT 5');
      expect(params).toEqual(['2024-01-01', '2024-01-31']);
      expect(result).toHaveLength(1);
    });

    it('should throw DatabaseError when startDate is missing', async () => {
      const endDate = new Date('2024-01-31');

      await expect(performanceArchiveDb.getSlowestQueries(null as any, endDate)).rejects.toThrow(DatabaseError);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when endDate is missing', async () => {
      const startDate = new Date('2024-01-01');

      await expect(performanceArchiveDb.getSlowestQueries(startDate, null as any)).rejects.toThrow(DatabaseError);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the query fails', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const dbError = new Error('Query failed');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.getSlowestQueries(startDate, endDate)).rejects.toThrow(DatabaseError);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getArchiveLogs()', () => {
    it('should return archive logs with default limit', async () => {
      const mockRows = [
        {
          id: 1,
          archive_date: new Date('2024-01-15'),
          started_at: new Date('2024-01-15T02:00:00Z'),
          completed_at: new Date('2024-01-15T02:05:00Z'),
          status: 'completed',
          metrics_archived: 100,
          queries_processed: 25,
          error_message: null,
        },
        {
          id: 2,
          archive_date: new Date('2024-01-14'),
          started_at: new Date('2024-01-14T02:00:00Z'),
          completed_at: new Date('2024-01-14T02:03:00Z'),
          status: 'failed',
          metrics_archived: 0,
          queries_processed: 0,
          error_message: 'Connection timeout',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getArchiveLogs();

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM archive_execution_log');
      expect(sql).toContain('ORDER BY started_at DESC');
      expect(sql).toContain('LIMIT 10');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        archiveDate: new Date('2024-01-15'),
        startedAt: new Date('2024-01-15T02:00:00Z'),
        completedAt: new Date('2024-01-15T02:05:00Z'),
        status: 'completed',
        metricsArchived: 100,
        queriesProcessed: 25,
        errorMessage: null,
      });
    });

    it('should return archive logs with custom limit', async () => {
      const limit = 20;
      const mockRows = [
        {
          id: 1,
          archive_date: new Date('2024-01-15'),
          started_at: new Date('2024-01-15T02:00:00Z'),
          completed_at: new Date('2024-01-15T02:05:00Z'),
          status: 'completed',
          metrics_archived: 100,
          queries_processed: 25,
          error_message: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getArchiveLogs(limit);

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain('FROM archive_execution_log');
      expect(sql).toContain('LIMIT 20');
      expect(result).toHaveLength(1);
    });

    it('should throw DatabaseError when the query fails', async () => {
      const dbError = new Error('Query failed');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.getArchiveLogs()).rejects.toThrow(DatabaseError);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getArchiveStatistics()', () => {
    it('should return archive statistics with default days', async () => {
      const mockRows = [
        {
          total_queries: 50,
          total_executions: 10000,
          avg_duration: 25.5,
          slowest_query: 'SELECT * FROM shows WHERE id = ?',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getArchiveStatistics();

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute.mock.calls[0][0]).toContain('FROM query_performance_daily_summary');
      expect(result).toEqual({
        totalQueries: 50,
        totalExecutions: 10000,
        avgDuration: 25.5,
        slowestQuery: 'SELECT * FROM shows WHERE id = ?',
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
      });
    });

    it('should return archive statistics with custom days', async () => {
      const days = 30;
      const mockRows = [
        {
          total_queries: 100,
          total_executions: 50000,
          avg_duration: 30.2,
          slowest_query: 'SELECT * FROM movies WHERE id = ?',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getArchiveStatistics(days);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        totalQueries: 100,
        totalExecutions: 50000,
        avgDuration: 30.2,
        slowestQuery: 'SELECT * FROM movies WHERE id = ?',
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
      });
    });

    it('should handle null values in the result', async () => {
      const mockRows = [
        {
          total_queries: null,
          total_executions: null,
          avg_duration: null,
          slowest_query: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getArchiveStatistics();

      expect(result).toEqual({
        totalQueries: 0,
        totalExecutions: 0,
        avgDuration: 0,
        slowestQuery: null,
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
      });
    });

    it('should throw DatabaseError when the query fails', async () => {
      const dbError = new Error('Query failed');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.getArchiveStatistics()).rejects.toThrow(DatabaseError);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupOldDetailedMetrics()', () => {
    it('should delete old detailed metrics and return affected rows', async () => {
      const retentionDays = 30;
      const deleteResult: [ResultSetHeader, any] = [{ affectedRows: 150 } as ResultSetHeader, undefined];

      mockConnection.execute.mockResolvedValueOnce(deleteResult);

      const result = await performanceArchiveDb.cleanupOldDetailedMetrics(retentionDays, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute.mock.calls[0][0]).toContain('DELETE FROM query_performance_detailed_metrics');
      expect(mockConnection.execute.mock.calls[0][0]).toContain('WHERE archive_date < ?');
      expect(result).toBe(150);
    });

    it('should return zero when no rows are deleted', async () => {
      const retentionDays = 30;
      const deleteResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockConnection.execute.mockResolvedValueOnce(deleteResult);

      const result = await performanceArchiveDb.cleanupOldDetailedMetrics(retentionDays, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(0);
    });

    it('should throw DatabaseError when the delete fails', async () => {
      const retentionDays = 30;
      const dbError = new Error('Delete failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.cleanupOldDetailedMetrics(retentionDays, mockConnection)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupOldDailySummaries()', () => {
    it('should delete old daily summaries and return affected rows', async () => {
      const retentionDays = 90;
      const deleteResult: [ResultSetHeader, any] = [{ affectedRows: 50 } as ResultSetHeader, undefined];

      mockConnection.execute.mockResolvedValueOnce(deleteResult);

      const result = await performanceArchiveDb.cleanupOldDailySummaries(retentionDays, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute.mock.calls[0][0]).toContain('DELETE FROM query_performance_daily_summary');
      expect(mockConnection.execute.mock.calls[0][0]).toContain('WHERE archive_date < ?');
      expect(result).toBe(50);
    });

    it('should return zero when no rows are deleted', async () => {
      const retentionDays = 90;
      const deleteResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];

      mockConnection.execute.mockResolvedValueOnce(deleteResult);

      const result = await performanceArchiveDb.cleanupOldDailySummaries(retentionDays, mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(0);
    });

    it('should throw DatabaseError when the delete fails', async () => {
      const retentionDays = 90;
      const dbError = new Error('Delete failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.cleanupOldDailySummaries(retentionDays, mockConnection)).rejects.toThrow(
        DatabaseError,
      );

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('aggregateMonthlyPerformance()', () => {
    it('should aggregate monthly performance and return month count', async () => {
      const insertResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];
      const countRows = [{ month_count: 3 } as RowDataPacket];

      mockConnection.execute.mockResolvedValueOnce(insertResult).mockResolvedValueOnce([countRows]);

      const result = await performanceArchiveDb.aggregateMonthlyPerformance(mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute.mock.calls[0][0]).toContain('INSERT INTO query_performance_monthly_summary');
      expect(mockConnection.execute.mock.calls[0][0]).toContain('ON DUPLICATE KEY UPDATE');
      expect(mockConnection.execute.mock.calls[1][0]).toContain('SELECT COUNT(DISTINCT');
      expect(result).toBe(3);
    });

    it('should include current month in aggregation (no date restriction)', async () => {
      const insertResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];
      const countRows = [{ month_count: 3 } as RowDataPacket];

      mockConnection.execute.mockResolvedValueOnce(insertResult).mockResolvedValueOnce([countRows]);

      await performanceArchiveDb.aggregateMonthlyPerformance(mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      const insertSql = mockConnection.execute.mock.calls[0][0];
      
      // Verify the SQL does NOT contain the old WHERE clause that excluded the current month
      expect(insertSql).not.toContain("WHERE archive_date < DATE_FORMAT(NOW(), '%Y-%m-01')");
      
      // Verify it contains the GROUP BY clause (which aggregates all months)
      expect(insertSql).toContain('GROUP BY YEAR(archive_date), MONTH(archive_date), query_hash, query_template');
    });

    it('should return zero when no months are aggregated', async () => {
      const insertResult: [ResultSetHeader, any] = [{ affectedRows: 0 } as ResultSetHeader, undefined];
      const countRows: RowDataPacket[] = [];

      mockConnection.execute.mockResolvedValueOnce(insertResult).mockResolvedValueOnce([countRows]);

      const result = await performanceArchiveDb.aggregateMonthlyPerformance(mockConnection);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(result).toBe(0);
    });

    it('should throw DatabaseError when the aggregation fails', async () => {
      const dbError = new Error('Aggregation failed');

      mockConnection.execute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.aggregateMonthlyPerformance(mockConnection)).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw DatabaseError when the count query fails', async () => {
      const insertResult: [ResultSetHeader, any] = [{ affectedRows: 1 } as ResultSetHeader, undefined];
      const dbError = new Error('Count query failed');

      mockConnection.execute.mockResolvedValueOnce(insertResult).mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.aggregateMonthlyPerformance(mockConnection)).rejects.toThrow(DatabaseError);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMonthlyPerformanceSummary()', () => {
    it('should return monthly performance summary with default parameters', async () => {
      const mockRows = [
        {
          year: 2024,
          month: 1,
          query_hash: 'abc123',
          query_template: 'SELECT * FROM shows WHERE id = ?',
          total_executions: 1000,
          avg_duration_ms: 50.5,
          min_duration_ms: 10,
          max_duration_ms: 150,
          p50_duration_ms: 45,
          p95_duration_ms: 120,
          p99_duration_ms: 140,
        },
        {
          year: 2024,
          month: 1,
          query_hash: 'def456',
          query_template: 'SELECT * FROM movies WHERE id = ?',
          total_executions: 800,
          avg_duration_ms: 45.2,
          min_duration_ms: 8,
          max_duration_ms: 120,
          p50_duration_ms: 40,
          p95_duration_ms: 100,
          p99_duration_ms: 110,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getMonthlyPerformanceSummary();

      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM query_performance_monthly_summary');
      expect(sql).toContain('ROW_NUMBER() OVER');
      expect(sql).toContain('PARTITION BY year, month');
      expect(sql).toContain('ORDER BY avg_duration_ms DESC');
      expect(sql).toContain('WHERE (year > ? OR (year = ? AND month >= ?))');
      expect(sql).toContain('WHERE rn <= ?');
      expect(params).toHaveLength(4);
      expect(params[3]).toBe(10); // Default limit

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
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
      });
      expect(result[1]).toEqual({
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
      });
    });

    it('should return monthly performance summary with custom months and limit', async () => {
      const months = 6;
      const limit = 5;
      const mockRows = [
        {
          year: 2024,
          month: 1,
          query_hash: 'abc123',
          query_template: 'SELECT * FROM shows WHERE id = ?',
          total_executions: 1000,
          avg_duration_ms: 50.5,
          min_duration_ms: 10,
          max_duration_ms: 150,
          p50_duration_ms: 45,
          p95_duration_ms: 120,
          p99_duration_ms: 140,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getMonthlyPerformanceSummary(months, limit);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('FROM query_performance_monthly_summary');
      expect(params).toHaveLength(4);
      expect(params[3]).toBe(5); // Custom limit
      expect(result).toHaveLength(1);
    });

    it('should handle null percentile values', async () => {
      const mockRows = [
        {
          year: 2024,
          month: 1,
          query_hash: 'abc123',
          query_template: 'SELECT * FROM shows WHERE id = ?',
          total_executions: 1000,
          avg_duration_ms: 50.5,
          min_duration_ms: 10,
          max_duration_ms: 150,
          p50_duration_ms: null,
          p95_duration_ms: null,
          p99_duration_ms: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getMonthlyPerformanceSummary();

      expect(result).toHaveLength(1);
      expect(result[0].p50DurationInMillis).toBeNull();
      expect(result[0].p95DurationInMillis).toBeNull();
      expect(result[0].p99DurationInMillis).toBeNull();
    });

    it('should return empty array when no data exists', async () => {
      const mockRows: any[] = [];

      mockExecute.mockResolvedValueOnce([mockRows]);

      const result = await performanceArchiveDb.getMonthlyPerformanceSummary();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError when months is zero', async () => {
      await expect(performanceArchiveDb.getMonthlyPerformanceSummary(0, 10)).rejects.toThrow(DatabaseError);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when months is negative', async () => {
      await expect(performanceArchiveDb.getMonthlyPerformanceSummary(-5, 10)).rejects.toThrow(DatabaseError);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when limit is zero', async () => {
      await expect(performanceArchiveDb.getMonthlyPerformanceSummary(12, 0)).rejects.toThrow(DatabaseError);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when limit is negative', async () => {
      await expect(performanceArchiveDb.getMonthlyPerformanceSummary(12, -5)).rejects.toThrow(DatabaseError);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when the query fails', async () => {
      const dbError = new Error('Query failed');

      mockExecute.mockRejectedValueOnce(dbError);

      await expect(performanceArchiveDb.getMonthlyPerformanceSummary()).rejects.toThrow(DatabaseError);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });
});
