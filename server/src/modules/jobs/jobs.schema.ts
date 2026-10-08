import { z } from 'zod';
import { JOB_PRIORITY_VALUES, JOB_STATUS_VALUES } from '../../config/constants.js';
import { isRealDateOnly } from '../../utils/dates.js';

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const dateOnly = (label: string) =>
  z.string().refine(isRealDateOnly, { error: `${label} must be a valid date (YYYY-MM-DD)` });

// Optional text: omitted, null or blank all become null.
const blankToNull = (value: string | null | undefined) =>
  value == null || value.trim() === '' ? null : value.trim();

const startDateSchema = z
  .string({ error: 'Start date must be a valid date (YYYY-MM-DD)' })
  .nullish()
  .transform(blankToNull)
  .pipe(dateOnly('Start date').nullable());

const dueDateSchema = z
  .string({ error: 'Due date is required' })
  .trim()
  .min(1, 'Due date is required')
  .pipe(dateOnly('Due date'));

const notesSchema = z
  .string({ error: 'Notes must be text' })
  .max(2000, 'Notes must be at most 2000 characters')
  .nullish()
  .transform(blankToNull);

const assignedEmployeeIdSchema = z
  .number({ error: 'Assigned employee must be a valid employee id' })
  .int('Assigned employee must be a valid employee id')
  .positive('Assigned employee must be a valid employee id')
  .nullish()
  .transform((value) => value ?? null);

// Used for create and edit. status, jobNo and createdBy are deliberately absent:
// unknown fields are stripped, so they can never be set from a request body.
export const jobBodySchema = z
  .object({
    customerName: requiredText('Customer name', 150),
    product: requiredText('Product', 150),
    quantity: z
      .number({ error: 'Quantity is required and must be a number' })
      .int('Quantity must be a whole number')
      .gt(0, 'Quantity must be greater than 0')
      .max(1_000_000, 'Quantity must be at most 1,000,000'),
    priority: z.enum(JOB_PRIORITY_VALUES, {
      error: (issue) =>
        issue.input === undefined
          ? 'Priority is required'
          : `Priority must be one of ${JOB_PRIORITY_VALUES.join(', ')}`,
    }),
    assignedEmployeeId: assignedEmployeeIdSchema,
    startDate: startDateSchema,
    dueDate: dueDateSchema,
    notes: notesSchema,
  })
  // YYYY-MM-DD strings compare correctly as text. Equal dates are allowed.
  .refine((job) => job.startDate === null || job.dueDate >= job.startDate, {
    error: 'Due date cannot be before the start date',
    path: ['dueDate'],
  });

export const jobListQuerySchema = z.object({
  search: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
  status: z.enum(JOB_STATUS_VALUES, { error: 'Invalid status' }).optional(),
  priority: z.enum(JOB_PRIORITY_VALUES, { error: 'Invalid priority' }).optional(),
  employeeId: z.coerce
    .number({ error: 'Employee id must be a positive integer' })
    .int('Employee id must be a positive integer')
    .positive('Employee id must be a positive integer')
    .optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be between 1 and 100')
    .max(100, 'Page size must be between 1 and 100')
    .default(10),
});

export type JobBody = z.infer<typeof jobBodySchema>;
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
