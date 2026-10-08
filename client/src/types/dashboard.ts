import type { JobPriority, JobStatus } from './job';

export interface DashboardCounts {
  total: number;
  pending: number;
  inProduction: number;
  readyForDispatch: number;
  completed: number;
  cancelled: number;
}

export interface DashboardRecentJob {
  id: number;
  jobNo: string;
  customerName: string;
  status: JobStatus;
  // Date-only value, YYYY-MM-DD.
  dueDate: string;
}

export interface DashboardDueSoonJob extends DashboardRecentJob {
  priority: JobPriority;
  isOverdue: boolean;
}

export interface Dashboard {
  counts: DashboardCounts;
  recentJobs: DashboardRecentJob[];
  dueSoon: DashboardDueSoonJob[];
}
