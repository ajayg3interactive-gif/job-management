import { rateLimit } from 'express-rate-limit';
import { LOGIN_RATE_LIMIT } from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  // Lets a test turn the limiter on even though it is off by default under NODE_ENV=test.
  enabled?: boolean;
}

export const createRateLimiter = ({
  windowMs,
  limit,
  enabled = env.NODE_ENV !== 'test',
}: RateLimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !enabled,
    handler: (_req, _res, next) => next(AppError.tooManyRequests()),
  });

export const loginRateLimiter = createRateLimiter(LOGIN_RATE_LIMIT);
