import { createDbPool, getDbPool, resetDbPool } from '@utils/db';
import mysql from 'mysql2/promise';

// Mock mysql2/promise
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn().mockReturnValue({ mockPool: true })
}));

describe('db utility', () => {
  // Save original process.env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module state between tests
    resetDbPool();
    
    // Reset process.env
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Reset mock call counts
    (mysql.createPool as jest.Mock).mockClear();
  });

  afterAll(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  describe('createDbPool', () => {
    it('should create a pool with environment variables when no config is provided', () => {
      // Set up environment variables
      process.env.MYSQL_HOST = 'test-host';
      process.env.MYSQL_USER = 'test-user';
      process.env.MYSQL_PWD = 'test-password';
      process.env.MYSQL_DB = 'test-db';

      const pool = createDbPool();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'test-host',
        user: 'test-user',
        password: 'test-password',
        database: 'test-db',
        waitForConnections: true,
        connectionLimit: 100,
        queueLimit: 0,
      });
      expect(pool).toEqual({ mockPool: true });
    });

    it('should create a pool with provided config instead of environment variables', () => {
      // Set up environment variables (that shouldn't be used)
      process.env.MYSQL_HOST = 'env-host';
      
      // Create custom config
      const customConfig = {
        host: 'custom-host',
        user: 'custom-user',
        password: 'custom-password',
        database: 'custom-db',
        ssl: true,
      };

      const pool = createDbPool(customConfig);

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      expect(mysql.createPool).toHaveBeenCalledWith(customConfig);
      expect(pool).toEqual({ mockPool: true });
    });
  });

  describe('getDbPool', () => {
    it('should create a new pool on first call', () => {
      // Set up environment variables
      process.env.MYSQL_HOST = 'test-host';
      process.env.MYSQL_USER = 'test-user';
      process.env.MYSQL_PWD = 'test-password';
      process.env.MYSQL_DB = 'test-db';

      const pool = getDbPool();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      expect(pool).toEqual({ mockPool: true });
    });

    it('should return existing pool on subsequent calls', () => {
      // Get pool for the first time
      const firstPool = getDbPool();
      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      
      // Get pool again
      const secondPool = getDbPool();
      
      // Should not create a new pool
      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      
      // Both references should be the same
      expect(secondPool).toBe(firstPool);
    });
  });

  describe('resetDbPool', () => {
    it('should reset the pool instance so a new one is created next time', () => {
      // Get pool for the first time
      getDbPool();
      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      
      // Reset the pool
      resetDbPool();
      
      // Get pool again
      getDbPool();
      
      // Should create a new pool
      expect(mysql.createPool).toHaveBeenCalledTimes(2);
    });
  });
});
