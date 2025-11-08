import { appLogger, cliLogger } from '@logger/logger';
import { GlobalErrorHandler } from '@utils/globalErrorHandler';
import { type Mock, afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the loggers
vi.mock('@logger/logger', () => ({
  appLogger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  cliLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('GlobalErrorHandler', () => {
  // Store original process methods
  const originalProcessOn = process.on;
  const originalProcessExit = process.exit;
  const originalSetTimeout = setTimeout;
  const originalListeners = {
    uncaughtException: process.listeners('uncaughtException'),
    unhandledRejection: process.listeners('unhandledRejection'),
    warning: process.listeners('warning'),
  };

  // Mock containers
  let mockProcessOn: Mock;
  let mockProcessExit: Mock;
  let mockSetTimeout: Mock;
  let registeredHandlers: Map<string, Function>;

  beforeAll(() => {
    // Remove any existing listeners to prevent interference
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('warning');
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset the initialized state using reflection
    (GlobalErrorHandler as any).initialized = false;

    // Create mock functions
    mockProcessOn = vi.fn();
    mockProcessExit = vi.fn().mockImplementation(() => {
      // Don't actually exit in tests
      return undefined as never;
    });
    mockSetTimeout = vi.fn((callback: Function, delay: number) => {
      // Immediately execute the callback for testing purposes
      callback();
      return { unref: vi.fn() } as unknown as NodeJS.Timeout;
    });

    // Track registered handlers
    registeredHandlers = new Map();
    mockProcessOn.mockImplementation((event: string, handler: Function) => {
      registeredHandlers.set(event, handler);
      return process; // Return process for chaining
    });

    // Replace process methods with proper typing
    process.on = mockProcessOn as any;
    (process.exit as any) = mockProcessExit;
    global.setTimeout = mockSetTimeout as any;
  });

  afterEach(() => {
    // Restore original methods
    process.on = originalProcessOn as any;
    (process.exit as any) = originalProcessExit;
    global.setTimeout = originalSetTimeout;

    // Reset the initialized state
    (GlobalErrorHandler as any).initialized = false;

    // Remove any listeners that might have been added during tests
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('warning');
  });

  afterAll(() => {
    // Restore original listeners
    originalListeners.uncaughtException.forEach((listener) => {
      process.on('uncaughtException', listener as any);
    });
    originalListeners.unhandledRejection.forEach((listener) => {
      process.on('unhandledRejection', listener as any);
    });
    originalListeners.warning.forEach((listener) => {
      process.on('warning', listener as any);
    });
  });

  describe('initialize', () => {
    it('should initialize global error handlers successfully', () => {
      GlobalErrorHandler.initialize();

      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('warning', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledTimes(3);

      expect(cliLogger.info).toHaveBeenCalledWith('Global error handlers initialized');
      expect(GlobalErrorHandler.isInitialized()).toBe(true);
    });

    it('should not initialize handlers multiple times', () => {
      GlobalErrorHandler.initialize();
      GlobalErrorHandler.initialize();

      // Should only be called once
      expect(mockProcessOn).toHaveBeenCalledTimes(3);
      expect(cliLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should handle uncaught exceptions', () => {
      GlobalErrorHandler.initialize();

      const uncaughtExceptionHandler = registeredHandlers.get('uncaughtException')!;
      const testError = new Error('Test uncaught exception');
      testError.stack = 'Error stack trace';

      uncaughtExceptionHandler(testError);

      expect(cliLogger.error).toHaveBeenCalledWith('Uncaught Exception: Test uncaught exception');
      expect(appLogger.error).toHaveBeenCalledWith('Uncaught Exception', {
        error: {
          name: 'Error',
          message: 'Test uncaught exception',
          stack: 'Error stack trace',
        },
        errorInfo: undefined,
        codePrefix: undefined,
      });

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle uncaught exceptions with additional properties', () => {
      GlobalErrorHandler.initialize();

      const uncaughtExceptionHandler = registeredHandlers.get('uncaughtException')!;
      const testError = new Error('Test error with extras') as any;
      testError.errorInfo = { code: 'E001', context: 'test' };
      testError.codePrefix = 'DATABASE_ERROR';

      uncaughtExceptionHandler(testError);

      expect(appLogger.error).toHaveBeenCalledWith('Uncaught Exception', {
        error: {
          name: 'Error',
          message: 'Test error with extras',
          stack: testError.stack,
        },
        errorInfo: { code: 'E001', context: 'test' },
        codePrefix: 'DATABASE_ERROR',
      });
    });

    it('should handle unhandled promise rejections with Error objects', () => {
      GlobalErrorHandler.initialize();

      const unhandledRejectionHandler = registeredHandlers.get('unhandledRejection')!;
      const testError = new Error('Test promise rejection');
      testError.stack = 'Promise rejection stack';
      // Create a mock promise object instead of a real rejected promise
      const mockPromise = {
        toString: () => 'Promise { <rejected> Error: Test promise rejection }',
      };

      unhandledRejectionHandler(testError, mockPromise);

      expect(cliLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection: Error: Test promise rejection');
      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: {
          name: 'Error',
          message: 'Test promise rejection',
          stack: 'Promise rejection stack',
          errorInfo: undefined,
          codePrefix: undefined,
        },
        promise: 'Promise { <rejected> Error: Test promise rejection }',
      });
    });

    it('should handle unhandled promise rejections with Error objects having extra properties', () => {
      GlobalErrorHandler.initialize();

      const unhandledRejectionHandler = registeredHandlers.get('unhandledRejection')!;
      const testError = new Error('Test promise rejection') as any;
      testError.errorInfo = { userId: 123 };
      testError.codePrefix = 'API_ERROR';
      // Create a mock promise object instead of a real rejected promise
      const mockPromise = {
        toString: () => 'Promise { <rejected> Error: Test promise rejection }',
      };

      unhandledRejectionHandler(testError, mockPromise);

      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: {
          name: 'Error',
          message: 'Test promise rejection',
          stack: testError.stack,
          errorInfo: { userId: 123 },
          codePrefix: 'API_ERROR',
        },
        promise: 'Promise { <rejected> Error: Test promise rejection }',
      });
    });

    it('should handle unhandled promise rejections with non-Error objects', () => {
      GlobalErrorHandler.initialize();

      const unhandledRejectionHandler = registeredHandlers.get('unhandledRejection')!;
      const testReason = 'String rejection reason';
      // Create a mock promise object instead of a real rejected promise
      const mockPromise = {
        toString: () => 'Promise { <rejected> "String rejection reason" }',
      };

      unhandledRejectionHandler(testReason, mockPromise);

      expect(cliLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection: String rejection reason');
      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: 'String rejection reason',
        promise: 'Promise { <rejected> "String rejection reason" }',
      });
    });

    it('should handle unhandled promise rejections with object reasons', () => {
      GlobalErrorHandler.initialize();

      const unhandledRejectionHandler = registeredHandlers.get('unhandledRejection')!;
      const testReason = { code: 'ERR001', message: 'Custom error object' };
      // Create a mock promise object instead of a real rejected promise
      const mockPromise = {
        toString: () => 'Promise { <rejected> { code: "ERR001", message: "Custom error object" } }',
      };

      unhandledRejectionHandler(testReason, mockPromise);

      expect(cliLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection: [object Object]');
      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: { code: 'ERR001', message: 'Custom error object' },
        promise: 'Promise { <rejected> { code: "ERR001", message: "Custom error object" } }',
      });
    });

    it('should handle process warnings', () => {
      GlobalErrorHandler.initialize();

      const warningHandler = registeredHandlers.get('warning')!;
      const testWarning = new Error('Test warning message');
      testWarning.name = 'DeprecationWarning';
      testWarning.stack = 'Warning stack trace';

      warningHandler(testWarning);

      expect(cliLogger.warn).toHaveBeenCalledWith('Warning: Test warning message');
      expect(appLogger.warn).toHaveBeenCalledWith('Process Warning', {
        name: 'DeprecationWarning',
        message: 'Test warning message',
        stack: 'Warning stack trace',
      });
    });
  });

  describe('logError', () => {
    beforeEach(() => {
      // Don't need to initialize for this test, just testing the static method
    });

    it('should log error without context', () => {
      const testError = new Error('Test manual error');
      testError.stack = 'Manual error stack';

      GlobalErrorHandler.logError(testError);

      expect(cliLogger.error).toHaveBeenCalledWith('Test manual error');
      expect(appLogger.error).toHaveBeenCalledWith('Error', {
        error: {
          name: 'Error',
          message: 'Test manual error',
          stack: 'Manual error stack',
        },
        errorInfo: undefined,
        codePrefix: undefined,
      });
    });

    it('should log error with context', () => {
      const testError = new Error('Test manual error');
      testError.stack = 'Manual error stack';

      GlobalErrorHandler.logError(testError, 'Database Operation');

      expect(cliLogger.error).toHaveBeenCalledWith('Database Operation: Test manual error');
      expect(appLogger.error).toHaveBeenCalledWith('Database Operation', {
        error: {
          name: 'Error',
          message: 'Test manual error',
          stack: 'Manual error stack',
        },
        errorInfo: undefined,
        codePrefix: undefined,
      });
    });

    it('should log error with additional properties', () => {
      const testError = new Error('Test error with props') as any;
      testError.errorInfo = { transactionId: 'tx123' };
      testError.codePrefix = 'PAYMENT_ERROR';

      GlobalErrorHandler.logError(testError, 'Payment Processing');

      expect(cliLogger.error).toHaveBeenCalledWith('Payment Processing: Test error with props');
      expect(appLogger.error).toHaveBeenCalledWith('Payment Processing', {
        error: {
          name: 'Error',
          message: 'Test error with props',
          stack: testError.stack,
        },
        errorInfo: { transactionId: 'tx123' },
        codePrefix: 'PAYMENT_ERROR',
      });
    });

    it('should handle errors without stack traces', () => {
      const testError = new Error('Test error without stack');
      delete testError.stack;

      GlobalErrorHandler.logError(testError);

      expect(appLogger.error).toHaveBeenCalledWith('Error', {
        error: {
          name: 'Error',
          message: 'Test error without stack',
          stack: undefined,
        },
        errorInfo: undefined,
        codePrefix: undefined,
      });
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string,
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const testError = new CustomError('Custom error message', 'CUSTOM_001') as any;
      testError.errorInfo = { customProp: 'value' };

      GlobalErrorHandler.logError(testError, 'Custom Context');

      expect(appLogger.error).toHaveBeenCalledWith('Custom Context', {
        error: {
          name: 'CustomError',
          message: 'Custom error message',
          stack: testError.stack,
        },
        errorInfo: { customProp: 'value' },
        codePrefix: undefined,
      });
    });
  });

  describe('isInitialized', () => {
    it('should return false when not initialized', () => {
      expect(GlobalErrorHandler.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      GlobalErrorHandler.initialize();
      expect(GlobalErrorHandler.isInitialized()).toBe(true);
    });

    it('should remain true after multiple initialization attempts', () => {
      GlobalErrorHandler.initialize();
      GlobalErrorHandler.initialize();
      expect(GlobalErrorHandler.isInitialized()).toBe(true);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle errors thrown during error handling by letting them propagate', () => {
      // Mock cliLogger.error to throw an error
      (cliLogger.error as Mock).mockImplementationOnce(() => {
        throw new Error('Logger error');
      });

      // The error should propagate since logError doesn't catch logger errors
      expect(() => {
        GlobalErrorHandler.logError(new Error('Test error'));
      }).toThrow('Logger error');
    });

    it('should handle errors with circular references in extra properties', () => {
      const testError = new Error('Test error') as any;
      const circularRef = { self: null as any };
      circularRef.self = circularRef;
      testError.errorInfo = circularRef;

      expect(() => {
        GlobalErrorHandler.logError(testError);
      }).not.toThrow();

      expect(appLogger.error).toHaveBeenCalledWith('Error', {
        error: {
          name: 'Error',
          message: 'Test error',
          stack: testError.stack,
        },
        errorInfo: circularRef,
        codePrefix: undefined,
      });
    });

    it('should handle promise rejection with null/undefined reasons', () => {
      GlobalErrorHandler.initialize();

      const unhandledRejectionHandler = registeredHandlers.get('unhandledRejection')!;
      // Create mock promise objects instead of real rejected promises
      const mockPromiseNull = {
        toString: () => 'Promise { <rejected> null }',
      };
      const mockPromiseUndefined = {
        toString: () => 'Promise { <rejected> undefined }',
      };

      unhandledRejectionHandler(null, mockPromiseNull);

      expect(cliLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection: null');
      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: null,
        promise: 'Promise { <rejected> null }',
      });

      // Test undefined as well
      unhandledRejectionHandler(undefined, mockPromiseUndefined);

      expect(cliLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection: undefined');
      expect(appLogger.error).toHaveBeenCalledWith('Unhandled Promise Rejection', {
        reason: undefined,
        promise: 'Promise { <rejected> undefined }',
      });
    });

    it('should handle warnings without stack traces', () => {
      GlobalErrorHandler.initialize();

      const warningHandler = registeredHandlers.get('warning')!;
      const testWarning = new Error('Warning without stack');
      testWarning.name = 'ExperimentalWarning';
      delete testWarning.stack;

      warningHandler(testWarning);

      expect(appLogger.warn).toHaveBeenCalledWith('Process Warning', {
        name: 'ExperimentalWarning',
        message: 'Warning without stack',
        stack: undefined,
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly in a typical application lifecycle', () => {
      // Initialize
      expect(GlobalErrorHandler.isInitialized()).toBe(false);
      GlobalErrorHandler.initialize();
      expect(GlobalErrorHandler.isInitialized()).toBe(true);

      // Manually log some errors
      GlobalErrorHandler.logError(new Error('Startup error'), 'Application Start');

      // Simulate an uncaught exception
      const uncaughtHandler = registeredHandlers.get('uncaughtException')!;
      uncaughtHandler(new Error('Fatal error'));

      // Verify all calls were made
      expect(cliLogger.info).toHaveBeenCalledWith('Global error handlers initialized');
      expect(cliLogger.error).toHaveBeenCalledWith('Application Start: Startup error');
      expect(cliLogger.error).toHaveBeenCalledWith('Uncaught Exception: Fatal error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should maintain registration state across multiple operations', () => {
      GlobalErrorHandler.initialize();

      // Verify handlers are registered
      expect(registeredHandlers.has('uncaughtException')).toBe(true);
      expect(registeredHandlers.has('unhandledRejection')).toBe(true);
      expect(registeredHandlers.has('warning')).toBe(true);

      // Log multiple errors
      GlobalErrorHandler.logError(new Error('Error 1'));
      GlobalErrorHandler.logError(new Error('Error 2'), 'Context 2');

      // Trigger handlers
      const warningHandler = registeredHandlers.get('warning')!;
      warningHandler(new Error('Test warning'));

      // Verify everything still works
      expect(cliLogger.error).toHaveBeenCalledWith('Error 1');
      expect(cliLogger.error).toHaveBeenCalledWith('Context 2: Error 2');
      expect(cliLogger.warn).toHaveBeenCalledWith('Warning: Test warning');
    });
  });
});
