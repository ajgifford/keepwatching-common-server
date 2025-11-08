import { cliLogger } from '../logger/logger';
import { TransientApiError } from '../middleware/errorMiddleware';
import { AxiosError } from 'axios';

/**
 * Options for configuring retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds between retries */
  baseDelay?: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay?: number;
  /** Jitter factor (0-1) to add randomness to delay */
  jitter?: number;
  /** Whether to log retry attempts */
  logRetries?: boolean;
  /** List of HTTP status codes that should trigger a retry */
  retryableStatusCodes?: number[];
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  jitter: 0.2, // 20% jitter
  logRetries: true,
  retryableStatusCodes: [408, 429, 502, 503, 504],
};

/**
 * Determines if an HTTP status code should trigger a retry
 * @param status - HTTP status code
 * @param retryableStatusCodes - List of status codes that should trigger a retry
 * @returns True if the status code should trigger a retry
 */
export function isRetriableStatus(
  status?: number,
  retryableStatusCodes = DEFAULT_RETRY_OPTIONS.retryableStatusCodes,
): boolean {
  if (!status) return false;
  return retryableStatusCodes.includes(status);
}

/**
 * Calculates the delay before the next retry with exponential backoff and jitter
 *
 * @param error - The error that triggered the retry
 * @param retry - Current retry attempt (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(error: any, retry: number, options: Required<RetryOptions>): number {
  // First check if the server specified a Retry-After header
  const retryAfter = error.response?.headers?.['retry-after']
    ? parseInt(error.response.headers['retry-after']) * 1000
    : null;

  if (retryAfter) return retryAfter;

  // Calculate exponential backoff with jitter
  const exponentialDelay = options.baseDelay * Math.pow(2, retry);
  const jitterFactor = 1 - options.jitter + Math.random() * options.jitter * 2;

  return Math.min(exponentialDelay * jitterFactor, options.maxDelay);
}

/**
 * Determines if an error should trigger a retry
 *
 * @param error - The error to check
 * @param retryableStatusCodes - List of status codes that should trigger a retry
 * @returns True if the error should trigger a retry
 */
export function isRetriableError(
  error: any,
  retryableStatusCodes = DEFAULT_RETRY_OPTIONS.retryableStatusCodes,
): boolean {
  // TransientApiError is explicitly designed to be retriable
  if (error instanceof TransientApiError) {
    return true;
  }

  // Retry for specific HTTP status codes
  if (error instanceof AxiosError && error.response) {
    return isRetriableStatus(error.response.status, retryableStatusCodes);
  }

  // Network errors (connection refused, timeout, etc.) are generally retriable
  if (error instanceof AxiosError && !error.response && error.request) {
    return true;
  }

  return false;
}

/**
 * Executes a function with retry logic
 *
 * This utility function will retry the provided function when it fails with retriable errors,
 * implementing exponential backoff with jitter to prevent thundering herd problems.
 *
 * @param fn - The function to execute with retry logic
 * @param options - Retry configuration options
 * @param context - Description of the operation for logging
 * @returns The result of the function execution
 * @throws The last error encountered if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
  context: string = 'operation',
): Promise<T> {
  // Merge provided options with defaults
  const mergedOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | null = null;

  // We start from 0 and go up to maxRetries, giving maxRetries+1 total attempts
  for (let retry = 0; retry <= mergedOptions.maxRetries; retry++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this is not a retriable error, throw immediately
      if (!isRetriableError(error, mergedOptions.retryableStatusCodes)) {
        throw error;
      }

      // If this was our last attempt, throw the error
      if (retry === mergedOptions.maxRetries) {
        throw error;
      }

      // Calculate delay for next retry
      const delay = calculateRetryDelay(error, retry, mergedOptions);

      // Log retry attempt if enabled
      if (mergedOptions.logRetries) {
        cliLogger.info(
          `Retrying ${context} after error. Attempt ${retry + 1}/${mergedOptions.maxRetries} in ${delay}ms`,
        );
      }

      // Wait before next retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This shouldn't be reachable, but TypeScript requires a return statement
  throw lastError || new Error(`Unknown error in ${context}`);
}
