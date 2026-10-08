import { z } from 'zod';

// Shared by every route with an `:id` path param.
export const idParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Id must be a positive integer' })
    .int('Id must be a positive integer')
    .positive('Id must be a positive integer'),
});

// req.params after validation. Controllers read the id through this.
export type IdParams = z.infer<typeof idParamsSchema>;
