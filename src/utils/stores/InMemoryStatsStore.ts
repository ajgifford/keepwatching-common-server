import { StatsStore } from '../../types/statsStore';
import { DBQueryStats } from '@ajgifford/keepwatching-types';

interface QueryStat {
  count: number;
  totalTime: number;
  maxTime: number;
}

/**
 * In-memory implementation of StatsStore for testing and development.
 * Stores query statistics in a Map without persistence.
 * Does not require Redis or any external dependencies.
 */
export class InMemoryStatsStore implements StatsStore {
  private stats: Map<string, QueryStat> = new Map();

  async recordQuery(queryName: string, executionTime: number): Promise<void> {
    const current = this.stats.get(queryName) || {
      count: 0,
      totalTime: 0,
      maxTime: 0,
    };

    current.count++;
    current.totalTime += executionTime;
    current.maxTime = Math.max(current.maxTime, executionTime);

    this.stats.set(queryName, current);
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

  async clearStats(): Promise<void> {
    this.stats.clear();
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
}
