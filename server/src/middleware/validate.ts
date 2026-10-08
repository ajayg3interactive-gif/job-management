import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { AppError, type ErrorDetail } from '../utils/AppError.js';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

const toDetails = (error: z.ZodError): ErrorDetail[] =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

// Validates body, query and params before the controller runs.
// Parsed values replace the originals, so unknown fields are stripped.
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    const details: ErrorDetail[] = [];

    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        details.push(...toDetails(result.error));
        continue;
      }

      // req.query is a getter in Express 5, so redefine it instead of assigning.
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
    }

    if (details.length > 0) return next(AppError.validation(details));
    next();
  };
