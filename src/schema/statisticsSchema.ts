import { z } from 'zod';

export const recapQuerySchema = z
  .object({
    period: z.enum(['month', 'year'], {
      error: (issue) => `Period must be either "month" or "year", received "${issue.input}"`,
    }),
    year: z.coerce.number().int().min(1900).max(9999),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((data) => data.period !== 'month' || data.month !== undefined, {
    message: 'month is required when period is "month"',
    path: ['month'],
  });

export type RecapQuery = z.infer<typeof recapQuerySchema>;
