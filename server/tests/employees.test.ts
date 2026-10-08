import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
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

const valid = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ann Lee',
  email: 'ann@example.com',
  phone: '+1 (555) 123-4567',
  ...overrides,
});

const createEmployee = async (overrides: Record<string, unknown> = {}) => {
  const res = await agent.post('/api/employees').send(valid(overrides));
  expect(res.status).toBe(201);
  return res.body as { id: number; name: string; email: string; isActive: boolean };
};

const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);

describe('POST /api/employees', () => {
  it('creates an active employee and returns it', async () => {
    const res = await agent.post('/api/employees').send(valid());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Ann Lee',
      email: 'ann@example.com',
      phone: '+1 (555) 123-4567',
      isActive: true,
    });
    expect(typeof res.body.id).toBe('number');
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('trims the name and lower-cases the email', async () => {
    const res = await agent.post('/api/employees').send(valid({ name: '  Ann Lee ', email: ' ANN@Example.COM ' }));
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ann Lee');
    expect(res.body.email).toBe('ann@example.com');
  });

  it('stores a missing or blank phone as null', async () => {
    const omitted = await agent.post('/api/employees').send({ name: 'A', email: 'a@example.com' });
    const blank = await agent.post('/api/employees').send(valid({ email: 'b@example.com', phone: '  ' }));
    const explicitNull = await agent.post('/api/employees').send(valid({ email: 'c@example.com', phone: null }));

    expect(omitted.body.phone).toBeNull();
    expect(blank.body.phone).toBeNull();
    expect(explicitNull.body.phone).toBeNull();
  });

  it('ignores isActive, id and unknown fields in the body', async () => {
    const res = await agent.post('/api/employees').send(valid({ isActive: false, id: 999, role: 'admin' }));
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
    expect(res.body.id).not.toBe(999);
    expect(res.body).not.toHaveProperty('role');
  });

  it('returns 409 DUPLICATE_EMAIL for an existing email, ignoring case', async () => {
    await createEmployee();
    const res = await agent.post('/api/employees').send(valid({ name: 'Other', email: 'ANN@example.com' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    expect(res.body.error.details[0].field).toBe('email');
    expect(await prisma.employee.count()).toBe(1);
  });

  describe('validation', () => {
    it('rejects a missing name and email', async () => {
      const res = await agent.post('/api/employees').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)).toEqual(expect.arrayContaining(['name', 'email']));
    });

    it('rejects a blank name', async () => {
      const res = await agent.post('/api/employees').send(valid({ name: '   ' }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('name');
    });

    it('rejects a name over 100 characters but accepts exactly 100', async () => {
      const tooLong = await agent.post('/api/employees').send(valid({ name: 'x'.repeat(101) }));
      expect(tooLong.status).toBe(400);
      expect(fieldsOf(tooLong)).toContain('name');

      const exact = await agent.post('/api/employees').send(valid({ name: 'x'.repeat(100) }));
      expect(exact.status).toBe(201);
    });

    it('rejects an invalid email', async () => {
      const res = await agent.post('/api/employees').send(valid({ email: 'not-an-email' }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('email');
    });

    it.each([
      ['too short', '12345'],
      ['too long', '1'.repeat(21)],
      ['letters', '555-CALL-NOW'],
      ['disallowed symbols', '555#1234567'],
    ])('rejects a phone that is %s', async (_label, phone) => {
      const res = await agent.post('/api/employees').send(valid({ phone }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('phone');
    });

    it.each(['1234567', '+44 20 7946 0958', '(555) 123-4567', '1'.repeat(20)])(
      'accepts the phone %s',
      async (phone) => {
        const res = await agent.post('/api/employees').send(valid({ phone }));
        expect(res.status).toBe(201);
      },
    );

    it('rejects a non-text phone', async () => {
      const res = await agent.post('/api/employees').send(valid({ phone: 5551234567 }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('phone');
    });
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee', async () => {
    const created = await createEmployee();
    const res = await agent.get(`/api/employees/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, email: 'ann@example.com' });
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const res = await agent.get('/api/employees/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the id "%s"', async (id) => {
    const res = await agent.get(`/api/employees/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/employees/:id', () => {
  it('updates the employee', async () => {
    const created = await createEmployee();
    const res = await agent
      .put(`/api/employees/${created.id}`)
      .send({ name: 'Ann Smith', email: 'ann.smith@example.com', phone: '5551234567' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      name: 'Ann Smith',
      email: 'ann.smith@example.com',
      phone: '5551234567',
      isActive: true,
    });
  });

  it('clears the phone when it is omitted, blank or null', async () => {
    for (const body of [
      { name: 'Ann', email: 'ann@example.com' },
      { name: 'Ann', email: 'ann@example.com', phone: '' },
      { name: 'Ann', email: 'ann@example.com', phone: null },
    ]) {
      const created = await createEmployee({ email: `e${Math.random()}@example.com` });
      const res = await agent.put(`/api/employees/${created.id}`).send({ ...body, email: created.email });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBeNull();
    }
  });

  it('allows saving with the employee’s own email', async () => {
    const created = await createEmployee();
    const res = await agent.put(`/api/employees/${created.id}`).send(valid({ name: 'Renamed' }));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('returns 409 when the email belongs to another employee', async () => {
    await createEmployee({ email: 'first@example.com' });
    const second = await createEmployee({ name: 'Second', email: 'second@example.com' });

    const res = await agent.put(`/api/employees/${second.id}`).send(valid({ email: 'FIRST@example.com' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');

    const unchanged = await prisma.employee.findUniqueOrThrow({ where: { id: second.id } });
    expect(unchanged.email).toBe('second@example.com');
  });

  it('does not change isActive', async () => {
    const created = await createEmployee();
    await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: false });

    const res = await agent.put(`/api/employees/${created.id}`).send(valid({ isActive: true }));
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.put('/api/employees/99999').send(valid());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an invalid body', async () => {
    const created = await createEmployee();
    const res = await agent.put(`/api/employees/${created.id}`).send(valid({ name: '' }));
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('name');
  });
});

describe('PATCH /api/employees/:id/status', () => {
  it('deactivates and reactivates', async () => {
    const created = await createEmployee();

    const off = await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);

    const on = await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: true });
    expect(on.status).toBe(200);
    expect(on.body.isActive).toBe(true);
  });

  it('is idempotent', async () => {
    const created = await createEmployee();
    const res = await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it.each([{}, { isActive: 'false' }, { isActive: 0 }])('rejects the body %j', async (body) => {
    const created = await createEmployee();
    const res = await agent.patch(`/api/employees/${created.id}/status`).send(body);
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('isActive');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.patch('/api/employees/99999/status').send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it('never hard deletes: the row still exists after deactivation', async () => {
    const created = await createEmployee();
    await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: false });
    expect(await prisma.employee.count()).toBe(1);
  });

  it('keeps the job assignment when an assigned employee is deactivated', async () => {
    const created = await createEmployee();
    const job = await prisma.job.create({
      data: {
        jobNo: 'JOB-001',
        customerName: 'ABC Timber',
        product: 'Standard Pallet',
        quantity: 10,
        priority: 'NORMAL',
        dueDate: new Date('2026-10-12'),
        createdById: adminId,
        assignedEmployeeId: created.id,
      },
    });

    const res = await agent.patch(`/api/employees/${created.id}/status`).send({ isActive: false });
    expect(res.status).toBe(200);

    const after = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
      include: { assignedEmployee: true },
    });
    expect(after.assignedEmployeeId).toBe(created.id);
    expect(after.assignedEmployee?.name).toBe('Ann Lee');
    expect(after.assignedEmployee?.isActive).toBe(false);
  });
});

describe('GET /api/employees (list)', () => {
  const seed = async () => {
    await createEmployee({ name: 'Charlie Brown', email: 'charlie@example.com' });
    await createEmployee({ name: 'Alice Johnson', email: 'alice@work.com' });
    await createEmployee({ name: 'Bob Stone', email: 'bob@example.com' });
    const dana = await createEmployee({ name: 'Dana Joanne', email: 'dana@example.com' });
    await agent.patch(`/api/employees/${dana.id}/status`).send({ isActive: false });
  };

  const names = (res: request.Response): string[] =>
    res.body.data.map((e: { name: string }) => e.name);

  it('returns the paginated shape sorted by name A-Z by default', async () => {
    await seed();
    const res = await agent.get('/api/employees');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 4 });
    expect(names(res)).toEqual(['Alice Johnson', 'Bob Stone', 'Charlie Brown', 'Dana Joanne']);
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      name: 'Alice Johnson',
      email: 'alice@work.com',
      phone: '+1 (555) 123-4567',
      isActive: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns every employee, active and inactive, when no status filter is given', async () => {
    await seed();
    const res = await agent.get('/api/employees');
    expect(res.body.data.map((e: { isActive: boolean }) => e.isActive)).toContain(false);
  });

  it('paginates with the correct total and slices', async () => {
    await seed();
    const page1 = await agent.get('/api/employees?page=1&pageSize=3');
    const page2 = await agent.get('/api/employees?page=2&pageSize=3');
    const page3 = await agent.get('/api/employees?page=3&pageSize=3');

    expect(page1.body).toMatchObject({ page: 1, pageSize: 3, total: 4 });
    expect(names(page1)).toEqual(['Alice Johnson', 'Bob Stone', 'Charlie Brown']);
    expect(names(page2)).toEqual(['Dana Joanne']);
    expect(page3.body.data).toEqual([]);
    expect(page3.body.total).toBe(4);
  });

  it('searches by name, partial and case-insensitive', async () => {
    await seed();
    const res = await agent.get('/api/employees?search=JOHN');
    expect(names(res)).toEqual(['Alice Johnson']);
    expect(res.body.total).toBe(1);
  });

  it('matches the middle of a name', async () => {
    await seed();
    const res = await agent.get('/api/employees?search=oann');
    expect(names(res)).toEqual(['Dana Joanne']);
  });

  it('searches by email', async () => {
    await seed();
    const res = await agent.get('/api/employees?search=work.COM');
    expect(names(res)).toEqual(['Alice Johnson']);
  });

  it.each([['%25'], ['_'], ['%25ice'], ['a_ice']])(
    'treats the wildcard characters in "%s" literally',
    async (search) => {
      await seed();
      const res = await agent.get(`/api/employees?search=${search}`);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    },
  );

  it('still finds a name that contains an underscore or percent sign', async () => {
    await createEmployee({ name: 'Under_score 100%', email: 'weird@example.com' });
    const underscore = await agent.get('/api/employees?search=r_s');
    const percent = await agent.get('/api/employees?search=100%25');
    expect(underscore.body.total).toBe(1);
    expect(percent.body.total).toBe(1);
  });

  it('filters by status', async () => {
    await seed();
    const active = await agent.get('/api/employees?status=active');
    const inactive = await agent.get('/api/employees?status=inactive');

    expect(names(active)).toEqual(['Alice Johnson', 'Bob Stone', 'Charlie Brown']);
    expect(active.body.total).toBe(3);
    expect(names(inactive)).toEqual(['Dana Joanne']);
    expect(inactive.body.total).toBe(1);
  });

  it('combines search, status and paging', async () => {
    await seed();
    const res = await agent.get('/api/employees?search=example&status=active&pageSize=1&page=2');
    expect(res.body.total).toBe(2); // bob and charlie
    expect(names(res)).toEqual(['Charlie Brown']);
  });

  it('ignores a blank search', async () => {
    await seed();
    const res = await agent.get('/api/employees?search=');
    expect(res.body.total).toBe(4);
  });

  it.each([
    'page=0',
    'page=abc',
    'pageSize=0',
    'pageSize=101',
    'status=maybe',
    `search=${'x'.repeat(101)}`,
    'search=a&search=b',
  ])('returns 400 for the query "%s"', async (query) => {
    const res = await agent.get(`/api/employees?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/employees?active=true (dropdown)', () => {
  it('returns only active employees as { id, name }, without pagination', async () => {
    const active = await createEmployee({ name: 'Zed Active', email: 'zed@example.com' });
    const inactive = await createEmployee({ name: 'Ian Inactive', email: 'ian@example.com' });
    await agent.patch(`/api/employees/${inactive.id}/status`).send({ isActive: false });

    const res = await agent.get('/api/employees?active=true');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: active.id, name: 'Zed Active' }]);
  });

  it('is not paginated: returns more than one page of results', async () => {
    for (let i = 0; i < 12; i++) {
      await createEmployee({ name: `Person ${String(i).padStart(2, '0')}`, email: `p${i}@example.com` });
    }
    const res = await agent.get('/api/employees?active=true');
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toEqual({ id: expect.any(Number), name: 'Person 00' });
  });

  it('ignores search, status and paging params', async () => {
    await createEmployee({ name: 'Ann', email: 'ann@example.com' });
    await createEmployee({ name: 'Bob', email: 'bob@example.com' });
    const res = await agent.get('/api/employees?active=true&search=zzz&status=inactive&page=5&pageSize=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it.each(['false', '1', 'yes', ''])('rejects active=%s with 400', async (value) => {
    const res = await agent.get(`/api/employees?active=${value}`);
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('active');
  });
});

describe('GET /api/employees?all=true (filter options)', () => {
  it('returns every employee, active and inactive, as { id, name, isActive }, without pagination', async () => {
    const active = await createEmployee({ name: 'Zed Active', email: 'zed@example.com' });
    const inactive = await createEmployee({ name: 'Ian Inactive', email: 'ian@example.com' });
    await agent.patch(`/api/employees/${inactive.id}/status`).send({ isActive: false });

    const res = await agent.get('/api/employees?all=true');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: inactive.id, name: 'Ian Inactive', isActive: false },
      { id: active.id, name: 'Zed Active', isActive: true },
    ]);
  });

  it('is not paginated and ignores search, status and paging params', async () => {
    for (let i = 0; i < 12; i++) {
      await createEmployee({ name: `Person ${String(i).padStart(2, '0')}`, email: `p${i}@example.com` });
    }
    const res = await agent.get('/api/employees?all=true&search=zzz&status=inactive&page=5&pageSize=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
  });

  it.each(['false', '1', ''])('rejects all=%s with 400', async (value) => {
    const res = await agent.get(`/api/employees?all=${value}`);
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('all');
  });

  it('rejects combining all and active', async () => {
    const res = await agent.get('/api/employees?all=true&active=true');
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('all');
  });
});
