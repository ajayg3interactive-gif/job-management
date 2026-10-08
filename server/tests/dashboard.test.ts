import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import type { JobStatusValue } from '../src/config/constants.js';
import { getDashboard } from '../src/modules/dashboard/dashboard.service.js';
import { prisma, resetDb } from './helpers/db.js';

const ADMIN = { name: 'Admin', email: 'admin@example.com', password: 'Admin@123' };

type Agent = ReturnType<typeof request.agent>;
let agent: Agent;
let adminId: number;
let counter = 0;

beforeEach(async () => {
  await resetDb();
  counter = 0;
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

const DAY = 24 * 60 * 60 * 1000;
const dateOnly = (offsetDays: number, from = new Date()) =>
  new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()) + offsetDays * DAY)
    .toISOString()
    .slice(0, 10);

interface JobSeed {
  status?: JobStatusValue;
  dueInDays?: number;
  createdAt?: Date;
  customerName?: string;
}

const seedJob = async ({ status = 'PENDING', dueInDays = 30, createdAt, customerName }: JobSeed = {}) => {
  counter += 1;
  return prisma.job.create({
    data: {
      jobNo: `JOB-${String(counter).padStart(3, '0')}`,
      customerName: customerName ?? `Customer ${counter}`,
      product: 'Pallet',
      quantity: 10,
      priority: 'NORMAL',
      status,
      dueDate: new Date(`${dateOnly(dueInDays)}T00:00:00.000Z`),
      createdById: adminId,
      ...(createdAt ? { createdAt } : {}),
    },
  });
};

const get = () => agent.get('/api/dashboard');

describe('GET /api/dashboard', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns zero counts and empty lists when there are no jobs', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      counts: { total: 0, pending: 0, inProduction: 0, readyForDispatch: 0, completed: 0, cancelled: 0 },
      recentJobs: [],
      dueSoon: [],
    });
  });

  it('counts jobs per status and the total equals their sum', async () => {
    const statuses: JobStatusValue[] = [
      'PENDING',
      'PENDING',
      'PENDING',
      'IN_PRODUCTION',
      'IN_PRODUCTION',
      'READY_FOR_DISPATCH',
      'COMPLETED',
      'CANCELLED',
      'CANCELLED',
    ];
    for (const status of statuses) await seedJob({ status });

    const { counts } = (await get()).body;

    expect(counts).toEqual({
      total: 9,
      pending: 3,
      inProduction: 2,
      readyForDispatch: 1,
      completed: 1,
      cancelled: 2,
    });
    expect(counts.total).toBe(
      counts.pending + counts.inProduction + counts.readyForDispatch + counts.completed + counts.cancelled,
    );
  });

  it('counts match the job list for each status', async () => {
    for (const status of ['PENDING', 'IN_PRODUCTION', 'IN_PRODUCTION', 'COMPLETED'] as const) {
      await seedJob({ status });
    }

    const { counts } = (await get()).body;
    const listTotal = async (status: string) =>
      (await agent.get('/api/jobs').query({ status })).body.total;

    expect(counts.pending).toBe(await listTotal('PENDING'));
    expect(counts.inProduction).toBe(await listTotal('IN_PRODUCTION'));
    expect(counts.completed).toBe(await listTotal('COMPLETED'));
    expect(counts.total).toBe((await agent.get('/api/jobs')).body.total);
  });

  describe('recent jobs', () => {
    it('returns at most 5, newest first, with the documented fields', async () => {
      const base = Date.now() - 10 * 60 * 1000;
      for (let i = 0; i < 7; i += 1) {
        await seedJob({ createdAt: new Date(base + i * 60 * 1000), customerName: `Job ${i}` });
      }

      const { recentJobs } = (await get()).body;

      expect(recentJobs.map((j: { customerName: string }) => j.customerName)).toEqual([
        'Job 6',
        'Job 5',
        'Job 4',
        'Job 3',
        'Job 2',
      ]);
      expect(recentJobs[0]).toEqual({
        id: expect.any(Number),
        jobNo: 'JOB-007',
        customerName: 'Job 6',
        status: 'PENDING',
        dueDate: dateOnly(30),
      });
    });

    it('includes locked jobs', async () => {
      await seedJob({ status: 'COMPLETED' });
      await seedJob({ status: 'CANCELLED' });

      const { recentJobs } = (await get()).body;
      expect(recentJobs).toHaveLength(2);
    });
  });

  describe('due soon', () => {
    it('includes open jobs due today through today + 7 days and excludes later ones', async () => {
      await seedJob({ dueInDays: 0, customerName: 'today' });
      await seedJob({ dueInDays: 7, customerName: 'day 7' });
      await seedJob({ dueInDays: 8, customerName: 'day 8' });
      await seedJob({ dueInDays: 60, customerName: 'far' });

      const { dueSoon } = (await get()).body;

      expect(dueSoon.map((j: { customerName: string }) => j.customerName)).toEqual(['today', 'day 7']);
    });

    it.each(['PENDING', 'IN_PRODUCTION', 'READY_FOR_DISPATCH'] as const)('includes %s jobs', async (status) => {
      await seedJob({ status, dueInDays: 2 });
      expect((await get()).body.dueSoon).toHaveLength(1);
    });

    it.each(['COMPLETED', 'CANCELLED'] as const)('excludes %s jobs, even when overdue', async (status) => {
      await seedJob({ status, dueInDays: 2 });
      await seedJob({ status, dueInDays: -3 });
      expect((await get()).body.dueSoon).toEqual([]);
    });

    it('lists overdue jobs first, marked overdue, then upcoming by due date', async () => {
      await seedJob({ dueInDays: 5, customerName: 'in 5' });
      await seedJob({ dueInDays: -1, customerName: 'late 1' });
      await seedJob({ dueInDays: 0, customerName: 'today' });
      await seedJob({ dueInDays: -20, customerName: 'late 20' });

      const { dueSoon } = (await get()).body;

      expect(
        dueSoon.map((j: { customerName: string; isOverdue: boolean }) => [j.customerName, j.isOverdue]),
      ).toEqual([
        ['late 20', true],
        ['late 1', true],
        ['today', false],
        ['in 5', false],
      ]);
      expect(dueSoon[0]).toEqual({
        id: expect.any(Number),
        jobNo: expect.any(String),
        customerName: 'late 20',
        status: 'PENDING',
        priority: 'NORMAL',
        dueDate: dateOnly(-20),
        isOverdue: true,
      });
    });

    it('is capped at 10 rows', async () => {
      for (let i = 0; i < 13; i += 1) await seedJob({ dueInDays: i % 7 });
      expect((await get()).body.dueSoon).toHaveLength(10);
    });
  });
});

describe('getDashboard(now)', () => {
  it('uses the UTC date of the given time as today', async () => {
    const now = new Date('2026-10-08T23:30:00.000Z');
    const seed = (due: string, customerName: string) =>
      prisma.job.create({
        data: {
          jobNo: `JOB-${(counter += 1)}`,
          customerName,
          product: 'Pallet',
          quantity: 1,
          priority: 'LOW',
          dueDate: new Date(`${due}T00:00:00.000Z`),
          createdById: adminId,
        },
      });
    await seed('2026-10-07', 'yesterday');
    await seed('2026-10-08', 'today');
    await seed('2026-10-15', 'edge');
    await seed('2026-10-16', 'outside');

    const { dueSoon } = await getDashboard(now);

    expect(dueSoon.map((j) => [j.customerName, j.isOverdue])).toEqual([
      ['yesterday', true],
      ['today', false],
      ['edge', false],
    ]);
  });
});
