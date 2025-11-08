// Import AFTER all mocks are set up
import { Logger, appLogger, cliLogger, formatAppLoggerResponse, getResponseMessage } from '@logger/logger';
import { HTTPHeaders, HTTPMethods, SensitiveKeys, SpecialMessages, SuccessMessages } from '@logger/loggerModel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies BEFORE importing the logger module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({
    toString: vi.fn(() => 'mock-log-id'),
  })),
}));

vi.mock('winston', async () => {
  const originalModule = await vi.importActual<typeof import('winston')>('winston');

  // Create spy functions that will be shared across createLogger calls
  const logSpy = vi.fn();
  const infoSpy = vi.fn();
  const errorSpy = vi.fn();
  const warnSpy = vi.fn();
  const debugSpy = vi.fn();

  return {
    ...originalModule,
    createLogger: vi.fn().mockReturnValue({
      log: logSpy,
      info: infoSpy,
      error: errorSpy,
      warn: warnSpy,
      debug: debugSpy,
      transports: [{ on: vi.fn() }],
    }),
    format: {
      ...(originalModule.format as any),
      combine: vi.fn().mockReturnValue({
        transform: vi.fn((info) => info),
      }),
      timestamp: vi.fn().mockReturnValue({
        transform: vi.fn((info) => info),
      }),
      json: vi.fn().mockReturnValue({
        transform: vi.fn((info) => info),
      }),
      printf: vi.fn().mockImplementation(() => ({
        transform: vi.fn((info) => info),
      })),
      label: vi.fn().mockReturnValue({
        transform: vi.fn((info) => info),
      }),
      colorize: vi.fn().mockReturnValue({
        transform: vi.fn((info) => info),
      }),
    },
    transports: {
      File: vi.fn(function (this: any) {
        this.on = vi.fn();
        this.log = vi.fn();
        return this;
      }),
      Console: vi.fn(function (this: any) {
        this.on = vi.fn();
        this.log = vi.fn();
        return this;
      }),
    },
  };
});

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(function (this: any) {
    this.on = vi.fn();
    this.log = vi.fn();
    return this;
  }),
}));

describe('Logger Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on the logger methods after they've been imported
    vi.spyOn(appLogger, 'info');
    vi.spyOn(appLogger, 'error');
    vi.spyOn(appLogger, 'warn');
    vi.spyOn(appLogger, 'debug');

    vi.spyOn(cliLogger, 'info');
    vi.spyOn(cliLogger, 'error');
    vi.spyOn(cliLogger, 'warn');
    vi.spyOn(cliLogger, 'debug');
  });

  describe('Logger Initialization', () => {
    it('should have logger instances created', () => {
      // The logger module initialization runs when imported
      // Since we mocked existsSync to return true by default,
      // mkdirSync should not have been called on initial import
      expect(appLogger).toBeDefined();
      expect(cliLogger).toBeDefined();
    });
  });

  describe('Logger instances', () => {
    it('appLogger should have the expected methods', () => {
      expect(appLogger).toHaveProperty('info');
      expect(appLogger).toHaveProperty('error');
      expect(appLogger).toHaveProperty('warn');
      expect(appLogger).toHaveProperty('debug');
    });

    it('cliLogger should have the expected methods', () => {
      expect(cliLogger).toHaveProperty('info');
      expect(cliLogger).toHaveProperty('error');
      expect(cliLogger).toHaveProperty('warn');
      expect(cliLogger).toHaveProperty('debug');
    });
  });

  describe('Logger static methods', () => {
    it('Logger.info should call appLogger.info and cliLogger.info', () => {
      const message = 'Test info message';
      const meta = { data: 'test' };

      Logger.info(message, meta);

      expect(appLogger.info).toHaveBeenCalledWith(message, { meta });
      expect(cliLogger.info).toHaveBeenCalledWith(message);
    });

    it('Logger.error should call appLogger.error and cliLogger.error', () => {
      const message = 'Test error message';
      const meta = new Error('Test error');

      Logger.error(message, meta);

      expect(appLogger.error).toHaveBeenCalledWith(message, { error: meta });
      expect(cliLogger.error).toHaveBeenCalledWith(message);
    });

    it('Logger.warn should call appLogger.warn and cliLogger.warn', () => {
      const message = 'Test warning message';
      const meta = { data: 'test' };

      Logger.warn(message, meta);

      expect(appLogger.warn).toHaveBeenCalledWith(message, { meta });
      expect(cliLogger.warn).toHaveBeenCalledWith(message);
    });

    it('Logger.debug should call appLogger.debug and cliLogger.debug', () => {
      const message = 'Test debug message';
      const meta = { data: 'test' };

      Logger.debug(message, meta);

      expect(appLogger.debug).toHaveBeenCalledWith(message, { meta });
      expect(cliLogger.debug).toHaveBeenCalledWith(message);
    });

    it('Logger.logError should format and log error details', () => {
      const error = new Error('Test error');
      const mockRequest = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: { test: 'data' },
        query: { sort: 'desc' },
        params: { id: '123' },
      };

      Logger.logError(error, mockRequest);

      expect(appLogger.error).toHaveBeenCalledWith(
        'Application error occurred',
        expect.objectContaining({
          message: error.message,
          stack: error.stack,
          timestamp: expect.any(String),
          request: expect.objectContaining({
            method: mockRequest.method,
            url: mockRequest.originalUrl,
          }),
        }),
      );
      expect(cliLogger.error).toHaveBeenCalledWith(`Error: ${error.message}`);
    });

    it('Logger.logRequest should setup request logging middleware', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: { test: 'data' },
        query: { sort: 'desc' },
        params: { id: '123' },
        ip: '127.0.0.1',
      };

      const mockRes = {
        send: vi.fn(),
        getHeaders: vi.fn().mockReturnValue({ 'content-type': 'application/json' }),
        statusCode: 200,
      };

      const mockNext = vi.fn();

      Logger.logRequest(mockReq, mockRes, mockNext);

      expect(appLogger.info).toHaveBeenCalledWith(
        `Incoming ${mockReq.method} request to ${mockReq.originalUrl}`,
        expect.objectContaining({
          method: mockReq.method,
          url: mockReq.originalUrl,
        }),
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getResponseMessage function', () => {
    it('should return correct message for POST method', () => {
      expect(getResponseMessage(HTTPMethods.POST)).toBe(SuccessMessages.CreateSuccess);
    });

    it('should return correct message for GET method', () => {
      expect(getResponseMessage(HTTPMethods.GET)).toBe(SuccessMessages.GetSuccess);
    });

    it('should return correct message for PUT method', () => {
      expect(getResponseMessage(HTTPMethods.PUT)).toBe(SuccessMessages.UpdateSuccess);
    });

    it('should return correct message for PATCH method', () => {
      expect(getResponseMessage(HTTPMethods.PATCH)).toBe(SuccessMessages.UpdateSuccess);
    });

    it('should return correct message for DELETE method', () => {
      expect(getResponseMessage(HTTPMethods.DELETE)).toBe(SuccessMessages.DeleteSuccess);
    });

    it('should return generic message for unknown method', () => {
      expect(getResponseMessage('CUSTOM')).toBe(SuccessMessages.GenericSuccess);
    });
  });

  describe('formatAppLoggerResponse function', () => {
    it('should format HTTP request and response correctly', () => {
      const mockReq = {
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
          accept: 'application/json',
          'accept-language': 'en-US',
          authorization: 'Bearer token123', // Should be filtered
        },
        method: 'GET',
        baseUrl: '/api',
        url: '/users',
        body: { username: 'testuser', password: 'secret' }, // password should be redacted
        params: { id: '123' },
        query: { filter: 'active' },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({
          'content-type': 'application/json',
          'content-length': '256',
          'cache-control': 'no-cache',
          'x-custom-header': 'value', // Should be filtered
        }),
        statusCode: 200,
      };

      const responseBody = {
        data: {
          users: [
            { id: 1, name: 'User 1' },
            { id: 2, name: 'User 2' },
            // ...more items that would be truncated
          ],
        },
      };

      const startTime = Date.now() - 150; // 150ms ago
      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, responseBody, startTime);

      // Check request formatting
      expect(result.request).toHaveProperty('headers');
      expect(result.request.headers).toHaveProperty('content-type');
      expect(result.request.headers).toHaveProperty('user-agent');
      expect(result.request.headers).not.toHaveProperty('authorization'); // Should be filtered
      expect(result.request).toHaveProperty('method', 'GET');
      expect(result.request).toHaveProperty('path', '/api/users');
      expect(result.request.body).toHaveProperty('username', 'testuser');
      expect(result.request.body).toHaveProperty('password', SpecialMessages.Redacted);
      expect(result.request).toHaveProperty('params', { id: '123' });
      expect(result.request).toHaveProperty('query', { filter: 'active' });
      expect(result.request).toHaveProperty('clientIp', '127.0.0.1');

      // Check response formatting
      expect(result.response).toHaveProperty('headers');
      expect(result.response.headers).toHaveProperty('content-type');
      expect(result.response.headers).toHaveProperty('content-length');
      expect(result.response.headers).toHaveProperty('cache-control');
      expect(result.response.headers).not.toHaveProperty('x-custom-header'); // Should be filtered
      expect(result.response).toHaveProperty('statusCode', 200);
      expect(result.response).toHaveProperty('requestDuration');
      expect(result.response.requestDuration).toMatch(/0\.\d+s/); // Should be like "0.150s"
      expect(result.response).toHaveProperty('body');
    });

    it('should handle XForwardedFor header when present', () => {
      const mockReq = {
        headers: {
          [HTTPHeaders.ForwardedFor]: '192.168.1.1',
          'content-type': 'application/json',
        },
        method: 'GET',
        baseUrl: '/api',
        url: '/test',
        body: {},
        params: {},
        query: {},
        socket: {
          remoteAddress: '127.0.0.1', // Should use x-forwarded-for instead
        },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});
      expect(result.request.clientIp).toBe('192.168.1.1');
    });

    it('should truncate long string bodies', () => {
      const mockReq = {
        headers: { 'content-type': 'text/plain' },
        method: 'POST',
        baseUrl: '/api',
        url: '/data',
        body: 'A'.repeat(1000), // Long string
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});
      expect(result.request.body.length).toBeLessThan(1000);
      expect(result.request.body).toMatch(/\.\.\. \[truncated\]$/);
    });

    it('should truncate large arrays', () => {
      const longArray = Array(20)
        .fill(0)
        .map((_, i) => ({ id: i, value: `Item ${i}` }));

      const mockReq = {
        headers: { 'content-type': 'application/json' },
        method: 'GET',
        baseUrl: '/api',
        url: '/items',
        body: { items: longArray },
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, { items: longArray });

      // Should truncate the array to 5 items plus a message
      expect(Array.isArray(result.response.body.items)).toBe(true);
      expect(result.response.body.items.length).toBe(6);
      expect(typeof result.response.body.items[5]).toBe('string');
      expect(result.response.body.items[5]).toMatch(/and \d+ more items/);
    });

    it('should redact all sensitive keys in objects', () => {
      const mockReq = {
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        baseUrl: '/api',
        url: '/auth',
        body: {
          username: 'testuser',
          password: 'secret',
          new_password: 'newSecret',
          old_password: 'oldSecret',
          token: 'myAuthToken',
          api_key: 'myApiKey',
          secret: 'mySecret',
          repeat_password: 'secret',
          normalField: 'notRedacted',
        },
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});

      // Check all sensitive fields are redacted
      Object.values(SensitiveKeys).forEach((key) => {
        if (mockReq.body[key]) {
          expect(result.request.body[key]).toBe(SpecialMessages.Redacted);
        }
      });

      // Normal field should remain untouched
      expect(result.request.body.normalField).toBe('notRedacted');
      expect(result.request.body.username).toBe('testuser');
    });

    it('should redact sensitive information recursively in nested objects', () => {
      const mockReq = {
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        baseUrl: '/api',
        url: '/auth',
        body: {
          user: {
            credentials: {
              password: 'super-secret',
              new_password: 'new-secret',
            },
            profile: {
              name: 'Test User',
              email: 'test@example.com',
            },
          },
        },
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});

      // Should redact password fields in nested objects
      expect(result.request.body.user.credentials.password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.user.credentials.new_password).toBe(SpecialMessages.Redacted);
      // But should keep other fields intact
      expect(result.request.body.user.profile.name).toBe('Test User');
      expect(result.request.body.user.profile.email).toBe('test@example.com');
    });

    it('should redact sensitive information in arrays', () => {
      const mockReq = {
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        baseUrl: '/api',
        url: '/users',
        body: {
          users: [
            { username: 'user1', password: 'pass1' },
            { username: 'user2', password: 'pass2' },
          ],
        },
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});

      // Should redact password fields in array items
      expect(result.request.body.users[0].password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.users[1].password).toBe(SpecialMessages.Redacted);
      // But should keep other fields intact
      expect(result.request.body.users[0].username).toBe('user1');
      expect(result.request.body.users[1].username).toBe('user2');
    });

    it('should handle when no request start time is provided', () => {
      const mockReq = {
        headers: {},
        method: 'GET',
        baseUrl: '/api',
        url: '/test',
        body: {},
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});
      expect(result.response.requestDuration).toBe('.');
    });

    it('should handle null body values', () => {
      const mockReq = {
        headers: {},
        method: 'GET',
        baseUrl: '/api',
        url: '/test',
        body: null,
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, null);

      // Should not throw errors
      expect(result.request.body).toBe(null);
      expect(result.response.body).toBe(null);
    });

    it('should handle undefined body values', () => {
      const mockReq = {
        headers: {},
        method: 'GET',
        baseUrl: '/api',
        url: '/test',
        body: undefined,
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, undefined);

      // Should not throw errors
      expect(result.request.body).toBe(undefined);
      expect(result.response.body).toBe(undefined);
    });

    it('should handle complex nested objects without errors', () => {
      const complexObj = {
        level1: {
          level2: {
            level3: {
              level4: {
                password: 'secret',
                data: [1, 2, 3],
                deep: {
                  api_key: 'secret-key',
                },
              },
            },
          },
        },
      };

      const mockReq = {
        headers: {},
        method: 'POST',
        baseUrl: '/api',
        url: '/complex',
        body: complexObj,
        params: {},
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      };

      const mockRes = {
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatAppLoggerResponse(mockReq as any, mockRes as any, {});

      // Should redact deeply nested sensitive fields
      expect(result.request.body.level1.level2.level3.level4.password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.level1.level2.level3.level4.deep.api_key).toBe(SpecialMessages.Redacted);
      // But preserve structure and non-sensitive data
      expect(result.request.body.level1.level2.level3.level4.data).toEqual([1, 2, 3]);
    });
  });
});
