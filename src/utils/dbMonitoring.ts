import { getRedisConfig } from '../config/config';
import { appLogger } from '../logger/logger';
import { DBQueryStats } from '@ajgifford/keepwatching-types';
import Redis from 'ioredis';

const REDIS_KEY_PREFIX = 'db:query:stats:';
const STATS_EXPIRY_SECONDS = 86400; // 24 hours

export class DbMonitor {
  private static instance: DbMonitor | null = null;
  private redis: Redis;

  private constructor() {
    const config = getRedisConfig();
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
      appLogger.error('Redis connection error in DbMonitor:', error);
    });

    this.redis.on('connect', () => {
      appLogger.info('DbMonitor connected to Redis');
    });

    // Connect to Redis
    this.redis.connect().catch((error) => {
      appLogger.error('Failed to connect to Redis in DbMonitor:', error);
    });
  }

  static getInstance(): DbMonitor {
    if (!DbMonitor.instance) {
      DbMonitor.instance = new DbMonitor();
    }
    return DbMonitor.instance;
  }

  static resetInstance(): void {
    DbMonitor.instance = null;
  }

  async executeWithTiming<T>(queryName: string, queryFn: () => Promise<T>, warnThresholdMs: number = 1000): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      const executionTime = Date.now() - startTime;

      await this.recordQuery(queryName, executionTime);

      if (executionTime > warnThresholdMs) {
        appLogger.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      appLogger.error(`Query failed: ${queryName} after ${executionTime}ms`, error);
      throw error;
    }
  }

  private async recordQuery(queryName: string, executionTime: number): Promise<void> {
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

  async logStats(): Promise<void> {
    const stats = await this.getStats();
    appLogger.info('Database Query Statistics:', { stats });
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
      appLogger.info('DbMonitor disconnected from Redis');
    } catch (error) {
      appLogger.error('Error disconnecting from Redis:', error);
    }
  }
}
