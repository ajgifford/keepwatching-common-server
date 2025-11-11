import { Logger, appLogger, formatAppLoggerResponse, getResponseMessage } from '@logger/logger';
import { requestLogger, responseInterceptor } from '@middleware/loggerMiddleware';
import { NextFunction, Request, Response } from 'express';

// Mock the appLogger
jest.mock('@logger/logger', () => ({
  appLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  formatAppLoggerResponse: jest.fn(() => ({
    request: { test: 'request' },
    response: { test: 'response' },
  })),
  getResponseMessage: jest.fn().mockReturnValue('Test response message'),
  Logger: {
    logRequest: jest.fn(),
  },
}));

describe('Logger Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      method: 'GET',
      baseUrl: '/api',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      body: { test: 'data' },
      params: { id: '123' },
      query: { filter: 'active' },
    };

    mockResponse = {
      statusCode: 200,
      send: jest.fn(function (this: any) {
        return this;
      }),
      getHeaders: jest.fn().mockReturnValue({
        'content-type': 'application/json',
      }),
    };

    mockNext = jest.fn();
  });

  describe('responseInterceptor middleware', () => {
    it('should intercept and wrap the response.send method', () => {
      // Call the middleware
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Middleware should call next
      expect(mockNext).toHaveBeenCalled();

      // Original send should be wrapped
      expect(mockResponse.send).not.toBeUndefined();
      expect(typeof mockResponse.send).toBe('function');
    });

    it('should log successful responses with info level', () => {
      // Set up a successful response
      mockResponse.statusCode = 200;

      // Call the middleware
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate sending a response
      const responseBody = { success: true, data: { test: 'value' } };
      (mockResponse.send as jest.Mock)(responseBody);

      // Verify logging behavior
      expect(formatAppLoggerResponse).toHaveBeenCalledWith(mockRequest, mockResponse, responseBody, expect.any(Number));
      expect(getResponseMessage).toHaveBeenCalledWith(mockRequest.method);
      expect(appLogger.info).toHaveBeenCalledTimes(1);
      expect(appLogger.error).not.toHaveBeenCalled();
    });

    it('should log error responses with error level', () => {
      // Set up an error response
      mockResponse.statusCode = 400;

      // Call the middleware
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate sending an error response
      const errorBody = { message: 'Bad request', code: 'INVALID_INPUT' };
      (mockResponse.send as jest.Mock)(errorBody);

      // Verify logging behavior
      expect(formatAppLoggerResponse).toHaveBeenCalledWith(mockRequest, mockResponse, errorBody, expect.any(Number));
      // The middleware passes the result of formatAppLoggerResponse directly to appLogger.error
      const formattedResponse = (formatAppLoggerResponse as jest.Mock).mock.results[0].value;
      expect(appLogger.error).toHaveBeenCalledWith('Bad request', formattedResponse);
      expect(appLogger.info).not.toHaveBeenCalled();
    });

    it('should log generic error message if no message in response body', () => {
      // Set up an error response
      mockResponse.statusCode = 500;

      // Call the middleware
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate sending an error response with no message
      const errorBody = { error: true };
      (mockResponse.send as jest.Mock)(errorBody);

      // Verify logging behavior
      const formattedResponse = (formatAppLoggerResponse as jest.Mock).mock.results[0].value;
      expect(appLogger.error).toHaveBeenCalledWith('Error processing request', formattedResponse);
    });

    it('should only log once even if send is called multiple times', () => {
      // Call the middleware
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate sending multiple responses
      (mockResponse.send as jest.Mock)({ data: 'first' });
      (mockResponse.send as jest.Mock)({ data: 'second' });
      (mockResponse.send as jest.Mock)({ data: 'third' });

      // Verify logging only happened once
      expect(appLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should preserve the original send behavior and return value', () => {
      // Create a more realistic mock with chainable methods
      const chainableMock = {
        statusCode: 200,
        send: jest.fn(function (this: any) {
          return this;
        }),
        json: jest.fn(function (this: any) {
          return this;
        }),
        getHeaders: jest.fn().mockReturnValue({}),
      };

      // Call the middleware
      responseInterceptor(mockRequest as Request, chainableMock as unknown as Response, mockNext);

      // Simulate a chainable call
      const result = chainableMock.send();

      // Verify the chain is preserved
      expect(result).toBe(chainableMock);
    });

    it('should correctly calculate request duration', () => {
      jest.useFakeTimers();

      // Call the middleware (sets start time)
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);

      // Fast-forward time
      jest.advanceTimersByTime(500); // 500ms

      // Reset the formatAppLoggerResponse mock to capture actual arguments
      (formatAppLoggerResponse as jest.Mock).mockImplementationOnce((req, res, body, startTime) => {
        // Verify that request duration is calculated correctly
        const endTime = Date.now();
        const duration = endTime - startTime;
        expect(duration).toBeGreaterThanOrEqual(500);

        return {
          request: { test: 'request' },
          response: { test: 'response' },
        };
      });

      // Simulate sending a response
      (mockResponse.send as jest.Mock)({ data: 'test' });

      jest.useRealTimers();
    });
  });

  describe('requestLogger middleware', () => {
    it('should call Logger.logRequest', () => {
      const logRequestSpy = jest.spyOn(Logger, 'logRequest');

      // Call the middleware
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify that it delegates to Logger.logRequest
      expect(logRequestSpy).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);

      logRequestSpy.mockRestore();
    });
  });

  describe('Integration with Express application', () => {
    it('should handle various HTTP methods correctly', () => {
      // Test GET request
      mockRequest.method = 'GET';
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)({ data: 'test' });
      expect(getResponseMessage).toHaveBeenCalledWith('GET');

      jest.clearAllMocks();

      // Test POST request
      mockRequest.method = 'POST';
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)({ data: 'test' });
      expect(getResponseMessage).toHaveBeenCalledWith('POST');

      jest.clearAllMocks();

      // Test PUT request
      mockRequest.method = 'PUT';
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)({ data: 'test' });
      expect(getResponseMessage).toHaveBeenCalledWith('PUT');

      jest.clearAllMocks();

      // Test DELETE request
      mockRequest.method = 'DELETE';
      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)({ data: 'test' });
      expect(getResponseMessage).toHaveBeenCalledWith('DELETE');
    });

    it('should handle different response status codes correctly', () => {
      // Test successful status codes
      [200, 201, 204, 304].forEach((statusCode) => {
        jest.clearAllMocks();
        mockResponse.statusCode = statusCode;
        responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
        (mockResponse.send as jest.Mock)({ data: 'test' });
        expect(appLogger.info).toHaveBeenCalled();
        expect(appLogger.error).not.toHaveBeenCalled();
      });

      // Test error status codes
      [400, 401, 403, 404, 500, 502, 503].forEach((statusCode) => {
        jest.clearAllMocks();
        mockResponse.statusCode = statusCode;
        responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
        (mockResponse.send as jest.Mock)({ message: 'Error message' });
        expect(appLogger.error).toHaveBeenCalled();
        expect(appLogger.info).not.toHaveBeenCalled();
      });
    });

    it('should handle complex response bodies', () => {
      const complexBody = {
        data: {
          users: [
            { id: 1, name: 'User 1' },
            { id: 2, name: 'User 2' },
          ],
          pagination: {
            total: 10,
            page: 1,
            limit: 2,
          },
          metadata: {
            version: '1.0',
            generated: new Date().toISOString(),
          },
        },
        success: true,
      };

      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)(complexBody);

      expect(formatAppLoggerResponse).toHaveBeenCalledWith(mockRequest, mockResponse, complexBody, expect.any(Number));
    });

    it('should handle error objects in response', () => {
      const errorObj = new Error('Test error');
      mockResponse.statusCode = 500;

      responseInterceptor(mockRequest as Request, mockResponse as Response, mockNext);
      (mockResponse.send as jest.Mock)(errorObj);

      expect(formatAppLoggerResponse).toHaveBeenCalledWith(mockRequest, mockResponse, errorObj, expect.any(Number));
      expect(appLogger.error).toHaveBeenCalled();
    });
  });
});
