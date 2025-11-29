import { logRequestContext } from '@middleware/contextMiddleware';
import { requestContext } from '../../../src/context/requestContext';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('Context Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      method: 'GET',
      url: '/api/accounts/123/profiles/456/shows',
      params: {
        accountId: '123',
        profileId: '456',
      },
    };

    mockResponse = {};
    mockNext = jest.fn();

    // Mock uuid to return a predictable value
    (uuid as jest.Mock).mockReturnValue('test-request-id-123');

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('logRequestContext', () => {
    it('should create context with requestId, endpoint, accountId, and profileId', () => {
      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify uuid was called
      expect(uuid).toHaveBeenCalledTimes(1);

      // Verify next was called
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should extract accountId and profileId from request params', () => {
      let capturedContext: any;

      // Mock the AsyncLocalStorage run method to capture the context
      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        capturedContext = context;
        return originalRun(context, callback);
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(capturedContext).toEqual({
        requestId: 'test-request-id-123',
        endpoint: 'GET /api/accounts/123/profiles/456/shows',
        accountId: '123',
        profileId: '456',
      });
    });

    it('should handle requests with only accountId', () => {
      mockRequest.params = {
        accountId: '789',
      };

      let capturedContext: any;

      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        capturedContext = context;
        return originalRun(context, callback);
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(capturedContext).toEqual({
        requestId: 'test-request-id-123',
        endpoint: 'GET /api/accounts/123/profiles/456/shows',
        accountId: '789',
        profileId: undefined,
      });
    });

    it('should handle requests without accountId or profileId', () => {
      mockRequest.params = {};

      let capturedContext: any;

      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        capturedContext = context;
        return originalRun(context, callback);
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(capturedContext).toEqual({
        requestId: 'test-request-id-123',
        endpoint: 'GET /api/accounts/123/profiles/456/shows',
        accountId: undefined,
        profileId: undefined,
      });
    });

    it('should generate unique requestId for each request', () => {
      const requestIds = ['request-1', 'request-2', 'request-3'];
      let callCount = 0;

      (uuid as jest.Mock).mockImplementation(() => requestIds[callCount++]);

      const contexts: any[] = [];
      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        contexts.push(context);
        return originalRun(context, callback);
      });

      // Call middleware three times
      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);
      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);
      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(contexts[0].requestId).toBe('request-1');
      expect(contexts[1].requestId).toBe('request-2');
      expect(contexts[2].requestId).toBe('request-3');
    });

    it('should construct endpoint from method and url', () => {
      const testCases = [
        { method: 'GET', url: '/api/test', expected: 'GET /api/test' },
        { method: 'POST', url: '/api/users', expected: 'POST /api/users' },
        { method: 'PUT', url: '/api/users/123', expected: 'PUT /api/users/123' },
        { method: 'DELETE', url: '/api/users/123', expected: 'DELETE /api/users/123' },
        { method: 'PATCH', url: '/api/users/123', expected: 'PATCH /api/users/123' },
      ];

      testCases.forEach(({ method, url, expected }) => {
        jest.clearAllMocks();

        mockRequest.method = method;
        mockRequest.url = url;

        let capturedContext: any;
        const originalRun = requestContext.run.bind(requestContext);
        jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
          capturedContext = context;
          return originalRun(context, callback);
        });

        logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

        expect(capturedContext.endpoint).toBe(expected);
      });
    });

    it('should call next within the async context', (done) => {
      const customNext = jest.fn(() => {
        // Verify that we can access the context from within next
        const context = requestContext.getStore();
        expect(context).toBeDefined();
        expect(context?.requestId).toBe('test-request-id-123');
        expect(context?.accountId).toBe('123');
        expect(context?.profileId).toBe('456');
        done();
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, customNext);
    });

    it('should handle errors gracefully and still call next', () => {
      // Force an error by making uuid throw
      (uuid as jest.Mock).mockImplementation(() => {
        throw new Error('UUID generation failed');
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in logRequestContext:',
        expect.any(Error)
      );

      // Verify next was still called
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in requestContext.run and still call next', () => {
      // Mock requestContext.run to throw an error
      jest.spyOn(requestContext, 'run').mockImplementation(() => {
        throw new Error('AsyncLocalStorage error');
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in logRequestContext:',
        expect.objectContaining({ message: 'AsyncLocalStorage error' })
      );

      // Verify next was still called
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle missing request params gracefully', () => {
      mockRequest.params = undefined as any;

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not throw and should call next
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle numeric accountId and profileId', () => {
      mockRequest.params = {
        accountId: 123 as any,
        profileId: 456 as any,
      };

      let capturedContext: any;

      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        capturedContext = context;
        return originalRun(context, callback);
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(capturedContext.accountId).toBe(123);
      expect(capturedContext.profileId).toBe(456);
    });

    it('should handle requests with query parameters in url', () => {
      mockRequest.url = '/api/shows?limit=10&offset=20';

      let capturedContext: any;

      const originalRun = requestContext.run.bind(requestContext);
      jest.spyOn(requestContext, 'run').mockImplementation((context, callback) => {
        capturedContext = context;
        return originalRun(context, callback);
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(capturedContext.endpoint).toBe('GET /api/shows?limit=10&offset=20');
    });

    it('should maintain context isolation between concurrent requests', (done) => {
      const request1 = {
        ...mockRequest,
        params: { accountId: '1', profileId: '10' },
        method: 'GET',
        url: '/request1',
      };

      const request2 = {
        ...mockRequest,
        params: { accountId: '2', profileId: '20' },
        method: 'POST',
        url: '/request2',
      };

      (uuid as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      let completedRequests = 0;

      const checkCompletion = () => {
        completedRequests++;
        if (completedRequests === 2) {
          done();
        }
      };

      const next1 = jest.fn(() => {
        const context = requestContext.getStore();
        expect(context?.requestId).toBe('uuid-1');
        expect(context?.accountId).toBe('1');
        expect(context?.profileId).toBe('10');
        checkCompletion();
      });

      const next2 = jest.fn(() => {
        const context = requestContext.getStore();
        expect(context?.requestId).toBe('uuid-2');
        expect(context?.accountId).toBe('2');
        expect(context?.profileId).toBe('20');
        checkCompletion();
      });

      // Simulate concurrent requests
      logRequestContext(request1 as Request, mockResponse as Response, next1);
      logRequestContext(request2 as Request, mockResponse as Response, next2);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with Express middleware chain', () => {
      const middlewareChain = [
        logRequestContext,
        (req: Request, res: Response, next: NextFunction) => {
          // Verify context is accessible in subsequent middleware
          const context = requestContext.getStore();
          expect(context).toBeDefined();
          expect(context?.requestId).toBe('test-request-id-123');
          next();
        },
        (req: Request, res: Response, next: NextFunction) => {
          // Verify context is still accessible
          const context = requestContext.getStore();
          expect(context).toBeDefined();
          expect(context?.accountId).toBe('123');
          next();
        },
      ];

      let currentIndex = 0;
      const executeNext = () => {
        if (currentIndex < middlewareChain.length) {
          const middleware = middlewareChain[currentIndex++];
          middleware(mockRequest as Request, mockResponse as Response, executeNext);
        }
      };

      executeNext();
    });

    it('should preserve context across async operations', (done) => {
      const asyncNext = jest.fn(async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Context should still be available
        const context = requestContext.getStore();
        expect(context).toBeDefined();
        expect(context?.requestId).toBe('test-request-id-123');
        expect(context?.accountId).toBe('123');
        expect(context?.profileId).toBe('456');
        done();
      });

      logRequestContext(mockRequest as Request, mockResponse as Response, asyncNext);
    });
  });
});
