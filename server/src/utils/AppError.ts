import {
  ERROR_CODES,
  HTTP_STATUS,
  INVALID_CREDENTIALS_MESSAGE,
  type ErrorCode,
} from '../config/constants.js';

export interface ErrorDetail {
  field?: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(details: ErrorDetail[], message = 'Validation failed') {
    return new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, message);
  }

  static invalidCredentials() {
    return new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_CREDENTIALS,
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.TOO_MANY_REQUESTS, message);
  }
}
