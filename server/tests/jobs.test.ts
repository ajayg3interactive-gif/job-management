import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma, resetDb } from './helpers/db.js';

const ADMIN = { name: 'Admin', email: 'admin@example.com', password: 'Admin@123' };

type Agent = ReturnType<typeof request.agent>;
let agent: Agent;
let adminId: number;
let activeEmployee: { id: number; name: string };
let inactiveEmployee: { id: number; name: string };

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
  activeEmployee = await prisma.employee.create({
    data: { name: 'Ann Lee', email: 'ann@example.com' },
    select: { id: true, name: true },
  });
  inactiveEmployee = await prisma.employee.create({
    data: { name: 'Ian Gone', email: 'ian@example.com', isActive: false },
    select: { id: true, name: true },
  });
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const validJob = (overrides: Record<string, unknown> = {}) => ({
  customerName: 'ABC Timber',
  product: 'Standard Pallet',
  quantity: 120,
  priority: 'HIGH',
  assignedEmployeeId: activeEmployee.id,
  startDate: '2026-10-08',
  dueDate: '2026-10-12',
  notes: 'Customer requested urgent delivery.',
  ...overrides,
});

const createJob = async (overrides: Record<string, unknown> = {}) => {
  const res = await agent.post('/api/jobs').send(validJob(overrides));
  expect(res.status).toBe(201);
  return res.body as { id: number; jobNo: string };
};

const setStatus = (id: number, status: string) =>
  prisma.job.update({ where: { id }, data: { status: status as 'COMPLETED' } });

const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);

describe('POST /api/jobs', () => {
  it('creates a PENDING job with a generated number and returns the full shape', async () => {
    const res = await agent.post('/api/jobs').send(validJob());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      jobNo: 'JOB-001',
      customerName: 'ABC Timber',
      product: 'Standard Pallet',
      quantity: 120,
      priority: 'HIGH',
      status: 'PENDING',
      assignedEmployee: { id: activeEmployee.id, name: 'Ann Lee', isActive: true },
      startDate: '2026-10-08',
      dueDate: '2026-10-12',
      notes: 'Customer requested urgent delivery.',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('records the logged in admin as created_by', async () => {
    const created = await createJob();
    const row = await prisma.job.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.createdById).toBe(adminId);
  });

  it('writes exactly one history row: null -> PENDING by the admin', async () => {
    const created = await createJob();
    const history = await prisma.jobStatusHistory.findMany({ where: { jobId: created.id } });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldStatus: null,
      newStatus: 'PENDING',
      changedById: adminId,
    });
  });

  it('accepts a job with only the required fields', async () => {
    const res = await agent.post('/api/jobs').send({
      customerName: 'Min Co',
      product: 'Box',
      quantity: 1,
      priority: 'LOW',
      dueDate: '2026-11-01',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      assignedEmployee: null,
      startDate: null,
      notes: null,
    });
  });

  it('trims text and stores blank optional fields as null', async () => {
    const res = await agent
      .post('/api/jobs')
      .send(validJob({ customerName: '  ABC Timber ', notes: '   ', startDate: '', assignedEmployeeId: null }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      customerName: 'ABC Timber',
      notes: null,
      startDate: null,
      assignedEmployee: null,
    });
  });

  describe('job numbers', () => {
    it('are sequential and unique', async () => {
      const numbers = [];
      for (let i = 0; i < 3; i++) numbers.push((await createJob()).jobNo);
      expect(numbers).toEqual(['JOB-001', 'JOB-002', 'JOB-003']);
    });

    it('keep growing past JOB-999', async () => {
      await prisma.jobCounter.update({ where: { id: 1 }, data: { lastNumber: 998 } });
      const numbers = [(await createJob()).jobNo, (await createJob()).jobNo, (await createJob()).jobNo];
      expect(numbers).toEqual(['JOB-999', 'JOB-1000', 'JOB-1001']);
    });

    it('are never duplicated by concurrent creates', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, i) => agent.post('/api/jobs').send(validJob({ customerName: `Customer ${i}` }))),
      );

      expect(responses.map((r) => r.status)).toEqual(Array(10).fill(201));
      const numbers = responses.map((r) => r.body.jobNo as string).sort();
      expect(new Set(numbers).size).toBe(10);
      expect(numbers).toEqual(Array.from({ length: 10 }, (_, i) => `JOB-${String(i + 1).padStart(3, '0')}`));

      const counter = await prisma.jobCounter.findUniqueOrThrow({ where: { id: 1 } });
      expect(counter.lastNumber).toBe(10);
      expect(await prisma.jobStatusHistory.count()).toBe(10);
    });

    it('are not used up by a rejected request', async () => {
      await agent.post('/api/jobs').send(validJob({ assignedEmployeeId: inactiveEmployee.id }));
      await agent.post('/api/jobs').send(validJob({ quantity: 0 }));

      expect((await createJob()).jobNo).toBe('JOB-001');
    });
  });

  describe('fields the request can never set', () => {
    it('ignores status, jobNo, createdBy and id in the body', async () => {
      const res = await agent
        .post('/api/jobs')
        .send(validJob({ status: 'COMPLETED', jobNo: 'JOB-999', createdBy: 999, createdById: 999, id: 999 }));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.jobNo).toBe('JOB-001');
      expect(res.body.id).not.toBe(999);

      const row = await prisma.job.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.createdById).toBe(adminId);
      expect(row.status).toBe('PENDING');
    });
  });

  describe('validation', () => {
    const reject = async (overrides: Record<string, unknown>, field: string) => {
      const res = await agent.post('/api/jobs').send(validJob(overrides));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)).toContain(field);
      expect(await prisma.job.count()).toBe(0);
      expect(await prisma.jobStatusHistory.count()).toBe(0);
    };

    it('rejects an empty body with a message per required field', async () => {
      const res = await agent.post('/api/jobs').send({});
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toEqual(
        expect.arrayContaining(['customerName', 'product', 'quantity', 'priority', 'dueDate']),
      );
    });

    it('rejects a missing or blank customer name', async () => {
      await reject({ customerName: undefined }, 'customerName');
      await reject({ customerName: '   ' }, 'customerName');
    });

    it('rejects a missing or blank product', async () => {
      await reject({ product: undefined }, 'product');
      await reject({ product: '' }, 'product');
    });

    it('limits customer name and product to 150 characters', async () => {
      await reject({ customerName: 'x'.repeat(151) }, 'customerName');
      await reject({ product: 'x'.repeat(151) }, 'product');
      const ok = await agent.post('/api/jobs').send(validJob({ customerName: 'x'.repeat(150), product: 'y'.repeat(150) }));
      expect(ok.status).toBe(201);
    });

    it.each([0, -1, -100, 1.5, 1_000_001, '12', null])('rejects the quantity %j', async (quantity) => {
      await reject({ quantity }, 'quantity');
    });

    it.each([1, 1_000_000])('accepts the quantity %d', async (quantity) => {
      const res = await agent.post('/api/jobs').send(validJob({ quantity }));
      expect(res.status).toBe(201);
    });

    it.each(['URGENT_PLUS', 'low', '', 5, null])('rejects the priority %j', async (priority) => {
      await reject({ priority }, 'priority');
    });

    it('rejects a missing priority', async () => {
      await reject({ priority: undefined }, 'priority');
    });

    it.each(['LOW', 'NORMAL', 'HIGH', 'URGENT'])('accepts the priority %s', async (priority) => {
      const res = await agent.post('/api/jobs').send(validJob({ priority }));
      expect(res.status).toBe(201);
    });

    it('rejects a missing due date', async () => {
      await reject({ dueDate: undefined }, 'dueDate');
      await reject({ dueDate: '' }, 'dueDate');
    });

    it.each(['10/12/2026', '2026-1-5', 'tomorrow', '2026-02-30', '2026-13-01', '2026-10-12T00:00:00Z'])(
      'rejects the due date %s',
      async (dueDate) => {
        await reject({ dueDate }, 'dueDate');
      },
    );

    it('rejects an invalid start date', async () => {
      await reject({ startDate: '2026-02-30' }, 'startDate');
      await reject({ startDate: 'soon' }, 'startDate');
    });

    it('rejects a due date before the start date', async () => {
      await reject({ startDate: '2026-10-12', dueDate: '2026-10-11' }, 'dueDate');
    });

    it('accepts a due date equal to the start date', async () => {
      const res = await agent.post('/api/jobs').send(validJob({ startDate: '2026-10-12', dueDate: '2026-10-12' }));
      expect(res.status).toBe(201);
    });

    it('limits notes to 2000 characters', async () => {
      await reject({ notes: 'n'.repeat(2001) }, 'notes');
      const ok = await agent.post('/api/jobs').send(validJob({ notes: 'n'.repeat(2000) }));
      expect(ok.status).toBe(201);
    });

    it('rejects a non-existent assigned employee', async () => {
      await reject({ assignedEmployeeId: 99999 }, 'assignedEmployeeId');
    });

    it('rejects an inactive assigned employee', async () => {
      const res = await agent.post('/api/jobs').send(validJob({ assignedEmployeeId: inactiveEmployee.id }));
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toEqual({
        field: 'assignedEmployeeId',
        message: 'Assigned employee is inactive',
      });
    });

    it.each([0, -1, 1.5, '3', true])('rejects the assigned employee id %j', async (assignedEmployeeId) => {
      await reject({ assignedEmployeeId }, 'assignedEmployeeId');
    });
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns the job with its assigned employee', async () => {
    const created = await createJob();
    const res = await agent.get(`/api/jobs/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      jobNo: 'JOB-001',
      assignedEmployee: { id: activeEmployee.id, name: 'Ann Lee', isActive: true },
    });
  });

  it('shows an inactive assignee as inactive', async () => {
    const created = await createJob();
    await prisma.employee.update({ where: { id: activeEmployee.id }, data: { isActive: false } });

    const res = await agent.get(`/api/jobs/${created.id}`);
    expect(res.body.assignedEmployee).toEqual({ id: activeEmployee.id, name: 'Ann Lee', isActive: false });
  });

  it('returns null for an unassigned job', async () => {
    const created = await createJob({ assignedEmployeeId: null });
    const res = await agent.get(`/api/jobs/${created.id}`);
    expect(res.body.assignedEmployee).toBeNull();
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const res = await agent.get('/api/jobs/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the id "%s"', async (id) => {
    const res = await agent.get(`/api/jobs/${id}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/jobs (list)', () => {
  // JOB-001 Acme Corp / LOW, JOB-002 Beta Industries / HIGH (Ann), JOB-003 acme tools / URGENT (Ann),
  // JOB-004 Gamma 100%_Co / NORMAL, JOB-005 Delta Works / HIGH (Ian, inactive)
  const seed = async () => {
    const a = await createJob({ customerName: 'Acme Corp', priority: 'LOW', assignedEmployeeId: null });
    const b = await createJob({ customerName: 'Beta Industries', priority: 'HIGH' });
    const c = await createJob({ customerName: 'acme tools', priority: 'URGENT' });
    const d = await createJob({ customerName: 'Gamma 100%_Co', priority: 'NORMAL', assignedEmployeeId: null });
    const e = await createJob({ customerName: 'Delta Works', priority: 'HIGH' });
    await prisma.job.update({ where: { id: e.id }, data: { assignedEmployeeId: inactiveEmployee.id } });
    await setStatus(a.id, 'COMPLETED');
    await setStatus(b.id, 'IN_PRODUCTION');
    await setStatus(c.id, 'IN_PRODUCTION');
    return { a, b, c, d, e };
  };

  const numbers = (res: request.Response): string[] => res.body.data.map((j: { jobNo: string }) => j.jobNo);

  it('returns the paginated shape, newest first', async () => {
    await seed();
    const res = await agent.get('/api/jobs');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 5 });
    expect(numbers(res)).toEqual(['JOB-005', 'JOB-004', 'JOB-003', 'JOB-002', 'JOB-001']);
    expect(res.body.data[2]).toMatchObject({
      jobNo: 'JOB-003',
      customerName: 'acme tools',
      assignedEmployee: { id: activeEmployee.id, name: 'Ann Lee', isActive: true },
      status: 'IN_PRODUCTION',
    });
    expect(res.body.data[4].assignedEmployee).toBeNull();
  });

  it('paginates with the correct total and slices', async () => {
    await seed();
    const p1 = await agent.get('/api/jobs?page=1&pageSize=2');
    const p2 = await agent.get('/api/jobs?page=2&pageSize=2');
    const p3 = await agent.get('/api/jobs?page=3&pageSize=2');
    const p4 = await agent.get('/api/jobs?page=4&pageSize=2');

    expect(p1.body).toMatchObject({ page: 1, pageSize: 2, total: 5 });
    expect(numbers(p1)).toEqual(['JOB-005', 'JOB-004']);
    expect(numbers(p2)).toEqual(['JOB-003', 'JOB-002']);
    expect(numbers(p3)).toEqual(['JOB-001']);
    expect(p4.body.data).toEqual([]);
    expect(p4.body.total).toBe(5);
  });

  describe('search', () => {
    it('matches a full job number', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?search=JOB-002'))).toEqual(['JOB-002']);
    });

    it('matches part of a job number, case-insensitively', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?search=job-00'))).toHaveLength(5);
      expect(numbers(await agent.get('/api/jobs?search=003'))).toEqual(['JOB-003']);
    });

    it('matches part of a customer name, case-insensitively', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?search=ACME'))).toEqual(['JOB-003', 'JOB-001']);
      expect(numbers(await agent.get('/api/jobs?search=industr'))).toEqual(['JOB-002']);
    });

    it('treats % and _ literally', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?search=%25'))).toEqual(['JOB-004']);
      expect(numbers(await agent.get('/api/jobs?search=_'))).toEqual(['JOB-004']);
      expect(numbers(await agent.get('/api/jobs?search=100%25_'))).toEqual(['JOB-004']);
      expect((await agent.get('/api/jobs?search=a_me')).body.total).toBe(0);
    });

    it('ignores a blank search', async () => {
      await seed();
      expect((await agent.get('/api/jobs?search=')).body.total).toBe(5);
    });
  });

  describe('filters', () => {
    it('filters by status', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?status=IN_PRODUCTION'))).toEqual(['JOB-003', 'JOB-002']);
      expect(numbers(await agent.get('/api/jobs?status=COMPLETED'))).toEqual(['JOB-001']);
      expect(numbers(await agent.get('/api/jobs?status=PENDING'))).toEqual(['JOB-005', 'JOB-004']);
      expect((await agent.get('/api/jobs?status=CANCELLED')).body.total).toBe(0);
    });

    it('filters by priority', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?priority=HIGH'))).toEqual(['JOB-005', 'JOB-002']);
      expect(numbers(await agent.get('/api/jobs?priority=URGENT'))).toEqual(['JOB-003']);
    });

    it('filters by assigned employee, including an inactive one', async () => {
      await seed();
      expect(numbers(await agent.get(`/api/jobs?employeeId=${activeEmployee.id}`))).toEqual(['JOB-003', 'JOB-002']);
      expect(numbers(await agent.get(`/api/jobs?employeeId=${inactiveEmployee.id}`))).toEqual(['JOB-005']);
    });

    it('combines search and every filter with AND', async () => {
      await seed();
      expect(numbers(await agent.get('/api/jobs?search=acme&status=IN_PRODUCTION'))).toEqual(['JOB-003']);
      expect(numbers(await agent.get(`/api/jobs?priority=HIGH&employeeId=${activeEmployee.id}`))).toEqual(['JOB-002']);
      expect(
        numbers(await agent.get(`/api/jobs?status=IN_PRODUCTION&priority=URGENT&employeeId=${activeEmployee.id}&search=tools`)),
      ).toEqual(['JOB-003']);
      expect((await agent.get('/api/jobs?search=acme&status=PENDING')).body.total).toBe(0);
    });

    it('keeps the total and paging correct when filtered', async () => {
      await seed();
      const res = await agent.get('/api/jobs?priority=HIGH&pageSize=1&page=2');
      expect(res.body).toMatchObject({ page: 2, pageSize: 1, total: 2 });
      expect(numbers(res)).toEqual(['JOB-002']);
    });
  });

  it.each([
    'page=0',
    'page=abc',
    'pageSize=0',
    'pageSize=101',
    'status=DONE',
    'status=pending',
    'priority=EXTREME',
    'employeeId=abc',
    'employeeId=0',
    'employeeId=-3',
    `search=${'x'.repeat(101)}`,
  ])('returns 400 for the query "%s"', async (query) => {
    const res = await agent.get(`/api/jobs?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/jobs/:id', () => {
  const edit = (overrides: Record<string, unknown> = {}) =>
    validJob({ customerName: 'ABC Timber Ltd', quantity: 200, priority: 'URGENT', ...overrides });

  it('updates the editable fields', async () => {
    const created = await createJob();
    const res = await agent
      .put(`/api/jobs/${created.id}`)
      .send(edit({ assignedEmployeeId: null, startDate: null, dueDate: '2026-11-30', notes: null }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      jobNo: 'JOB-001',
      customerName: 'ABC Timber Ltd',
      quantity: 200,
      priority: 'URGENT',
      assignedEmployee: null,
      startDate: null,
      dueDate: '2026-11-30',
      notes: null,
      status: 'PENDING',
    });
  });

  it('never changes the job number, status or creator, and ignores them in the body', async () => {
    const created = await createJob();
    const res = await agent
      .put(`/api/jobs/${created.id}`)
      .send(edit({ status: 'COMPLETED', jobNo: 'JOB-999', createdBy: 999, createdById: 999 }));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.jobNo).toBe('JOB-001');
    const row = await prisma.job.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('PENDING');
    expect(row.createdById).toBe(adminId);
  });

  it('does not write a history row', async () => {
    const created = await createJob();
    await agent.put(`/api/jobs/${created.id}`).send(edit());
    expect(await prisma.jobStatusHistory.count({ where: { jobId: created.id } })).toBe(1);
  });

  it('works on a job in any open status', async () => {
    for (const status of ['IN_PRODUCTION', 'READY_FOR_DISPATCH']) {
      const created = await createJob();
      await setStatus(created.id, status);
      const res = await agent.put(`/api/jobs/${created.id}`).send(edit());
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  describe('locked jobs', () => {
    it.each(['COMPLETED', 'CANCELLED'])('returns 422 JOB_LOCKED for a %s job and changes nothing', async (status) => {
      const created = await createJob();
      await setStatus(created.id, status);

      const res = await agent.put(`/api/jobs/${created.id}`).send(edit());

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('JOB_LOCKED');
      const row = await prisma.job.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.customerName).toBe('ABC Timber');
      expect(row.quantity).toBe(120);
      expect(row.priority).toBe('HIGH');
    });

    it('locks before validating assignment: a locked job never changes even with a bad body target', async () => {
      const created = await createJob();
      await setStatus(created.id, 'COMPLETED');
      const res = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: inactiveEmployee.id }));
      expect(res.status).toBe(422);
    });
  });

  describe('assigned employee', () => {
    it('saves without changing an assignee who has since been deactivated', async () => {
      const created = await createJob();
      await prisma.employee.update({ where: { id: activeEmployee.id }, data: { isActive: false } });

      const res = await agent.put(`/api/jobs/${created.id}`).send(edit());

      expect(res.status).toBe(200);
      expect(res.body.assignedEmployee).toEqual({ id: activeEmployee.id, name: 'Ann Lee', isActive: false });
    });

    it('rejects switching to an inactive employee', async () => {
      const created = await createJob();
      const res = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: inactiveEmployee.id }));

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('assignedEmployeeId');
      const row = await prisma.job.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.assignedEmployeeId).toBe(activeEmployee.id);
    });

    it('rejects a non-existent employee', async () => {
      const created = await createJob();
      const res = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: 99999 }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('assignedEmployeeId');
    });

    it('allows reassigning to another active employee and clearing the assignment', async () => {
      const other = await prisma.employee.create({ data: { name: 'Bo Chan', email: 'bo@example.com' } });
      const created = await createJob();

      const reassigned = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: other.id }));
      expect(reassigned.body.assignedEmployee).toMatchObject({ id: other.id, name: 'Bo Chan' });

      const cleared = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: null }));
      expect(cleared.body.assignedEmployee).toBeNull();
    });

    it('allows keeping an inactive assignee while assigning nobody else', async () => {
      const created = await createJob();
      await prisma.job.update({ where: { id: created.id }, data: { assignedEmployeeId: inactiveEmployee.id } });

      const res = await agent.put(`/api/jobs/${created.id}`).send(edit({ assignedEmployeeId: inactiveEmployee.id }));
      expect(res.status).toBe(200);
      expect(res.body.assignedEmployee).toMatchObject({ id: inactiveEmployee.id, isActive: false });
    });
  });

  it('applies the same validation as create', async () => {
    const created = await createJob();
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ customerName: '' }, 'customerName'],
      [{ product: undefined }, 'product'],
      [{ quantity: 0 }, 'quantity'],
      [{ quantity: 1.5 }, 'quantity'],
      [{ priority: 'NOPE' }, 'priority'],
      [{ dueDate: undefined }, 'dueDate'],
      [{ startDate: '2026-12-01', dueDate: '2026-11-01' }, 'dueDate'],
      [{ notes: 'n'.repeat(2001) }, 'notes'],
    ];
    for (const [overrides, field] of cases) {
      const res = await agent.put(`/api/jobs/${created.id}`).send(edit(overrides));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain(field);
    }
    const row = await prisma.job.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.customerName).toBe('ABC Timber');
  });

  it('returns 404 for an unknown job and 400 for a bad id', async () => {
    expect((await agent.put('/api/jobs/99999').send(edit())).status).toBe(404);
    expect((await agent.put('/api/jobs/abc').send(edit())).status).toBe(400);
  });
});
