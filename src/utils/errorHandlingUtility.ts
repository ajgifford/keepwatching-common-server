import { CustomError, DatabaseError } from '../middleware/errorMiddleware';

/**
 * Helper function to handle database errors consistently
 *
 * This function standardizes error handling for database operations,
 * ensuring that CustomErrors are propagated while other errors are
 * wrapped in a DatabaseError with a consistent message format.
 *
 * @param error - The caught error to handle
 * @param contextMessage - A message describing the operation context (e.g., "retrieving shows count")
 * @returns Never returns, always throws an error
 * @throws {CustomError} If the error is already a CustomError
 * @throws {DatabaseError} For all other errors, wrapped with a consistent message
 *
 * @example
 * try {
 *   // Database operation here
 * } catch (error) {
 *   handleDatabaseError(error, "retrieving shows count");
 * }
 */
export function handleDatabaseError(error: unknown, contextMessage: string): never {
  if (error instanceof CustomError) {
    throw error;
  }

  const errorMessage =
    error instanceof Error
      ? `Database error ${contextMessage}: ${error.message}`
      : `Unknown database error ${contextMessage}`;

  throw new DatabaseError(errorMessage, error);
}
