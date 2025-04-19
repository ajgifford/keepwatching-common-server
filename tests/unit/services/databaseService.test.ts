import { cliLogger } from '@logger/logger';
import { DatabaseService, databaseService } from '@services/databaseService';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@utils/db', () => {
  const mockPool = {
    end: jest.fn().mockResolvedValue(undefined),
  };

  return {
    getDbPool: jest.fn(() => mockPool),
    resetDbPool: jest.fn(),
    createDbPool: jest.fn(() => mockPool),
  };
});

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DatabaseService.reset();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getPool', () => {
    it('should return the database pool', () => {
      const pool = databaseService.getPool();

      expect(pool).toBeDefined();
      expect(pool.end).toBeDefined();
    });
  });

  describe('isInShutdownMode', () => {
    it('should return false by default', () => {
      const isShuttingDown = databaseService.isInShutdownMode();

      expect(isShuttingDown).toBe(false);
    });

    it('should return true during shutdown', async () => {
      const originalMethod = databaseService.isInShutdownMode;
      databaseService.isInShutdownMode = jest.fn().mockReturnValue(true);

      expect(databaseService.isInShutdownMode()).toBe(true);

      databaseService.isInShutdownMode = originalMethod;
    });
  });

  describe('shutdown', () => {
    it('should close the database pool', async () => {
      const pool = databaseService.getPool();

      await databaseService.shutdown();

      expect(pool.end).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Closing database connections...');
      expect(cliLogger.info).toHaveBeenCalledWith('Database connections closed successfully');
    });

    it('should log an error if pool closing fails', async () => {
      const pool = databaseService.getPool();
      const error = new Error('Connection error');
      (pool.end as jest.Mock).mockRejectedValueOnce(error);

      await expect(databaseService.shutdown()).rejects.toThrow('Connection error');
      expect(cliLogger.error).toHaveBeenCalledWith('Error closing database connections', error);
    });

    it('should not attempt another shutdown if one is in progress', async () => {
      const originalIsInShutdownMode = databaseService.isInShutdownMode;
      databaseService.isInShutdownMode = jest.fn().mockReturnValue(true);

      await databaseService.shutdown();

      expect(cliLogger.info).toHaveBeenCalledWith('Database shutdown already in progress');
      expect(databaseService.getPool().end).not.toHaveBeenCalled();

      databaseService.isInShutdownMode = originalIsInShutdownMode;
    });
  });

  describe('static reset', () => {
    it('should reset the database service instance', () => {
      const instance = DatabaseService.getInstance();
      const resetDbPoolMock = require('@utils/db').resetDbPool;

      DatabaseService.reset();

      expect(resetDbPoolMock).toHaveBeenCalled();

      const newInstance = DatabaseService.getInstance();

      expect(newInstance).not.toBe(instance);
    });
  });
});
