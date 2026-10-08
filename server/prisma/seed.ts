import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, type JobPriority, type JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Demo credentials only (documented in the README). Change them in real use.
const ADMIN = {
  name: 'Admin',
  email: 'admin@example.com',
  password: 'Admin@123',
};

// The last one is inactive, to try the assignment dropdown filter.
const EMPLOYEES = [
  { name: 'Ravi Kumar', email: 'ravi.kumar@example.com', phone: '+91 98765 43210', isActive: true },
  { name: 'Priya Nair', email: 'priya.nair@example.com', phone: '+91 91234 56780', isActive: true },
  { name: 'Tom Becker', email: 'tom.becker@example.com', phone: '(555) 201-3344', isActive: true },
  { name: 'Maria Lopez', email: 'maria.lopez@example.com', phone: null, isActive: true },
  { name: 'Sam Carter', email: 'sam.carter@example.com', phone: '555 010 7788', isActive: false },
];

interface SeedJob {
  customerName: string;
  product: string;
  quantity: number;
  priority: JobPriority;
  status: JobStatus;
  // Index into EMPLOYEES, or null for unassigned.
  employee: number | null;
  // Due date as a day offset from today: negative = overdue, 0 = today.
  dueInDays: number;
  startOffsetDays: number | null;
  notes: string | null;
}

// Covers every status and priority, unassigned jobs, due soon, overdue and an inactive assignee.
const JOBS: SeedJob[] = [
  { customerName: 'ABC Timber', product: 'Standard Pallet', quantity: 120, priority: 'HIGH', status: 'PENDING', employee: 0, dueInDays: 4, startOffsetDays: -1, notes: 'Customer requested urgent delivery.' },
  { customerName: 'Northwind Logistics', product: 'Euro Pallet', quantity: 300, priority: 'NORMAL', status: 'IN_PRODUCTION', employee: 1, dueInDays: 2, startOffsetDays: -3, notes: null },
  { customerName: 'Greenfield Farms', product: 'Crate Box', quantity: 80, priority: 'URGENT', status: 'READY_FOR_DISPATCH', employee: 2, dueInDays: 1, startOffsetDays: -6, notes: 'Pickup booked for tomorrow morning.' },
  { customerName: 'Delta Packaging', product: 'Wooden Spool', quantity: 45, priority: 'LOW', status: 'COMPLETED', employee: 0, dueInDays: -3, startOffsetDays: -12, notes: null },
  { customerName: 'Orion Retail', product: 'Display Pallet', quantity: 200, priority: 'NORMAL', status: 'PENDING', employee: null, dueInDays: 10, startOffsetDays: null, notes: 'Waiting for artwork approval.' },
  { customerName: 'Summit Hardware', product: 'Heavy Duty Pallet', quantity: 60, priority: 'HIGH', status: 'IN_PRODUCTION', employee: 1, dueInDays: -2, startOffsetDays: -9, notes: 'Behind schedule: timber delivery was late.' },
  { customerName: 'Bluewave Exports', product: 'Export Crate', quantity: 150, priority: 'URGENT', status: 'PENDING', employee: 3, dueInDays: 0, startOffsetDays: 0, notes: null },
  { customerName: 'Harvest Foods', product: 'Produce Bin', quantity: 500, priority: 'NORMAL', status: 'COMPLETED', employee: 2, dueInDays: -10, startOffsetDays: -20, notes: null },
  { customerName: 'Metro Builders', product: 'Pallet Collar', quantity: 90, priority: 'LOW', status: 'CANCELLED', employee: 4, dueInDays: 6, startOffsetDays: null, notes: 'Cancelled by the customer.' },
  { customerName: 'Alpine Furniture', product: 'Custom Crate', quantity: 25, priority: 'HIGH', status: 'READY_FOR_DISPATCH', employee: 3, dueInDays: 3, startOffsetDays: -5, notes: null },
  { customerName: 'Sunrise Bakery', product: 'Half Pallet', quantity: 400, priority: 'NORMAL', status: 'IN_PRODUCTION', employee: null, dueInDays: 7, startOffsetDays: -2, notes: null },
  { customerName: 'Coastal Marine', product: 'Marine Crate', quantity: 35, priority: 'URGENT', status: 'PENDING', employee: 4, dueInDays: -1, startOffsetDays: -4, notes: 'Assigned before the employee was deactivated.' },
];

// The status path a job took to reach its current status (cancel is only from Pending).
const STATUS_PATH: Record<JobStatus, JobStatus[]> = {
  PENDING: ['PENDING'],
  IN_PRODUCTION: ['PENDING', 'IN_PRODUCTION'],
  READY_FOR_DISPATCH: ['PENDING', 'IN_PRODUCTION', 'READY_FOR_DISPATCH'],
  COMPLETED: ['PENDING', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'COMPLETED'],
  CANCELLED: ['PENDING', 'CANCELLED'],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const formatJobNo = (n: number) => `JOB-${String(n).padStart(3, '0')}`;

// A UTC-midnight date `offsetDays` from today, as stored in the DATE columns.
function dateOffset(offsetDays: number): Date {
  const today = new Date();
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return new Date(midnight + offsetDays * DAY_MS);
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN.password, 10);

  return prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { name: ADMIN.name, passwordHash, isActive: true },
    create: { name: ADMIN.name, email: ADMIN.email, passwordHash },
  });
}

async function seedEmployees() {
  const ids: number[] = [];
  for (const employee of EMPLOYEES) {
    // update is empty so re-running never undoes changes made in the app.
    const row = await prisma.employee.upsert({
      where: { email: employee.email },
      update: {},
      create: employee,
    });
    ids.push(row.id);
  }
  return ids;
}

async function seedJobs(adminId: number, employeeIds: number[]) {
  const now = Date.now();
  let created = 0;

  for (const [index, job] of JOBS.entries()) {
    const jobNo = formatJobNo(index + 1);
    if (await prisma.job.findUnique({ where: { jobNo }, select: { id: true } })) continue;

    // Oldest job first, so the list shows newest first in the order above reversed.
    const createdAt = new Date(now - (JOBS.length - index) * DAY_MS);
    const path = STATUS_PATH[job.status];

    // The job and its history rows go in together, like the real create and status flow.
    await prisma.$transaction(async (tx) => {
      const row = await tx.job.create({
        data: {
          jobNo,
          customerName: job.customerName,
          product: job.product,
          quantity: job.quantity,
          priority: job.priority,
          status: job.status,
          assignedEmployeeId: job.employee === null ? null : employeeIds[job.employee],
          startDate: job.startOffsetDays === null ? null : dateOffset(job.startOffsetDays),
          dueDate: dateOffset(job.dueInDays),
          notes: job.notes,
          createdById: adminId,
          createdAt,
        },
      });

      await tx.jobStatusHistory.createMany({
        data: path.map((newStatus, step) => ({
          jobId: row.id,
          oldStatus: step === 0 ? null : path[step - 1],
          newStatus,
          changedById: adminId,
          createdAt: new Date(createdAt.getTime() + step * 3 * HOUR_MS),
        })),
      });
    });
    created += 1;
  }

  return created;
}

async function seedCounter() {
  // Single counter row used for job number generation. It must never move backwards,
  // so jobs created in the app keep their numbers when the seed is run again.
  const counter = await prisma.jobCounter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastNumber: JOBS.length },
  });
  if (counter.lastNumber < JOBS.length) {
    await prisma.jobCounter.update({ where: { id: 1 }, data: { lastNumber: JOBS.length } });
  }
}

async function main() {
  const admin = await seedAdmin();
  const employeeIds = await seedEmployees();
  const created = await seedJobs(admin.id, employeeIds);
  await seedCounter();

  console.log(
    `Seeded admin ${ADMIN.email}, ${EMPLOYEES.length} employees, ${created} new jobs (of ${JOBS.length}) and the job counter.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
