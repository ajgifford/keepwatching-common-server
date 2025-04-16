import { BadRequestError, ConflictError, CustomError, NotFoundError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { AxiosError } from 'axios';

describe('ErrorService', () => {
  describe('handleError', () => {
    it('should pass through CustomError instances unchanged', () => {
      const customError = new BadRequestError('Test error');
      const result = errorService.handleError(customError, 'test context');
      expect(result).toBe(customError);
    });

    it('should wrap Error instances with BadRequestError', () => {
      const error = new Error('Test error');
      const result = errorService.handleError(error, 'test context');
      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Error in test context: Test error');
    });

    it('should wrap database error hints with DatabaseError', () => {
      const databaseError = new Error('database connection failed');
      const result = errorService.handleError(databaseError, 'test context');
      expect(result).toBeInstanceOf(CustomError);
      expect(result.statusCode).toBe(500);
      expect(result.errorCode).toBe('DATABASE_ERROR');
      expect(result.message).toBe('Database error in test context: database connection failed');
    });

    it('should wrap SQL error hints with DatabaseError', () => {
      const sqlError = new Error('sql syntax error in query');
      const result = errorService.handleError(sqlError, 'test context');
      expect(result).toBeInstanceOf(CustomError);
      expect(result.statusCode).toBe(500);
      expect(result.errorCode).toBe('DATABASE_ERROR');
      expect(result.message).toBe('Database error in test context: sql syntax error in query');
    });

    it('should handle unknown error types with BadRequestError', () => {
      const unknownError = { message: 'Something went wrong' };
      const result = errorService.handleError(unknownError, 'test context');
      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Unknown error in test context');
    });

    it('should handle undefined error with BadRequestError', () => {
      const result = errorService.handleError(undefined, 'test context');
      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Unknown error in test context');
    });
  });

  describe('handleAxiosError', () => {
    it('should handle rate limiting error (429)', () => {
      const axiosError = new AxiosError('Rate limit exceeded', 'ECONNABORTED', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        data: { message: 'Rate limit exceeded' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('External API rate limit reached. Please try again later.');
    });

    it('should handle not found error (404)', () => {
      const axiosError = new AxiosError('Not found', 'ECONNABORTED', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Resource not found' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Resource not found in external API: test context');
    });

    it('should handle authentication error (401)', () => {
      const axiosError = new AxiosError('Unauthorized', 'ECONNABORTED', undefined, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: { message: 'Invalid credentials' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Authentication error with external API: Unauthorized');
    });

    it('should handle server error (500)', () => {
      const axiosError = new AxiosError('Internal Server Error', 'ECONNABORTED', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Server error' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('External API server error: Internal Server Error');
    });

    it('should extract error message from response data', () => {
      const axiosError = new AxiosError('Bad Request', 'ECONNABORTED', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'Invalid parameters' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('External API error: Invalid parameters');
    });

    it('should handle network errors without response', () => {
      const axiosError = new AxiosError(
        'Network Error',
        'ECONNABORTED',
        { method: 'GET', url: 'https://api.example.com' } as any,
        undefined,
        undefined,
      );
      axiosError.request = {}; // Add request property without response

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Network error: Unable to reach external API');
    });

    it('should handle errors in request setup', () => {
      const axiosError = new AxiosError('Invalid URL', 'ERR_INVALID_URL', undefined, undefined, undefined);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('Error setting up API request: Invalid URL');
    });

    it('should handle error with status_message', () => {
      const axiosError = new AxiosError('Bad Request', 'ECONNABORTED', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: { status_message: 'Invalid API key' },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('External API error: Invalid API key');
    });

    it('should handle error with nested error message', () => {
      const axiosError = new AxiosError('Bad Request', 'ECONNABORTED', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: { error: { message: 'Invalid parameters' } },
      } as any);

      const result = errorService.handleError(axiosError, 'test context');

      expect(result).toBeInstanceOf(CustomError);
      expect(result.message).toBe('External API error: Invalid parameters');
    });
  });

  describe('assertExists', () => {
    it('should not throw an error when entity exists', () => {
      const entity = { id: 1, name: 'Test' };

      expect(() => {
        errorService.assertExists(entity, 'Entity', 1);
      }).not.toThrow();
    });

    it('should throw NotFoundError when entity is null', () => {
      const entity = null;

      expect(() => {
        errorService.assertExists(entity, 'Entity', 1);
      }).toThrow(CustomError);

      try {
        errorService.assertExists(entity, 'Entity', 1);
      } catch (error: any) {
        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('Entity with ID 1 not found');
        expect(error.statusCode).toBe(404);
        expect(error.errorCode).toBe('NOT_FOUND');
      }
    });

    it('should throw NotFoundError when entity is undefined', () => {
      const entity = undefined;

      expect(() => {
        errorService.assertExists(entity, 'Entity', 'abc123');
      }).toThrow(CustomError);

      try {
        errorService.assertExists(entity, 'Entity', 'abc123');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('Entity with ID abc123 not found');
      }
    });
  });

  describe('assertNotExists', () => {
    it('should not throw an error when entity does not exist', () => {
      const entity = null;

      expect(() => {
        errorService.assertNotExists(entity, 'Entity', 'email', 'test@example.com');
      }).not.toThrow();
    });

    it('should throw ConflictError when entity exists', () => {
      const entity = { id: 1, email: 'test@example.com' };

      expect(() => {
        errorService.assertNotExists(entity, 'Entity', 'email', 'test@example.com');
      }).toThrow(CustomError);

      try {
        errorService.assertNotExists(entity, 'Entity', 'email', 'test@example.com');
      } catch (error: any) {
        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('Entity with email test@example.com already exists');
        expect(error.statusCode).toBe(409);
        expect(error.errorCode).toBe('CONFLICT');
      }
    });
  });
});
