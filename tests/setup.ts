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

jest.setTimeout(10000);

// Restore real timers after each test for tests that use jest.useFakeTimers()
afterEach(() => {
  jest.useRealTimers();
});
