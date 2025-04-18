// Mock middleware and error classes for external projects

// Error handler middleware mock
export const errorHandler = jest.fn();

// Base error class
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

// Specific error classes
export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, originalError: any) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class TransientApiError extends CustomError {
  constructor(
    message: string,
    public statusCode: number = 503,
    public retryAfter: number = 60,
  ) {
    super(message, statusCode, 'TRANSIENT_API_ERROR');
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class NoAffectedRowsError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'NO_AFFECTED_ROWS');
  }
}
