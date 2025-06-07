import { AxiosError, isAxiosError } from 'axios';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();

  if (error instanceof CustomError) {
    if (error instanceof TransientApiError) {
      res.status(error.statusCode).json({
        status: 'error',
        requestId,
        error: {
          code: error.errorCode,
          message: error.message,
          retryAfter: error.retryAfter,
        },
      });
    } else {
      res.status(error.statusCode).json({
        status: 'error',
        requestId,
        error: {
          code: error.errorCode,
          message: error.message,
        },
      });
    }
  } else if (isAxiosError(error) && error.response) {
    const status = error.response.status;

    if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
      const retryAfter = error.response.headers['retry-after']
        ? parseInt(error.response.headers['retry-after'] as string)
        : 60;

      res.status(status).json({
        status: 'error',
        requestId,
        error: {
          message: `External API error: ${error.response.statusText || 'Service currently unavailable'}`,
          retryAfter: retryAfter,
        },
      });
    } else {
      res.status(error.response.status || 500).json({
        status: 'error',
        requestId,
        error: {
          message: `External API error: ${error.response.data?.message || error.message || 'Unknown error'}`,
        },
      });
    }
  } else {
    res.status(500).json({
      status: 'error',
      requestId,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};

export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errorCode: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class TransientApiError extends CustomError {
  constructor(
    message: string,
    public statusCode: number = 503,
    public retryAfter: number = 60,
  ) {
    super(message, statusCode, 'TRANSIENT_API_ERROR');
    Object.setPrototypeOf(this, TransientApiError.prototype);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class NoAffectedRowsError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'NO_AFFECTED_ROWS');
    Object.setPrototypeOf(this, NoAffectedRowsError.prototype);
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, originalError: any) {
    super(message, 500, 'DATABASE_ERROR');
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class NotVerifiedError extends CustomError {
  constructor() {
    super('Email not verified', 400, 'EMAIL_NOT_VERIFIED');
    Object.setPrototypeOf(this, NotVerifiedError.prototype);
  }
}
