import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ERROR_CODES, HTTP_STATUS } from '../config/constants.js';
import { env, isProduction } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const errorBody = (code: string, message: string, details: unknown[] = []) => ({
  error: { code, message, details },
});

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorBody(err.code, err.message, err.details));
    return;
  }

  // body-parser errors carry a `type` field.
  if (err?.type === 'entity.parse.failed') {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(errorBody(ERROR_CODES.VALIDATION_ERROR, 'Malformed JSON body'));
    return;
  }

  if (err?.type === 'entity.too.large') {
    res
      .status(HTTP_STATUS.PAYLOAD_TOO_LARGE)
      .json(errorBody(ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body too large'));
    return;
  }

  if (env.NODE_ENV !== 'test' && !isProduction) console.error(err);

  // Never leak internals to the client.
  res
    .status(HTTP_STATUS.INTERNAL)
    .json(errorBody(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
};
