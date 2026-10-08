import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { JOB_STATUS_VALUES, type JobStatusValue } from '../src/config/constants.js';
import * as jobsService from '../src/modules/jobs/jobs.service.js';
import { ALLOWED_TRANSITIONS } from '../src/modules/jobs/transitions.js';
import { prisma, resetDb } from './helpers/db.js';

const ADMIN = { name: 'Admin', email: 'admin@example.com', password: 'Admin@123' };

type Agent = ReturnType<typeof request.agent>;
let agent: Agent;
let adminId: number;

beforeEach(async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: await bcrypt.hash(ADMIN.password, 4),
    },
  });
  adminId = admin.id;
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createJob = async () => {
  const res = await agent.post('/api/jobs').send({
    customerName: 'ABC Timber',
    product: 'Standard Pallet',
    quantity: 10,
    priority: 'NORMAL',
    dueDate: '2026-10-12',
  });
  expect(res.status).toBe(201);
  return res.body as { id: number };
};

// Creates a job and moves it straight to `status` in the database (no history rows added).
const jobIn = async (status: JobStatusValue) => {
  const job = await createJob();
  await prisma.job.update({ where: { id: job.id }, data: { status } });
  return job.id;
};

const historyCount = (jobId: number) => prisma.jobStatusHistory.count({ where: { jobId } });
const statusOf = async (jobId: number) =>
  (await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status;

const pairs = JOB_STATUS_VALUES.flatMap((from) => JOB_STATUS_VALUES.map((to) => [from, to] as const));
const validPairs = pairs.filter(([from, to]) => ALLOWED_TRANSITIONS[from].includes(to));
const lockedPairs = pairs.filter(([from]) => ALLOWED_TRANSITIONS[from].length === 0);
const invalidPairs = pairs.filter(
  ([from, to]) => ALLOWED_TRANSITIONS[from].length > 0 && !ALLOWED_TRANSITIONS[from].includes(to),
);

describe('POST /api/jobs/:id/status', () => {
  it.each(validPairs)('allows %s -> %s and writes exactly one history row', async (from, to) => {
    const id = await jobIn(from);
    const before = await historyCount(id);

    const res = await agent.post(`/api/jobs/${id}/status`).send({ status: to });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(to);
    expect(await historyCount(id)).toBe(before + 1);

    const latest = await prisma.jobStatusHistory.findFirstOrThrow({
      where: { jobId: id },
      orderBy: { id: 'desc' },
    });
    expect(latest).toMatchObject({ oldStatus: from, newStatus: to, changedById: adminId });
  });

  it.each(invalidPairs)('rejects %s -> %s with 409 and no history row', async (from, to) => {
    const id = await jobIn(from);
    const before = await historyCount(id);

    const res = await agent.post(`/api/jobs/${id}/status`).send({ status: to });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(await statusOf(id)).toBe(from);
    expect(await historyCount(id)).toBe(before);
  });

  it.each(lockedPairs)('rejects %s -> %s with 422 because the job is locked', async (from, to) => {
    const id = await jobIn(from);
    const before = await historyCount(id);

    const res = await agent.post(`/api/jobs/${id}/status`).send({ status: to });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('JOB_LOCKED');
    expect(await statusOf(id)).toBe(from);
    expect(await historyCount(id)).toBe(before);
  });

  it('names both statuses in the invalid transition message', async () => {
    const id = await jobIn('IN_PRODUCTION');
    const res = await agent.post(`/api/jobs/${id}/status`).send({ status: 'CANCELLED' });

    expect(res.body.error.message).toBe('Cannot change status from In Production to Cancelled');
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await agent.post('/api/jobs/99999/status').send({ status: 'IN_PRODUCTION' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['an unknown status', { status: 'SHIPPED' }],
    ['a lowercase status', { status: 'pending' }],
    ['a missing status', {}],
    ['a non-string status', { status: 3 }],
  ])('returns 400 for %s', async (_label, body) => {
    const id = await jobIn('PENDING');
    const res = await agent.post(`/api/jobs/${id}/status`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await historyCount(id)).toBe(1);
  });

  it('returns 400 for a non-numeric job id', async () => {
    const res = await agent.post('/api/jobs/abc/status').send({ status: 'IN_PRODUCTION' });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const id = await jobIn('PENDING');
    const res = await request(app).post(`/api/jobs/${id}/status`).send({ status: 'IN_PRODUCTION' });

    expect(res.status).toBe(401);
    expect(await statusOf(id)).toBe('PENDING');
  });

  it('rolls the status back if the history insert fails', async () => {
    const id = await jobIn('PENDING');
    const before = await historyCount(id);

    // A user id that does not exist breaks the history foreign key.
    await expect(jobsService.changeStatus(id, 'IN_PRODUCTION', adminId + 1000)).rejects.toThrow();

    expect(await statusOf(id)).toBe('PENDING');
    expect(await historyCount(id)).toBe(before);
  });

  it('lets only one of two simultaneous identical changes succeed', async () => {
    const id = await jobIn('PENDING');

    const results = await Promise.all([
      agent.post(`/api/jobs/${id}/status`).send({ status: 'IN_PRODUCTION' }),
      agent.post(`/api/jobs/${id}/status`).send({ status: 'IN_PRODUCTION' }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await statusOf(id)).toBe('IN_PRODUCTION');
    // Creation row (from POST /jobs) plus exactly one change.
    expect(await historyCount(id)).toBe(2);
  });

  it('lets a cancel win over a start when both arrive at once', async () => {
    const id = await jobIn('PENDING');

    const results = await Promise.all([
      agent.post(`/api/jobs/${id}/status`).send({ status: 'IN_PRODUCTION' }),
      agent.post(`/api/jobs/${id}/status`).send({ status: 'CANCELLED' }),
    ]);

    const codes = results.map((r) => r.status).sort();
    expect(codes[0]).toBe(200);
    expect([409, 422]).toContain(codes[1]);
    expect(await historyCount(id)).toBe(2);
  });
});

describe('GET /api/jobs/:id/history', () => {
  it('returns the creation row first, then changes oldest first, with the admin name', async () => {
    const { id } = await createJob();
    await agent.post(`/api/jobs/${id}/status`).send({ status: 'IN_PRODUCTION' });
    await agent.post(`/api/jobs/${id}/status`).send({ status: 'READY_FOR_DISPATCH' });

    const res = await agent.get(`/api/jobs/${id}/history`);

    expect(res.status).toBe(200);
    expect(
      res.body.map((r: { oldStatus: string | null; newStatus: string }) => [r.oldStatus, r.newStatus]),
    ).toEqual([
      [null, 'PENDING'],
      ['PENDING', 'IN_PRODUCTION'],
      ['IN_PRODUCTION', 'READY_FOR_DISPATCH'],
    ]);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      oldStatus: null,
      newStatus: 'PENDING',
      changedBy: { id: adminId, name: ADMIN.name },
      createdAt: expect.any(String),
    });
  });

  it('exposes nothing sensitive about the admin', async () => {
    const { id } = await createJob();
    const res = await agent.get(`/api/jobs/${id}/history`);

    expect(JSON.stringify(res.body)).not.toMatch(/password|email/i);
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await agent.get('/api/jobs/99999/history');
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const { id } = await createJob();
    const res = await request(app).get(`/api/jobs/${id}/history`);
    expect(res.status).toBe(401);
  });

  it('has no endpoint to change or delete history', async () => {
    const { id } = await createJob();
    for (const method of ['put', 'patch', 'delete', 'post'] as const) {
      const res = await agent[method](`/api/jobs/${id}/history`).send({});
      expect([404, 405]).toContain(res.status);
    }
    expect(await historyCount(id)).toBe(1);
  });
});

describe('job edit and status interaction', () => {
  it('does not create a history row when other fields are edited', async () => {
    const { id } = await createJob();
    const res = await agent.put(`/api/jobs/${id}`).send({
      customerName: 'Changed Co',
      product: 'Standard Pallet',
      quantity: 11,
      priority: 'LOW',
      dueDate: '2026-10-20',
    });

    expect(res.status).toBe(200);
    expect(await historyCount(id)).toBe(1);
  });

  it('ignores a status field sent to the edit endpoint', async () => {
    const { id } = await createJob();
    await agent.put(`/api/jobs/${id}`).send({
      customerName: 'ABC Timber',
      product: 'Standard Pallet',
      quantity: 10,
      priority: 'NORMAL',
      dueDate: '2026-10-12',
      status: 'COMPLETED',
    });

    expect(await statusOf(id)).toBe('PENDING');
  });
});
