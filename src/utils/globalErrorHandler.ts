import { appLogger, cliLogger } from '../logger/logger';
import { TimestampUtil } from './timestampUtil';

/**
 * Global error handler for uncaught exceptions and unhandled Promise rejections
 * This ensures all errors are logged through your winston logger with timestamps
 */
export class GlobalErrorHandler {
  private static initialized = false;

  /**
   * Initialize global error handlers
   * Should be called once early in your application startup
   */
  public static initialize(): void {
    if (GlobalErrorHandler.initialized) {
      return;
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      cliLogger.error(`Uncaught Exception: ${error.message}`);
      appLogger.error('Uncaught Exception', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: (error as any).errorInfo || undefined,
        codePrefix: (error as any).codePrefix || undefined,
      });

      // Give winston a chance to write the log before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      cliLogger.error(`Unhandled Promise Rejection: ${reason}`);
      appLogger.error('Unhandled Promise Rejection', {
        reason:
          reason instanceof Error
            ? {
                name: reason.name,
                message: reason.message,
                stack: reason.stack,
                errorInfo: (reason as any).errorInfo || undefined,
                codePrefix: (reason as any).codePrefix || undefined,
              }
            : reason,
        promise: promise.toString(),
      });
    });

    // Handle warnings (optional)
    process.on('warning', (warning: Error) => {
      cliLogger.warn(`Warning: ${warning.message}`);
      appLogger.warn('Process Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });

    GlobalErrorHandler.initialized = true;
    cliLogger.info('Global error handlers initialized');
  }

  /**
   * Manually log an error through the global handler
   * Useful for catching and logging errors in specific contexts
   */
  public static logError(error: Error, context?: string): void {
    const message = context ? `${context}: ${error.message}` : error.message;

    cliLogger.error(message);
    appLogger.error(context || 'Error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: (error as any).errorInfo || undefined,
      codePrefix: (error as any).codePrefix || undefined,
    });
  }

  /**
   * Override console.error to ensure timestamps in all console output
   * This ensures any library errors that use console.error get timestamps
   */
  public static overrideConsoleError(): void {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const timestamp = TimestampUtil.forConsoleLogging();
      originalConsoleError(`[${timestamp}] ERROR:`, ...args);
    };

    const originalConsoleWarn = console.warn;
    console.warn = (...args: any[]) => {
      const timestamp = TimestampUtil.forConsoleLogging();
      originalConsoleWarn(`[${timestamp}] WARN:`, ...args);
    };

    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      const timestamp = TimestampUtil.forConsoleLogging();
      originalConsoleLog(`[${timestamp}] INFO:`, ...args);
    };
  }

  /**
   * Check if global error handlers are initialized
   */
  public static isInitialized(): boolean {
    return GlobalErrorHandler.initialized;
  }
}
