import { ArchiveLogEntry, DailySummary, SlowestQuery } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Interface for Redis performance data structure
 */
export interface RedisPerformanceData {
  query: string;
  executions: Array<{
    duration: number;
    timestamp: string;
    endpoint: string;
    profileId?: number;
    accountId?: number;
    content?: {
      id: number;
      type: 'show' | 'movie' | 'episode' | 'season' | 'person';
    };
    resultCount?: number;
    cacheHit?: boolean;
  }>;
  stats: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalExecutions: number;
  };
}

/**
 * Interface for archive log entry row
 */
export interface ArchiveLogEntryRow extends RowDataPacket {
  id: number;
  archive_date: Date;
  started_at: Date;
  completed_at: Date | null;
  status: 'started' | 'completed' | 'failed';
  metrics_archived: number;
  queries_processed: number;
  error_message: string | null;
}

/**
 * Interface for daily summary row
 */
export interface DailySummaryRow extends RowDataPacket {
  archive_date: Date;
  total_executions: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p95_duration_ms: number | null;
}

/**
 * Interface for slowest queries result
 */
export interface SlowestQueryRow extends RowDataPacket {
  query_hash: string;
  query_template: string;
  total_executions: number;
  avg_duration_ms: number;
  max_duration_ms: number;
}

export function translateArchiveLogEntryRow(row: ArchiveLogEntryRow): ArchiveLogEntry {
  return {
    id: row.id,
    archiveDate: row.archive_date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    metricsArchived: row.metrics_archived,
    queriesProcessed: row.queries_processed,
    errorMessage: row.error_message,
  };
}

export function translateDailySummaryRow(row: DailySummaryRow): DailySummary {
  return {
    archiveDate: row.archive_date,
    totalExecutions: row.total_executions,
    avgDurationInMillis: row.avg_duration_ms,
    minDurationInMillis: row.min_duration_ms,
    maxDurationInMillis: row.max_duration_ms,
    p95DurationInMillis: row.p95_duration_ms,
  };
}

export function translateSlowestQueryRow(queryRow: SlowestQueryRow): SlowestQuery {
  return {
    queryHash: queryRow.query_hash,
    queryTemplate: queryRow.query_template,
    totalExecutions: queryRow.total_executions,
    avgDurationInMillis: queryRow.avg_duration_ms,
    maxDurationInMillis: queryRow.max_duration_ms,
  };
}
