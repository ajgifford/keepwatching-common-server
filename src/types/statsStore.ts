import { DBQueryStats } from '@ajgifford/keepwatching-types';

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
   */
  recordQuery(queryName: string, executionTime: number): Promise<void>;

  /**
   * Retrieves all recorded query statistics.
   * Returns stats sorted by total execution time (descending).
   *
   * @returns Array of query statistics including count, avg time, max time, and total time
   */
  getStats(): Promise<DBQueryStats[]>;

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
