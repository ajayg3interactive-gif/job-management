import { Router } from 'express';
import { loginRateLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as authController from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

// Deliberately not behind requireAuth: logging out must always clear the cookie,
// even when the session has already expired.
authRouter.post('/logout', authController.logout);

authRouter.get('/me', requireAuth, authController.me);
