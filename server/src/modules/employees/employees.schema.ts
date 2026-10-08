import { z } from 'zod';

const PHONE_PATTERN = /^[0-9\s+\-()]+$/;

const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .max(191, 'Email must be at most 191 characters')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

// Optional. Omitted, null or blank all become null, so a PUT can clear the phone.
const phoneSchema = z
  .string({ error: 'Phone must be text' })
  .nullish()
  .transform((value) => (value == null || value.trim() === '' ? null : value.trim()))
  .pipe(
    z
      .string()
      .min(7, 'Phone must be 7 to 20 characters')
      .max(20, 'Phone must be 7 to 20 characters')
      .regex(PHONE_PATTERN, 'Phone may only contain digits, spaces and + - ( )')
      .nullable(),
  );

// Used for create and edit. isActive is deliberately absent: it changes only through
// the status endpoint, and unknown fields are stripped.
export const employeeBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

export const employeeStatusBodySchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false' }),
});

export const employeeListQuerySchema = z.object({
  // Dropdown modes (no paging): only `true` is accepted for each.
  // active=true -> active employees only. all=true -> every employee, for filters.
  all: z.literal('true', { error: 'all can only be "true"' }).optional(),
  active: z.literal('true', { error: 'active can only be "true"' }).optional(),
  search: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
  status: z.enum(['active', 'inactive'], { error: 'Status must be active or inactive' }).optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be between 1 and 100')
    .max(100, 'Page size must be between 1 and 100')
    .default(10),
}).refine((query) => !(query.active && query.all), {
  error: 'active and all cannot be combined',
  path: ['all'],
});

export type EmployeeBody = z.infer<typeof employeeBodySchema>;
export type EmployeeStatusBody = z.infer<typeof employeeStatusBodySchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
