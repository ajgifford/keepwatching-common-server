import { HTTPHeaders, SensitiveKeys, SpecialMessages } from './loggerModel';
import { Request, Response } from 'express';

export const formatHTTPLoggerResponse = (req: Request, res: Response, responseBody: any, requestStartTime?: number) => {
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

  const truncateBody = (body: any) => {
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
  };

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
};

const sensitiveKeysList = Object.values(SensitiveKeys) as string[];
const redactLogData = (data: any): any => {
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
};
