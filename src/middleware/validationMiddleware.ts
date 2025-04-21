import { BadRequestError } from './errorMiddleware';
import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Middleware factory for validating request data using Zod schemas
 * @param schema The Zod schema to validate against
 * @param source Where to find the data to validate ('query', 'body', 'params')
 */
export const validateSchema = <T extends AnyZodObject>(schema: T, source: 'query' | 'body' | 'params' = 'body') => {
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
};

/**
 * Validates multiple parts of the request simultaneously
 * @param bodySchema Schema for the request body
 * @param paramsSchema Schema for the route parameters
 * @param querySchema Schema for query parameters
 */
export const validateRequest = <TBody, TParams, TQuery>(
  bodySchema?: AnyZodObject,
  paramsSchema?: AnyZodObject,
  querySchema?: AnyZodObject,
) => {
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
};
