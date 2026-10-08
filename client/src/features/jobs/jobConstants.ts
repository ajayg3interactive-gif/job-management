import { JOB_PRIORITY, JOB_STATUS, type JobPriority, type JobStatus } from '../../types/job';

export const JOBS_PAGE_SIZE = 10;

export const JOB_STATUSES: readonly JobStatus[] = [
  JOB_STATUS.PENDING,
  JOB_STATUS.IN_PRODUCTION,
  JOB_STATUS.READY_FOR_DISPATCH,
  JOB_STATUS.COMPLETED,
  JOB_STATUS.CANCELLED,
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: 'Pending',
  IN_PRODUCTION: 'In Production',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// Completed and Cancelled jobs are locked: they cannot be edited or have their status changed.
const LOCKED_STATUSES: readonly JobStatus[] = [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED];
export const isJobLocked = (status: JobStatus) => LOCKED_STATUSES.includes(status);

export const JOB_PRIORITIES: readonly JobPriority[] = [
  JOB_PRIORITY.LOW,
  JOB_PRIORITY.NORMAL,
  JOB_PRIORITY.HIGH,
  JOB_PRIORITY.URGENT,
];

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

// Badge colors come from the theme tokens (Tailwind needs the full class names here).
export const JOB_STATUS_BADGE_CLASSES: Record<JobStatus, string> = {
  PENDING: 'bg-warning/15 text-warning',
  IN_PRODUCTION: 'bg-accent/15 text-accent',
  READY_FOR_DISPATCH: 'bg-secondary/25 text-text',
  COMPLETED: 'bg-success/15 text-success',
  CANCELLED: 'bg-text-muted/15 text-text-muted',
};

export const JOB_PRIORITY_BADGE_CLASSES: Record<JobPriority, string> = {
  LOW: 'bg-text-muted/15 text-text-muted',
  NORMAL: 'bg-accent/15 text-accent',
  HIGH: 'bg-warning/15 text-warning',
  URGENT: 'bg-danger/15 text-danger',
};
