import { CustomError } from '@middleware/errorMiddleware';
import { validateRequest, validateSchema } from '@middleware/validationMiddleware';
import { Request, Response } from 'express';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: Mock;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {
      json: vi.fn(),
    };
    nextFunction = vi.fn();
  });

  afterEach(() => {
    // Restore all spies to prevent leakage to other tests
    vi.restoreAllMocks();
  });

  describe('validateSchema', () => {
    it('validates request body successfully', async () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });
      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
      };
      const middleware = validateSchema(schema, 'body');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('validates request query successfully', async () => {
      const schema = z.object({
        searchString: z.string().min(1),
        page: z.string().regex(/^\d+$/).optional(),
      });
      mockRequest.query = {
        searchString: 'test',
        page: '1',
      };
      const middleware = validateSchema(schema, 'query');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.query).toEqual({
        searchString: 'test',
        page: '1',
      });
    });

    it('validates request params successfully', async () => {
      const schema = z.object({
        accountId: z.string().regex(/^\d+$/, 'Account ID must be a number'),
        profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number'),
      });
      mockRequest.params = {
        accountId: '123',
        profileId: '456',
      };
      const middleware = validateSchema(schema, 'params');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.params).toEqual({
        accountId: '123',
        profileId: '456',
      });
    });

    it('returns error when body validation fails', async () => {
      const schema = z.object({
        name: z.string().min(3, 'Name must be at least 3 characters'),
        email: z.string().email('Invalid email format'),
      });
      mockRequest.body = {
        name: 'Jo',
        email: 'not-an-email',
      };
      const middleware = validateSchema(schema, 'body');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('name: Name must be at least 3 characters, email: Invalid email format'),
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });

    it('returns error when query validation fails', async () => {
      const schema = z.object({
        searchString: z.string().min(1, 'Search string is required'),
        page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
      });
      mockRequest.query = {
        searchString: '',
        page: 'abc',
      };
      const middleware = validateSchema(schema, 'query');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('searchString: Search string is required, page: Page must be a number'),
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });

    it('returns error when params validation fails', async () => {
      const schema = z.object({
        accountId: z.string().regex(/^\d+$/, 'Account ID must be a number'),
        profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number'),
      });
      mockRequest.params = {
        accountId: 'abc',
        profileId: '456',
      };
      const middleware = validateSchema(schema, 'params');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('accountId: Account ID must be a number'),
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });

    it('handles unexpected errors during validation', async () => {
      const schema = z.object({
        name: z.string(),
      });

      vi.spyOn(schema, 'parseAsync').mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      mockRequest.body = { name: 'John' };
      const middleware = validateSchema(schema, 'body');

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid request data',
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });
  });

  describe('validateRequest', () => {
    it('validates multiple parts of request successfully', async () => {
      const bodySchema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });

      const paramsSchema = z.object({
        accountId: z.string().regex(/^\d+$/),
        profileId: z.string().regex(/^\d+$/),
      });

      const querySchema = z.object({
        searchString: z.string().min(1),
        page: z.string().regex(/^\d+$/).optional(),
      });

      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockRequest.params = {
        accountId: '123',
        profileId: '456',
      };

      mockRequest.query = {
        searchString: 'test',
        page: '1',
      };

      const middleware = validateRequest(bodySchema, paramsSchema, querySchema);

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(mockRequest.params).toEqual({
        accountId: '123',
        profileId: '456',
      });
      expect(mockRequest.query).toEqual({
        searchString: 'test',
        page: '1',
      });
    });

    it('validates with optional schemas', async () => {
      const bodySchema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });

      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const middleware = validateRequest(bodySchema);

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('returns error when any part of validation fails', async () => {
      const bodySchema = z.object({
        name: z.string().min(3, 'Name must be at least 3 characters'),
        email: z.string().email('Invalid email format'),
      });

      const paramsSchema = z.object({
        accountId: z.string().regex(/^\d+$/, 'Account ID must be a number'),
        profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number'),
      });

      const querySchema = z.object({
        searchString: z.string().min(1, 'Search string is required'),
        page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
      });

      mockRequest.body = {
        name: 'Jo', // too short
        email: 'not-an-email',
      };

      mockRequest.params = {
        accountId: 'abc', // not a number
        profileId: '456',
      };

      mockRequest.query = {
        searchString: '', // empty
        page: 'abc', // not a number
      };

      const middleware = validateRequest(bodySchema, paramsSchema, querySchema);

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(
            /Name must be at least 3 characters|Invalid email format|Account ID must be a number|Search string is required|Page must be a number/,
          ),
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });

    it('handles unexpected errors during validation', async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      vi.spyOn(bodySchema, 'parseAsync').mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      mockRequest.body = { name: 'John' };
      const middleware = validateRequest(bodySchema);

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid request data',
        }),
      );
      const error = nextFunction.mock.calls[0][0];
      expect(error).toBeInstanceOf(CustomError);
    });

    it('handles no schemas provided', async () => {
      const middleware = validateRequest();

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(nextFunction).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
