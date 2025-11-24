import { getRedisConfig, getStatsStoreType } from '../config/config';
import { appLogger } from '../logger/logger';
import { StatsStore } from '../types/statsStore';
import { InMemoryStatsStore } from './stores/InMemoryStatsStore';
import { RedisStatsStore } from './stores/RedisStatsStore';
import { DBQueryCallHistory, DBQueryStats } from '@ajgifford/keepwatching-types';

/**
 * Database query monitor that tracks execution times and performance metrics.
 * Uses a pluggable StatsStore for storing statistics (Redis by default).
 */
export class DbMonitor {
  private static instance: DbMonitor | null = null;
  private store: StatsStore;

  private constructor(store: StatsStore) {
    this.store = store;
  }

  /**
   * Gets the singleton instance of DbMonitor.
   * Creates a new instance with RedisStatsStore or InMemoryStatsStore based on configuration.
   * Automatically falls back to InMemoryStatsStore if Redis connection fails.
   */
  static getInstance(): DbMonitor {
    if (!DbMonitor.instance) {
      const storeType = getStatsStoreType();
      let store: StatsStore;

      if (storeType === 'memory') {
        appLogger.info('Using InMemoryStatsStore for database query statistics');
        store = new InMemoryStatsStore();
      } else {
        appLogger.info('Using RedisStatsStore for database query statistics');
        const config = getRedisConfig();
        store = new RedisStatsStore(config);
      }

      DbMonitor.instance = new DbMonitor(store);
    }
    return DbMonitor.instance;
  }

  /**
   * Creates a new DbMonitor instance with a custom StatsStore.
   * Useful for testing with InMemoryStatsStore or custom implementations.
   *
   * @param store - The StatsStore implementation to use
   */
  static createInstance(store: StatsStore): DbMonitor {
    return new DbMonitor(store);
  }

  /**
   * Resets the singleton instance. Used primarily for testing.
   */
  static resetInstance(): void {
    DbMonitor.instance = null;
  }

  async executeWithTiming<T>(queryName: string, queryFn: () => Promise<T>, warnThresholdMs: number = 1000): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await queryFn();
      const executionTime = performance.now() - startTime;

      await this.store.recordQuery(queryName, executionTime, true);

      if (executionTime > warnThresholdMs) {
        appLogger.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      appLogger.error(`Query failed: ${queryName} after ${executionTime}ms`, error);

      // Record the failed query with error information
      await this.store.recordQuery(queryName, executionTime, false, errorMessage);

      throw error;
    }
  }

  async getStats(): Promise<DBQueryStats[]> {
    return await this.store.getStats();
  }

  async getQueryHistory(queryName: string, limit?: number): Promise<DBQueryCallHistory[]> {
    return await this.store.getQueryHistory(queryName, limit);
  }

  async logStats(): Promise<void> {
    const stats = await this.getStats();
    appLogger.info('Database Query Statistics:', { stats });
  }

  async clearStats(): Promise<void> {
    await this.store.clearStats();
  }

  async disconnect(): Promise<void> {
    await this.store.disconnect();
  }

  /**
   * Get information about the stats store for logging/debugging
   */
  getStoreInfo(): { type: string; isRedis: boolean; status?: string; connected?: boolean } {
    const isRedis = this.store.constructor.name === 'RedisStatsStore';
    const info: { type: string; isRedis: boolean; status?: string; connected?: boolean } = {
      type: isRedis ? 'Redis' : 'In-Memory',
      isRedis,
    };

    // Add connection status for Redis stores
    if (isRedis && this.store instanceof RedisStatsStore) {
      info.status = this.store.getConnectionStatus();
      info.connected = this.store.isConnected();
    }

    return info;
  }

  /**
   * Wait for Redis connection to be established (only applicable for Redis stores)
   * @param timeoutMs Maximum time to wait in milliseconds (default: 5000)
   * @returns Promise that resolves to true if connected, false if timeout or not using Redis
   */
  async waitForConnection(timeoutMs: number = 5000): Promise<boolean> {
    if (this.store instanceof RedisStatsStore) {
      return await this.store.waitForConnection(timeoutMs);
    }
    // In-memory store is always "connected"
    return true;
  }
}
