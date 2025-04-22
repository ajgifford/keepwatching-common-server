import { CustomError, TransientApiError, errorHandler } from '@middleware/errorMiddleware';
import { AxiosError } from 'axios';
import { NextFunction, Request, Response } from 'express';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-request-id'),
}));

// AxiosError mock helper
const mockAxiosError = (message: string, code = 'ERR_BAD_REQUEST', status = 400): AxiosError => {
  return {
    name: 'AxiosError',
    message,
    code,
    config: {},
    isAxiosError: true,
    toJSON: () => ({}),
    response: {
      status,
      statusText: 'Error',
      headers: {},
      config: {},
      data: {
        error: message,
      },
    },
    request: {},
  } as AxiosError;
};

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('handles CustomError', () => {
    const error = new CustomError('Custom error', 400, 'CUSTOM_ERROR');

    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      requestId: 'test-request-id',
      error: {
        code: 'CUSTOM_ERROR',
        message: 'Custom error',
      },
    });
  });

  it('handles TransientApiError', () => {
    const error = new TransientApiError('Transient error', 503, 30);

    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      requestId: 'test-request-id',
      error: {
        code: 'TRANSIENT_API_ERROR',
        message: 'Transient error',
        retryAfter: 30,
      },
    });
  });

  it('handles retryable AxiosError', () => {
    const error = mockAxiosError('Service unavailable', 'ERR_BAD_RESPONSE', 503);

    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      requestId: 'test-request-id',
      error: {
        message: 'External API error: Error',
        retryAfter: 60,
      },
    });
  });

  it('handles non-retryable AxiosError', () => {
    const error = mockAxiosError('Bad request error', 'ERR_BAD_REQUEST', 400);

    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      requestId: 'test-request-id',
      error: {
        message: 'External API error: Bad request error',
      },
    });
  });

  it('handles unknown errors', () => {
    const error = new Error('Unknown');

    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      requestId: 'test-request-id',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});
