import { RedisStatsStore } from '../../../../src/utils/stores/RedisStatsStore';
import { QueryExecutionMetadata } from '../../../../src/types/statsStore';
import Redis from 'ioredis';
import { appLogger } from '../../../../src/logger/logger';

// Mock ioredis
jest.mock('ioredis');
jest.mock('../../../../src/logger/logger');

describe('RedisStatsStore', () => {
  let store: RedisStatsStore;
  let mockRedis: jest.Mocked<Redis>;

  // Mock data structures
  const mockHashData: Record<string, Record<string, string>> = {};
  const mockSortedSets: Record<string, Array<{ score: number; value: string }>> = {};

  beforeEach(() => {
    // Clear mock data
    Object.keys(mockHashData).forEach((key) => delete mockHashData[key]);
    Object.keys(mockSortedSets).forEach((key) => delete mockSortedSets[key]);

    // Create mock Redis instance
    mockRedis = {
      status: 'ready',
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      multi: jest.fn(),
      hgetall: jest.fn(),
      hincrby: jest.fn(),
      hincrbyfloat: jest.fn(),
      hset: jest.fn(),
      expire: jest.fn(),
      zadd: jest.fn(),
      zremrangebyrank: jest.fn(),
      zrevrange: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Setup multi() to return a chainable mock
    const multiMock = {
      hincrby: jest.fn().mockReturnThis(),
      hincrbyfloat: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zremrangebyrank: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    mockRedis.multi.mockReturnValue(multiMock as any);

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // Create store instance
    store = new RedisStatsStore({
      host: 'localhost',
      port: 6379,
      password: 'test',
      db: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Redis instance with correct config', () => {
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          password: 'test',
          db: 0,
          lazyConnect: true,
        }),
      );
    });

    it('should connect to Redis on initialization', () => {
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should setup error and connect event handlers', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('recordQuery', () => {
    beforeEach(() => {
      // Mock hgetall to return current stats
      mockRedis.hgetall.mockResolvedValue({ count: '0', totalTime: '0', maxTime: '0' });
    });

    it('should record a new query with basic stats', async () => {
      await store.recordQuery('testQuery', 100);

      const multi = mockRedis.multi();
      expect(multi.hincrby).toHaveBeenCalledWith('db:query:stats:testQuery', 'count', 1);
      expect(multi.hincrbyfloat).toHaveBeenCalledWith('db:query:stats:testQuery', 'totalTime', 100);
      expect(multi.expire).toHaveBeenCalledWith('db:query:stats:testQuery', 86400);
      expect(multi.exec).toHaveBeenCalled();
    });

    it('should update max time when execution time is higher', async () => {
      mockRedis.hgetall.mockResolvedValue({ count: '1', totalTime: '50', maxTime: '50' });

      await store.recordQuery('testQuery', 100);

      const multi = mockRedis.multi();
      expect(multi.hset).toHaveBeenCalledWith('db:query:stats:testQuery', 'maxTime', 100);
    });

    it('should not update max time when execution time is lower', async () => {
      mockRedis.hgetall.mockResolvedValue({ count: '1', totalTime: '100', maxTime: '100' });

      await store.recordQuery('testQuery', 50);

      const multi = mockRedis.multi();
      expect(multi.hset).not.toHaveBeenCalled();
    });

    it('should store query history in sorted set', async () => {
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await store.recordQuery('testQuery', 100, true);

      const multi = mockRedis.multi();
      expect(multi.zadd).toHaveBeenCalledWith(
        'db:query:history:testQuery',
        mockTimestamp,
        expect.stringContaining('"timestamp":1234567890'),
      );
      expect(multi.zremrangebyrank).toHaveBeenCalledWith('db:query:history:testQuery', 0, -1001);
      expect(multi.expire).toHaveBeenCalledWith('db:query:history:testQuery', 86400);

      jest.restoreAllMocks();
    });

    it('should record query with error', async () => {
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await store.recordQuery('testQuery', 100, false, 'Connection timeout');

      const multi = mockRedis.multi();
      const callArgs = (multi.zadd as jest.Mock).mock.calls[0];
      const historyEntry = JSON.parse(callArgs[2]);

      expect(historyEntry.success).toBe(false);
      expect(historyEntry.error).toBe('Connection timeout');

      jest.restoreAllMocks();
    });

    it('should record query with metadata', async () => {
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const metadata: QueryExecutionMetadata = {
        endpoint: '/api/shows',
        profileId: 1,
        accountId: 2,
        resultCount: 10,
        content: { id: 123, type: 'show' },
      };

      await store.recordQuery('testQuery', 100, true, undefined, metadata);

      const multi = mockRedis.multi();
      const callArgs = (multi.zadd as jest.Mock).mock.calls[0];
      const historyEntry = JSON.parse(callArgs[2]);

      expect(historyEntry.endpoint).toBe('/api/shows');
      expect(historyEntry.profileId).toBe(1);
      expect(historyEntry.accountId).toBe(2);
      expect(historyEntry.resultCount).toBe(10);
      expect(historyEntry.content).toEqual({ id: 123, type: 'show' });

      jest.restoreAllMocks();
    });

    it('should skip recording when Redis is not ready', async () => {
      mockRedis.status = 'connecting';

      await store.recordQuery('testQuery', 100);

      expect(mockRedis.multi).not.toHaveBeenCalled();
    });

    it('should silently handle Redis errors', async () => {
      mockRedis.hgetall.mockRejectedValue(new Error('Redis error'));

      await expect(store.recordQuery('testQuery', 100)).resolves.not.toThrow();
      expect(appLogger.debug).toHaveBeenCalledWith(
        'Failed to record query stats for testQuery:',
        expect.any(Error),
      );
    });
  });

  describe('getStats', () => {
    it('should return empty array when no stats exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const stats = await store.getStats();

      expect(stats).toEqual([]);
      expect(mockRedis.keys).toHaveBeenCalledWith('db:query:stats:*');
    });

    it('should retrieve and parse stats correctly', async () => {
      mockRedis.keys.mockResolvedValue(['db:query:stats:query1', 'db:query:stats:query2']);
      mockRedis.hgetall
        .mockResolvedValueOnce({ count: '5', totalTime: '500', maxTime: '150' })
        .mockResolvedValueOnce({ count: '3', totalTime: '900', maxTime: '400' });

      const stats = await store.getStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        query: 'query2',
        count: 3,
        totalTime: 900,
        maxTime: 400,
        avgTime: 300,
      });
      expect(stats[1]).toEqual({
        query: 'query1',
        count: 5,
        totalTime: 500,
        maxTime: 150,
        avgTime: 100,
      });
    });

    it('should sort stats by total time descending', async () => {
      mockRedis.keys.mockResolvedValue([
        'db:query:stats:fast',
        'db:query:stats:slow',
        'db:query:stats:medium',
      ]);
      mockRedis.hgetall
        .mockResolvedValueOnce({ count: '1', totalTime: '100', maxTime: '100' })
        .mockResolvedValueOnce({ count: '1', totalTime: '1000', maxTime: '1000' })
        .mockResolvedValueOnce({ count: '1', totalTime: '500', maxTime: '500' });

      const stats = await store.getStats();

      expect(stats[0].query).toBe('slow');
      expect(stats[1].query).toBe('medium');
      expect(stats[2].query).toBe('fast');
    });

    it('should skip entries with incomplete data', async () => {
      mockRedis.keys.mockResolvedValue(['db:query:stats:query1', 'db:query:stats:query2']);
      mockRedis.hgetall
        .mockResolvedValueOnce({ count: '5', totalTime: '500', maxTime: '150' })
        .mockResolvedValueOnce({}); // Incomplete data

      const stats = await store.getStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].query).toBe('query1');
    });

    it('should return empty array when Redis is not ready', async () => {
      mockRedis.status = 'connecting';

      const stats = await store.getStats();

      expect(stats).toEqual([]);
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await store.getStats();

      expect(stats).toEqual([]);
      expect(appLogger.debug).toHaveBeenCalledWith('Failed to retrieve query stats:', expect.any(Error));
    });

    it('should round avgTime, maxTime, and totalTime to integers', async () => {
      mockRedis.keys.mockResolvedValue(['db:query:stats:query1']);
      mockRedis.hgetall.mockResolvedValue({ count: '3', totalTime: '350.5', maxTime: '150.8' });

      const stats = await store.getStats();

      expect(stats[0].avgTime).toBe(117); // 350.5 / 3 = 116.83... rounded to 117
      expect(stats[0].maxTime).toBe(151); // 150.8 rounded to 151
      expect(stats[0].totalTime).toBe(351); // 350.5 rounded to 351
    });
  });

  describe('getQueryHistory', () => {
    it('should retrieve query history in descending order', async () => {
      const history1 = JSON.stringify({ timestamp: 1000, executionTime: 100, success: true });
      const history2 = JSON.stringify({ timestamp: 2000, executionTime: 150, success: true });
      const history3 = JSON.stringify({ timestamp: 3000, executionTime: 200, success: false });

      mockRedis.zrevrange.mockResolvedValue([history3, history2, history1]);

      const result = await store.getQueryHistory('testQuery', 100);

      expect(mockRedis.zrevrange).toHaveBeenCalledWith('db:query:history:testQuery', 0, 99);
      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe(3000);
      expect(result[1].timestamp).toBe(2000);
      expect(result[2].timestamp).toBe(1000);
    });

    it('should respect the limit parameter', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      await store.getQueryHistory('testQuery', 50);

      expect(mockRedis.zrevrange).toHaveBeenCalledWith('db:query:history:testQuery', 0, 49);
    });

    it('should use default limit of 100', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      await store.getQueryHistory('testQuery');

      expect(mockRedis.zrevrange).toHaveBeenCalledWith('db:query:history:testQuery', 0, 99);
    });

    it('should filter out invalid JSON entries', async () => {
      const validHistory = JSON.stringify({ timestamp: 1000, executionTime: 100, success: true });
      const invalidHistory = 'invalid json';

      mockRedis.zrevrange.mockResolvedValue([validHistory, invalidHistory]);

      const result = await store.getQueryHistory('testQuery');

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(1000);
      expect(appLogger.error).toHaveBeenCalledWith(
        'Failed to parse history entry for testQuery:',
        expect.any(Error),
      );
    });

    it('should return empty array when Redis is not ready', async () => {
      mockRedis.status = 'connecting';

      const result = await store.getQueryHistory('testQuery');

      expect(result).toEqual([]);
      expect(mockRedis.zrevrange).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.zrevrange.mockRejectedValue(new Error('Redis error'));

      const result = await store.getQueryHistory('testQuery');

      expect(result).toEqual([]);
      expect(appLogger.debug).toHaveBeenCalledWith(
        'Failed to retrieve query history for testQuery:',
        expect.any(Error),
      );
    });
  });

  describe('clearStats', () => {
    it('should delete all stats and history keys', async () => {
      mockRedis.keys
        .mockResolvedValueOnce(['db:query:stats:query1', 'db:query:stats:query2'])
        .mockResolvedValueOnce(['db:query:history:query1', 'db:query:history:query2']);

      await store.clearStats();

      expect(mockRedis.keys).toHaveBeenCalledWith('db:query:stats:*');
      expect(mockRedis.keys).toHaveBeenCalledWith('db:query:history:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'db:query:stats:query1',
        'db:query:stats:query2',
        'db:query:history:query1',
        'db:query:history:query2',
      );
      expect(appLogger.info).toHaveBeenCalledWith(
        'Cleared 4 query statistics and history entries from Redis',
      );
    });

    it('should not call del when no keys exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await store.clearStats();

      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(appLogger.info).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      await store.clearStats();

      expect(appLogger.error).toHaveBeenCalledWith('Failed to clear query stats:', expect.any(Error));
    });
  });

  describe('getAllQueryNames', () => {
    it('should return array of query names', async () => {
      mockRedis.keys.mockResolvedValue([
        'db:query:stats:query1',
        'db:query:stats:query2',
        'db:query:stats:query3',
      ]);

      const names = await store.getAllQueryNames();

      expect(names).toEqual(['query1', 'query2', 'query3']);
      expect(mockRedis.keys).toHaveBeenCalledWith('db:query:stats:*');
    });

    it('should return empty array when no queries exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const names = await store.getAllQueryNames();

      expect(names).toEqual([]);
    });

    it('should return empty array when Redis is not ready', async () => {
      mockRedis.status = 'connecting';

      const names = await store.getAllQueryNames();

      expect(names).toEqual([]);
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const names = await store.getAllQueryNames();

      expect(names).toEqual([]);
      expect(appLogger.debug).toHaveBeenCalledWith('Failed to retrieve query names:', expect.any(Error));
    });
  });

  describe('disconnect', () => {
    it('should quit Redis connection', async () => {
      await store.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(appLogger.info).toHaveBeenCalledWith('RedisStatsStore disconnected from Redis');
    });

    it('should handle disconnect errors', async () => {
      mockRedis.quit.mockRejectedValue(new Error('Disconnect error'));

      await store.disconnect();

      expect(appLogger.error).toHaveBeenCalledWith('Error disconnecting from Redis:', expect.any(Error));
    });
  });

  describe('getConnectionStatus', () => {
    it('should return Redis status', () => {
      mockRedis.status = 'ready';
      expect(store.getConnectionStatus()).toBe('ready');

      mockRedis.status = 'connecting';
      expect(store.getConnectionStatus()).toBe('connecting');
    });
  });

  describe('isConnected', () => {
    it('should return true when Redis is ready', () => {
      mockRedis.status = 'ready';
      expect(store.isConnected()).toBe(true);
    });

    it('should return false when Redis is not ready', () => {
      mockRedis.status = 'connecting';
      expect(store.isConnected()).toBe(false);

      mockRedis.status = 'close';
      expect(store.isConnected()).toBe(false);
    });
  });

  describe('waitForConnection', () => {
    it('should resolve immediately if already connected', async () => {
      mockRedis.status = 'ready';

      const result = await store.waitForConnection(1000);

      expect(result).toBe(true);
    });

    it('should resolve true when connection succeeds', async () => {
      mockRedis.status = 'connecting';

      // Mock once to trigger ready event
      mockRedis.once.mockImplementation((event, handler) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
        return mockRedis;
      });

      const result = await store.waitForConnection(1000);

      expect(result).toBe(true);
    });

    it('should resolve false on timeout', async () => {
      mockRedis.status = 'connecting';

      const result = await store.waitForConnection(100);

      expect(result).toBe(false);
    });

    it('should resolve false on error', async () => {
      mockRedis.status = 'connecting';

      mockRedis.once.mockImplementation((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(), 10);
        }
        return mockRedis;
      });

      const result = await store.waitForConnection(1000);

      expect(result).toBe(false);
    });

    it('should cleanup event listeners after completion', async () => {
      mockRedis.status = 'connecting';

      mockRedis.once.mockImplementation((event, handler) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
        return mockRedis;
      });

      await store.waitForConnection(1000);

      expect(mockRedis.off).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});
