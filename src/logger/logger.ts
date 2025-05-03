import { HTTPHeaders, HTTPMethods, SensitiveKeys, SpecialMessages, SuccessMessages } from './loggerModel';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, printf, label, colorize } = format;
const timestampFormat: string = 'MMM-DD-YYYY HH:mm:ss';
const generateLogId = (): string => randomBytes(16).toString('hex');
const appVersion = process.env.npm_package_version;

const logDirectory = path.resolve(process.env.LOG_DIR || 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

export const appLogger = winston.createLogger({
  format: combine(
    timestamp({ format: timestampFormat }),
    json(),
    printf(({ timestamp, level, message, ...data }) => {
      const response = {
        level,
        logId: generateLogId(),
        timestamp,
        appInfo: {
          appVersion,
          environment: process.env.NODE_ENV,
          processId: process.pid,
        },
        message,
        data,
      };

      return JSON.stringify(response);
    }),
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'keepwatching' },
  transports: [
    new transports.File({
      filename: path.join(logDirectory, `${process.env.SERVICE_NAME || 'keepwatching'}-error.log`),
      level: 'error',
    }),
    new DailyRotateFile({
      filename: path.join(logDirectory, `${process.env.SERVICE_NAME || 'keepwatching'}-%DATE%.log`),
      datePattern: 'MMMM-DD-YYYY',
      zippedArchive: false,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

export const cliLogger = winston.createLogger({
  format: combine(
    label({ label: appVersion }),
    timestamp({ format: timestampFormat }),
    printf(({ level, message, label, timestamp }) => `[${timestamp}] ${level} (${label}): ${message}`),
  ),
  transports: [new winston.transports.Console()],
});

appLogger.transports.forEach((transport) => {
  transport.on('error', (error) => {
    console.error('Logger transport error:', error);
  });
});

cliLogger.transports.forEach((transport) => {
  transport.on('error', (error) => {
    console.error('Logger transport error:', error);
  });
});

export class Logger {
  static error(message: string, meta?: any) {
    appLogger.error(message, { error: meta });
    cliLogger.error(message);
  }

  static warn(message: string, meta?: any) {
    appLogger.warn(message, { meta });
    cliLogger.warn(message);
  }

  static info(message: string, meta?: any) {
    appLogger.info(message, { meta });
    cliLogger.info(message);
  }

  static debug(message: string, meta?: any) {
    appLogger.debug(message, { meta });
    cliLogger.debug(message);
  }

  static logRequest(req: any, res: any, next: any) {
    const requestStartTime = Date.now();

    appLogger.info(`Incoming ${req.method} request to ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
    });

    const originalSend = res.send;
    let responseSent = false;

    res.send = function (body: any): any {
      if (!responseSent) {
        const duration = Date.now() - requestStartTime;
        const logData = formatAppLoggerResponse(req, res, body, requestStartTime);

        if (res.statusCode < 400) {
          appLogger.info(getResponseMessage(req.method), logData);
        } else {
          appLogger.error(body.message || 'Error processing request', logData);
        }

        responseSent = true;
      }
      return originalSend.apply(res, arguments);
    };

    next();
  }

  static logError(error: Error, request?: any) {
    const errorLog: {
      message: string;
      stack?: string;
      timestamp: string;
      request?: {
        method: string;
        url: string;
        headers: any;
        body: any;
        query: any;
        params: any;
      };
    } = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    if (request) {
      errorLog.request = {
        method: request.method,
        url: request.originalUrl,
        headers: request.headers,
        body: request.body,
        query: request.query,
        params: request.params,
      };
    }

    appLogger.error('Application error occurred', errorLog);
    cliLogger.error(`Error: ${error.message}`);
  }
}

export function getResponseMessage(method: string): string {
  switch (method) {
    case HTTPMethods.POST:
      return SuccessMessages.CreateSuccess;
    case HTTPMethods.GET:
      return SuccessMessages.GetSuccess;
    case HTTPMethods.PUT:
    case HTTPMethods.PATCH:
      return SuccessMessages.UpdateSuccess;
    case HTTPMethods.DELETE:
      return SuccessMessages.DeleteSuccess;
    default:
      return SuccessMessages.GenericSuccess;
  }
}

export function formatAppLoggerResponse(req: any, res: any, responseBody: any, requestStartTime?: number) {
  let requestDuration = '.';
  if (requestStartTime) {
    const endTime = Date.now() - requestStartTime;
    requestDuration = `${endTime / 1000}s`; // ms to s
  }

  const essentialRequestHeaders = ['content-type', 'user-agent', 'accept', 'accept-language'];
  const filteredReqHeaders = Object.keys(req.headers)
    .filter((key) => essentialRequestHeaders.includes(key.toLowerCase()))
    .reduce((obj: Record<string, any>, key) => {
      obj[key] = req.headers[key];
      return obj;
    }, {});

  const essentialResponseHeaders = ['content-type', 'content-length', 'cache-control'];
  const resHeaders = res.getHeaders();
  const filteredResHeaders = Object.keys(resHeaders)
    .filter((key) => essentialResponseHeaders.includes(key.toLowerCase()))
    .reduce((obj: Record<string, any>, key) => {
      obj[key] = resHeaders[key];
      return obj;
    }, {});

  return {
    request: {
      headers: filteredReqHeaders,
      method: req.method,
      path: req.baseUrl + req.url,
      body: redactLogData(truncateBody(req.body)),
      params: req?.params,
      query: req?.query,
      clientIp: req?.headers[HTTPHeaders.ForwardedFor] ?? req?.socket.remoteAddress,
    },
    response: {
      headers: filteredResHeaders,
      statusCode: res.statusCode,
      requestDuration,
      body: redactLogData(truncateBody(responseBody)),
    },
  };
}

function truncateBody(body: any) {
  if (!body) return body;

  // If it's a string and too long, truncate it
  if (typeof body === 'string' && body.length > 500) {
    return body.substring(0, 500) + '... [truncated]';
  }

  // If it's an object, process it recursively but watch for large arrays
  if (typeof body === 'object' && body !== null) {
    // Deep clone to avoid modifying the original
    const clone = JSON.parse(JSON.stringify(body));

    // Handle arrays specially to avoid excessive logging
    if (Array.isArray(clone) && clone.length > 5) {
      return [...clone.slice(0, 5), `... and ${clone.length - 5} more items`];
    }

    for (const key in clone) {
      clone[key] = truncateBody(clone[key]);
    }
    return clone;
  }

  return body;
}

const sensitiveKeysList = Object.values(SensitiveKeys) as string[];
function redactLogData(data: any): any {
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map((item) => redactLogData(item));
    }

    const redactedData: any = {};
    for (const key in data) {
      if (sensitiveKeysList.includes(key)) {
        redactedData[key] = SpecialMessages.Redacted;
      } else {
        // Recursively redact sensitive keys within nested objects
        redactedData[key] = redactLogData(data[key]);
      }
    }

    return redactedData;
  } else {
    return data;
  }
}
