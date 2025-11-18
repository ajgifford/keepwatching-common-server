import { StatsStore, QueryCallHistory } from '../../types/statsStore';
import { DBQueryStats } from '@ajgifford/keepwatching-types';

interface QueryStat {
  count: number;
  totalTime: number;
  maxTime: number;
}

const MAX_HISTORY_PER_QUERY = 1000; // Keep last 1000 executions per query

/**
 * In-memory implementation of StatsStore for testing and development.
 * Stores query statistics in a Map without persistence.
 * Does not require Redis or any external dependencies.
 */
export class InMemoryStatsStore implements StatsStore {
  private stats: Map<string, QueryStat> = new Map();
  private history: Map<string, QueryCallHistory[]> = new Map();

  async recordQuery(queryName: string, executionTime: number, success: boolean = true, error?: string): Promise<void> {
    // Update aggregated stats
    const current = this.stats.get(queryName) || {
      count: 0,
      totalTime: 0,
      maxTime: 0,
    };

    current.count++;
    current.totalTime += executionTime;
    current.maxTime = Math.max(current.maxTime, executionTime);

    this.stats.set(queryName, current);

    // Store individual call history
    const historyEntry: QueryCallHistory = {
      timestamp: Date.now(),
      executionTime,
      success,
      ...(error && { error }),
    };

    const queryHistory = this.history.get(queryName) || [];
    queryHistory.push(historyEntry);

    // Keep only the most recent MAX_HISTORY_PER_QUERY entries
    if (queryHistory.length > MAX_HISTORY_PER_QUERY) {
      queryHistory.shift(); // Remove oldest entry
    }

    this.history.set(queryName, queryHistory);
  }

  async getStats(): Promise<DBQueryStats[]> {
    const result: DBQueryStats[] = [];

    for (const [queryName, stat] of this.stats.entries()) {
      result.push({
        query: queryName,
        count: stat.count,
        avgTime: stat.totalTime / stat.count,
        maxTime: stat.maxTime,
        totalTime: stat.totalTime,
      });
    }

    // Sort by total time descending (same as Redis implementation)
    return result.sort((a, b) => b.totalTime - a.totalTime);
  }

  async getQueryHistory(queryName: string, limit: number = 100): Promise<QueryCallHistory[]> {
    const queryHistory = this.history.get(queryName) || [];

    // Return most recent entries (last N items), in reverse chronological order
    return queryHistory.slice(-limit).reverse();
  }

  async clearStats(): Promise<void> {
    this.stats.clear();
    this.history.clear();
  }

  async disconnect(): Promise<void> {
    // No-op for in-memory store - nothing to disconnect
  }

  /**
   * Helper method for testing: get raw stats for a specific query
   */
  getQueryStat(queryName: string): QueryStat | undefined {
    return this.stats.get(queryName);
  }

  /**
   * Helper method for testing: check if a query has been recorded
   */
  hasQuery(queryName: string): boolean {
    return this.stats.has(queryName);
  }

  /**
   * Helper method for testing: get raw history for a specific query
   */
  getQueryHistoryRaw(queryName: string): QueryCallHistory[] | undefined {
    return this.history.get(queryName);
  }
}
