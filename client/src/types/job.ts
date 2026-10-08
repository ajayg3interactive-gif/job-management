export const JOB_STATUS = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

export interface JobAssignee {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Job {
  id: number;
  jobNo: string;
  customerName: string;
  product: string;
  quantity: number;
  priority: JobPriority;
  status: JobStatus;
  assignedEmployee: JobAssignee | null;
  // Date-only values, YYYY-MM-DD.
  startDate: string | null;
  dueDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobListParams {
  search?: string;
  status?: JobStatus;
  priority?: JobPriority;
  employeeId?: number;
  page: number;
  pageSize: number;
}

// The body sent to POST /jobs and PUT /jobs/:id.
export interface JobPayload {
  customerName: string;
  product: string;
  quantity: number;
  priority: JobPriority;
  assignedEmployeeId: number | null;
  startDate: string | null;
  dueDate: string;
  notes: string | null;
}

export interface JobHistoryEntry {
  id: number;
  // null for the creation row.
  oldStatus: JobStatus | null;
  newStatus: JobStatus;
  changedBy: { id: number; name: string };
  createdAt: string;
}
