import { appLogger } from '@logger/logger';
import { DbMonitor } from '@utils/dbMonitoring';
import Redis from 'ioredis';

jest.unmock('@utils/dbMonitoring');

// Mock ioredis
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();
const mockMulti = jest.fn();
const mockHgetall = jest.fn();
const mockKeys = jest.fn();
const mockDel = jest.fn();
const mockQuit = jest.fn().mockResolvedValue(undefined);

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    on: mockOn,
    multi: mockMulti,
    hgetall: mockHgetall,
    keys: mockKeys,
    del: mockDel,
    quit: mockQuit,
  }));
});

jest.mock('@logger/logger', () => ({
  appLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@config/config', () => ({
  getRedisConfig: jest.fn().mockReturnValue({
    host: 'test-host',
    port: 6379,
    password: 'test-password',
    db: 0,
  }),
}));

describe('DbMonitor', () => {
  let dbMonitor: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance using the new resetInstance method
    DbMonitor.resetInstance();

    // Create new instance
    dbMonitor = DbMonitor.getInstance();
  });

  afterEach(() => {
    // Clean up singleton
    DbMonitor.resetInstance();
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = DbMonitor.getInstance();
      const instance2 = DbMonitor.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize Redis with correct configuration', () => {
      expect(Redis).toHaveBeenCalledWith({
        host: 'test-host',
        port: 6379,
        password: 'test-password',
        db: 0,
        retryStrategy: expect.any(Function),
        lazyConnect: true,
      });
    });

    it('should set up Redis error handler', () => {
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should set up Redis connect handler', () => {
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should attempt to connect to Redis', () => {
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should handle Redis connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockConnect.mockRejectedValueOnce(connectionError);

      // Reset singleton to trigger new connection attempt
      DbMonitor.resetInstance();
      DbMonitor.getInstance();

      // Wait for promise to resolve
      await new Promise(process.nextTick);

      expect(appLogger.error).toHaveBeenCalledWith('Failed to connect to Redis in DbMonitor:', connectionError);
    });

    it('should implement exponential backoff retry strategy', () => {
      const mockCalls = (Redis as jest.MockedClass<typeof Redis>).mock.calls as any[];
      expect(mockCalls.length).toBeGreaterThan(0);

      const redisConfig = mockCalls[0][0];
      expect(redisConfig).toBeDefined();
      expect(redisConfig.retryStrategy).toBeDefined();

      const retryStrategy = redisConfig.retryStrategy as (times: number) => number;

      expect(retryStrategy(1)).toBe(50); // First retry: 1 * 50 = 50ms
      expect(retryStrategy(10)).toBe(500); // 10 * 50 = 500ms
      expect(retryStrategy(50)).toBe(2000); // 50 * 50 = 2500, but capped at 2000ms
      expect(retryStrategy(100)).toBe(2000); // Should be capped at 2000ms
    });
  });

  describe('executeWithTiming', () => {
    it('should execute query and return result', async () => {
      const queryFn = jest.fn().mockResolvedValue({ data: 'test' });
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      const result = await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(result).toEqual({ data: 'test' });
      expect(queryFn).toHaveBeenCalled();
    });

    it('should record query execution time', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(mockMulti).toHaveBeenCalled();
      expect(mockMultiObj.hincrby).toHaveBeenCalled();
      expect(mockMultiObj.hincrbyfloat).toHaveBeenCalled();
    });

    it('should log warning for slow queries', async () => {
      const queryFn = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('result'), 100)));
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('slowQuery', queryFn, 50);

      expect(appLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Slow query detected: slowQuery'));
    });

    it('should use default warning threshold of 1000ms', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('fastQuery', queryFn);

      expect(appLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle query errors and rethrow', async () => {
      const error = new Error('Query failed');
      const queryFn = jest.fn().mockRejectedValue(error);

      await expect(dbMonitor.executeWithTiming('failingQuery', queryFn)).rejects.toThrow('Query failed');

      expect(appLogger.error).toHaveBeenCalledWith(expect.stringContaining('Query failed: failingQuery'), error);
    });

    it('should record execution time even when query fails', async () => {
      const error = new Error('Query failed');
      const queryFn = jest.fn().mockRejectedValue(error);

      try {
        await dbMonitor.executeWithTiming('failingQuery', queryFn);
      } catch {
        // Expected error - ignoring
      }

      expect(appLogger.error).toHaveBeenCalledWith(expect.stringContaining('after'), error);
    });
  });

  describe('recordQuery (private method)', () => {
    it('should increment query count', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(mockMultiObj.hincrby).toHaveBeenCalledWith('db:query:stats:testQuery', 'count', 1);
    });

    it('should add to total execution time', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(mockMultiObj.hincrbyfloat).toHaveBeenCalledWith(
        'db:query:stats:testQuery',
        'totalTime',
        expect.any(Number),
      );
    });

    it('should update max time when current execution is slower', async () => {
      // Add delay to ensure execution time exceeds maxTime
      const queryFn = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('result'), 10)));
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({ maxTime: '5' });
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(mockMultiObj.hset).toHaveBeenCalled();
    });

    it('should not update max time when current execution is faster', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({ maxTime: '10000' });
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      // hset should still be called for maxTime if execution time is greater
      expect(mockMultiObj.expire).toHaveBeenCalled();
    });

    it('should set expiry on stats key', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(mockMultiObj.expire).toHaveBeenCalledWith('db:query:stats:testQuery', 86400);
    });

    it('should handle Redis errors gracefully', async () => {
      const queryFn = jest.fn().mockResolvedValue('result');
      const mockMultiObj = {
        hincrby: jest.fn().mockReturnThis(),
        hincrbyfloat: jest.fn().mockReturnThis(),
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis error')),
      };

      mockHgetall.mockResolvedValue({});
      mockMulti.mockReturnValue(mockMultiObj as any);

      const result = await dbMonitor.executeWithTiming('testQuery', queryFn);

      expect(result).toBe('result');
      expect(appLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record query stats'),
        expect.any(Error),
      );
    });
  });

  describe('getStats', () => {
    it('should return empty array when no stats exist', async () => {
      mockKeys.mockResolvedValue([]);

      const stats = await dbMonitor.getStats();

      expect(stats).toEqual([]);
    });

    it('should retrieve and format stats correctly', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:query1', 'db:query:stats:query2']);
      mockHgetall
        .mockResolvedValueOnce({
          count: '10',
          totalTime: '1500',
          maxTime: '250',
        })
        .mockResolvedValueOnce({
          count: '5',
          totalTime: '2000',
          maxTime: '500',
        });

      const stats = await dbMonitor.getStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        query: 'query2',
        count: 5,
        avgTime: 400,
        maxTime: 500,
        totalTime: 2000,
      });
      expect(stats[1]).toEqual({
        query: 'query1',
        count: 10,
        avgTime: 150,
        maxTime: 250,
        totalTime: 1500,
      });
    });

    it('should sort stats by total time descending', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:fast', 'db:query:stats:slow']);
      mockHgetall
        .mockResolvedValueOnce({
          count: '10',
          totalTime: '100',
          maxTime: '20',
        })
        .mockResolvedValueOnce({
          count: '5',
          totalTime: '5000',
          maxTime: '1200',
        });

      const stats = await dbMonitor.getStats();

      expect(stats[0].query).toBe('slow');
      expect(stats[1].query).toBe('fast');
    });

    it('should handle missing maxTime gracefully', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:query1']);
      mockHgetall.mockResolvedValue({
        count: '10',
        totalTime: '1500',
      });

      const stats = await dbMonitor.getStats();

      expect(stats[0].maxTime).toBe(0);
    });

    it('should skip entries without count or totalTime', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:invalid', 'db:query:stats:valid']);
      mockHgetall
        .mockResolvedValueOnce({}) // Invalid: no count/totalTime
        .mockResolvedValueOnce({
          count: '10',
          totalTime: '1500',
        });

      const stats = await dbMonitor.getStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].query).toBe('valid');
    });

    it('should handle Redis errors and return empty array', async () => {
      mockKeys.mockRejectedValue(new Error('Redis error'));

      const stats = await dbMonitor.getStats();

      expect(stats).toEqual([]);
      expect(appLogger.error).toHaveBeenCalledWith('Failed to retrieve query stats:', expect.any(Error));
    });

    it('should round average time correctly', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:query1']);
      mockHgetall.mockResolvedValue({
        count: '3',
        totalTime: '100',
        maxTime: '50',
      });

      const stats = await dbMonitor.getStats();

      expect(stats[0].avgTime).toBe(33); // Math.round(100 / 3)
    });
  });

  describe('logStats', () => {
    it('should retrieve stats and log them', async () => {
      mockKeys.mockResolvedValue(['db:query:stats:query1']);
      mockHgetall.mockResolvedValue({
        count: '10',
        totalTime: '1500',
        maxTime: '250',
      });

      await dbMonitor.logStats();

      expect(appLogger.info).toHaveBeenCalledWith('Database Query Statistics:', {
        stats: [
          {
            query: 'query1',
            count: 10,
            avgTime: 150,
            maxTime: 250,
            totalTime: 1500,
          },
        ],
      });
    });

    it('should log empty array when no stats exist', async () => {
      mockKeys.mockResolvedValue([]);

      await dbMonitor.logStats();

      expect(appLogger.info).toHaveBeenCalledWith('Database Query Statistics:', { stats: [] });
    });
  });

  describe('clearStats', () => {
    it('should delete all stats keys', async () => {
      const keys = ['db:query:stats:query1', 'db:query:stats:query2'];
      mockKeys.mockResolvedValue(keys);
      mockDel.mockResolvedValue(2);

      await dbMonitor.clearStats();

      expect(mockDel).toHaveBeenCalledWith(...keys);
      expect(appLogger.info).toHaveBeenCalledWith('Cleared 2 query statistics from Redis');
    });

    it('should not attempt to delete when no keys exist', async () => {
      mockKeys.mockResolvedValue([]);

      await dbMonitor.clearStats();

      expect(mockDel).not.toHaveBeenCalled();
      expect(appLogger.info).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockKeys.mockRejectedValue(new Error('Redis error'));

      await dbMonitor.clearStats();

      expect(appLogger.error).toHaveBeenCalledWith('Failed to clear query stats:', expect.any(Error));
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await dbMonitor.disconnect();

      expect(mockQuit).toHaveBeenCalled();
      expect(appLogger.info).toHaveBeenCalledWith('DbMonitor disconnected from Redis');
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      mockQuit.mockRejectedValue(error);

      await dbMonitor.disconnect();

      expect(appLogger.error).toHaveBeenCalledWith('Error disconnecting from Redis:', error);
    });
  });

  describe('Redis event handlers', () => {
    it('should log error on Redis error event', () => {
      const errorHandler = mockOn.mock.calls.find((call) => call[0] === 'error')?.[1];
      const error = new Error('Redis error');

      errorHandler?.(error);

      expect(appLogger.error).toHaveBeenCalledWith('Redis connection error in DbMonitor:', error);
    });

    it('should log info on Redis connect event', () => {
      const connectHandler = mockOn.mock.calls.find((call) => call[0] === 'connect')?.[1];

      connectHandler?.();

      expect(appLogger.info).toHaveBeenCalledWith('DbMonitor connected to Redis');
    });
  });
});
