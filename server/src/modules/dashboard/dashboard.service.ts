import { JOB_STATUS, LOCKED_STATUSES, type JobStatusValue } from '../../config/constants.js';
import { formatDateOnly, parseDateOnly } from '../../utils/dates.js';
import { prisma } from '../../utils/prisma.js';
import { DUE_SOON_DAYS, DUE_SOON_LIMIT, RECENT_JOBS_LIMIT } from './dashboard.constants.js';
import type { DashboardCounts, DashboardResponse } from './dashboard.schema.js';

const OPEN_STATUSES = Object.values(JOB_STATUS).filter(
  (status) => !LOCKED_STATUSES.includes(status),
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const recentSelect = {
  id: true,
  jobNo: true,
  customerName: true,
  status: true,
  dueDate: true,
} as const;

// `now` is a parameter so the date logic can be tested without faking the clock.
export async function getDashboard(now: Date = new Date()): Promise<DashboardResponse> {
  // "Today" is the server's UTC date. Due dates are stored as UTC dates.
  const today = parseDateOnly(formatDateOnly(now));
  const windowEnd = new Date(today.getTime() + DUE_SOON_DAYS * MS_PER_DAY);

  const [grouped, recent, dueSoon] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.job.findMany({
      select: recentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_JOBS_LIMIT,
    }),
    // Oldest due date first, so overdue jobs come before the upcoming ones.
    prisma.job.findMany({
      where: { status: { in: OPEN_STATUSES }, dueDate: { lte: windowEnd } },
      select: { ...recentSelect, priority: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: DUE_SOON_LIMIT,
    }),
  ]);

  const countOf = (status: JobStatusValue) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;

  const counts: DashboardCounts = {
    pending: countOf(JOB_STATUS.PENDING),
    inProduction: countOf(JOB_STATUS.IN_PRODUCTION),
    readyForDispatch: countOf(JOB_STATUS.READY_FOR_DISPATCH),
    completed: countOf(JOB_STATUS.COMPLETED),
    cancelled: countOf(JOB_STATUS.CANCELLED),
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
  };

  return {
    counts,
    recentJobs: recent.map((job) => ({ ...job, dueDate: formatDateOnly(job.dueDate) })),
    dueSoon: dueSoon.map((job) => ({
      ...job,
      dueDate: formatDateOnly(job.dueDate),
      isOverdue: job.dueDate < today,
    })),
  };
}
