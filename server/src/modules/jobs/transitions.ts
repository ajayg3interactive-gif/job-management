import { JOB_STATUS, type JobStatusValue } from '../../config/constants.js';

// The single source of truth for status changes (docs/business-rules/04-status-workflow.md).
// Completed and Cancelled are terminal. Cancel is allowed from Pending only.
export const ALLOWED_TRANSITIONS: Record<JobStatusValue, readonly JobStatusValue[]> = {
  [JOB_STATUS.PENDING]: [JOB_STATUS.IN_PRODUCTION, JOB_STATUS.CANCELLED],
  [JOB_STATUS.IN_PRODUCTION]: [JOB_STATUS.READY_FOR_DISPATCH],
  [JOB_STATUS.READY_FOR_DISPATCH]: [JOB_STATUS.COMPLETED],
  [JOB_STATUS.COMPLETED]: [],
  [JOB_STATUS.CANCELLED]: [],
};

export const canTransition = (from: JobStatusValue, to: JobStatusValue) =>
  ALLOWED_TRANSITIONS[from].includes(to);
