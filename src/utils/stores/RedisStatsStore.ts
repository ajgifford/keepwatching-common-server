import { appLogger } from '../../logger/logger';
import { QueryExecutionMetadata, StatsStore } from '../../types/statsStore';
import { DBQueryCallHistory, DBQueryStats } from '@ajgifford/keepwatching-types';
import Redis from 'ioredis';

const REDIS_KEY_PREFIX = 'db:query:stats:';
const REDIS_HISTORY_PREFIX = 'db:query:history:';
const STATS_EXPIRY_SECONDS = 86400; // 24 hours
const HISTORY_EXPIRY_SECONDS = 86400; // 24 hours
const MAX_HISTORY_PER_QUERY = 1000; // Keep last 1000 executions per query

/**
 * Redis implementation of StatsStore for database query statistics.
 * Stores query metrics in Redis hashes with automatic expiry.
 */
export class RedisStatsStore implements StatsStore {
  private redis: Redis;

  constructor(config: { host: string; port: number; password?: string; db: number }) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      appLogger.error('Redis connection error in RedisStatsStore:', error);
    });

    this.redis.on('connect', () => {
      appLogger.info('RedisStatsStore connected to Redis');
    });

    // Connect to Redis
    this.redis.connect().catch((error) => {
      appLogger.error('Failed to connect to Redis in RedisStatsStore:', error);
    });
  }

  async recordQuery(
    queryName: string,
    executionTime: number,
    success: boolean = true,
    error?: string,
    metadata?: QueryExecutionMetadata,
  ): Promise<void> {
    try {
      // Check if Redis is connected before attempting operations
      if (this.redis.status !== 'ready') {
        return; // Silently skip if Redis is not connected
      }

      const statsKey = `${REDIS_KEY_PREFIX}${queryName}`;
      const historyKey = `${REDIS_HISTORY_PREFIX}${queryName}`;
      const timestamp = Date.now();

      const multi = this.redis.multi();

      // Update aggregated stats
      // Increment count
      multi.hincrby(statsKey, 'count', 1);

      // Add to total time
      multi.hincrbyfloat(statsKey, 'totalTime', executionTime);

      // Get current max time to compare
      const currentStats = await this.redis.hgetall(statsKey);
      const currentMaxTime = parseFloat(currentStats.maxTime || '0');

      if (executionTime > currentMaxTime) {
        multi.hset(statsKey, 'maxTime', executionTime);
      }

      // Set expiry on the stats key
      multi.expire(statsKey, STATS_EXPIRY_SECONDS);

      // Store individual call history in a sorted set (sorted by timestamp)
      const historyEntry: DBQueryCallHistory = {
        timestamp,
        executionTime,
        success,
        ...(error && { error }),
        ...(metadata?.endpoint && { endpoint: metadata.endpoint }),
        ...(metadata?.profileId && { profileId: metadata.profileId }),
        ...(metadata?.accountId && { accountId: metadata.accountId }),
        ...(metadata?.content && { content: metadata.content }),
        ...(metadata?.resultCount !== undefined && { resultCount: metadata.resultCount }),
      };

      // Add to sorted set with timestamp as score
      multi.zadd(historyKey, timestamp, JSON.stringify(historyEntry));

      // Trim to keep only the most recent MAX_HISTORY_PER_QUERY entries
      // This removes the oldest entries
      multi.zremrangebyrank(historyKey, 0, -(MAX_HISTORY_PER_QUERY + 1));

      // Set expiry on the history key
      multi.expire(historyKey, HISTORY_EXPIRY_SECONDS);

      await multi.exec();
    } catch (error) {
      // Silently handle Redis errors to prevent disrupting application flow
      appLogger.debug(`Failed to record query stats for ${queryName}:`, error);
    }
  }

  async getStats(): Promise<DBQueryStats[]> {
    try {
      // Check if Redis is connected before attempting operations
      if (this.redis.status !== 'ready') {
        return [];
      }

      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      const stats: DBQueryStats[] = [];

      for (const key of keys) {
        const queryName = key.replace(REDIS_KEY_PREFIX, '');
        const data = await this.redis.hgetall(key);

        if (data.count && data.totalTime) {
          const count = parseInt(data.count, 10);
          const totalTime = parseFloat(data.totalTime);
          const maxTime = parseFloat(data.maxTime || '0');

          stats.push({
            query: queryName,
            count,
            avgTime: Math.round(totalTime / count),
            maxTime: Math.round(maxTime),
            totalTime: Math.round(totalTime),
          });
        }
      }

      return stats.sort((a, b) => b.totalTime - a.totalTime);
    } catch (error) {
      appLogger.debug('Failed to retrieve query stats:', error);
      return [];
    }
  }

  async getQueryHistory(queryName: string, limit: number = 100): Promise<DBQueryCallHistory[]> {
    try {
      // Check if Redis is connected before attempting operations
      if (this.redis.status !== 'ready') {
        return [];
      }

      const historyKey = `${REDIS_HISTORY_PREFIX}${queryName}`;

      // Get the most recent entries (highest scores = most recent timestamps)
      // Use ZREVRANGE to get in descending order (most recent first)
      const entries = await this.redis.zrevrange(historyKey, 0, limit - 1);

      const history: DBQueryCallHistory[] = entries
        .map((entry) => {
          try {
            return JSON.parse(entry) as DBQueryCallHistory;
          } catch (parseError) {
            appLogger.error(`Failed to parse history entry for ${queryName}:`, parseError);
            return null;
          }
        })
        .filter((entry): entry is DBQueryCallHistory => entry !== null);

      return history;
    } catch (error) {
      appLogger.debug(`Failed to retrieve query history for ${queryName}:`, error);
      return [];
    }
  }

  async clearStats(): Promise<void> {
    try {
      const statsKeys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      const historyKeys = await this.redis.keys(`${REDIS_HISTORY_PREFIX}*`);
      const allKeys = [...statsKeys, ...historyKeys];

      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
        appLogger.info(`Cleared ${allKeys.length} query statistics and history entries from Redis`);
      }
    } catch (error) {
      appLogger.error('Failed to clear query stats:', error);
    }
  }

  async getAllQueryNames(): Promise<string[]> {
    try {
      // Check if Redis is connected before attempting operations
      if (this.redis.status !== 'ready') {
        return [];
      }

      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      return keys.map((key) => key.replace(REDIS_KEY_PREFIX, ''));
    } catch (error) {
      appLogger.debug('Failed to retrieve query names:', error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      appLogger.info('RedisStatsStore disconnected from Redis');
    } catch (error) {
      appLogger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Get the connection status of Redis
   */
  getConnectionStatus(): string {
    return this.redis.status;
  }

  /**
   * Check if Redis is connected and ready
   */
  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Wait for Redis connection to be established
   * @param timeoutMs Maximum time to wait in milliseconds (default: 5000)
   * @returns Promise that resolves to true if connected, false if timeout
   */
  async waitForConnection(timeoutMs: number = 5000): Promise<boolean> {
    if (this.redis.status === 'ready') {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      const readyHandler = () => {
        cleanup();
        resolve(true);
      };

      const errorHandler = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.redis.off('ready', readyHandler);
        this.redis.off('error', errorHandler);
      };

      this.redis.once('ready', readyHandler);
      this.redis.once('error', errorHandler);
    });
  }
}
