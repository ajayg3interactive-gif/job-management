import type { CookieOptions, Request, Response } from 'express';
import { HTTP_STATUS, REMEMBER_ME_SECONDS } from '../../config/constants.js';
import { env, isProduction } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import type { LoginInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
};

export async function login(req: Request, res: Response) {
  const input = req.body as LoginInput;
  const { user, token } = await authService.login(input);

  res.cookie(env.COOKIE_NAME, token, {
    ...baseCookieOptions,
    // No maxAge makes it a session cookie that ends when the browser closes.
    ...(input.rememberMe ? { maxAge: REMEMBER_ME_SECONDS * 1000 } : {}),
  });
  res.status(HTTP_STATUS.OK).json({ user });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(env.COOKIE_NAME, baseCookieOptions);
  res.status(HTTP_STATUS.NO_CONTENT).send();
}

export function me(req: Request, res: Response) {
  // requireAuth always sets req.user before this runs.
  if (!req.user) throw AppError.unauthenticated();
  res.status(HTTP_STATUS.OK).json({ user: req.user });
}
