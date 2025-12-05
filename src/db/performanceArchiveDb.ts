import { DatabaseError } from '../middleware/errorMiddleware';
import {
  ArchiveLogEntryRow,
  DailySummaryRow,
  MonthlyPerformanceSummaryRow,
  RedisPerformanceData,
  SlowestQueryRow,
  translateArchiveLogEntryRow,
  translateDailySummaryRow,
  translateMonthlyPerformanceSummaryRow,
  translateSlowestQueryRow,
} from '../types/performanceTypes';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { ArchiveLogEntry, ArchiveStatistics, DailySummary, MonthlyPerformanceSummary, SlowestQuery } from '@ajgifford/keepwatching-types';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * Starts a new archive log entry
 * @param archiveDate - Date being archived
 * @param connection - Database connection to use (for transaction support)
 * @returns The ID of the created log entry
 */
export async function startArchiveLog(archiveDate: Date, connection: PoolConnection): Promise<number> {
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO archive_execution_log 
       (archive_date, started_at, status) 
       VALUES (?, NOW(), 'started')`,
      [archiveDate],
    );
    return result.insertId;
  } catch (error) {
    handleDatabaseError(error, 'starting archive log');
  }
}

/**
 * Updates archive log with completion status
 * @param logId - ID of the log entry to update
 * @param metricsArchived - Number of metrics archived
 * @param queriesProcessed - Number of queries processed
 * @param connection - Database connection to use (for transaction support)
 */
export async function completeArchiveLog(
  logId: number,
  metricsArchived: number,
  queriesProcessed: number,
  connection: PoolConnection,
): Promise<void> {
  try {
    await connection.execute(
      `UPDATE archive_execution_log 
       SET completed_at = NOW(), status = 'completed', 
           metrics_archived = ?, queries_processed = ?
       WHERE id = ?`,
      [metricsArchived, queriesProcessed, logId],
    );
  } catch (error) {
    handleDatabaseError(error, 'completing archive log');
  }
}

/**
 * Updates archive log with failure status
 * @param archiveDate - Date being archived
 * @param errorMessage - Error message to log
 * @param connection - Database connection to use (for transaction support)
 */
export async function failArchiveLog(
  archiveDate: Date,
  errorMessage: string,
  connection: PoolConnection,
): Promise<void> {
  try {
    await connection.execute(
      `UPDATE archive_execution_log 
       SET completed_at = NOW(), status = 'failed', 
           error_message = ?
       WHERE archive_date = ? AND status = 'started'
       ORDER BY started_at DESC LIMIT 1`,
      [errorMessage, archiveDate],
    );
  } catch (error) {
    handleDatabaseError(error, 'failing archive log');
  }
}

/**
 * Archives summary statistics for a query
 * @param archiveDate - Date being archived
 * @param queryHash - Hash of the query
 * @param perfData - Performance data from Redis
 * @param connection - Database connection to use (for transaction support)
 */
export async function archiveSummaryStats(
  archiveDate: Date,
  queryHash: string,
  perfData: RedisPerformanceData,
  connection: PoolConnection,
): Promise<void> {
  try {
    await connection.execute(
      `INSERT INTO query_performance_daily_summary 
       (archive_date, query_hash, query_template, total_executions, 
        avg_duration_ms, min_duration_ms, max_duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        archiveDate,
        queryHash,
        perfData.query,
        perfData.stats.totalExecutions,
        perfData.stats.avgDuration,
        perfData.stats.minDuration,
        perfData.stats.maxDuration,
      ],
    );
  } catch (error) {
    handleDatabaseError(error, 'archiving summary statistics');
  }
}

/**
 * Archives detailed execution metrics for a query
 * @param archiveDate - Date being archived
 * @param queryHash - Hash of the query
 * @param executions - Array of execution data
 * @param connection - Database connection to use (for transaction support)
 */
export async function archiveDetailedMetrics(
  archiveDate: Date,
  queryHash: string,
  executions: RedisPerformanceData['executions'],
  connection: PoolConnection,
): Promise<void> {
  if (executions.length === 0) return;

  try {
    const detailValues: Array<
      [Date, string, number, Date, string | null, number | null, number | null, string | null, number | null]
    > = [];

    for (const execution of executions) {
      detailValues.push([
        archiveDate,
        queryHash,
        execution.duration,
        new Date(execution.timestamp),
        execution.endpoint || null,
        execution.profileId || null,
        execution.accountId || null,
        execution.content ? JSON.stringify(execution.content) : null,
        execution.resultCount || null,
      ]);
    }

    // Batch insert for better performance
    const placeholders = detailValues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    await connection.execute(
      `INSERT INTO query_performance_detailed_metrics
       (archive_date, query_hash, execution_time_ms, executed_at,
        endpoint, profile_id, account_id, content, result_count)
       VALUES ${placeholders}`,
      detailValues.flat(),
    );
  } catch (error) {
    handleDatabaseError(error, 'archiving detailed metrics');
  }
}

/**
 * Gets performance trends over time for a specific query
 * @param queryHash - Hash of the query
 * @param startDate - Start date for the range
 * @param endDate - End date for the range
 * @returns Array of daily summary records
 */
export async function getPerformanceTrends(queryHash: string, startDate: Date, endDate: Date): Promise<DailySummary[]> {
  if (!queryHash || !startDate || !endDate) {
    throw new DatabaseError('Invalid parameters: queryHash, startDate, and endDate are required', null);
  }

  try {
    return await DbMonitor.getInstance().executeWithTiming('getPerformanceTrends', async () => {
      const [rows] = await getDbPool().execute<DailySummaryRow[]>(
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

      return rows.map(translateDailySummaryRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting performance trends');
  }
}

/**
 * Gets the slowest queries for a date range
 * @param startDate - Start date for the range
 * @param endDate - End date for the range
 * @param limit - Maximum number of results to return
 * @returns Array of slowest query records
 */
export async function getSlowestQueries(startDate: Date, endDate: Date, limit: number = 10): Promise<SlowestQuery[]> {
  if (!startDate || !endDate) {
    throw new DatabaseError('Invalid parameters: startDate and endDate are required', null);
  }

  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  const params = [start, end];

  try {
    return await DbMonitor.getInstance().executeWithTiming('getSlowestQueries', async () => {
      const [rows] = await getDbPool().execute<SlowestQueryRow[]>(
        `SELECT 
          query_hash,
          query_template,
          SUM(total_executions) as total_executions,
          AVG(avg_duration_ms) as avg_duration_ms,
          MAX(max_duration_ms) as max_duration_ms
        FROM query_performance_daily_summary
        WHERE archive_date BETWEEN ? AND ?
        GROUP BY query_hash, query_template
        ORDER BY avg_duration_ms DESC
        LIMIT ${limit}`,
        params,
      );

      return rows.map(translateSlowestQueryRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting slowest queries');
  }
}

/**
 * Gets the most recent archive execution logs
 * @param limit - Maximum number of log entries to return
 * @returns Array of archive log entries
 */
export async function getArchiveLogs(limit: number = 10): Promise<ArchiveLogEntry[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getArchiveLogs', async () => {
      const [rows] = await getDbPool().execute<ArchiveLogEntryRow[]>(
        `SELECT 
          id,
          archive_date,
          started_at,
          completed_at,
          status,
          metrics_archived,
          queries_processed,
          error_message
        FROM archive_execution_log
        ORDER BY started_at DESC
        LIMIT ${limit}`,
      );

      return rows.map(translateArchiveLogEntryRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting archive logs');
  }
}

/**
 * Gets aggregate statistics from the archived performance data
 * @param days - Number of days to look back (default: 7)
 * @returns Aggregate statistics
 */
export async function getArchiveStatistics(days: number = 7): Promise<ArchiveStatistics> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getArchiveStatistics', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [rows] = await getDbPool().execute<RowDataPacket[]>(
        `SELECT
          COUNT(DISTINCT query_hash) as total_queries,
          SUM(total_executions) as total_executions,
          AVG(avg_duration_ms) as avg_duration,
          (
            SELECT query_template
            FROM query_performance_daily_summary
            WHERE archive_date BETWEEN ? AND ?
            ORDER BY avg_duration_ms DESC
            LIMIT 1
          ) as slowest_query
        FROM query_performance_daily_summary
        WHERE archive_date BETWEEN ? AND ?`,
        [
          startDate.toISOString().slice(0, 10),
          endDate.toISOString().slice(0, 10),
          startDate.toISOString().slice(0, 10),
          endDate.toISOString().slice(0, 10),
        ],
      );

      const result = rows[0];
      return {
        totalQueries: result.total_queries || 0,
        totalExecutions: result.total_executions || 0,
        avgDuration: result.avg_duration || 0,
        slowestQuery: result.slowest_query || null,
        dateRange: { start: startDate, end: endDate },
      };
    });
  } catch (error) {
    handleDatabaseError(error, 'getting archive statistics');
  }
}

/**
 * Deletes detailed metrics older than the specified number of days
 * @param retentionDays - Number of days to retain detailed metrics
 * @param connection - Database connection to use (for transaction support)
 * @returns Number of rows deleted
 */
export async function cleanupOldDetailedMetrics(retentionDays: number, connection: PoolConnection): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM query_performance_detailed_metrics
       WHERE archive_date < ?`,
      [cutoffDate.toISOString().slice(0, 10)],
    );

    return result.affectedRows;
  } catch (error) {
    handleDatabaseError(error, 'cleaning up old detailed metrics');
  }
}

/**
 * Deletes daily summaries older than the specified number of days
 * @param retentionDays - Number of days to retain daily summaries
 * @param connection - Database connection to use (for transaction support)
 * @returns Number of rows deleted
 */
export async function cleanupOldDailySummaries(retentionDays: number, connection: PoolConnection): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM query_performance_daily_summary
       WHERE archive_date < ?`,
      [cutoffDate.toISOString().slice(0, 10)],
    );

    return result.affectedRows;
  } catch (error) {
    handleDatabaseError(error, 'cleaning up old daily summaries');
  }
}

/**
 * Creates or updates monthly aggregated performance summaries
 * This aggregates daily summaries into monthly rollups for long-term retention
 * @param connection - Database connection to use (for transaction support)
 * @returns Number of months aggregated
 */
export async function aggregateMonthlyPerformance(connection: PoolConnection): Promise<number> {
  try {
    // Aggregate daily summaries into monthly summaries
    // Only aggregate complete months (not the current month)
    await connection.execute(
      `INSERT INTO query_performance_monthly_summary
       (year, month, query_hash, query_template, total_executions,
        avg_duration_ms, min_duration_ms, max_duration_ms,
        p50_duration_ms, p95_duration_ms, p99_duration_ms)
       SELECT
         YEAR(archive_date) as year,
         MONTH(archive_date) as month,
         query_hash,
         query_template,
         SUM(total_executions) as total_executions,
         AVG(avg_duration_ms) as avg_duration_ms,
         MIN(min_duration_ms) as min_duration_ms,
         MAX(max_duration_ms) as max_duration_ms,
         AVG(p50_duration_ms) as p50_duration_ms,
         AVG(p95_duration_ms) as p95_duration_ms,
         AVG(p99_duration_ms) as p99_duration_ms
       FROM query_performance_daily_summary
       WHERE archive_date < DATE_FORMAT(NOW(), '%Y-%m-01')
       GROUP BY YEAR(archive_date), MONTH(archive_date), query_hash, query_template
       ON DUPLICATE KEY UPDATE
         total_executions = VALUES(total_executions),
         avg_duration_ms = VALUES(avg_duration_ms),
         min_duration_ms = VALUES(min_duration_ms),
         max_duration_ms = VALUES(max_duration_ms),
         p50_duration_ms = VALUES(p50_duration_ms),
         p95_duration_ms = VALUES(p95_duration_ms),
         p99_duration_ms = VALUES(p99_duration_ms),
         updated_at = NOW()`,
    );

    // Count distinct months that were aggregated
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT CONCAT(year, '-', month)) as month_count
       FROM query_performance_monthly_summary`,
    );

    return rows[0]?.month_count || 0;
  } catch (error) {
    handleDatabaseError(error, 'aggregating monthly performance');
  }
}

/**
 * Gets monthly performance summary data for long-term trend analysis
 * @param months - Number of months to retrieve (default: 12, max: 24)
 * @param limit - Maximum number of queries to return per month (default: 10)
 * @returns Array of monthly performance summaries ordered by year/month descending
 */
export async function getMonthlyPerformanceSummary(
  months: number = 12,
  limit: number = 10,
): Promise<MonthlyPerformanceSummary[]> {
  if (months <= 0 || limit <= 0) {
    throw new DatabaseError('Invalid parameters: months and limit must be positive integers', null);
  }

  try {
    return await DbMonitor.getInstance().executeWithTiming('getMonthlyPerformanceSummary', async () => {
      // Calculate the cutoff date (N months ago)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      const cutoffYear = cutoffDate.getFullYear();
      const cutoffMonth = cutoffDate.getMonth() + 1; // JS months are 0-indexed

      const [rows] = await getDbPool().execute<MonthlyPerformanceSummaryRow[]>(
        `SELECT
          year,
          month,
          query_hash,
          query_template,
          total_executions,
          avg_duration_ms,
          min_duration_ms,
          max_duration_ms,
          p50_duration_ms,
          p95_duration_ms,
          p99_duration_ms
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY year, month
              ORDER BY avg_duration_ms DESC
            ) as rn
          FROM query_performance_monthly_summary
          WHERE (year > ? OR (year = ? AND month >= ?))
        ) ranked
        WHERE rn <= ?
        ORDER BY year DESC, month DESC, avg_duration_ms DESC`,
        [cutoffYear, cutoffYear, cutoffMonth, limit],
      );

      return rows.map(translateMonthlyPerformanceSummaryRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting monthly performance summary');
  }
}
