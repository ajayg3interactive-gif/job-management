import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { getUserFromToken } from '../modules/auth/auth.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token: unknown = req.cookies?.[env.COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) throw AppError.unauthenticated();

  const user = await getUserFromToken(token);
  if (!user) throw AppError.unauthenticated();

  req.user = user;
  next();
});
