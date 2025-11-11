// Mock Winston logger globally to prevent file handle leaks
jest.mock('@logger/logger', () => ({
  appLogger: {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    close: jest.fn((callback) => callback && callback()),
  },
  cliLogger: {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    close: jest.fn((callback) => callback && callback()),
  },
  Logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    logRequest: jest.fn((req, res, next) => next()),
    logError: jest.fn(),
  },
  getResponseMessage: jest.fn(),
  formatAppLoggerResponse: jest.fn(),
}));

// Set a longer timeout for certain tests
jest.setTimeout(10000);

// Global setup before each test
beforeEach(() => {
  // Ensure we start with a clean state
  jest.clearAllMocks();
});

// Global cleanup after each test to prevent memory leaks and hanging processes
afterEach(() => {
  // Clear all mocks (already configured in jest.config.js with clearMocks: true)
  jest.clearAllMocks();

  // Reset all modules to prevent state leakage between tests
  jest.resetModules();

  // Restore real timers to prevent timer-related issues
  // This is critical for tests that use jest.useFakeTimers()
  jest.useRealTimers();
});
