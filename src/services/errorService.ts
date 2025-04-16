import {
  BadRequestError,
  ConflictError,
  CustomError,
  DatabaseError,
  NotFoundError,
} from '../middleware/errorMiddleware';
import { AxiosError } from 'axios';

interface TMDBErrorResponse {
  message?: string;
  status_message?: string;
  error?: {
    message?: string;
  };
}

export class ErrorService {
  /**
   * Handles errors in a consistent way across the application
   * @param error The error to handle
   * @param context Additional context information
   * @returns A consistent CustomError object
   */
  public handleError(error: unknown, context: string): CustomError {
    if (error instanceof CustomError) {
      return error;
    }

    if (error instanceof AxiosError) {
      return this.handleAxiosError(error, context);
    }

    if (error instanceof Error) {
      if (error.message.includes('database') || error.message.includes('sql') || error.message.includes('query')) {
        return new DatabaseError(`Database error in ${context}: ${error.message}`, error);
      }

      return new BadRequestError(`Error in ${context}: ${error.message}`);
    }

    return new BadRequestError(`Unknown error in ${context}`);
  }

  /**
   * Special handling for Axios errors (external API calls)
   */
  private handleAxiosError(error: AxiosError, context: string): CustomError {
    if (error.response) {
      const status = error.response.status;

      // Rate limiting
      if (status === 429) {
        return new BadRequestError(`External API rate limit reached. Please try again later.`);
      }

      // Not found
      if (status === 404) {
        return new NotFoundError(`Resource not found in external API: ${context}`);
      }

      // Authentication issues
      if (status === 401 || status === 403) {
        return new BadRequestError(`Authentication error with external API: ${error.response.statusText}`);
      }

      // Server error
      if (status >= 500) {
        return new BadRequestError(`External API server error: ${error.response.statusText}`);
      }

      // Get error message from response if available
      const errorData = error.response.data as TMDBErrorResponse;
      const message = errorData.message || errorData.status_message || errorData.error?.message || error.message;

      return new BadRequestError(`External API error: ${message}`);
    }

    // Network error (no response)
    if (error.request) {
      return new BadRequestError(`Network error: Unable to reach external API`);
    }

    // Something happened in setting up the request
    return new BadRequestError(`Error setting up API request: ${error.message}`);
  }

  /**
   * Assert that an entity exists, throwing a NotFoundError if it doesn't
   * @param entity The entity to check
   * @param entityName The name of the entity for the error message
   * @param id The ID of the entity
   * @throws NotFoundError if the entity doesn't exits
   */
  public assertExists<T>(entity: T | null | undefined, entityName: string, id: string | number): asserts entity is T {
    if (!entity) {
      throw new NotFoundError(`${entityName} with ID ${id} not found`);
    }
  }

  /**
   * Assert that an entity does not exist, throwing a ConflictError if it does
   * @param entity The entity to check
   * @param entityName The name of the entity for the error message
   * @param fieldName The name of the field on which the entity was searched
   * @param fieldValue The value of the field on which the entity was searched
   * @throws ConflictError if the entity exists
   */
  public assertNotExists<T>(
    entity: T | null | undefined,
    entityName: string,
    fieldName: string,
    fieldValue: string,
  ): asserts entity is T {
    if (entity) {
      throw new ConflictError(`${entityName} with ${fieldName} ${fieldValue} already exists`);
    }
  }
}

export const errorService: ErrorService = new ErrorService();
