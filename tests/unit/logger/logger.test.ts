import { cliLogger, httpLogger } from '@logger/logger';
import { HTTPHeaders, SpecialMessages } from '@logger/loggerModel';
import { formatHTTPLoggerResponse } from '@logger/loggerUtil';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');
  return {
    ...originalModule,
    createLogger: jest.fn().mockReturnValue({
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
    format: {
      ...originalModule.format,
      combine: jest.fn().mockReturnValue({}),
      timestamp: jest.fn().mockReturnValue({}),
      json: jest.fn().mockReturnValue({}),
      printf: jest.fn().mockImplementation((fn) => fn),
      label: jest.fn().mockReturnValue({}),
      colorize: jest.fn().mockReturnValue({}),
    },
    transports: {
      File: jest.fn().mockImplementation(() => ({})),
      Console: jest.fn().mockImplementation(() => ({})),
    },
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-log-id'),
  }),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('Logger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Initialization', () => {
    it('should create the log directory if it does not exist', () => {
      // Mock fs.existsSync to return false (directory doesn't exist)
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      // Re-import logger to trigger initialization code
      jest.isolateModules(() => {
        require('../../../src/logger/logger');
      });

      expect(fs.existsSync).toHaveBeenCalledWith(expect.any(String));
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should not create the log directory if it already exists', () => {
      // Mock fs.existsSync to return true (directory exists)
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);

      // Re-import logger to trigger initialization code
      jest.isolateModules(() => {
        require('../../../src/logger/logger');
      });

      expect(fs.existsSync).toHaveBeenCalledWith(expect.any(String));
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('formatHTTPLoggerResponse function', () => {
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
        getHeaders: jest.fn().mockReturnValue({
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
      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, responseBody, startTime);

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
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, {});
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
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, {});
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
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, { items: longArray });

      // Should truncate the array to 5 items plus a message
      expect(Array.isArray(result.response.body.items)).toBe(true);
      expect(result.response.body.items.length).toBe(6);
      expect(typeof result.response.body.items[5]).toBe('string');
      expect(result.response.body.items[5]).toMatch(/and \d+ more items/);
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
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, {});

      // Should redact password fields in nested objects
      expect(result.request.body.user.credentials.password).toBe(SpecialMessages.Redacted);
      expect(result.request.body.user.credentials.new_password).toBe(SpecialMessages.Redacted);
      // But should keep other fields intact
      expect(result.request.body.user.profile.name).toBe('Test User');
      expect(result.request.body.user.profile.email).toBe('test@example.com');
    });

    it('should handle case when no request start time is provided', () => {
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
        getHeaders: jest.fn().mockReturnValue({}),
        statusCode: 200,
      };

      const result = formatHTTPLoggerResponse(mockReq as any, mockRes as any, {});
      expect(result.response.requestDuration).toBe('.');
    });
  });

  describe('Logger Instances', () => {
    it('httpLogger should have the expected methods', () => {
      expect(httpLogger).toHaveProperty('log');
      expect(httpLogger).toHaveProperty('info');
      expect(httpLogger).toHaveProperty('error');
      expect(httpLogger).toHaveProperty('warn');
      expect(httpLogger).toHaveProperty('debug');
    });

    it('cliLogger should have the expected methods', () => {
      expect(cliLogger).toHaveProperty('log');
      expect(cliLogger).toHaveProperty('info');
      expect(cliLogger).toHaveProperty('error');
      expect(cliLogger).toHaveProperty('warn');
      expect(cliLogger).toHaveProperty('debug');
    });
  });
});
