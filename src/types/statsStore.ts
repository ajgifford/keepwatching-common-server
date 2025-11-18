import { DBQueryStats } from '@ajgifford/keepwatching-types';

/**
 * Represents a single query execution in the call history.
 */
export interface QueryCallHistory {
  /**
   * Timestamp when the query was executed
   */
  timestamp: number;
  /**
   * Execution time in milliseconds
   */
  executionTime: number;
  /**
   * Whether the query succeeded or failed
   */
  success: boolean;
  /**
   * Error message if the query failed
   */
  error?: string;
}

/**
 * Interface for storing and retrieving database query statistics.
 * Implementations can use Redis, in-memory storage, or any other backend.
 */
export interface StatsStore {
  /**
   * Records a query execution with its execution time.
   * Updates count, total time, and max time for the given query.
   *
   * @param queryName - Name of the database query
   * @param executionTime - Time taken to execute the query in milliseconds
   * @param success - Whether the query succeeded (default: true)
   * @param error - Error message if the query failed
   */
  recordQuery(queryName: string, executionTime: number, success?: boolean, error?: string): Promise<void>;

  /**
   * Retrieves all recorded query statistics.
   * Returns stats sorted by total execution time (descending).
   *
   * @returns Array of query statistics including count, avg time, max time, and total time
   */
  getStats(): Promise<DBQueryStats[]>;

  /**
   * Retrieves call history for a specific query.
   * Returns the most recent executions up to the specified limit.
   *
   * @param queryName - Name of the database query
   * @param limit - Maximum number of history entries to return (default: 100)
   * @returns Array of query call history entries, sorted by timestamp descending
   */
  getQueryHistory(queryName: string, limit?: number): Promise<QueryCallHistory[]>;

  /**
   * Clears all recorded query statistics.
   */
  clearStats(): Promise<void>;

  /**
   * Disconnects from the underlying storage.
   * Should be called when shutting down to clean up resources.
   */
  disconnect(): Promise<void>;
}
