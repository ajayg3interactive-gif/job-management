import { z } from 'zod';

const PHONE_PATTERN = /^[0-9\s+\-()]+$/;

// Mirrors the backend employeeBodySchema (server/src/modules/employees/employees.schema.ts).
export const employeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(191, 'Email must be at most 191 characters')
    .pipe(z.email('Enter a valid email address')),
  // Optional: a blank phone is allowed and saved as empty.
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || (value.length >= 7 && value.length <= 20), {
      error: 'Phone must be 7 to 20 characters',
    })
    .refine((value) => value === '' || PHONE_PATTERN.test(value), {
      error: 'Phone may only contain digits, spaces and + - ( )',
    }),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
