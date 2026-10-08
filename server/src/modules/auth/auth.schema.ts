import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
  // No complexity rules on login, only that it is present.
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
  rememberMe: z.boolean({ error: 'Remember me must be true or false' }).optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
