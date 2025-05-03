import { Logger, appLogger, formatAppLoggerResponse, getResponseMessage } from '../logger/logger';
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware to intercept HTTP responses and log them
 */
export const responseInterceptor = (req: Request, res: Response, next: NextFunction) => {
  const requestStartTime = Date.now();
  const originalSend = res.send;

  let responseSent = false;
  res.send = function (body: any): Response {
    if (!responseSent) {
      if (res.statusCode < 400) {
        appLogger.info(getResponseMessage(req.method), formatAppLoggerResponse(req, res, body, requestStartTime));
      } else {
        appLogger.error(
          body.message || 'Error processing request',
          formatAppLoggerResponse(req, res, body, requestStartTime),
        );
      }

      responseSent = true;
    }
    return originalSend.call(this, body);
  };
  next();
};

/**
 * Comprehensive request logger middleware
 * This combines request and response logging in a single middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  Logger.logRequest(req, res, next);
};

export default responseInterceptor;
