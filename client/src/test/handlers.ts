import { http, HttpResponse } from 'msw';
import { API } from './server';

export const ADMIN = { id: 1, name: 'Admin', email: 'admin@example.com' };

// GET /auth/me for a signed-in admin, so a test can open a protected page.
export const authenticatedMe = () =>
  http.get(`${API}/auth/me`, () => HttpResponse.json({ user: ADMIN }));

export const apiError = (status: number, code: string, message: string, details: unknown[] = []) =>
  HttpResponse.json({ error: { code, message, details } }, { status });
