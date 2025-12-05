import * as performanceArchiveDb from '../db/performanceArchiveDb';
import { PERFORMANCE_KEYS } from '../constants/cacheKeys';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { errorService } from './errorService';
import { CacheService } from './cacheService';
import {
  ArchiveLogEntry,
  DBQueryCallHistory,
  DBQueryStats,
  DailySummary,
  DatabaseHealthResponse,
  MonthlyPerformanceSummary,
  QueryPerformanceOverview,
  SlowestQuery,
} from '@ajgifford/keepwatching-types';
import { archiveNow } from '@utils/performanceArchiveUtil';

export class HealthService {
  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: object) {
    // No dependencies currently, but keeping pattern consistent
    void dependencies;
  }

  public async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    try {
      const pool = getDbPool();
      const connection = await pool.getConnection();

      await connection.ping();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalPool = pool.pool as any;
      const poolStats = {
        totalConnections: pool.pool.config.connectionLimit,
        activeConnections: internalPool._allConnections?.length ?? 0,
        freeConnections: internalPool._freeConnections?.length ?? 0,
      };

      connection.release();

      return {
        status: 'healthy',
        pool: poolStats,
        queryStats: (await DbMonitor.getInstance().getStats()).slice(0, 10), // Top 10 queries
      } as DatabaseHealthResponse;
    } catch (error) {
      throw errorService.handleError(error, `getDatabaseHealth()`);
    }
  }

  public async getQueryStats(limit: number = 30): Promise<DBQueryStats[]> {
    try {
      const effectiveLimit = Math.min(limit, 50);
      const stats = await DbMonitor.getInstance().getStats();
      return stats.slice(0, effectiveLimit);
    } catch (error) {
      throw errorService.handleError(error, `getQueryStats(${limit})`);
    }
  }

  /**
   * Retrieves call history for a specific query.
   * This provides detailed execution information for monitoring and debugging.
   *
   * @param queryName - Name of the database query to retrieve history for
   * @param limit - Maximum number of history entries to return (default: 100, max: 1000)
   * @returns Array of query execution history entries
   */
  public async getQueryHistory(queryName: string, limit: number = 100): Promise<DBQueryCallHistory[]> {
    try {
      // Enforce maximum limit
      const effectiveLimit = Math.min(limit, 1000);
      return await DbMonitor.getInstance().getQueryHistory(queryName, effectiveLimit);
    } catch (error) {
      throw errorService.handleError(error, `getQueryHistory(${queryName})`);
    }
  }

  /**
   * Gets historical performance trends for a specific query from archived data
   * Results are cached for 30 minutes to reduce database load
   * @param queryHash - Hash of the query to get trends for
   * @param startDate - Start date for the range
   * @param endDate - End date for the range
   * @returns Array of daily performance trends
   */
  public async getHistoricalPerformanceTrends(
    queryHash: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailySummary[]> {
    try {
      const cacheKey = PERFORMANCE_KEYS.historicalTrends(
        queryHash,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
      );
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          return await performanceArchiveDb.getPerformanceTrends(queryHash, startDate, endDate);
        },
        1800, // Cache for 30 minutes (1800 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getHistoricalPerformanceTrends(${queryHash}, ${startDate}, ${endDate})`);
    }
  }

  /**
   * Gets the slowest queries from archived data for a date range
   * Results are cached for 30 minutes to reduce database load
   * @param startDate - Start date for the range
   * @param endDate - End date for the range
   * @param limit - Maximum number of results to return (default: 10)
   * @returns Array of slowest queries
   */
  public async getHistoricalSlowestQueries(
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<SlowestQuery[]> {
    try {
      const cacheKey = PERFORMANCE_KEYS.historicalSlowest(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        limit,
      );
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          return await performanceArchiveDb.getSlowestQueries(startDate, endDate, limit);
        },
        1800, // Cache for 30 minutes (1800 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getHistoricalSlowestQueries(${startDate}, ${endDate}, ${limit})`);
    }
  }

  /**
   * Gets the archive execution logs showing history of daily archiving operations
   * Results are cached for 15 minutes to reduce database load
   * @param limit - Maximum number of log entries to return (default: 10)
   * @returns Array of archive log entries
   */
  public async getArchiveLogs(limit: number = 10): Promise<ArchiveLogEntry[]> {
    try {
      const cacheKey = PERFORMANCE_KEYS.archiveLogs(limit);
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          return await performanceArchiveDb.getArchiveLogs(limit);
        },
        900, // Cache for 15 minutes (900 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getArchiveLogs(${limit})`);
    }
  }

  /**
   * Gets aggregate statistics from archived performance data
   * Results are cached for 30 minutes to reduce database load
   * @param days - Number of days to look back (default: 7, max: 90)
   * @returns Aggregate performance statistics
   */
  public async getArchiveStatistics(days: number = 7): Promise<{
    totalQueries: number;
    totalExecutions: number;
    avgDuration: number;
    slowestQuery: string | null;
    dateRange: { start: Date; end: Date };
  }> {
    try {
      // Enforce maximum lookback period
      const effectiveDays = Math.min(days, 90);
      const cacheKey = PERFORMANCE_KEYS.archiveStatistics(effectiveDays);
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          return await performanceArchiveDb.getArchiveStatistics(effectiveDays);
        },
        1800, // Cache for 30 minutes (1800 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getArchiveStatistics(${days})`);
    }
  }

  /**
   * Gets comprehensive performance overview combining real-time and historical data
   * Results are cached for 15 minutes to reduce database load
   * @param days - Number of days to look back for historical data (default: 7)
   * @returns Combined performance overview
   */
  public async getPerformanceOverview(days: number = 7): Promise<QueryPerformanceOverview> {
    try {
      const cacheKey = PERFORMANCE_KEYS.performanceOverview(days);
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const endDate = new Date();

          const [realtimeStats, historicalStats, slowestQueries, archiveLogs] = await Promise.all([
            this.getQueryStats(10),
            this.getArchiveStatistics(days),
            this.getHistoricalSlowestQueries(startDate, endDate, 10),
            this.getArchiveLogs(5),
          ]);

          return {
            realtime: {
              queryStats: realtimeStats,
            },
            historical: {
              statistics: historicalStats,
              slowestQueries,
              archiveLogs,
            },
          };
        },
        900, // Cache for 15 minutes (900 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getPerformanceOverview(${days})`);
    }
  }

  /**
   * Gets monthly performance summary data for long-term trend analysis
   * Results are cached for 1 hour to reduce database load
   * @param months - Number of months to retrieve (default: 12, max: 24)
   * @param limit - Maximum number of queries to return per month (default: 10)
   * @returns Array of monthly performance summaries
   */
  public async getMonthlyPerformanceSummary(
    months: number = 12,
    limit: number = 10,
  ): Promise<MonthlyPerformanceSummary[]> {
    try {
      // Enforce maximum lookback period
      const effectiveMonths = Math.min(months, 24);
      const effectiveLimit = Math.min(limit, 50);

      const cacheKey = PERFORMANCE_KEYS.monthlySummary(effectiveMonths, effectiveLimit);
      const cache = CacheService.getInstance();

      return await cache.getOrSet(
        cacheKey,
        async () => {
          return await performanceArchiveDb.getMonthlyPerformanceSummary(effectiveMonths, effectiveLimit);
        },
        3600, // Cache for 1 hour (3600 seconds)
      );
    } catch (error) {
      throw errorService.handleError(error, `getMonthlyPerformanceSummary(${months}, ${limit})`);
    }
  }

  /**
   * Archives the daily performance data manually
   */
  public async archiveDailyPerformanceNow(): Promise<void> {
    try {
      await archiveNow();
    } catch (error) {
      throw errorService.handleError(error, `archiveDailyPerformanceNow()`);
    }
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createHealthService(dependencies?: object): HealthService {
  return new HealthService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: HealthService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getHealthService(): HealthService {
  if (!instance) {
    instance = createHealthService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetHealthService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { healthService }` continues to work
 */
export const healthService = getHealthService();
