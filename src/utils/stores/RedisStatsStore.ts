import Redis from 'ioredis';
import { DBQueryStats } from '@ajgifford/keepwatching-types';
import { appLogger } from '../../logger/logger';
import { StatsStore } from '../../types/statsStore';

const REDIS_KEY_PREFIX = 'db:query:stats:';
const STATS_EXPIRY_SECONDS = 86400; // 24 hours

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

  async recordQuery(queryName: string, executionTime: number): Promise<void> {
    try {
      const key = `${REDIS_KEY_PREFIX}${queryName}`;
      const multi = this.redis.multi();

      // Increment count
      multi.hincrby(key, 'count', 1);

      // Add to total time
      multi.hincrbyfloat(key, 'totalTime', executionTime);

      // Get current max time to compare
      const currentStats = await this.redis.hgetall(key);
      const currentMaxTime = parseFloat(currentStats.maxTime || '0');

      if (executionTime > currentMaxTime) {
        multi.hset(key, 'maxTime', executionTime);
      }

      // Set expiry on the key
      multi.expire(key, STATS_EXPIRY_SECONDS);

      await multi.exec();
    } catch (error) {
      appLogger.error(`Failed to record query stats for ${queryName}:`, error);
    }
  }

  async getStats(): Promise<DBQueryStats[]> {
    try {
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
      appLogger.error('Failed to retrieve query stats:', error);
      return [];
    }
  }

  async clearStats(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        appLogger.info(`Cleared ${keys.length} query statistics from Redis`);
      }
    } catch (error) {
      appLogger.error('Failed to clear query stats:', error);
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
}
