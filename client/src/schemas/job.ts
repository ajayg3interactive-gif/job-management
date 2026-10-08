import { z } from 'zod';
import { JOB_PRIORITY } from '../types/job';
import type { JobPayload, JobPriority } from '../types/job';

const PRIORITY_VALUES: readonly string[] = Object.values(JOB_PRIORITY);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

// Mirrors the backend jobBodySchema (server/src/modules/jobs/jobs.schema.ts).
// Every field is a string here because that is what the inputs hold; toJobPayload converts.
export const jobSchema = z
  .object({
    customerName: requiredText('Customer name', 150),
    product: requiredText('Product', 150),
    quantity: z
      .string()
      .trim()
      .min(1, 'Quantity is required')
      .refine((value) => /^-?\d+$/.test(value), { error: 'Quantity must be a whole number' })
      .refine((value) => Number(value) > 0, { error: 'Quantity must be greater than 0' })
      .refine((value) => Number(value) <= 1_000_000, { error: 'Quantity must be at most 1,000,000' }),
    // '' until chosen, so it is a string here and narrowed to JobPriority in toJobPayload.
    priority: z.string().refine((value) => PRIORITY_VALUES.includes(value), { error: 'Priority is required' }),
    // '' means unassigned.
    assignedEmployeeId: z.string(),
    startDate: z
      .string()
      .refine((value) => value === '' || isRealDate(value), { error: 'Start date must be a valid date' }),
    dueDate: z
      .string()
      .min(1, 'Due date is required')
      .refine(isRealDate, { error: 'Due date must be a valid date' }),
    notes: z.string().max(2000, 'Notes must be at most 2000 characters'),
  })
  // YYYY-MM-DD strings compare correctly as text. Equal dates are allowed.
  .refine((job) => job.startDate === '' || !isRealDate(job.dueDate) || job.dueDate >= job.startDate, {
    error: 'Due date cannot be before the start date',
    path: ['dueDate'],
  });

export type JobFormValues = z.infer<typeof jobSchema>;

export function toJobPayload(values: JobFormValues): JobPayload {
  return {
    customerName: values.customerName,
    product: values.product,
    quantity: Number(values.quantity),
    // Safe: jobSchema only accepts the JobPriority values.
    priority: values.priority as JobPriority,
    assignedEmployeeId: values.assignedEmployeeId ? Number(values.assignedEmployeeId) : null,
    startDate: values.startDate || null,
    dueDate: values.dueDate,
    notes: values.notes.trim() || null,
  };
}
