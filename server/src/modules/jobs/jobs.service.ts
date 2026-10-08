import { Prisma } from '@prisma/client';
import {
  JOB_STATUS,
  JOB_STATUS_LABELS,
  LOCKED_STATUSES,
  type JobStatusValue,
} from '../../config/constants.js';
import { AppError } from '../../utils/AppError.js';
import { formatDateOnly, parseDateOnly } from '../../utils/dates.js';
import { escapeLike } from '../../utils/escapeLike.js';
import { prisma } from '../../utils/prisma.js';
import type { JobBody, JobListQuery } from './jobs.schema.js';
import { canTransition } from './transitions.js';

const jobInclude = {
  assignedEmployee: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.JobInclude;

type JobRow = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

// The API shape: dates as YYYY-MM-DD, no internal columns such as created_by.
const toJobDto = (job: JobRow) => ({
  id: job.id,
  jobNo: job.jobNo,
  customerName: job.customerName,
  product: job.product,
  quantity: job.quantity,
  priority: job.priority,
  status: job.status,
  assignedEmployee: job.assignedEmployee,
  startDate: job.startDate ? formatDateOnly(job.startDate) : null,
  dueDate: formatDateOnly(job.dueDate),
  notes: job.notes,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

const isLocked = (status: JobStatusValue) => LOCKED_STATUSES.includes(status);

// JOB-001 ... JOB-999, then JOB-1000 and so on.
const formatJobNo = (n: number) => `JOB-${String(n).padStart(3, '0')}`;

const jobFields = (input: JobBody) => ({
  customerName: input.customerName,
  product: input.product,
  quantity: input.quantity,
  priority: input.priority,
  assignedEmployeeId: input.assignedEmployeeId,
  startDate: input.startDate ? parseDateOnly(input.startDate) : null,
  dueDate: parseDateOnly(input.dueDate),
  notes: input.notes,
});

// A job can only be newly assigned to an existing, active employee.
async function assertAssignable(tx: Prisma.TransactionClient, employeeId: number | null) {
  if (employeeId === null) return;

  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { isActive: true },
  });
  if (!employee) {
    throw AppError.validation([
      { field: 'assignedEmployeeId', message: 'Assigned employee does not exist' },
    ]);
  }
  if (!employee.isActive) {
    throw AppError.validation([
      { field: 'assignedEmployeeId', message: 'Assigned employee is inactive' },
    ]);
  }
}

export async function create(input: JobBody, userId: number) {
  const job = await prisma.$transaction(async (tx) => {
    await assertAssignable(tx, input.assignedEmployeeId);

    // The atomic increment takes a row lock on the single counter row, so
    // concurrent creates queue up here and each gets its own number.
    // It is done last to hold that lock for as short a time as possible.
    let lastNumber: number;
    try {
      ({ lastNumber } = await tx.jobCounter.update({
        where: { id: 1 },
        data: { lastNumber: { increment: 1 } },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('job_counters row (id = 1) is missing. Run `npx prisma db seed`.');
      }
      throw error;
    }

    const created = await tx.job.create({
      data: {
        ...jobFields(input),
        jobNo: formatJobNo(lastNumber),
        status: JOB_STATUS.PENDING,
        createdById: userId,
      },
      include: jobInclude,
    });

    // First history row, in the same transaction as the job.
    await tx.jobStatusHistory.create({
      data: {
        jobId: created.id,
        oldStatus: null,
        newStatus: JOB_STATUS.PENDING,
        changedById: userId,
      },
    });

    return created;
  });

  return toJobDto(job);
}

export async function list({ search, status, priority, employeeId, page, pageSize }: JobListQuery) {
  const term = search ? escapeLike(search) : undefined;

  // MySQL's default collation makes `contains` case-insensitive.
  const where: Prisma.JobWhereInput = {
    ...(term ? { OR: [{ jobNo: { contains: term } }, { customerName: { contains: term } }] } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      include: jobInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  return { data: rows.map(toJobDto), page, pageSize, total };
}

export async function getById(id: number) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  if (!job) throw AppError.notFound('Job not found');
  return toJobDto(job);
}

export async function changeStatus(id: number, newStatus: JobStatusValue, userId: number) {
  const job = await prisma.$transaction(async (tx) => {
    // Locking read: concurrent changes to the same job queue up here, and each one
    // sees the status the previous one committed (a plain read would use a stale snapshot).
    const rows = await tx.$queryRaw<{ status: JobStatusValue }[]>`
      SELECT status FROM jobs WHERE id = ${id} FOR UPDATE`;
    const current = rows[0]?.status;
    if (!current) throw AppError.notFound('Job not found');

    if (isLocked(current)) throw AppError.jobLocked(JOB_STATUS_LABELS[current]);
    if (!canTransition(current, newStatus)) {
      throw AppError.invalidTransition(JOB_STATUS_LABELS[current], JOB_STATUS_LABELS[newStatus]);
    }

    const updated = await tx.job.update({
      where: { id },
      data: { status: newStatus },
      include: jobInclude,
    });

    // Same transaction as the status change: if this fails, the status rolls back.
    await tx.jobStatusHistory.create({
      data: { jobId: id, oldStatus: current, newStatus, changedById: userId },
    });

    return updated;
  });

  return toJobDto(job);
}

export async function getHistory(id: number) {
  const exists = await prisma.job.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('Job not found');

  const rows = await prisma.jobStatusHistory.findMany({
    where: { jobId: id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      createdAt: true,
      changedBy: { select: { id: true, name: true } },
    },
  });

  return rows;
}

export async function update(id: number, input: JobBody) {
  const job = await prisma.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({
      where: { id },
      select: { status: true, assignedEmployeeId: true },
    });
    if (!existing) throw AppError.notFound('Job not found');
    if (isLocked(existing.status)) throw AppError.jobLocked(JOB_STATUS_LABELS[existing.status]);

    // Saving without changing the assignee must work even if they were deactivated since.
    if (input.assignedEmployeeId !== existing.assignedEmployeeId) {
      await assertAssignable(tx, input.assignedEmployeeId);
    }

    // Conditional update: if the job became Completed or Cancelled after the check
    // above (a concurrent status change), no row matches and the edit is refused.
    const { count } = await tx.job.updateMany({
      where: { id, status: { notIn: [...LOCKED_STATUSES] } },
      data: jobFields(input),
    });
    if (count === 0) {
      const current = await tx.job.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw AppError.notFound('Job not found');
      throw AppError.jobLocked(JOB_STATUS_LABELS[current.status]);
    }

    return tx.job.findUniqueOrThrow({ where: { id }, include: jobInclude });
  });

  return toJobDto(job);
}
