import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validate } from '../src/middleware/validate.js';
import { AppError } from '../src/utils/AppError.js';

describe('app foundation', () => {
  it('serves the health check under /api', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.details).toEqual([]);
  });

  it('returns 400 VALIDATION_ERROR for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validate middleware and error handler', () => {
  const testApp = express();
  testApp.use(express.json());

  const bodySchema = z.object({
    quantity: z.number().int().gt(0, 'Quantity must be greater than 0'),
  });
  const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

  testApp.post('/items', validate({ body: bodySchema }), (req, res) => {
    res.json(req.body);
  });
  testApp.get('/items', validate({ query: querySchema }), (req, res) => {
    res.json(req.query);
  });
  testApp.get('/boom', () => {
    throw new Error('secret internal detail');
  });
  testApp.get('/conflict', (_req, _res, next) => {
    next(new AppError(409, 'DUPLICATE_EMAIL', 'Email already exists'));
  });
  testApp.use(errorHandler);

  it('returns 400 with field-level details on invalid body', async () => {
    const res = await request(testApp).post('/items').send({ quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ field: 'quantity', message: 'Quantity must be greater than 0' }],
    });
  });

  it('strips unknown body fields', async () => {
    const res = await request(testApp).post('/items').send({ quantity: 3, status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ quantity: 3 });
  });

  it('validates and coerces query params', async () => {
    const ok = await request(testApp).get('/items?page=2');
    expect(ok.body).toEqual({ page: 2 });

    const bad = await request(testApp).get('/items?page=0');
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('page');
  });

  it('maps AppError to its status and code', async () => {
    const res = await request(testApp).get('/conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('returns a generic 500 without leaking internals', async () => {
    const res = await request(testApp).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
