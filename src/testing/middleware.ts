// Mock middleware and error classes for external projects
import { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';
import { AnyZodObject, ZodError } from 'zod';

// Error handler middleware mock
export const errorHandler = vi.fn();

// Base error class
export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errorCode: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

// Specific error classes
export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, originalError: any) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class TransientApiError extends CustomError {
  constructor(
    message: string,
    public statusCode: number = 503,
    public retryAfter: number = 60,
  ) {
    super(message, statusCode, 'TRANSIENT_API_ERROR');
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class NoAffectedRowsError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'NO_AFFECTED_ROWS');
  }
}

/**
 * Middleware factory for validating request data using Zod schemas
 * @param schema The Zod schema to validate against
 * @param source Where to find the data to validate ('query', 'body', 'params')
 */
export const validateSchema = vi
  .fn()
  .mockImplementation(<T extends AnyZodObject>(schema: T, source: 'query' | 'body' | 'params' = 'body') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        let data: unknown;

        // Determine which part of the request to validate
        switch (source) {
          case 'body':
            data = req.body;
            break;
          case 'params':
            data = req.params;
            break;
          case 'query':
            data = req.query;
            break;
        }

        // Validate data against schema
        const validatedData = await schema.parseAsync(data);

        // Update request with validated data
        switch (source) {
          case 'body':
            req.body = validatedData;
            break;
          case 'params':
            req.params = validatedData as any;
            break;
          case 'query':
            req.query = validatedData as any;
            break;
        }

        next();
      } catch (error) {
        if (error instanceof ZodError) {
          // Format Zod errors in a user-friendly way
          const formattedErrors = error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
          next(new BadRequestError(formattedErrors.join(', ')));
        } else {
          next(new BadRequestError('Invalid request data'));
        }
      }
    };
  });

/**
 * Validates multiple parts of the request simultaneously
 * @param bodySchema Schema for the request body
 * @param paramsSchema Schema for the route parameters
 * @param querySchema Schema for query parameters
 */
export const validateRequest = vi
  .fn()
  .mockImplementation(
    <TBody, TParams, TQuery>(bodySchema?: AnyZodObject, paramsSchema?: AnyZodObject, querySchema?: AnyZodObject) => {
      return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
          const promises: Promise<any>[] = [];
          const results: any = {};

          // Add schemas to validate if provided
          if (bodySchema) {
            promises.push(
              bodySchema.parseAsync(req.body).then((data) => {
                results.body = data;
              }),
            );
          }

          if (paramsSchema) {
            promises.push(
              paramsSchema.parseAsync(req.params).then((data) => {
                results.params = data;
              }),
            );
          }

          if (querySchema) {
            promises.push(
              querySchema.parseAsync(req.query).then((data) => {
                results.query = data;
              }),
            );
          }

          // Validate all parts simultaneously
          await Promise.all(promises);

          // Update request with validated data
          if (results.body) req.body = results.body;
          if (results.params) req.params = results.params as any;
          if (results.query) req.query = results.query as any;

          next();
        } catch (error) {
          if (error instanceof ZodError) {
            // Format Zod errors for better readability
            const formattedErrors = error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
            next(new BadRequestError(formattedErrors.join(', ')));
          } else {
            next(new BadRequestError('Invalid request data'));
          }
        }
      };
    },
  );
