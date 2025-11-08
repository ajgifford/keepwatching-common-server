import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
import { PoolConnection } from 'mysql2/promise';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database pool
vi.mock('@utils/db', () => ({
  getDbPool: vi.fn(),
}));

describe('TransactionHelper', () => {
  // Create mock objects for connection and pool
  let mockConnection: Partial<PoolConnection>;
  let mockPool: { getConnection: Mock };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock connection with all required methods
    mockConnection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };

    // Create mock pool
    mockPool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    // Configure getDbPool mock to return our mock pool
    (getDbPool as Mock).mockReturnValue(mockPool);
  });

  describe('executeInTransaction', () => {
    it('should execute callback within a transaction and commit on success', async () => {
      // Create transaction helper
      const transactionHelper = new TransactionHelper();

      // Create a mock callback
      const mockCallback = vi.fn().mockResolvedValue('result value');

      // Execute the callback in a transaction
      const result = await transactionHelper.executeInTransaction(mockCallback);

      // Verify the transaction flow
      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      // Verify the result
      expect(result).toBe('result value');
    });

    it('should rollback the transaction on error', async () => {
      // Create transaction helper
      const transactionHelper = new TransactionHelper();

      // Create a mock error
      const mockError = new Error('Transaction failed');

      // Create a mock callback that throws an error
      const mockCallback = vi.fn().mockRejectedValue(mockError);

      // Execute the callback in a transaction and expect it to throw
      await expect(transactionHelper.executeInTransaction(mockCallback)).rejects.toThrow(mockError);

      // Verify the transaction flow
      expect(getDbPool).toHaveBeenCalledTimes(1);
      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release the connection even if rollback fails', async () => {
      // Create transaction helper
      const transactionHelper = new TransactionHelper();

      // Create mock errors
      const callbackError = new Error('Transaction failed');
      const rollbackError = new Error('Rollback failed');

      // Create a mock callback that throws an error
      const mockCallback = vi.fn().mockRejectedValue(callbackError);

      // Make rollback throw an error
      (mockConnection.rollback as Mock).mockRejectedValue(rollbackError);

      // Execute the callback in a transaction and expect it to throw the rollback error
      // since that's the last error that occurred in the try/catch flow
      await expect(transactionHelper.executeInTransaction(mockCallback)).rejects.toThrow(rollbackError);

      // Verify the connection was still released
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should handle synchronous errors in the callback', async () => {
      // Create transaction helper
      const transactionHelper = new TransactionHelper();

      // Create a mock error
      const mockError = new Error('Synchronous error');

      // Create a mock callback that throws a synchronous error
      const mockCallback = vi.fn().mockImplementation(() => {
        throw mockError;
      });

      // Execute the callback in a transaction and expect it to throw
      await expect(transactionHelper.executeInTransaction(mockCallback)).rejects.toThrow(mockError);

      // Verify the transaction flow
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });
});
