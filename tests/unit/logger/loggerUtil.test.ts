import { HTTPHeaders, SensitiveKeys, SpecialMessages } from '../../../src/logger/loggerModel';
import { formatHTTPLoggerResponse } from '../../../src/logger/loggerUtil';
import { Request, Response } from 'express';
import { Socket } from 'net';

describe('LoggerUtil', () => {
  describe('formatHTTPLoggerResponse', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let requestStartTime: number;

    beforeEach(() => {
      // Set up a fresh mock request for each test
      mockRequest = {
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
          accept: 'application/json',
          'accept-language': 'en-US',
          authorization: 'Bearer token123', // Should be filtered out
          'custom-header': 'custom-value', // Should be filtered out
        },
        method: 'GET',
        baseUrl: '/api',
        url: '/users/123',
        body: { name: 'John Doe' },
        params: { id: '123' },
        query: { filter: 'active' },
        socket: {
          remoteAddress: '192.168.1.100',
        } as Partial<Socket> as Socket,
      };

      // Mock response object
      mockResponse = {
        getHeaders: jest.fn().mockReturnValue({
          'content-type': 'application/json',
          'content-length': '256',
          'cache-control': 'no-cache',
          'x-custom-header': 'value', // Should be filtered out
        }),
        statusCode: 200,
      };

      // Simulate request that started 100ms ago
      requestStartTime = Date.now() - 100;
    });

    it('should correctly format HTTP request and response data', () => {
      const responseBody = { success: true, data: { userId: 123 } };

      const result = formatHTTPLoggerResponse(
        mockRequest as Request,
        mockResponse as Response,
        responseBody,
        requestStartTime,
      );

      // Check request formatting
      expect(result.request).toBeDefined();
      expect(result.request.headers).toBeDefined();
      expect(result.request.method).toBe('GET');
      expect(result.request.path).toBe('/api/users/123');
      expect(result.request.body).toEqual({ name: 'John Doe' });
      expect(result.request.params).toEqual({ id: '123' });
      expect(result.request.query).toEqual({ filter: 'active' });
      expect(result.request.clientIp).toBe('192.168.1.100');

      // Check response formatting
      expect(result.response).toBeDefined();
      expect(result.response.headers).toBeDefined();
      expect(result.response.statusCode).toBe(200);
      expect(result.response.requestDuration).toMatch(/0\.\d+s/); // Should be like "0.100s"
      expect(result.response.body).toEqual(responseBody);
    });

    it('should filter headers correctly', () => {
      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Essential request headers should be included
      expect(result.request.headers).toHaveProperty('content-type');
      expect(result.request.headers).toHaveProperty('user-agent');
      expect(result.request.headers).toHaveProperty('accept');
      expect(result.request.headers).toHaveProperty('accept-language');

      // Non-essential request headers should be filtered out
      expect(result.request.headers).not.toHaveProperty('authorization');
      expect(result.request.headers).not.toHaveProperty('custom-header');

      // Essential response headers should be included
      expect(result.response.headers).toHaveProperty('content-type');
      expect(result.response.headers).toHaveProperty('content-length');
      expect(result.response.headers).toHaveProperty('cache-control');

      // Non-essential response headers should be filtered out
      expect(result.response.headers).not.toHaveProperty('x-custom-header');
    });

    it('should redact sensitive information', () => {
      mockRequest.body = {
        username: 'testuser',
        password: 'secretpassword',
        data: {
          old_password: 'oldsecret',
          new_password: 'newsecret',
          repeat_password: 'newsecret',
          name: 'John Doe',
        },
      };

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Check that sensitive fields are redacted
      expect(result.request.body.password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.data.old_password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.data.new_password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.data.repeat_password).toBe(SpecialMessages.Redacted);

      // Non-sensitive fields should remain intact
      expect(result.request.body.username).toBe('testuser');
      expect(result.request.body.data.name).toBe('John Doe');
    });

    it('should truncate long string bodies', () => {
      // Create a long string body
      mockRequest.body = 'A'.repeat(1000);

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Body should be truncated
      expect(typeof result.request.body).toBe('string');
      expect(result.request.body.length).toBeLessThan(1000);
      expect(result.request.body).toMatch(/^A+\.\.\. \[truncated\]$/);
    });

    it('should truncate large arrays', () => {
      // Create a large array
      const largeArray = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      mockRequest.body = { items: largeArray };

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, { items: largeArray });

      // Array should be truncated to 5 items + message
      expect(Array.isArray(result.response.body.items)).toBe(true);
      expect(result.response.body.items.length).toBe(6);
      expect(result.response.body.items[5]).toContain('more items');
    });

    it('should handle undefined/null bodies gracefully', () => {
      mockRequest.body = undefined;

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, null);

      // Should not error and return undefined/null as is
      expect(result.request.body).toBeUndefined();
      expect(result.response.body).toBeNull();
    });

    it('should use X-Forwarded-For header for client IP when available', () => {
      // Ensure headers object exists before setting property
      if (mockRequest.headers) {
        mockRequest.headers[HTTPHeaders.ForwardedFor] = '10.0.0.1, 10.0.0.2';
      }

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Should use X-Forwarded-For instead of socket address
      expect(result.request.clientIp).toBe('10.0.0.1, 10.0.0.2');
    });

    it('should handle missing request start time', () => {
      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Should use default duration
      expect(result.response.requestDuration).toBe('.');
    });

    it('should handle deeply nested objects and arrays', () => {
      const nestedBody = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: [
                { id: 1, secret: 'hidden1' },
                { id: 2, secret: 'hidden2' },
                { id: 3, password: 'nested-secret' },
              ],
            },
          },
        },
      };

      mockRequest.body = nestedBody;

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // Check deep redaction
      expect(result.request.body.level1.level2.level3.password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.level1.level2.level3.data[2].password).toBe(SpecialMessages.Redacted);

      // Non-sensitive fields should remain
      expect(result.request.body.level1.level2.level3.data[0].secret).toBe('hidden1');
    });

    it('should handle all SensitiveKeys defined in the model', () => {
      // Create an object with all sensitive keys
      const sensitiveBody = Object.values(SensitiveKeys).reduce(
        (obj, key) => {
          obj[key] = 'sensitive-value';
          return obj;
        },
        {} as Record<string, string>,
      );

      mockRequest.body = sensitiveBody;

      const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, {});

      // All sensitive keys should be redacted
      Object.values(SensitiveKeys).forEach((key) => {
        expect(result.request.body[key]).toBe(SpecialMessages.Redacted);
      });
    });

    it('should not mutate the original objects', () => {
      const originalBody = {
        username: 'testuser',
        password: 'secret',
      };
      const originalResponseBody = {
        success: true,
        token: 'jwt-token',
      };

      // Create deep copies to compare later
      const originalBodyCopy = JSON.parse(JSON.stringify(originalBody));
      const originalResponseBodyCopy = JSON.parse(JSON.stringify(originalResponseBody));

      mockRequest.body = originalBody;

      formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, originalResponseBody);

      // Original objects should not be modified
      expect(originalBody).toEqual(originalBodyCopy);
      expect(originalResponseBody).toEqual(originalResponseBodyCopy);
    });

    it('should handle non-object body types', () => {
      // Test different body types
      const testCases = [123, 'string body', true, [1, 2, 3], null, undefined];

      testCases.forEach((testCase) => {
        mockRequest.body = testCase;

        const result = formatHTTPLoggerResponse(mockRequest as Request, mockResponse as Response, testCase);

        // Should handle the type without errors
        expect(result.request.body).toEqual(testCase);
        expect(result.response.body).toEqual(testCase);
      });
    });
  });
});
