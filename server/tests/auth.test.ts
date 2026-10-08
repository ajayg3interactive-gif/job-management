import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createRateLimiter } from '../src/middleware/rateLimit.js';
import { prisma, resetDb } from './helpers/db.js';

const ADMIN = { name: 'Admin', email: 'admin@example.com', password: 'Admin@123' };
const GENERIC_MESSAGE = 'Invalid email or password';
const DAY = 24 * 60 * 60;

async function createAdmin(overrides: { isActive?: boolean } = {}) {
  return prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: await bcrypt.hash(ADMIN.password, 4),
      ...overrides,
    },
  });
}

const login = (body: Record<string, unknown>) => request(app).post('/api/auth/login').send(body);

const cookiesOf = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
};

const tokenCookie = (res: request.Response) =>
  cookiesOf(res).find((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=`));

const tokenValue = (cookie: string) => cookie.split(';')[0].split('=')[1];

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials, sets an httpOnly cookie and never returns the hash', async () => {
    const admin = await createAdmin();
    const res = await login({ email: ADMIN.email, password: ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: admin.id, name: ADMIN.name, email: ADMIN.email } });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const cookie = tokenCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i); // only in production
  });

  it('returns 401 with the generic message for a wrong password', async () => {
    await createAdmin();
    const res = await login({ email: ADMIN.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe(GENERIC_MESSAGE);
    expect(tokenCookie(res)).toBeUndefined();
  });

  it('returns an identical 401 for an unknown email', async () => {
    await createAdmin();
    const wrongPassword = await login({ email: ADMIN.email, password: 'wrong-password' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('rejects an inactive admin with the same generic 401', async () => {
    await createAdmin({ isActive: false });
    const res = await login({ email: ADMIN.email, password: ADMIN.password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(GENERIC_MESSAGE);
    expect(tokenCookie(res)).toBeUndefined();
  });

  it('matches the email case-insensitively', async () => {
    await createAdmin();
    const res = await login({ email: '  ADMIN@Example.com ', password: ADMIN.password });
    expect(res.status).toBe(200);
  });

  describe('Remember Me', () => {
    it('sets a persistent 30 day cookie and a 30 day token when on', async () => {
      await createAdmin();
      const res = await login({ email: ADMIN.email, password: ADMIN.password, rememberMe: true });

      const cookie = tokenCookie(res)!;
      expect(cookie).toMatch(/Max-Age=2592000/i);

      const payload = jwt.decode(tokenValue(cookie)) as jwt.JwtPayload;
      expect(payload.exp! - payload.iat!).toBe(30 * DAY);
    });

    it('sets a session cookie and a 1 day token when off', async () => {
      await createAdmin();
      const res = await login({ email: ADMIN.email, password: ADMIN.password, rememberMe: false });

      const cookie = tokenCookie(res)!;
      expect(cookie).not.toMatch(/Max-Age/i);
      expect(cookie).not.toMatch(/Expires/i);

      const payload = jwt.decode(tokenValue(cookie)) as jwt.JwtPayload;
      expect(payload.exp! - payload.iat!).toBe(DAY);
    });

    it('defaults to a session cookie when rememberMe is omitted', async () => {
      await createAdmin();
      const res = await login({ email: ADMIN.email, password: ADMIN.password });
      expect(tokenCookie(res)).not.toMatch(/Max-Age/i);
    });
  });

  describe('validation', () => {
    it('rejects a missing email and password with field details', async () => {
      const res = await login({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    });

    it('rejects an invalid email format', async () => {
      const res = await login({ email: 'not-an-email', password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'email' });
    });

    it('rejects an empty password', async () => {
      const res = await login({ email: ADMIN.email, password: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'password' });
    });

    it('rejects a non-boolean rememberMe', async () => {
      const res = await login({ email: ADMIN.email, password: 'x', rememberMe: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'rememberMe' });
    });
  });
});

describe('password storage', () => {
  it('stores bcrypt hashes, never plain text', async () => {
    const admin = await createAdmin();
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });

    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain(ADMIN.password);
    expect(await bcrypt.compare(ADMIN.password, stored.passwordHash)).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged in user without a password hash', async () => {
    const admin = await createAdmin();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: admin.id, name: ADMIN.name, email: ADMIN.email } });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns 401 UNAUTHENTICATED without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${env.COOKIE_NAME}=garbage`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const admin = await createAdmin();
    const forged = jwt.sign({}, 'some-other-secret-value', { subject: String(admin.id) });
    const res = await request(app).get('/api/auth/me').set('Cookie', `${env.COOKIE_NAME}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const admin = await createAdmin();
    const expired = jwt.sign({}, env.JWT_SECRET, { subject: String(admin.id), expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set('Cookie', `${env.COOKIE_NAME}=${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 once the admin is deactivated', async () => {
    const admin = await createAdmin();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    await prisma.user.update({ where: { id: admin.id }, data: { isActive: false } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('returns 401 when the user no longer exists', async () => {
    const admin = await createAdmin();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });

    await prisma.user.delete({ where: { id: admin.id } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie and ends the session', async () => {
    await createAdmin();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);

    const cleared = tokenCookie(res)!;
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(cleared).toMatch(/HttpOnly/i);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('always returns 204, even without a session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(tokenCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe('route protection', () => {
  // Every API route except POST /auth/login and POST /auth/logout must reject
  // unauthenticated requests. Add each new module's routes here as they are built.
  const protectedRoutes: Array<[method: 'get' | 'post' | 'put' | 'patch', path: string]> = [
    ['get', '/api/auth/me'],
    ['get', '/api/employees'],
    ['get', '/api/employees?active=true'],
    ['post', '/api/employees'],
    ['get', '/api/employees/1'],
    ['put', '/api/employees/1'],
    ['patch', '/api/employees/1/status'],
  ];

  it.each(protectedRoutes)('%s %s returns 401 without a cookie', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('login rate limiter', () => {
  it('returns 429 TOO_MANY_REQUESTS in the standard error shape after the limit', async () => {
    const limited = express();
    limited.use(express.json());
    limited.post('/login', createRateLimiter({ windowMs: 60_000, limit: 2, enabled: true }), (_req, res) => {
      res.json({ ok: true });
    });
    limited.use(errorHandler);

    expect((await request(limited).post('/login')).status).toBe(200);
    expect((await request(limited).post('/login')).status).toBe(200);

    const blocked = await request(limited).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.body.error.details).toEqual([]);
  });

  it('is switched off under NODE_ENV=test so other tests are not throttled', async () => {
    await createAdmin();
    for (let i = 0; i < 12; i++) {
      const res = await login({ email: ADMIN.email, password: 'wrong' });
      expect(res.status).toBe(401);
    }
  });
});
