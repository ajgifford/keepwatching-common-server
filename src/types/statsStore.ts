import { DBQueryCallHistory, DBQueryStats } from '@ajgifford/keepwatching-types';

/**
 * Optional metadata that can be recorded with a query execution
 */
export interface QueryExecutionMetadata {
  endpoint?: string;
  profileId?: number;
  accountId?: number;
  resultCount?: number;
  content?: {
    id: number;
    type: 'show' | 'movie' | 'episode' | 'season' | 'person';
  };
}

/**
 * Interface for storing and retrieving database query statistics.
 * Implementations can use Redis, in-memory storage, or any other backend.
 */
export interface StatsStore {
  /**
   * Records a query execution with its execution time and optional metadata.
   * Updates count, total time, and max time for the given query.
   *
   * @param queryName - Name of the database query
   * @param executionTime - Time taken to execute the query in milliseconds
   * @param success - Whether the query succeeded (default: true)
   * @param error - Error message if the query failed
   * @param metadata - Optional metadata about the query execution (endpoint, userId, etc.)
   */
  recordQuery(
    queryName: string,
    executionTime: number,
    success?: boolean,
    error?: string,
    metadata?: QueryExecutionMetadata,
  ): Promise<void>;

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
  getQueryHistory(queryName: string, limit?: number): Promise<DBQueryCallHistory[]>;

  /**
   * Clears all recorded query statistics.
   */
  clearStats(): Promise<void>;

  /**
   * Retrieves a list of all query names that have recorded statistics.
   * Useful for archiving operations that need to iterate over all queries.
   *
   * @returns Array of query names
   */
  getAllQueryNames(): Promise<string[]>;

  /**
   * Disconnects from the underlying storage.
   * Should be called when shutting down to clean up resources.
   */
  disconnect(): Promise<void>;
}
