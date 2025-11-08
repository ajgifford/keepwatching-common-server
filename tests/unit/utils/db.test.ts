import { createDbPool, getDbPool, resetDbPool } from '@utils/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to create mock variables that can be referenced in vi.mock
const { mockPool, mockCreatePool } = vi.hoisted(() => {
  const mockPool = { mockPool: true };
  const mockCreatePool = vi.fn().mockReturnValue(mockPool);
  return { mockPool, mockCreatePool };
});

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: mockCreatePool,
  },
}));

describe('db utility', () => {
  beforeEach(() => {
    // Set up environment variables for the config
    process.env.MYSQL_HOST = 'test-host';
    process.env.MYSQL_USER = 'test-user';
    process.env.MYSQL_PWD = 'test-password';
    process.env.MYSQL_DB = 'test-db';
    process.env.MYSQL_CONNECTION_LIMIT = '100';
    process.env.MYSQL_QUEUE_LIMIT = '0';

    resetDbPool();
    mockCreatePool.mockClear();
    // Re-set the return value after mockReset in vitest config
    mockCreatePool.mockReturnValue(mockPool);
  });

  describe('createDbPool', () => {
    it('should create a pool with environment variables when no config is provided', () => {
      const pool = createDbPool();

      expect(mockCreatePool).toHaveBeenCalledTimes(1);
      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'test-host',
          user: 'test-user',
          password: 'test-password',
          database: 'test-db',
          connectionLimit: 100,
          queueLimit: 0,
        }),
      );
      expect(pool).toEqual({ mockPool: true });
    });

    it('should create a pool with provided config instead of environment variables', () => {
      const customConfig = {
        host: 'custom-host',
        user: 'custom-user',
        password: 'custom-password',
        database: 'custom-db',
        ssl: true,
      };

      const pool = createDbPool(customConfig);

      expect(mockCreatePool).toHaveBeenCalledTimes(1);
      expect(mockCreatePool).toHaveBeenCalledWith(customConfig);
      expect(pool).toEqual({ mockPool: true });
    });
  });

  describe('getDbPool', () => {
    it('should create a new pool on first call', () => {
      const pool = getDbPool();

      expect(mockCreatePool).toHaveBeenCalledTimes(1);
      expect(pool).toEqual({ mockPool: true });
    });

    it('should return existing pool on subsequent calls', () => {
      const firstPool = getDbPool();
      expect(mockCreatePool).toHaveBeenCalledTimes(1);

      const secondPool = getDbPool();

      expect(mockCreatePool).toHaveBeenCalledTimes(1);

      expect(secondPool).toBe(firstPool);
    });
  });

  describe('resetDbPool', () => {
    it('should reset the pool instance so a new one is created next time', () => {
      getDbPool();
      expect(mockCreatePool).toHaveBeenCalledTimes(1);

      resetDbPool();

      getDbPool();

      expect(mockCreatePool).toHaveBeenCalledTimes(2);
    });
  });
});
