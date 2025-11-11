/**
 * Common test setup utilities for database module tests
 * Provides consistent mocking for DbMonitor, database pools, and transactions
 */
import { getDbPool } from '@utils/db';
import { DbMonitor } from '@utils/dbMonitoring';
import { TransactionHelper } from '@utils/transactionHelper';

// Mock all common database dependencies at module level
jest.mock('@utils/db');
jest.mock('@utils/transactionHelper');
jest.mock('@utils/dbMonitoring');

/**
 * Setup DbMonitor mock to execute queries immediately without timing overhead
 * This should be called in beforeEach of test files
 */
export function setupDbMonitorMock(): jest.Mocked<DbMonitor> {
  const mockDbMonitor = {
    executeWithTiming: jest.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
      return await queryFn();
    }),
    getStats: jest.fn().mockResolvedValue([]),
    logStats: jest.fn().mockResolvedValue(undefined),
    clearStats: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DbMonitor>;

  (DbMonitor.getInstance as jest.Mock).mockReturnValue(mockDbMonitor);
  (DbMonitor.createInstance as jest.Mock).mockReturnValue(mockDbMonitor);
  (DbMonitor.resetInstance as jest.Mock).mockImplementation(() => {});

  return mockDbMonitor;
}

/**
 * Setup database pool mock with execute and query methods
 * Returns the mock pool and individual method mocks for assertions
 */
export function setupDbPoolMock() {
  const mockExecute = jest.fn();
  const mockQuery = jest.fn();
  const mockRelease = jest.fn();

  const mockConnection = {
    execute: mockExecute,
    query: mockQuery,
    release: mockRelease,
  };

  const mockGetConnection = jest.fn().mockResolvedValue(mockConnection);

  const mockPool = {
    execute: mockExecute,
    query: mockQuery,
    getConnection: mockGetConnection,
  };

  (getDbPool as jest.Mock).mockReturnValue(mockPool);

  return {
    mockPool,
    mockExecute,
    mockQuery,
    mockConnection,
    mockGetConnection,
  };
}

/**
 * Setup TransactionHelper mock that executes callback with mock connection
 * Returns the mock transaction helper and connection for assertions
 */
export function setupTransactionHelperMock(mockConnection: any) {
  const mockExecuteInTransaction = jest.fn().mockImplementation(async (callback) => {
    return callback(mockConnection);
  });

  const mockTransactionHelper = {
    executeInTransaction: mockExecuteInTransaction,
  } as unknown as jest.Mocked<TransactionHelper>;

  (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);

  return {
    mockTransactionHelper,
    mockConnection,
    mockExecuteInTransaction,
  };
}

/**
 * Complete database test setup that initializes all common mocks
 * This is a convenience function that calls all setup functions
 *
 * @example
 * ```typescript
 * import { setupDatabaseTest } from '../helpers/dbTestSetup';
 *
 * describe('myDb', () => {
 *   let mockExecute: jest.Mock;
 *   let mockQuery: jest.Mock;
 *   let mockTransactionHelper: jest.Mocked<TransactionHelper>;
 *
 *   beforeEach(() => {
 *     jest.clearAllMocks();
 *     const mocks = setupDatabaseTest();
 *     mockExecute = mocks.mockExecute;
 *     mockQuery = mocks.mockQuery;
 *     mockTransactionHelper = mocks.mockTransactionHelper;
 *   });
 *
 *   // ... tests
 * });
 * ```
 */
export function setupDatabaseTest() {
  const dbMonitor = setupDbMonitorMock();
  const { mockPool, mockExecute, mockQuery, mockConnection, mockGetConnection } = setupDbPoolMock();
  const { mockTransactionHelper, mockExecuteInTransaction } = setupTransactionHelperMock(mockConnection);

  return {
    // DbMonitor
    mockDbMonitor: dbMonitor,

    // Database pool
    mockPool,
    mockExecute,
    mockQuery,
    mockGetConnection,

    // Transaction helper
    mockTransactionHelper,
    mockConnection,
    mockExecuteInTransaction,
  };
}
