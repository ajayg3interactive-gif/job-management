// Values must match the Prisma enums in prisma/schema.prisma.

export const JOB_STATUS = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type JobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
export const JOB_STATUS_VALUES = Object.values(JOB_STATUS) as [JobStatusValue, ...JobStatusValue[]];

export const JOB_STATUS_LABELS: Record<JobStatusValue, string> = {
  PENDING: 'Pending',
  IN_PRODUCTION: 'In Production',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// Jobs in these statuses are locked: no edits and no status changes.
export const LOCKED_STATUSES: readonly JobStatusValue[] = [
  JOB_STATUS.COMPLETED,
  JOB_STATUS.CANCELLED,
];

export const JOB_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type JobPriorityValue = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];
export const JOB_PRIORITY_VALUES = Object.values(JOB_PRIORITY) as [
  JobPriorityValue,
  ...JobPriorityValue[],
];

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  JOB_LOCKED: 'JOB_LOCKED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
} as const;

export const REMEMBER_ME_SECONDS = 30 * 24 * 60 * 60;
export const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 10 } as const;
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export const BCRYPT_COST = 10;
export const JSON_BODY_LIMIT = '100kb';
