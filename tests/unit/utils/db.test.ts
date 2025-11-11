import { getDBConfig } from '@config/config';
import { createDbPool, getDbPool, resetDbPool } from '@utils/db';
import mysql from 'mysql2/promise';

// Mock mysql2/promise with a mock that will be accessible
jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createPool: jest.fn().mockReturnValue({ mockPool: true }),
  },
}));

jest.mock('@config/config', () => ({
  getDBConfig: jest.fn().mockReturnValue({
    host: 'test-host',
    user: 'test-user',
    password: 'test-password',
    database: 'test-db',
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
  }),
}));

describe('db utility', () => {
  beforeEach(() => {
    // Reset the pool instance before each test
    resetDbPool();
    // Clear the mock call history but restore the mock implementation
    jest.clearAllMocks();
    // Re-establish the mock return values after clearing
    (mysql.createPool as jest.Mock).mockReturnValue({ mockPool: true });
    (getDBConfig as jest.Mock).mockReturnValue({
      host: 'test-host',
      user: 'test-user',
      password: 'test-password',
      database: 'test-db',
      waitForConnections: true,
      connectionLimit: 100,
      queueLimit: 0,
    });
  });

  describe('createDbPool', () => {
    it('should create a pool with environment variables when no config is provided', () => {
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
      const pool = getDbPool();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
      expect(pool).toEqual({ mockPool: true });
    });

    it('should return existing pool on subsequent calls', () => {
      const firstPool = getDbPool();
      expect(mysql.createPool).toHaveBeenCalledTimes(1);

      const secondPool = getDbPool();

      expect(mysql.createPool).toHaveBeenCalledTimes(1);

      expect(secondPool).toBe(firstPool);
    });
  });

  describe('resetDbPool', () => {
    it('should reset the pool instance so a new one is created next time', () => {
      getDbPool();
      expect(mysql.createPool).toHaveBeenCalledTimes(1);

      resetDbPool();

      getDbPool();

      expect(mysql.createPool).toHaveBeenCalledTimes(2);
    });
  });
});
