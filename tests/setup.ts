// Set a longer timeout for certain tests
jest.setTimeout(10000);

// Mock dbMonitoring globally to prevent Redis connections during tests
jest.mock('@utils/dbMonitoring', () => {
  // const mockInstance = {
  //   executeWithTiming: jest.fn().mockImplementation(async (queryName, queryFn) => {
  //     return queryFn();
  //   }),
  //   getStats: jest.fn().mockResolvedValue([]),
  //   logStats: jest.fn().mockResolvedValue(undefined),
  //   clearStats: jest.fn().mockResolvedValue(undefined),
  //   disconnect: jest.fn().mockResolvedValue(undefined),
  // };

  // return {
  //   DbMonitor: jest.fn().mockImplementation(() => mockInstance),
  // };

  const executeWithTimingMock = jest.fn().mockImplementation(async (queryName, queryFn) => {
    return queryFn();
  });
  const getStatsMock = jest.fn().mockResolvedValue([]);
  const logStatsMock = jest.fn().mockResolvedValue(undefined);
  const clearStatsMock = jest.fn().mockResolvedValue(undefined);
  const disconnectMock = jest.fn().mockResolvedValue(undefined);

  let instance: any = {
    executeWithTiming: executeWithTimingMock,
    getStats: getStatsMock,
    logStats: logStatsMock,
    clearStats: clearStatsMock,
    disconnect: disconnectMock,
  };

  const getInstanceMock = jest.fn(() => instance);
  const resetInstanceMock = jest.fn(() => {
    instance = { executeWithTiming: jest.fn((_, fn) => fn()) };
  });

  return {
    DbMonitor: {
      getInstance: getInstanceMock,
      resetInstance: resetInstanceMock,
    },
  };
});

// Global cleanup after each test to prevent memory leaks and hanging processes
afterEach(() => {
  // Clear all mocks (clears mock call history and implementations)
  jest.clearAllMocks();
});

// Global cleanup after all tests in a file to fully restore the environment
afterAll(() => {
  // Restore all mocks to their original implementations
  jest.restoreAllMocks();

  // Ensure real timers are restored
  jest.useRealTimers();

  // Reset all modules to ensure clean state for next test file
  jest.resetModules();
});
