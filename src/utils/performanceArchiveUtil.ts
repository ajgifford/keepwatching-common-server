/**
 * Utility for archiving query performance metrics from DbMonitor to MySQL
 * This utility reads from the current Redis/in-memory store and archives to MySQL
 */
import { getPerformanceRetentionConfig } from '../config/config';
import * as performanceArchiveDb from '../db/performanceArchiveDb';
import { appLogger, cliLogger } from '../logger/logger';
import { errorService } from '../services/errorService';
import { DbMonitor } from './dbMonitoring';
import { TransactionHelper } from './transactionHelper';
import { PoolConnection } from 'mysql2/promise';

/**
 * Archives summary statistics for a query from DbMonitor data
 */
async function archiveSummaryStatsFromMonitor(
  archiveDate: Date,
  queryName: string,
  connection: PoolConnection,
): Promise<void> {
  const dbMonitor = DbMonitor.getInstance();
  const history = await dbMonitor.getQueryHistory(queryName, 10000); // Get all history for the day

  if (history.length === 0) return;

  // Calculate statistics
  const durations = history.map((h) => h.executionTime);
  const totalExecutions = history.length;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / totalExecutions;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  // Calculate percentiles
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p50Index = Math.floor(sortedDurations.length * 0.5);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p99Index = Math.floor(sortedDurations.length * 0.99);

  const p50Duration = sortedDurations[p50Index] || null;
  const p95Duration = sortedDurations[p95Index] || null;
  const p99Duration = sortedDurations[p99Index] || null;

  await connection.execute(
    `INSERT INTO query_performance_daily_summary 
     (archive_date, query_hash, query_template, total_executions, 
      avg_duration_ms, min_duration_ms, max_duration_ms, 
      p50_duration_ms, p95_duration_ms, p99_duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      archiveDate,
      queryName, // Using queryName as hash for now
      queryName, // Using queryName as template for now
      totalExecutions,
      avgDuration,
      minDuration,
      maxDuration,
      p50Duration,
      p95Duration,
      p99Duration,
    ],
  );
}

/**
 * Archives detailed execution metrics for a query from DbMonitor data
 */
async function archiveDetailedMetricsFromMonitor(
  archiveDate: Date,
  queryName: string,
  connection: PoolConnection,
): Promise<number> {
  const dbMonitor = DbMonitor.getInstance();
  const history = await dbMonitor.getQueryHistory(queryName, 10000); // Get all history for the day

  if (history.length === 0) return 0;

  const detailValues: Array<
    [Date, string, number, Date, string | null, number | null, number | null, string | null, number | null]
  > = [];

  for (const execution of history) {
    detailValues.push([
      archiveDate,
      queryName, // Using queryName as hash
      execution.executionTime,
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

  return detailValues.length;
}

/**
 * Main archive method - exports all DbMonitor performance data to MySQL,
 * clears Redis stats to prevent duplication, and cleans up old data based on retention policy.
 * Typically runs at 11:59 PM daily to archive the previous day's data and start fresh.
 */
export async function archiveDailyPerformance(): Promise<void> {
  const dbMonitor = DbMonitor.getInstance();
  const storeInfo = dbMonitor.getStoreInfo();

  if (storeInfo.isRedis && !storeInfo.connected) {
    cliLogger.warn('Cannot archive: Redis client not ready');
    return;
  }

  const archiveDate = new Date();
  archiveDate.setHours(0, 0, 0, 0); // Start of current day

  const retentionConfig = getPerformanceRetentionConfig();
  const helper = new TransactionHelper();

  try {
    await helper.executeInTransaction(async (connection) => {
      // Start archive log
      const logId = await performanceArchiveDb.startArchiveLog(archiveDate, connection);

      // Get all query names from DbMonitor
      const queryNames = await dbMonitor.getAllQueryNames();
      let metricsArchived = 0;
      let queriesProcessed = 0;

      for (const queryName of queryNames) {
        // Archive summary statistics
        await archiveSummaryStatsFromMonitor(archiveDate, queryName, connection);

        // Archive detailed execution metrics
        const metricCount = await archiveDetailedMetricsFromMonitor(archiveDate, queryName, connection);

        metricsArchived += metricCount;
        queriesProcessed++;
      }

      // Aggregate daily summaries into monthly summaries for long-term retention
      const monthsAggregated = await performanceArchiveDb.aggregateMonthlyPerformance(connection);

      // Clean up old data based on retention policy
      const detailedMetricsDeleted = await performanceArchiveDb.cleanupOldDetailedMetrics(
        retentionConfig.detailedMetricsDays,
        connection,
      );

      const dailySummariesDeleted = await performanceArchiveDb.cleanupOldDailySummaries(
        retentionConfig.dailySummaryDays,
        connection,
      );

      // Update log with completion
      await performanceArchiveDb.completeArchiveLog(logId, metricsArchived, queriesProcessed, connection);

      cliLogger.info(
        `Archive completed: ${queriesProcessed} queries, ${metricsArchived} metrics archived, ` +
          `${monthsAggregated} months aggregated, ` +
          `${detailedMetricsDeleted} detailed metrics deleted, ${dailySummariesDeleted} summaries deleted`,
      );
    });

    // Clear Redis stats after successful archive to prevent duplication and start fresh for new day
    await dbMonitor.clearStats();
    cliLogger.info('Redis stats cleared after successful archive');
  } catch (error) {
    await helper.executeInTransaction(async (connection) => {
      // Log failure
      await performanceArchiveDb.failArchiveLog(
        archiveDate,
        error instanceof Error ? error.message : String(error),
        connection,
      );
    });

    appLogger.error('Archive failed:', error);
    throw errorService.handleError(error, 'archiveDailyPerformance()');
  }
}

/**
 * Manual archive trigger (useful for testing or immediate backup)
 */
export async function archiveNow(): Promise<void> {
  try {
    cliLogger.info('Manual archive triggered');
    await archiveDailyPerformance();
  } catch (error) {
    throw errorService.handleError(error, 'archiveNow()');
  }
}
